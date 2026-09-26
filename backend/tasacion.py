"""Modelo de tasación Varela (portado del tasador web, mismos valores).

Precio de PUBLICACIÓN (referencia de portales) = valor central ± apertura.
Precio VARELA (recomendado de cierre) = publicación × coeficiente (~0.83).
La config (51 parámetros) se guarda en Mongo `tasador_config` y es editable
desde VERA (panel de config), sin depender del Supabase externo.
"""
from __future__ import annotations

import math
from motor.motor_asyncio import AsyncIOMotorClient

import config as appconfig

_client: AsyncIOMotorClient | None = None

# Valores base del modelo Varela (Costa del Este · Mar del Tuyú).
SEED: dict[str, float] = {
    "add_deck": 0.02, "add_depto_estac_cubierto": 0.06, "add_depto_estac_descubierto": 0.025,
    "add_estac_cubierto": 0.04, "add_estac_descubierto": 0.015, "add_galeria_semi": 0.025,
    "add_pileta": 0.06, "add_quincho": 0.03,
    "coef_varela_min": 0.83, "coef_varela_max": 0.83,
    "mult_ant_estrenar": 1.12, "mult_ant_hasta10": 1.0, "mult_ant_10a25": 0.92, "mult_ant_mas25": 0.82,
    "mult_est_excelente": 1.12, "mult_est_muybueno": 1.05, "mult_est_bueno": 1.0, "mult_est_reciclar": 0.78,
    "mult_serv_gas": 1.1, "mult_serv_cloacas": 1.05,
    "mult_vista_frente": 1.2, "mult_vista_lateral": 1.0, "mult_vista_contra": 0.85,
    "mult_cercania_mar": 1.10,
    "precio_constr_economica": 850, "precio_constr_estandar": 1150, "precio_constr_estandar_plus": 1240,
    "precio_constr_superior": 1325, "precio_constr_premium": 1500,
    "precio_depto_1amb": 2200, "precio_depto_2amb": 2000, "precio_depto_3amb": 1850, "precio_depto_4amb": 1700,
    # Precio de lote por zona (USD/m²). Mapa de zonificación de Costa del Este (2026-08):
    # 16 zonas internas + 6 avenidas/calles que funcionan como zona propia por su zonificación.
    # Arrancan en 0 a propósito: el usuario los calibra zona por zona desde VERA (Tasador → Config).
    "precio_lote_pensamientos_sur": 0, "precio_lote_pensamientos_centro": 0, "precio_lote_pensamientos_norte": 0,
    "precio_lote_cristo_sur": 0, "precio_lote_cristo_centro": 0, "precio_lote_cristo_norte": 0,
    "precio_lote_centro_sur": 0, "precio_lote_centro": 0, "precio_lote_centro_norte": 0,
    "precio_lote_reserva_residencial": 0, "precio_lote_reserva_comercial": 0,
    "precio_lote_premium": 0, "precio_lote_premium_norte": 0,
    "precio_lote_playa": 0, "precio_lote_playa_norte": 0, "precio_lote_comercial_ruta": 0,
    "precio_lote_av_costanera": 0, "precio_lote_av2": 0, "precio_lote_av_interbalnearia": 0,
    "precio_lote_camelias": 0, "precio_lote_los_pensamientos": 0, "precio_lote_los_alelies": 0,
    "rango_apertura": 0.04,
}

# Zonas viejas (renombradas) → nueva clave, para migrar valores ya calibrados sin perderlos.
_MIGRACION_ZONAS = {"reserva_multif": "reserva_comercial", "alelies": "los_alelies"}

