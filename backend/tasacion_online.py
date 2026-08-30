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
    tipo = inp.get("tipo", "casa")
    market = await comparables.market_pm2(tipo)
    area = _area_referencia(inp)

    # ML solo scrapea "Costa del Este" en su conjunto (no hay filtro por zona/barrio en el
    # sitio público), así que su pm2 es un promedio plano de toda la localidad. Si el agente
    # ya calibró el precio real de esta zona (precio_lote_{zona} > 0 en Tasador → Config), se
    # usa el modelo local en vez del promedio plano de ML. Recién si la zona todavía está en 0
    # (sin calibrar) se cae al promedio plano de ML como aproximación provisoria.
    zsuf = tasacion.ZONA_SUFIJO.get(inp.get("zona", "playa"), "playa")
    zona_precio = float(cfg.get(f"precio_lote_{zsuf}") or 0)

    if tipo == "lote" and zona_precio > 0:
        # Terreno: el precio de zona calibrado ES el USD/m² del lote — se usa directo.
        pm2_zona = zona_precio
        base = pm2_zona * area if area > 0 else (r["pubMin"] + r["pubMax"]) / 2
        method = "varela"
        market_available = False
    elif tipo != "lote" and zona_precio > 0:
        # Casa/duplex/depto: el precio de zona es del TERRENO, no se puede multiplicar
        # directo por los m² de construcción (mezclaría unidades). `tasar()` ya combina
        # bien construcción + lote libre (o precio por ambiente para depto), así que se
        # usa ese cálculo completo en vez del pm2 plano de ML.
        base = (r["pubMin"] + r["pubMax"]) / 2
        method = "varela"
        market_available = False
        pm2_zona = (base / area) if area > 0 else 0
    elif market.get("available") and area > 0:
        pm2_zona = market["medianPm2"]
        base = pm2_zona * area
        method = "mercadolibre"
        market_available = True
    else:
        pm2_zona = 0
        base = (r["pubMin"] + r["pubMax"]) / 2
        method = "varela"
        market_available = False

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
            "available": market_available,
            "count": market.get("count", 0) if market_available else 0,
            "medianPm2": round(pm2_zona),
        },
    }
