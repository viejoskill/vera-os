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


def _movs():
    return _db()["rental_movimientos"]


def _res():
    return _db()["rental_reservations"]


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


def _entry_out(d: dict) -> dict:
    return {
        "id": d["_id"], "fecha": d.get("fecha"), "tipo": d.get("tipo"),
        "categoria": d.get("categoria"), "moneda": d.get("moneda", "ARS"),
        "monto": d.get("monto"), "descripcion": d.get("descripcion", ""),
        "origen": "manual", "createdAt": d.get("createdAt"),
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


# -------------------------------- Resumen ------------------------------- #
def _blank_cur() -> dict:
    return {"ingresos": 0.0, "gastos": 0.0, "neto": 0.0,
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


@router.get("/resumen")
async def resumen(desde: str = Query(...), hasta: str = Query(...)):
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

    # Cierre: neto y redondeos.
    for cur in monedas.values():
        cur["ingresos"] = round(cur["ingresos"])
        cur["gastos"] = round(cur["gastos"])
        cur["neto"] = cur["ingresos"] - cur["gastos"]
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
    }