# Mapa de zonificación de Costa del Este: zona (valor usado en los selects) → sufijo de config
# (identidad, ambos son el mismo slug). Se mantiene el dict por compatibilidad con `tasar()`.
ZONA_SUFIJO = {
    "pensamientos_sur": "pensamientos_sur", "pensamientos_centro": "pensamientos_centro", "pensamientos_norte": "pensamientos_norte",
    "cristo_sur": "cristo_sur", "cristo_centro": "cristo_centro", "cristo_norte": "cristo_norte",
    "centro_sur": "centro_sur", "centro": "centro", "centro_norte": "centro_norte",
    "reserva_residencial": "reserva_residencial", "reserva_comercial": "reserva_comercial",
    "premium": "premium", "premium_norte": "premium_norte",
    "playa": "playa", "playa_norte": "playa_norte", "comercial_ruta": "comercial_ruta",
    "av_costanera": "av_costanera", "av2": "av2", "av_interbalnearia": "av_interbalnearia",
    "camelias": "camelias", "los_pensamientos": "los_pensamientos", "los_alelies": "los_alelies",
}
NOMBRE_ZONA = {
    "pensamientos_sur": "Zona Pensamientos Sur", "pensamientos_centro": "Zona Pensamientos Centro", "pensamientos_norte": "Zona Pensamientos Norte",
    "cristo_sur": "Zona Cristo Sur", "cristo_centro": "Zona Cristo Centro", "cristo_norte": "Zona Cristo Norte",
    "centro_sur": "Zona Centro Sur", "centro": "Zona Centro", "centro_norte": "Zona Centro Norte",
    "reserva_residencial": "La Reserva Residencial", "reserva_comercial": "La Reserva Comercial",
    "premium": "Zona Premium", "premium_norte": "Zona Premium Norte",
    "playa": "Zona Playa", "playa_norte": "Zona Playa Norte", "comercial_ruta": "Zona Comercial Ruta",
    "av_costanera": "Av. Costanera", "av2": "Av. 2", "av_interbalnearia": "Av. Interbalnearia",
    "camelias": "Las Camelias", "los_pensamientos": "Los Pensamientos", "los_alelies": "Los Alelies",
}
NOMBRE_TIPO = {"casa": "Casa", "duplex": "Duplex", "lote": "Lote / Terreno", "depto": "Departamento"}


def _col():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(appconfig.MONGO_URL)
    return _client[appconfig.DB_NAME]["tasador_config"]


async def get_config() -> dict[str, float]:
    doc = await _col().find_one({"_id": "varela"})
    if not doc:
        await _col().update_one({"_id": "varela"}, {"$set": {"values": SEED}}, upsert=True)
        return dict(SEED)
    stored = doc.get("values") or {}
    merged = {**SEED, **stored}
    # Migra valores ya calibrados de zonas renombradas (mismo lugar, nueva clave).
    for vieja, nueva in _MIGRACION_ZONAS.items():
        campo_viejo, campo_nuevo = f"precio_lote_{vieja}", f"precio_lote_{nueva}"
        if stored.get(campo_viejo) and not stored.get(campo_nuevo):
            merged[campo_nuevo] = stored[campo_viejo]
    return merged


async def set_config(values: dict[str, float]) -> dict[str, float]:
    merged = {**(await get_config()), **{k: float(v) for k, v in values.items()}}
    merged = {k: merged[k] for k in SEED}
    await _col().update_one({"_id": "varela"}, {"$set": {"values": merged}}, upsert=True)
    return merged


def _manuales_col():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(appconfig.MONGO_URL)
    return _client[appconfig.DB_NAME]["tasaciones_manuales"]


async def save_manual(doc: dict) -> dict:
    key = {"_id": doc["_id"]}
    update = {"$set": {k: v for k, v in doc.items() if k not in ("_id", "createdAt")},
              "$setOnInsert": {"createdAt": doc["createdAt"]}}
    await _manuales_col().update_one(key, update, upsert=True)
    return doc


async def list_manuales(limit: int = 100) -> list[dict]:
    return [d async for d in _manuales_col().find({}).sort("createdAt", -1).limit(limit)]


async def delete_manual(manual_id: str) -> bool:
    res = await _manuales_col().delete_one({"_id": manual_id})
    return res.deleted_count > 0


def _r500(n: float, modo: str) -> int:
    paso = 500
    if modo == "down":
        return int(math.floor(n / paso) * paso)
    if modo == "up":
        return int(math.ceil(n / paso) * paso)
    return int(round(n / paso) * paso)


