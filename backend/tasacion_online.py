"""Tasador Online (público): modelo SEMÁFORO.

1) Valor de referencia de MERCADO (índice ML): precio/m² mediano EN VIVO de
   Mercado Libre × superficie, con una apertura de ±3%.
2) Índice VARELA de venta (semáforo): sobre ese valor de mercado, tres escenarios
   según el tiempo estimado de venta, en base a precios reales de venta de los
   últimos 12 meses:
     🟢 Verde   · 2 a 6 meses    · −12%
     🟡 Amarillo · 6 a 12 meses  · −7%
     🔴 Rojo    · 12 meses o más · mismo valor que el mercado
Si no hay suficientes comparables de ML, se usa el modelo Varela local como base.
Además captura al visitante como Lead (vendedor) en Personas."""
from __future__ import annotations

import tasacion
from mercadolibre import comparables

# Índice Varela de venta: (nivel, rango de meses, ajuste sobre el valor de mercado).
SEMAFORO = [
    ("verde", "2 a 6 meses", -0.12),
    ("amarillo", "6 a 12 meses", -0.07),
    ("rojo", "12 meses o más", 0.0),
]
APERTURA_MERCADO = 0.03  # ±3% sobre el valor de mercado


def _area_referencia(inp: dict) -> float:
    if inp.get("tipo") == "lote":
        return float(inp.get("lote") or 0)
    return float(inp.get("cubiertos") or 0)


async def estimar(inp: dict) -> dict:
    cfg = await tasacion.get_config()
    r = tasacion.tasar(inp, cfg)
    market = await comparables.market_pm2(inp.get("tipo", "casa"))
    area = _area_referencia(inp)

    # ML solo scrapea "Costa del Este" en su conjunto (no hay filtro por zona/barrio
    # en el sitio público), así que el pm2 que devuelve es un promedio plano de toda
    # la localidad. Para no repetir el mismo valor en todas las zonas, lo escalamos
    # por el diferencial de precio de zona calibrado en el modelo Varela local, contra
    # el PROMEDIO de las zonas ya calibradas (no cero). Mientras el usuario está
    # cargando los precios zona por zona, las zonas en 0 no distorsionan el promedio
    # y devuelven factor 1 (usan el valor plano de ML) hasta que se completen.
    zsuf = tasacion.ZONA_SUFIJO.get(inp.get("zona", "playa"), "playa")
    zona_precio = float(cfg.get(f"precio_lote_{zsuf}") or 0)
    precios_calibrados = [float(cfg.get(f"precio_lote_{s}") or 0) for s in tasacion.ZONA_SUFIJO.values()]
    precios_calibrados = [p for p in precios_calibrados if p > 0]
    promedio_zonas = sum(precios_calibrados) / len(precios_calibrados) if precios_calibrados else 0
    zona_factor = (zona_precio / promedio_zonas) if (promedio_zonas > 0 and zona_precio > 0) else 1.0

    if market.get("available") and area > 0:
        pm2_zona = market["medianPm2"] * zona_factor
        base = pm2_zona * area
        method = "mercadolibre"
    else:
        base = (r["pubMin"] + r["pubMax"]) / 2
        method = "varela"

    mkt_min = tasacion._r500(base * (1 - APERTURA_MERCADO), "down")
    mkt_max = tasacion._r500(base * (1 + APERTURA_MERCADO), "up")

    semaforo = [
        {
            "nivel": nivel,
            "meses": meses,
            "ajuste": ajuste,
            "valor": tasacion._r500(base * (1 + ajuste), "nearest"),
        }
        for nivel, meses, ajuste in SEMAFORO
    ]

    return {
        # Compat: el rango "estimado" es el valor de mercado (índice ML).
        "estMin": mkt_min,
        "estMax": mkt_max,
        "mktMin": mkt_min,
        "mktMax": mkt_max,
        "base": tasacion._r500(base, "nearest"),
        "semaforo": semaforo,
        "method": method,
        "tipoNombre": r["tipoNombre"],
        "zonaNombre": r["zonaNombre"],
        "area": int(area) if area else None,
        "market": {
            "available": market.get("available", False),
            "count": market.get("count", 0),
            "medianPm2": round(market.get("medianPm2", 0) * zona_factor) if market.get("available") else market.get("medianPm2", 0),
        },
    }
