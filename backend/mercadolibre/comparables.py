"""Comparables EN VIVO de Mercado Libre (Costa del Este) por scraping del sitio
público de inmuebles. La API oficial /sites/search está restringida (403) aun con
token de vendedor, así que leemos la grilla pública y calculamos el precio/m²
mediano de la zona. Aislado a propósito: si ML habilita la API oficial, se cambia
solo este módulo sin tocar la tasación ni la UI. Resultados cacheados en memoria
(TTL) para no golpear ML en cada visita."""
from __future__ import annotations

import logging
import re
import statistics
import time

import httpx

logger = logging.getLogger("vera")

_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
_BASE = "https://inmuebles.mercadolibre.com.ar"
_LOCALITY = "buenos-aires-costa-atlantica/costa-del-este"
_TTL = 6 * 3600  # 6 horas
_MIN_SAMPLES = 4

# Tipo de tasación → segmento de ML + qué superficie usar como referencia.
_TIPO_PATH = {
    "casa": ("casas", "cubiertos"),
    "duplex": ("casas", "cubiertos"),
    "depto": ("departamentos", "cubiertos"),
    "lote": ("terrenos", "totales"),
}

_cache: dict[str, tuple[float, dict]] = {}

_RE_PRICE = re.compile(r'andes-money-amount__fraction[^>]*>([\d\.]+)</span>')
_RE_CUR = re.compile(r'andes-money-amount__currency-symbol[^>]*>([^<]+)</span>')
_RE_AREA = re.compile(r'([\d\.]+)\s*m²\s*(cubiertos|totales)')
_USD = {"US$", "U$S", "USD"}


def _parse(html: str, area_kind: str) -> list[tuple[int, int]]:
    """Devuelve pares (precio_usd, m²) de cada tarjeta con precio USD y superficie."""
    out: list[tuple[int, int]] = []
    for card in re.split(r"poly-card__content|ui-search-layout__item", html):
        pm = _RE_PRICE.search(card)
        area = _RE_AREA.search(card)
        if not pm or not area:
            continue
        cur = _RE_CUR.search(card)
        cursym = cur.group(1).strip() if cur else ""
        if cursym not in _USD:
            continue
        try:
            price = int(pm.group(1).replace(".", ""))
            m2 = int(area.group(1).replace(".", ""))
        except ValueError:
            continue
        if price < 3000 or m2 <= 0:
            continue
        out.append((price, m2))
    return out


async def market_pm2(tipo: str) -> dict:
    """Precio/m² mediano EN VIVO en Costa del Este para el tipo dado.
    Retorna {available, count, medianPm2, minPm2, maxPm2, source}."""
    seg, area_kind = _TIPO_PATH.get(tipo, _TIPO_PATH["casa"])
    cache_key = seg
    now = time.time()
    hit = _cache.get(cache_key)
    if hit and now - hit[0] < _TTL:
        return hit[1]

    url = f"{_BASE}/{seg}/venta/{_LOCALITY}/"
    try:
        async with httpx.AsyncClient(timeout=25, follow_redirects=True, headers={"User-Agent": _UA}) as h:
            r = await h.get(url)
        rows = _parse(r.text, area_kind) if r.status_code == 200 else []
    except Exception:  # noqa: BLE001
        logger.warning("Comparables ML: fallo al leer %s", url)
        rows = []

    if len(rows) < _MIN_SAMPLES:
        result = {"available": False, "count": len(rows), "medianPm2": 0, "source": "mercadolibre"}
    else:
        pm2 = sorted(p / m for p, m in rows)
        # recorte de outliers (10% por punta) para robustez.
        cut = max(1, len(pm2) // 10)
        trimmed = pm2[cut:-cut] if len(pm2) > 2 * cut else pm2
        result = {
            "available": True,
            "count": len(rows),
            "medianPm2": round(statistics.median(trimmed)),
            "minPm2": round(min(trimmed)),
            "maxPm2": round(max(trimmed)),
            "source": "mercadolibre",
        }
    _cache[cache_key] = (now, result)
    return result
