"""Tasador Online (público): modelo híbrido = Varela + comparables EN VIVO de
Mercado Libre. Le muestra al visitante un rango estimado de su propiedad y lo
captura como Lead (vendedor) en Personas. La matemática Varela no se toca; el
mercado en vivo la ajusta cuando hay suficientes comparables."""
from __future__ import annotations

import tasacion
from mercadolibre import comparables


def _area_referencia(inp: dict) -> float:
    if inp.get("tipo") == "lote":
        return float(inp.get("lote") or 0)
    return float(inp.get("cubiertos") or 0)


async def estimar(inp: dict) -> dict:
    cfg = await tasacion.get_config()
    r = tasacion.tasar(inp, cfg)
    market = await comparables.market_pm2(inp.get("tipo", "casa"))
    area = _area_referencia(inp)

    pub_mid = (r["pubMin"] + r["pubMax"]) / 2
    if market.get("available") and area > 0:
        market_estimate = market["medianPm2"] * area
        blended = (pub_mid + market_estimate) / 2
        est_min = tasacion._r500(blended * 0.93, "down")
        est_max = tasacion._r500(blended * 1.07, "up")
        method = "hibrido"
    else:
        est_min, est_max = r["pubMin"], r["pubMax"]
        method = "varela"

    return {
        "estMin": est_min,
        "estMax": est_max,
        "method": method,
        "tipoNombre": r["tipoNombre"],
        "zonaNombre": r["zonaNombre"],
        "area": int(area) if area else None,
        "market": {
            "available": market.get("available", False),
            "count": market.get("count", 0),
            "medianPm2": market.get("medianPm2", 0),
        },
        "varela": {
            "cierreMin": r["cierreMin"], "cierreMax": r["cierreMax"],
            "pubMin": r["pubMin"], "pubMax": r["pubMax"], "coef": r["coef"],
        },
    }
