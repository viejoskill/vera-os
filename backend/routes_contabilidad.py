"""Contabilidad general de la inmobiliaria (`/api/contabilidad`).

Módulo SOLO admin. Consolida:
- Ingresos automáticos: comisiones de alquiler (movimientos `comision` del módulo
  Alquileres), en su moneda original (según la reserva).
- Ingresos y gastos manuales: comisiones de venta, sueldos, aportes, impuestos,
  servicios, etc. (colección `contabilidad`).

Todo se separa por moneda (ARS / USD), sin mezclar. Las categorías por defecto
se pueden ampliar con categorías propias (colección `contabilidad_categorias`).
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

import config as appconfig

router = APIRouter(prefix="/contabilidad", tags=["contabilidad"])

_client: AsyncIOMotorClient | None = None

# Categorías por defecto (además de las que cargue el usuario).
DEFAULT_CATS: dict[str, list[str]] = {
    "ingreso": ["Comisión venta", "Otros ingresos"],
    "gasto": ["Sueldos", "Aportes", "Impuestos", "Servicios", "Otros"],
}
# Etiqueta de la comisión de alquiler automática (no editable, viene de Alquileres).
CAT_COMISION_ALQ = "Comisión alquiler"

MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]


def _db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(appconfig.MONGO_URL)
    return _client[appconfig.DB_NAME]


def _col():
    return _db()["contabilidad"]


def _cats():
    return _db()["contabilidad_categorias"]


def _rec():
    return _db()["contabilidad_recurrentes"]


def _ventas():
    return _db()["venta_comisiones"]


async def _prop_status(pid: str):
    """Devuelve (status, propiedad) de una propiedad de venta (Supabase). None si no existe."""
    from property_repository import property_repository
    p = await property_repository.get(pid)
    return (p.get("status") if p else None), p


async def _prop_map() -> dict:
    from property_repository import property_repository
    rows = await property_repository.list_properties(status="all")
    return {r["id"]: r for r in rows}


def _estado_por_status(pstatus: str | None) -> str:
    if pstatus == "sold":
        return "confirmada"
    if pstatus == "reserved":
        return "reserva"
    return "descartar"


def _pad(n: int) -> str:
    return f"{int(n):02d}"


def _rango_meses(desde: str, hasta: str, cap: int = 25) -> list[str]:
    """Lista de meses 'YYYY-MM' entre desde y hasta (inclusive), acotada a los `cap` más recientes."""
    try:
        y, m = (int(x) for x in desde.split("-")[:2])
        y2, m2 = (int(x) for x in hasta.split("-")[:2])
    except Exception:
        return []
    out: list[str] = []
    while (y, m) <= (y2, m2) and len(out) < 400:
        out.append(f"{y}-{_pad(m)}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return out[-cap:] if len(out) > cap else out


def _movs():
    return _db()["rental_movimientos"]


def _res():
    return _db()["rental_reservations"]


def _rprops():
    return _db()["rental_properties"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm_moneda(m: str | None) -> str:
    return "USD" if (m or "").upper() == "USD" else "ARS"


# ------------------------------- Modelos -------------------------------- #
class EntryBody(BaseModel):
    fecha: str
    tipo: str  # "ingreso" | "gasto"
    categoria: str
    moneda: str = "ARS"
    monto: float
    descripcion: str | None = ""


class CategoryBody(BaseModel):
    nombre: str
    tipo: str  # "ingreso" | "gasto"


class RecurrenteBody(BaseModel):
    tipo: str = "gasto"  # "ingreso" | "gasto"
    categoria: str
    moneda: str = "ARS"
    monto: float
    descripcion: str | None = ""
    diaMes: int = 1
    desde: str  # YYYY-MM (mes en que empieza a aplicarse)
    activo: bool = True


class RecurrentePatch(BaseModel):
    monto: float | None = None
    descripcion: str | None = None
    diaMes: int | None = None
    activo: bool | None = None


def _entry_out(d: dict) -> dict:
    return {
        "id": d["_id"], "fecha": d.get("fecha"), "tipo": d.get("tipo"),
        "categoria": d.get("categoria"), "moneda": d.get("moneda", "ARS"),
        "monto": d.get("monto"), "descripcion": d.get("descripcion", ""),
        "origen": "manual", "recurrente": bool(d.get("recurrenteId")),
        "createdAt": d.get("createdAt"),
    }


# ------------------------------ Categorías ------------------------------ #
@router.get("/categorias")
async def list_categorias():
    ing = list(DEFAULT_CATS["ingreso"])
    gas = list(DEFAULT_CATS["gasto"])
    custom = []
    async for c in _cats().find({}).sort("nombre", 1):
        nombre = c.get("nombre")
        tipo = c.get("tipo")
        custom.append({"id": c["_id"], "nombre": nombre, "tipo": tipo})
        if tipo == "ingreso" and nombre not in ing:
            ing.append(nombre)
        elif tipo == "gasto" and nombre not in gas:
            gas.append(nombre)
    return {"ingreso": ing, "gasto": gas, "custom": custom}


@router.post("/categorias", status_code=201)
async def add_categoria(body: CategoryBody):
    nombre = (body.nombre or "").strip()
    if not nombre:
        raise HTTPException(400, "Nombre requerido")
    if body.tipo not in ("ingreso", "gasto"):
        raise HTTPException(400, "Tipo inválido")
    if nombre in DEFAULT_CATS.get(body.tipo, []) or nombre == CAT_COMISION_ALQ:
        raise HTTPException(400, "Esa categoría ya existe")
    exists = await _cats().find_one({"nombre": nombre, "tipo": body.tipo})
    if exists:
        raise HTTPException(400, "Esa categoría ya existe")
    doc = {"_id": uuid4().hex, "nombre": nombre, "tipo": body.tipo, "createdAt": _now()}
    await _cats().insert_one(doc)
    return {"id": doc["_id"], "nombre": nombre, "tipo": body.tipo}


@router.delete("/categorias/{cid}", status_code=204)
async def del_categoria(cid: str):
    await _cats().delete_one({"_id": cid})


# ------------------------- Gastos/ingresos fijos ------------------------ #
def _rec_out(r: dict) -> dict:
    return {
        "id": r["_id"], "tipo": r.get("tipo"), "categoria": r.get("categoria"),
        "moneda": r.get("moneda", "ARS"), "monto": r.get("monto"),
        "descripcion": r.get("descripcion", ""), "diaMes": r.get("diaMes", 1),
        "desde": r.get("desde"), "activo": bool(r.get("activo", True)),
    }


async def _materializar_recurrentes() -> None:
    """Crea (idempotente) los movimientos de los ítems fijos activos, desde su mes
    de inicio hasta el mes actual. No re-genera un mes ya generado aunque el
    usuario lo haya borrado (respeta la edición manual)."""
    now = datetime.now(timezone.utc)
    mes_actual = f"{now.year}-{_pad(now.month)}"
    async for rec in _rec().find({"activo": True}):
        generados = set(rec.get("generadosMeses") or [])
        meses = _rango_meses(rec.get("desde") or mes_actual, mes_actual, cap=25)
        nuevos = []
        for mk in meses:
            if mk in generados:
                continue
            dia = min(max(int(rec.get("diaMes") or 1), 1), 28)
            await _col().insert_one({
                "_id": uuid4().hex, "fecha": f"{mk}-{_pad(dia)}", "tipo": rec.get("tipo", "gasto"),
                "categoria": rec.get("categoria") or "Otros", "moneda": _norm_moneda(rec.get("moneda")),
                "monto": round(float(rec.get("monto") or 0)), "descripcion": rec.get("descripcion") or "",
                "recurrenteId": rec["_id"], "mes": mk, "createdAt": _now(),
            })
            nuevos.append(mk)
        if nuevos:
            await _rec().update_one({"_id": rec["_id"]}, {"$addToSet": {"generadosMeses": {"$each": nuevos}}})


@router.get("/recurrentes")
async def list_recurrentes():
    return [_rec_out(r) async for r in _rec().find({}).sort("createdAt", -1)]


@router.post("/recurrentes", status_code=201)
async def create_recurrente(body: RecurrenteBody):
    if body.tipo not in ("ingreso", "gasto"):
        raise HTTPException(400, "Tipo inválido")
    if not (body.categoria or "").strip():
        raise HTTPException(400, "Categoría requerida")
    doc = {
        "_id": uuid4().hex, "tipo": body.tipo, "categoria": body.categoria.strip(),
        "moneda": _norm_moneda(body.moneda), "monto": round(float(body.monto or 0)),
        "descripcion": (body.descripcion or "").strip(), "diaMes": min(max(int(body.diaMes or 1), 1), 28),
        "desde": (body.desde or "")[:7], "activo": body.activo, "generadosMeses": [],
        "createdAt": _now(),
    }
    await _rec().insert_one(doc)
    await _materializar_recurrentes()
    return _rec_out(doc)


@router.patch("/recurrentes/{rid}")
async def patch_recurrente(rid: str, body: RecurrentePatch):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "diaMes" in upd:
        upd["diaMes"] = min(max(int(upd["diaMes"]), 1), 28)
    if upd:
        await _rec().update_one({"_id": rid}, {"$set": upd})
    if upd.get("activo"):
        await _materializar_recurrentes()
    doc = await _rec().find_one({"_id": rid})
    return _rec_out(doc) if doc else {}


@router.delete("/recurrentes/{rid}", status_code=204)
async def delete_recurrente(rid: str):
    """Borra la plantilla fija. Los movimientos ya generados se conservan."""
    await _rec().delete_one({"_id": rid})


# ------------------------------ Movimientos ----------------------------- #
@router.get("/movimientos")
async def list_movimientos(
    desde: str = Query(...), hasta: str = Query(...),
    moneda: str | None = None, tipo: str | None = None, categoria: str | None = None,
):
    q: dict = {"fecha": {"$gte": desde, "$lte": hasta}}
    if moneda:
        q["moneda"] = _norm_moneda(moneda)
    if tipo:
        q["tipo"] = tipo
    if categoria:
        q["categoria"] = categoria
    cur = _col().find(q).sort("fecha", -1)
    return [_entry_out(d) async for d in cur]


@router.post("/movimientos", status_code=201)
async def create_movimiento(body: EntryBody):
    if body.tipo not in ("ingreso", "gasto"):
        raise HTTPException(400, "Tipo inválido")
    doc = {
        "_id": uuid4().hex, "fecha": body.fecha, "tipo": body.tipo,
        "categoria": (body.categoria or "").strip() or "Otros",
        "moneda": _norm_moneda(body.moneda), "monto": round(float(body.monto or 0)),
        "descripcion": (body.descripcion or "").strip(), "createdAt": _now(),
    }
    await _col().insert_one(doc)
    return _entry_out(doc)


@router.delete("/movimientos/{mid}", status_code=204)
async def delete_movimiento(mid: str):
    await _col().delete_one({"_id": mid})


# --------------------- Comisiones de venta (por propiedad) -------------- #
class VentaComisionBody(BaseModel):
    propertyId: str
    propertyLabel: str | None = ""
    moneda: str = "USD"
    monto: float
    descripcion: str | None = ""


def _label_prop(p: dict | None) -> str:
    if not p:
        return ""
    code = p.get("code") or p.get("codigo") or ""
    title = p.get("title") or p.get("titulo") or ""
    return f"{code} · {title}".strip(" ·") if code else title


async def _venta_out(d: dict, pstatus: str | None = None, p: dict | None = None) -> dict:
    if pstatus is None:
        pstatus, p = await _prop_status(d.get("propertyId"))
    est = _estado_por_status(pstatus)
    return {
        "id": d["_id"], "propertyId": d.get("propertyId"),
        "propertyLabel": d.get("propertyLabel") or _label_prop(p),
        "moneda": _norm_moneda(d.get("moneda")), "monto": d.get("monto"),
        "descripcion": d.get("descripcion", ""), "estado": est, "status": pstatus,
        "fechaConfirmada": d.get("fechaConfirmada"), "createdAt": d.get("createdAt"),
    }


@router.get("/ventas")
async def list_ventas():
    pmap = await _prop_map()
    out = []
    async for d in _ventas().find({}).sort("createdAt", -1):
        p = pmap.get(d.get("propertyId"))
        pstatus = p.get("status") if p else None
        if _estado_por_status(pstatus) == "descartar":
            # La propiedad ya no está reservada ni vendida: se descarta la comisión.
            await _ventas().delete_one({"_id": d["_id"]})
            continue
        out.append(await _venta_out(d, pstatus, p))
    return out


@router.get("/ventas/by-property/{property_id}")
async def get_venta_by_property(property_id: str):
    d = await _ventas().find_one({"propertyId": property_id})
    if not d:
        return None
    return await _venta_out(d)


@router.post("/ventas", status_code=201)
async def upsert_venta(body: VentaComisionBody):
    if not body.propertyId:
        raise HTTPException(400, "Falta la propiedad")
    key = {"propertyId": body.propertyId}
    await _ventas().update_one(
        key,
        {
            "$set": {
                "propertyLabel": body.propertyLabel or "", "moneda": _norm_moneda(body.moneda),
                "monto": round(float(body.monto or 0)), "descripcion": (body.descripcion or "").strip(),
                "updatedAt": _now(),
            },
            "$setOnInsert": {"_id": uuid4().hex, "createdAt": _now(), **key},
        },
        upsert=True,
    )
    doc = await _ventas().find_one(key)
    return await _venta_out(doc)


@router.delete("/ventas/by-property/{property_id}", status_code=204)
async def delete_venta_by_property(property_id: str):
    await _ventas().delete_one({"propertyId": property_id})


# -------------------------------- Resumen ------------------------------- #
def _blank_cur() -> dict:
    return {"ingresos": 0.0, "gastos": 0.0, "neto": 0.0, "ventasPendientes": 0.0,
            "ingresosPorCat": {}, "gastosPorCat": {}}


def _add(monedas: dict, moneda: str, tipo: str, categoria: str, monto: float):
    m = monedas.setdefault(moneda, _blank_cur())
    monto = float(monto or 0)
    if tipo == "ingreso":
        m["ingresos"] += monto
        m["ingresosPorCat"][categoria] = m["ingresosPorCat"].get(categoria, 0.0) + monto
    else:
        m["gastos"] += monto
        m["gastosPorCat"][categoria] = m["gastosPorCat"].get(categoria, 0.0) + monto


def _mes_key(fecha: str) -> str:
    return (fecha or "")[:7]  # YYYY-MM


def _mes_label(key: str) -> str:
    try:
        y, m = key.split("-")
        return f"{MESES_ES[int(m) - 1]} {y[2:]}"
    except Exception:
        return key


async def _reservas_moneda_map(reserva_ids: set[str]) -> dict[str, str]:
    if not reserva_ids:
        return {}
    out: dict[str, str] = {}
    cur = _res().find({"_id": {"$in": list(reserva_ids)}}, {"moneda": 1})
    async for r in cur:
        out[r["_id"]] = _norm_moneda(r.get("moneda"))
    return out


@router.post("/comisiones/backfill")
async def backfill_comisiones_alquiler():
    """Genera (retroactivo, idempotente) las comisiones de alquiler de reservas ya
    confirmadas cuya propiedad no tenía % de comisión configurado al momento de
    confirmarse, y luego sí se configuró. No duplica (salta si ya existe el movimiento)."""
    generadas = 0
    montos: dict[str, float] = {}
    async for p in _rprops().find({}):
        pct = float(p.get("comisionPct") or 0)
        minima = float(p.get("comisionMinima") or 0)
        if pct <= 0 and minima <= 0:
            continue
        async for r in _res().find({"propertyId": p["_id"], "estado": {"$in": ["confirmada", "encurso", "finalizada"]}}):
            if await _movs().find_one({"reservaId": r["_id"], "tipo": "comision"}):
                continue
            base = float(r.get("montoEstimado") or 0)
            com = max(round(base * pct / 100), minima)
            if com <= 0:
                continue
            moneda = _norm_moneda(r.get("moneda"))
            await _movs().insert_one({
                "_id": uuid4().hex, "propertyId": p["_id"], "reservaId": r["_id"],
                "fecha": r.get("checkIn"), "tipo": "comision", "monto": com, "comisionPct": pct,
                "descripcion": f"Comisión {pct}% · {(r.get('huesped') or {}).get('nombre', '')}".strip(),
                "createdAt": _now(),
            })
            generadas += 1
            montos[moneda] = montos.get(moneda, 0) + com
    return {"generadas": generadas, "montos": {k: round(v) for k, v in montos.items()}}


@router.get("/resumen")
async def resumen(desde: str = Query(...), hasta: str = Query(...)):
    await _materializar_recurrentes()
    monedas: dict[str, dict] = {}
    # Serie mensual: {mesKey: {ARS:{ingresos,gastos}, USD:{...}}}
    mensual: dict[str, dict] = {}
    detalle: list[dict] = []

    def _mensual(mesKey: str, moneda: str, tipo: str, monto: float):
        mk = mensual.setdefault(mesKey, {})
        cur = mk.setdefault(moneda, {"ingresos": 0.0, "gastos": 0.0})
        cur["ingresos" if tipo == "ingreso" else "gastos"] += float(monto or 0)

    # 1) Comisiones de alquiler automáticas (moneda según reserva).
    comisiones = []
    async for mv in _movs().find({"tipo": "comision", "fecha": {"$gte": desde, "$lte": hasta}}):
        comisiones.append(mv)
    mmap = await _reservas_moneda_map({mv.get("reservaId") for mv in comisiones if mv.get("reservaId")})
    for mv in comisiones:
        moneda = mmap.get(mv.get("reservaId"), "ARS")
        monto = float(mv.get("monto") or 0)
        _add(monedas, moneda, "ingreso", CAT_COMISION_ALQ, monto)
        _mensual(_mes_key(mv.get("fecha")), moneda, "ingreso", monto)
        detalle.append({
            "id": mv["_id"], "fecha": mv.get("fecha"), "tipo": "ingreso",
            "categoria": CAT_COMISION_ALQ, "moneda": moneda, "monto": round(monto),
            "descripcion": mv.get("descripcion", ""), "origen": "alquiler",
            "recurrente": False,
        })

    # 2) Movimientos manuales de contabilidad.
    async for d in _col().find({"fecha": {"$gte": desde, "$lte": hasta}}):
        moneda = _norm_moneda(d.get("moneda"))
        tipo = d.get("tipo")
        monto = float(d.get("monto") or 0)
        cat = d.get("categoria") or "Otros"
        _add(monedas, moneda, tipo, cat, monto)
        _mensual(_mes_key(d.get("fecha")), moneda, tipo, monto)
        detalle.append(_entry_out(d))

    # 3) Comisiones de venta (ancladas a la propiedad y su estado en Propiedades).
    #    Vendida ("sold") suma como ingreso; Reservada ("reserved") queda "por
    #    confirmar" (no suma). Cualquier otro estado descarta la comisión.
    pendientes_list = []
    pmap = await _prop_map()
    con_comision_ids: set[str] = set()
    async for d in _ventas().find({}):
        con_comision_ids.add(d.get("propertyId"))
        p = pmap.get(d.get("propertyId"))
        pstatus = p.get("status") if p else None
        est = _estado_por_status(pstatus)
        if est == "descartar":
            await _ventas().delete_one({"_id": d["_id"]})
            continue
        moneda = _norm_moneda(d.get("moneda"))
        monto = float(d.get("monto") or 0)
        etiqueta = d.get("propertyLabel") or _label_prop(p)
        if est == "confirmada":
            fecha = d.get("fechaConfirmada")
            if not fecha:
                # Primera vez que la vemos vendida: fijamos la fecha de confirmación (hoy).
                fecha = datetime.now(timezone.utc).date().isoformat()
                await _ventas().update_one({"_id": d["_id"]}, {"$set": {"fechaConfirmada": fecha}})
            if desde <= fecha <= hasta:
                _add(monedas, moneda, "ingreso", "Comisión venta", monto)
                _mensual(_mes_key(fecha), moneda, "ingreso", monto)
                detalle.append({
                    "id": d["_id"], "fecha": fecha, "tipo": "ingreso",
                    "categoria": "Comisión venta", "moneda": moneda, "monto": round(monto),
                    "descripcion": etiqueta, "origen": "venta", "recurrente": False, "estado": "confirmada",
                })
        else:  # reserva → pendiente de confirmar
            m = monedas.setdefault(moneda, _blank_cur())
            m["ventasPendientes"] += monto
            pendientes_list.append({
                "id": d["_id"], "moneda": moneda, "monto": round(monto),
                "propertyLabel": etiqueta, "descripcion": d.get("descripcion") or "",
            })

    # Propiedades Reservada/Vendida que TODAVÍA no tienen ninguna comisión cargada
    # (aviso para que no se le pase al usuario cargarla desde el Workspace de la propiedad).
    comisiones_faltantes = [
        {"propertyId": pid, "propertyLabel": _label_prop(p), "status": p.get("status"), "tipo": "venta"}
        for pid, p in pmap.items()
        if p.get("status") in ("sold", "reserved") and pid not in con_comision_ids
    ]

    # 4) Alquileres: propiedades con % de comisión en 0 (nunca configurado) que ya tienen
    #    reservas confirmadas sin comisión generada (se generan solas apenas se configura el %
    #    + se usa "Recalcular comisiones de alquiler" para las ya confirmadas).
    async for p in _rprops().find({}):
        pct = float(p.get("comisionPct") or 0)
        minima = float(p.get("comisionMinima") or 0)
        if pct > 0 or minima > 0:
            continue
        n = await _res().count_documents({"propertyId": p["_id"], "estado": {"$in": ["confirmada", "encurso", "finalizada"]}})
        if n > 0:
            comisiones_faltantes.append({
                "propertyId": p["_id"], "propertyLabel": p.get("titulo") or p.get("codigo") or "Propiedad de alquiler",
                "status": "sin_comision", "tipo": "alquiler", "reservas": n,
            })

    # Cierre: neto y redondeos.
    for cur in monedas.values():
        cur["ingresos"] = round(cur["ingresos"])
        cur["gastos"] = round(cur["gastos"])
        cur["neto"] = cur["ingresos"] - cur["gastos"]
        cur["ventasPendientes"] = round(cur["ventasPendientes"])
        cur["ingresosPorCat"] = {k: round(v) for k, v in cur["ingresosPorCat"].items()}
        cur["gastosPorCat"] = {k: round(v) for k, v in cur["gastosPorCat"].items()}

    serie = []
    for mk in sorted(mensual.keys()):
        row = {"mes": mk, "label": _mes_label(mk)}
        for moneda in ("ARS", "USD"):
            cur = mensual[mk].get(moneda, {"ingresos": 0.0, "gastos": 0.0})
            row[f"{moneda}_ingresos"] = round(cur["ingresos"])
            row[f"{moneda}_gastos"] = round(cur["gastos"])
        serie.append(row)

    detalle.sort(key=lambda x: x.get("fecha") or "", reverse=True)
    return {
        "periodo": {"desde": desde, "hasta": hasta},
        "monedas": monedas,
        "mensual": serie,
        "movimientos": detalle,
        "ventasPendientes": pendientes_list,
        "comisionesFaltantes": comisiones_faltantes,
    }