def tasar(inp: dict, cfg: dict) -> dict:
    def v(clave: str, default: float = 0.0) -> float:
        val = cfg.get(clave)
        return float(val) if val is not None else default

    tipo = inp.get("tipo", "casa")
    zsuf = ZONA_SUFIJO.get(inp.get("zona", "playa"), "playa")
    breakdown: list[dict] = []
    base = 0.0

    if tipo == "depto":
        m2 = float(inp.get("cubiertos") or 0)
        amb = str(inp.get("ambientes") or "2")
        amb_key = "4amb" if amb == "4" else f"{amb}amb"
        pm2 = v(f"precio_depto_{amb_key}")
        base = m2 * pm2
        breakdown.append({"paso": f"m² × precio depto {amb_key}", "valor": base})
        vmap = {"frente": "mult_vista_frente", "lateral": "mult_vista_lateral", "contrafrente": "mult_vista_contra"}
        base *= v(vmap.get(inp.get("vista"), "mult_vista_lateral"), 1)
        amap = {"estrenar": "mult_ant_estrenar", "reciente": "mult_ant_hasta10", "antiguo": "mult_ant_10a25"}
        base *= v(amap.get(inp.get("antDepto"), "mult_ant_hasta10"), 1)
        extra = (v("add_depto_estac_cubierto") if inp.get("estacCub") else 0) + \
                (v("add_depto_estac_descubierto") if inp.get("estacDesc") else 0)
        if extra:
            base *= (1 + extra)
    else:
        cub = float(inp.get("cubiertos") or 0)
        lote = float(inp.get("lote") or 0)
        if tipo == "lote":
            pm2 = v(f"precio_lote_{zsuf}")
            base = lote * pm2
            breakdown.append({"paso": f"m² lote × precio lote {zsuf}", "valor": base})
        else:
            calidad = inp.get("calidad") or "estandar"
            pconstr = v(f"precio_constr_{calidad}")
            plote = v(f"precio_lote_{zsuf}")
            vconstr = cub * pconstr
            m2libre = max(0.0, lote - cub)
            vlote = m2libre * plote
            base = vconstr + vlote
            breakdown.append({"paso": f"construcción ({cub}m² × {pconstr})", "valor": vconstr})
            breakdown.append({"paso": f"lote libre ({m2libre:.0f}m² × {plote})", "valor": vlote})
            amap = {"estrenar": "mult_ant_estrenar", "hasta10": "mult_ant_hasta10",
                    "diez25": "mult_ant_10a25", "mas25": "mult_ant_mas25"}
            base *= v(amap.get(inp.get("antiguedad"), "mult_ant_hasta10"), 1)
            emap = {"excelente": "mult_est_excelente", "muybueno": "mult_est_muybueno", "bueno": "mult_est_bueno", "reciclar": "mult_est_reciclar"}
            base *= v(emap.get(inp.get("estado"), "mult_est_bueno"), 1)
        if inp.get("gas"):
            base *= v("mult_serv_gas", 1)
        if inp.get("cloacas"):
            base *= v("mult_serv_cloacas", 1)
        suma = sum([
            v("add_pileta") if inp.get("pileta") else 0,
            v("add_quincho") if inp.get("quincho") else 0,
            v("add_deck") if inp.get("deck") else 0,
            v("add_estac_cubierto") if inp.get("estacCub") else 0,
            v("add_estac_descubierto") if inp.get("estacDesc") else 0,
            v("add_galeria_semi") if inp.get("galeria") else 0,
        ])
        if suma:
            base *= (1 + suma)

    # Cercanía al mar (≤200m): aplica a cualquier tipo, es un atributo de ubicación.
    if inp.get("cercaniaMar"):
        base *= v("mult_cercania_mar", 1.10)

    apertura = v("rango_apertura", 0.04)
    cmin = v("coef_varela_min", 0.83)
    cmax = v("coef_varela_max", 0.83)
    pub_min = _r500(base * (1 - apertura), "down")
    pub_max = _r500(base * (1 + apertura), "up")
    cierre_min = _r500(base * (1 - apertura) * cmin, "down")
    cierre_max = _r500(base * (1 + apertura) * cmax, "up")

    return {
        "precioBase": round(base),
        "pubMin": pub_min, "pubMax": pub_max,
        "cierreMin": cierre_min, "cierreMax": cierre_max,
        "coef": cmax, "apertura": apertura,
        "zonaNombre": NOMBRE_ZONA.get(inp.get("zona"), inp.get("zona")),
        "tipoNombre": NOMBRE_TIPO.get(tipo, tipo),
        "breakdown": breakdown,
    }
