"""Alquileres Temporarios (Fase 1).

Módulo independiente del CRM de ventas. Persistencia en MongoDB; las fotos van
al mismo storage (Supabase) vía StorageService y se sirven públicamente por un
proxy. Flujo estilo Airbnb: la web pública muestra disponibilidad y el huésped
crea una PRE-RESERVA que siempre requiere confirmación interna.
"""
from __future__ import annotations

import random
import re
from datetime import date, datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pydantic import BaseModel

import config as appconfig
from property_repository import property_repository
from storage_service import get_storage

router = APIRouter(prefix="/rentals", tags=["rentals"])

_client: AsyncIOMotorClient | None = None

# Estados que ocupan fechas en el calendario.
OCUPA = {"prereserva", "confirmada", "encurso", "finalizada", "bloqueo"}


def _db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(appconfig.MONGO_URL)
    return _client[appconfig.DB_NAME]


def _props():
    return _db()["rental_properties"]


def _res():
    return _db()["rental_reservations"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _next_code() -> str:
    """Código aleatorio y único para Alquileres: A100–A1000 (letra A + número, sin guion)."""
    used: set[int] = set()
    async for p in _props().find({"codigo": {"$regex": r"^A\d+$"}}, {"codigo": 1}):
        try:
            used.add(int(str(p["codigo"])[1:]))
        except (ValueError, TypeError):
            pass
    pool = [n for n in range(100, 1001) if n not in used]
    if not pool:  # sin números libres en el rango → seguimos por encima de 1000
        return f"A{1001 + len(used)}"
    return f"A{random.choice(pool)}"


async def _ensure_codes() -> None:
    """Normaliza códigos: toda propiedad debe tener un código A### (A100–A1000).
    Renombra los que falten o no cumplan el formato (p.ej. legacy CDE###). Idempotente:
    una vez normalizados, no vuelve a tocarlos."""
    cur = _props().find({"codigo": {"$not": {"$regex": r"^A\d+$"}}}).sort("createdAt", 1)
    async for p in cur:
        await _props().update_one(
            {"_id": p["_id"]}, {"$set": {"codigo": await _next_code(), "updatedAt": _now()}}
        )


def _slugify(text: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (text or "propiedad").lower()).strip("-")
    return (base or "propiedad")[:48] + "-" + uuid4().hex[:6]


def _nights(check_in: str, check_out: str) -> int:
    d1 = date.fromisoformat(check_in)
    d2 = date.fromisoformat(check_out)
    return (d2 - d1).days


def _overlap(a_in: str, a_out: str, b_in: str, b_out: str) -> bool:
    return a_in < b_out and b_in < a_out


def _quote(prop: dict, check_in: str, check_out: str) -> dict:
    n = _nights(check_in, check_out)
    precio = float(prop.get("precioNoche") or 0)
    base = n * precio
    disc = 0.0
    if n >= int(prop.get("descMesMin") or 25) and prop.get("descMes"):
        disc = float(prop["descMes"])
    elif n >= int(prop.get("descQuincenaMin") or 12) and prop.get("descQuincena"):
        disc = float(prop["descQuincena"])
    elif n >= int(prop.get("descSemanaMin") or 6) and prop.get("descSemana"):
        disc = float(prop["descSemana"])
    total = round(base * (1 - disc / 100))
    return {
        "noches": n, "precioNoche": precio, "base": round(base),
        "descuentoPct": disc, "total": total, "moneda": prop.get("moneda", "ARS"),
    }


# ----------------------------- Serialización ----------------------------- #
def _img_url(img_id: str) -> str:
    return f"/api/rentals/public/image/{img_id}"


def _prop_out(p: dict, public: bool = False) -> dict:
    imgs = sorted(p.get("imagenes") or [], key=lambda i: i.get("position", 0))
    out = {
        "id": p["_id"], "slug": p.get("slug"), "codigo": p.get("codigo"), "titulo": p.get("titulo"),
        "tipo": p.get("tipo", "casa"),
        "direccion": p.get("direccion"), "localidad": p.get("localidad"),
        "descripcion": p.get("descripcion"), "capacidad": p.get("capacidad"),
        "dormitorios": p.get("dormitorios"), "banos": p.get("banos"),
        "amenities": p.get("amenities") or [], "moneda": p.get("moneda", "ARS"),
        "precioNoche": p.get("precioNoche"), "activa": p.get("activa", True),
        "imagenes": [{"id": i["id"], "url": _img_url(i["id"]), "isCover": i.get("isCover", False)} for i in imgs],
        # Condiciones de la reserva (visibles también en la web pública).
        "ropaBlanca": p.get("ropaBlanca", False),
        "aceptaMascotas": p.get("aceptaMascotas", False),
        "depositoGarantia": p.get("depositoGarantia", 0),
        "penalidadDiaria": p.get("penalidadDiaria", 0),
        "limpieza": p.get("limpieza", 0),
        "checkInHora": p.get("checkInHora", ""),
        "checkOutHora": p.get("checkOutHora", ""),
        "estadiaMinima": p.get("estadiaMinima", 0),
        "condiciones": p.get("condiciones") or [],
        "reelUrl": p.get("reelUrl", "") or "",
        "latitude": p.get("latitude"),
        "longitude": p.get("longitude"),
    }
    if not public:
        out.update({
            "descSemana": p.get("descSemana", 0), "descQuincena": p.get("descQuincena", 0),
            "descMes": p.get("descMes", 0), "createdAt": p.get("createdAt"),
            "descSemanaMin": p.get("descSemanaMin", 6), "descQuincenaMin": p.get("descQuincenaMin", 12),
            "descMesMin": p.get("descMesMin", 25),
            "comisionPct": p.get("comisionPct", 0), "comisionMinima": p.get("comisionMinima", 0),
            "notas": p.get("notas", ""),
            "numeroLlave": p.get("numeroLlave"),
            "propietario": p.get("propietario") or {},
            "publications": p.get("publications") or {},
        })
    return out


def _movs():
    return _db()["rental_movimientos"]


def _settings():
    return _db()["rental_settings"]


TIPOS_MOV = {"ingreso", "gasto_prop", "gasto_nuestro", "comision"}


def _mov_out(m: dict) -> dict:
    return {
        "id": m["_id"], "propertyId": m.get("propertyId"), "fecha": m.get("fecha"),
        "tipo": m.get("tipo"), "monto": m.get("monto"), "descripcion": m.get("descripcion"),
        "reservaId": m.get("reservaId"), "createdAt": m.get("createdAt"),
        "comisionPct": m.get("comisionPct"),
    }


class MovimientoBody(BaseModel):
    propertyId: str
    fecha: str
    tipo: str
    monto: float
    descripcion: str | None = ""
    reservaId: str | None = None


def _pagos_calc(r: dict) -> dict:
    """Suma cobrada (seña + saldos) y saldo pendiente de una reserva."""
    total = float(r.get("montoEstimado") or 0)
    pago = r.get("pago") or {}
    sena = float(pago.get("monto") or 0) if pago.get("estado") == "pagado" else 0.0
    saldos = sum(float(s.get("monto") or 0) for s in (r.get("saldos") or []))
    cobrado = sena + saldos
    return {
        "senaCobrada": round(sena), "saldosCobrado": round(saldos),
        "totalCobrado": round(cobrado), "saldoPendiente": round(max(0.0, total - cobrado)),
    }


def _res_out(r: dict) -> dict:
    calc = _pagos_calc(r)
    return {
        "id": r["_id"], "propertyId": r.get("propertyId"), "propertyTitulo": r.get("propertyTitulo"),
        "estado": r.get("estado"), "checkIn": r.get("checkIn"), "checkOut": r.get("checkOut"),
        "noches": r.get("noches"), "montoEstimado": r.get("montoEstimado"), "moneda": r.get("moneda", "ARS"),
        "origen": r.get("origen"), "motivo": r.get("motivo"),
        "huesped": r.get("huesped") or {}, "createdAt": r.get("createdAt"),
        "pago": r.get("pago"),
        "comprobantes": [{"id": c["id"], "nombre": c.get("nombre"), "fecha": c.get("fecha")} for c in (r.get("comprobantes") or [])],
        "saldos": [{"id": s["id"], "monto": s.get("monto"), "metodo": s.get("metodo"),
                    "fecha": s.get("fecha"), "comprobanteId": s.get("comprobanteId")} for s in (r.get("saldos") or [])],
        "saldoPendiente": calc["saldoPendiente"], "totalCobrado": calc["totalCobrado"],
        "nroReserva": r.get("nroReserva"), "nroContrato": r.get("nroContrato"),
        "depositoOverride": r.get("depositoOverride"),
        "limpiezaOverride": r.get("limpiezaOverride"),
    }


# ------------------------------- Modelos --------------------------------- #
class OwnerBody(BaseModel):
    nombre: str | None = ""
    telefono: str | None = ""
    email: str | None = ""
    dni: str | None = ""
    observaciones: str | None = ""


class PropertyBody(BaseModel):
    titulo: str
    tipo: str = "casa"  # casa | departamento | ph (para Mercado Libre)
    direccion: str | None = ""
    localidad: str | None = "Costa del Este"
    descripcion: str | None = ""
    capacidad: int = 2
    dormitorios: int = 1
    banos: int = 1
    amenities: list[str] = []
    moneda: str = "ARS"
    precioNoche: float = 0
    descSemana: float = 0
    descQuincena: float = 0
    descMes: float = 0
    descSemanaMin: int = 6
    descQuincenaMin: int = 12
    descMesMin: int = 25
    activa: bool = True
    comisionPct: float = 0
    comisionMinima: float = 0
    notas: str | None = ""
    propietario: OwnerBody | None = None
    ropaBlanca: bool = False
    aceptaMascotas: bool = False
    depositoGarantia: float = 0
    penalidadDiaria: float = 0
    limpieza: float = 0
    checkInHora: str | None = ""
    checkOutHora: str | None = ""
    estadiaMinima: int = 0
    condiciones: list[str] = []
    numeroLlave: int | None = None
    reelUrl: str | None = ""
    latitude: float | None = None
    longitude: float | None = None


class ReservationBody(BaseModel):
    propertyId: str
    nombre: str
    telefono: str | None = ""
    email: str | None = ""
    dni: str | None = ""
    huespedes: int = 1
    comentario: str | None = ""
    checkIn: str
    checkOut: str
    estado: str = "prereserva"
    origen: str = "Directo"
    monto: float | None = None


class BlockBody(BaseModel):
    propertyId: str
    checkIn: str
    checkOut: str
    motivo: str | None = "Bloqueo manual"


class ManualReservationBody(BaseModel):
    propertyId: str
    nombre: str
    telefono: str | None = ""
    email: str | None = ""
    dni: str | None = ""
    domicilio: str | None = ""
    localidad: str | None = ""
    huespedes: int = 1
    comentario: str | None = ""
    checkIn: str
    checkOut: str
    montoTotal: float | None = None
    senaMonto: float = 0
    senaTenedor: str = "nosotros"   # nosotros | dueno | ninguno
    senaMetodo: str = "efectivo"    # efectivo | transferencia | mercadopago | otro
    senaPagada: bool = True
    origen: str = "Manual"


class StatusBody(BaseModel):
    estado: str
    motivo: str | None = None


class HuespedBody(BaseModel):
    nombre: str | None = None
    telefono: str | None = None
    email: str | None = None
    dni: str | None = None
    domicilio: str | None = None
    localidad: str | None = None
    huespedes: int | None = None
    comentario: str | None = None


class PaymentLinkBody(BaseModel):
    monto: float
    descripcion: str | None = None


class PrereservaBody(BaseModel):
    nombre: str
    telefono: str | None = ""
    email: str | None = ""
    dni: str | None = ""
    huespedes: int = 1
    comentario: str | None = ""
    checkIn: str
    checkOut: str
    origen: str = "Directo"
    aceptaCondiciones: bool = False


class SettingsBody(BaseModel):
    condicionesGenerales: list[str] = []
    avisoValidez: str | None = ""
    whatsappAgencia: str | None = ""


AVISO_VALIDEZ = "Esta pre-reserva tiene una validez de 24 horas y queda sujeta a confirmación de la inmobiliaria."


# --------------------------- Helpers de acceso --------------------------- #
async def _get_prop(pid: str) -> dict:
    p = await _props().find_one({"_id": pid})
    if not p:
        raise HTTPException(404, "Propiedad no encontrada")
    return p


async def _occupied(property_id: str) -> list[dict]:
    """Rangos ocupados (reservas activas + bloqueos)."""
    cur = _res().find({"propertyId": property_id, "estado": {"$in": list(OCUPA)}})
    return [{"checkIn": r["checkIn"], "checkOut": r["checkOut"], "estado": r["estado"]} async for r in cur]


async def _assert_free(property_id: str, check_in: str, check_out: str) -> None:
    if _nights(check_in, check_out) < 1:
        raise HTTPException(400, "El check-out debe ser posterior al check-in.")
    for o in await _occupied(property_id):
        if _overlap(check_in, check_out, o["checkIn"], o["checkOut"]):
            raise HTTPException(409, "Esas fechas ya no están disponibles.")


# =============================== INTERNO ================================= #
@router.get("/properties")
async def list_properties():
    await _ensure_codes()
    cur = _props().find().sort("createdAt", -1)
    return [_prop_out(p) async for p in cur]


@router.post("/properties", status_code=201)
async def create_property(body: PropertyBody):
    doc = body.model_dump()
    doc["_id"] = uuid4().hex
    doc["slug"] = _slugify(body.titulo)
    doc["codigo"] = await _next_code()
    doc["imagenes"] = []
    doc["createdAt"] = _now()
    await _props().insert_one(doc)
    return _prop_out(doc)


@router.get("/properties/{pid}")
async def get_property(pid: str):
    return _prop_out(await _get_prop(pid))


@router.put("/properties/{pid}")
async def update_property(pid: str, body: PropertyBody):
    await _get_prop(pid)
    await _props().update_one({"_id": pid}, {"$set": {**body.model_dump(), "updatedAt": _now()}})
    return _prop_out(await _get_prop(pid))


@router.delete("/properties/{pid}", status_code=204)
async def delete_property(pid: str):
    p = await _get_prop(pid)
    for img in p.get("imagenes") or []:
        try:
            await get_storage().delete(img["bucket"], img["object_path"])
        except Exception:
            pass
    await _props().delete_one({"_id": pid})
    await _res().delete_many({"propertyId": pid})


@router.post("/properties/{pid}/images", status_code=201)
async def upload_image(pid: str, file: UploadFile = File(...)):
    p = await _get_prop(pid)
    if not appconfig.supabase_configured():
        raise HTTPException(503, "Storage no configurado.")
    from pathlib import Path
    ext = Path(file.filename or "img.jpg").suffix.lower() or ".jpg"
    img_id = uuid4().hex
    object_path = f"rentals/{pid}/images/{img_id}{ext}"
    content = await file.read()
    await get_storage().upload(
        appconfig.BUCKET_IMAGES, object_path, content, file.content_type or "image/jpeg"
    )
    existing = p.get("imagenes") or []
    rec = {
        "id": img_id, "bucket": appconfig.BUCKET_IMAGES, "object_path": object_path,
        "position": len(existing), "isCover": len(existing) == 0,
        "contentType": file.content_type or "image/jpeg",
    }
    await _props().update_one({"_id": pid}, {"$push": {"imagenes": rec}})
    return {"id": img_id, "url": _img_url(img_id), "isCover": rec["isCover"]}


@router.delete("/properties/{pid}/images/{img_id}", status_code=204)
async def delete_image(pid: str, img_id: str):
    p = await _get_prop(pid)
    img = next((i for i in (p.get("imagenes") or []) if i["id"] == img_id), None)
    if not img:
        raise HTTPException(404, "Foto no encontrada")
    try:
        await get_storage().delete(img["bucket"], img["object_path"])
    except Exception:
        pass
    await _props().update_one({"_id": pid}, {"$pull": {"imagenes": {"id": img_id}}})


class ImageOrderBody(BaseModel):
    order: list[str]


@router.put("/properties/{pid}/images/order")
async def reorder_images(pid: str, body: ImageOrderBody):
    p = await _get_prop(pid)
    imgs = p.get("imagenes") or []
    by_id = {i["id"]: i for i in imgs}
    ordered = [by_id[i] for i in body.order if i in by_id]
    ordered += [i for i in imgs if i["id"] not in set(body.order)]
    for idx, img in enumerate(ordered):
        img["position"] = idx
        img["isCover"] = idx == 0
    await _props().update_one({"_id": pid}, {"$set": {"imagenes": ordered, "updatedAt": _now()}})
    return _prop_out(await _get_prop(pid))


class CodigoBody(BaseModel):
    codigo: str


@router.put("/properties/{pid}/codigo")
async def update_codigo(pid: str, body: CodigoBody):
    await _get_prop(pid)
    cod = (body.codigo or "").strip().upper()
    if not cod.startswith("A"):
        raise HTTPException(400, "El código debe empezar con A.")
    if len(cod) <= 1 or not cod[1:].isdigit():
        raise HTTPException(400, "Ingresá un número válido después de A (ej: A347).")
    dup = await _props().find_one({"codigo": cod, "_id": {"$ne": pid}})
    if dup:
        raise HTTPException(409, f"El código {cod} ya está en uso por otra propiedad.")
    await _props().update_one({"_id": pid}, {"$set": {"codigo": cod, "updatedAt": _now()}})
    return _prop_out(await _get_prop(pid))


@router.get("/reservations")
async def list_reservations(propertyId: str | None = Query(None), estado: str | None = Query(None)):
    q: dict = {}
    if propertyId:
        q["propertyId"] = propertyId
    if estado:
        q["estado"] = estado
    cur = _res().find(q).sort("createdAt", -1)
    return [_res_out(r) async for r in cur]


@router.post("/reservations", status_code=201)
async def create_reservation(body: ReservationBody):
    prop = await _get_prop(body.propertyId)
    await _assert_free(body.propertyId, body.checkIn, body.checkOut)
    q = _quote(prop, body.checkIn, body.checkOut)
    doc = {
        "_id": uuid4().hex, "propertyId": body.propertyId, "propertyTitulo": prop.get("titulo"),
        "estado": body.estado, "checkIn": body.checkIn, "checkOut": body.checkOut,
        "noches": q["noches"], "montoEstimado": body.monto if body.monto is not None else q["total"],
        "moneda": prop.get("moneda", "ARS"), "origen": body.origen,
        "huesped": {
            "nombre": body.nombre, "telefono": body.telefono, "email": body.email,
            "dni": body.dni, "huespedes": body.huespedes, "comentario": body.comentario,
        },
        "createdAt": _now(),
    }
    await _res().insert_one(doc)
    return _res_out(doc)


@router.post("/blocks", status_code=201)
async def create_block(body: BlockBody):
    prop = await _get_prop(body.propertyId)
    await _assert_free(body.propertyId, body.checkIn, body.checkOut)
    doc = {
        "_id": uuid4().hex, "propertyId": body.propertyId, "propertyTitulo": prop.get("titulo"),
        "estado": "bloqueo", "checkIn": body.checkIn, "checkOut": body.checkOut,
        "noches": _nights(body.checkIn, body.checkOut), "motivo": body.motivo,
        "moneda": prop.get("moneda", "ARS"), "origen": "Interno",
        "huesped": {}, "createdAt": _now(),
    }
    await _res().insert_one(doc)
    return _res_out(doc)


async def _register_inquilino(h: dict) -> None:
    """Agenda al huésped en Personas como inquilino (best-effort)."""
    if not appconfig.supabase_configured():
        return
    if not (h.get("nombre") or h.get("telefono")):
        return
    ident = {
        "full_name": h.get("nombre"), "phone": h.get("telefono"),
        "whatsapp": h.get("telefono"), "email": h.get("email"),
        "document": h.get("dni"), "role": "inquilino",
    }
    try:
        from people.resolver import person_resolver
        await person_resolver.resolve({k: v for k, v in ident.items() if v})
    except Exception:
        pass


async def _gen_comision(rid: str, r: dict) -> None:
    """Genera la comisión automática de una reserva (idempotente)."""
    prop = await _props().find_one({"_id": r.get("propertyId")})
    exists = await _movs().find_one({"reservaId": rid, "tipo": "comision"})
    if not prop or exists:
        return
    pct = float(prop.get("comisionPct") or 0)
    minima = float(prop.get("comisionMinima") or 0)
    base = float(r.get("montoEstimado") or 0)
    com = max(round(base * pct / 100), minima)
    if com > 0:
        await _movs().insert_one({
            "_id": uuid4().hex, "propertyId": r["propertyId"], "reservaId": rid,
            "fecha": r.get("checkIn"), "tipo": "comision", "monto": com, "comisionPct": pct,
            "descripcion": f"Comisión {pct}% · {r.get('huesped', {}).get('nombre', '')}".strip(),
            "createdAt": _now(),
        })


@router.post("/reservations/manual", status_code=201)
async def create_manual_reservation(body: ManualReservationBody):
    """Alta manual de una reserva ya confirmada (dueño reservó / huésped en el mostrador).
    Permite registrar la seña en poder del dueño y dejar el saldo para cobrar al ingresar."""
    prop = await _get_prop(body.propertyId)
    await _assert_free(body.propertyId, body.checkIn, body.checkOut)
    q = _quote(prop, body.checkIn, body.checkOut)
    total = round(float(body.montoTotal)) if body.montoTotal is not None else q["total"]
    moneda = prop.get("moneda", "ARS")
    rid = uuid4().hex
    doc: dict = {
        "_id": rid, "propertyId": body.propertyId, "propertyTitulo": prop.get("titulo"),
        "estado": "confirmada", "checkIn": body.checkIn, "checkOut": body.checkOut,
        "noches": q["noches"], "montoEstimado": total, "moneda": moneda, "origen": body.origen,
        "huesped": {
            "nombre": body.nombre, "telefono": body.telefono, "email": body.email,
            "dni": body.dni, "domicilio": body.domicilio, "localidad": body.localidad, "huespedes": body.huespedes, "comentario": body.comentario,
        },
        "createdAt": _now(),
    }
    sena = round(float(body.senaMonto or 0))
    if body.senaTenedor != "ninguno" and sena > 0:
        if body.senaTenedor == "dueno":
            doc["pago"] = {"estado": "pagado", "monto": sena, "moneda": moneda,
                           "metodo": "dueño", "tenedor": "dueno", "pagadoEl": _now()}
        else:
            pagada = bool(body.senaPagada)
            doc["pago"] = {"estado": "pagado" if pagada else "pendiente", "monto": sena, "moneda": moneda,
                           "metodo": body.senaMetodo, "tenedor": "nosotros",
                           "pagadoEl": _now() if pagada else None}
    await _res().insert_one(doc)
    await _gen_comision(rid, doc)
    await _register_inquilino(doc["huesped"])
    return _res_out(await _res().find_one({"_id": rid}))


@router.patch("/reservations/{rid}")
async def update_status(rid: str, body: StatusBody):
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    prev_estado = r.get("estado")
    # La confirmación "real" (con sus efectos) ocurre al pasar de pre-reserva a confirmada.
    # Reabrir una reserva (finalizada/en curso → confirmada) NO debe regenerar seña ni comisión.
    es_confirmacion_inicial = body.estado == "confirmada" and prev_estado == "prereserva"
    upd = {"estado": body.estado, "updatedAt": _now()}
    if body.motivo is not None:
        upd["motivo"] = body.motivo
    await _res().update_one({"_id": rid}, {"$set": upd})
    # Al confirmar, el huésped queda agendado en Personas como inquilino.
    if es_confirmacion_inicial and appconfig.supabase_configured():
        h = r.get("huesped") or {}
        if h.get("nombre") or h.get("telefono"):
            ident = {
                "full_name": h.get("nombre"), "phone": h.get("telefono"),
                "whatsapp": h.get("telefono"), "email": h.get("email"),
                "document": h.get("dni"), "role": "inquilino",
            }
            try:
                from people.resolver import person_resolver
                await person_resolver.resolve({k: v for k, v in ident.items() if v})
            except Exception:
                pass
    # Genera la comisión automática (editable luego en la ficha).
    if es_confirmacion_inicial:
        prop = await _props().find_one({"_id": r.get("propertyId")})
        exists = await _movs().find_one({"reservaId": rid, "tipo": "comision"})
        if prop and not exists:
            pct = float(prop.get("comisionPct") or 0)
            minima = float(prop.get("comisionMinima") or 0)
            base = float(r.get("montoEstimado") or 0)
            com = max(round(base * pct / 100), minima)
            if com > 0:
                await _movs().insert_one({
                    "_id": uuid4().hex, "propertyId": r["propertyId"], "reservaId": rid,
                    "fecha": r.get("checkIn"), "tipo": "comision", "monto": com,
                    "descripcion": f"Comisión {pct}% · {r.get('huesped', {}).get('nombre', '')}".strip(),
                    "createdAt": _now(),
                })
    # Al confirmar, genera automáticamente el link de seña (30% del total, solo ARS).
    # Nunca si ya hay seña pagada o link generado.
    if es_confirmacion_inicial and appconfig.mp_configured():
        r2 = await _res().find_one({"_id": rid})
        pago_prev = (r2 or {}).get("pago") or {}
        ya_tiene_pago = pago_prev.get("initPoint") or pago_prev.get("estado") == "pagado"
        if r2 and r2.get("moneda", "ARS") == "ARS" and not ya_tiene_pago:
            sena = round(float(r2.get("montoEstimado") or 0) * 0.3)
            if sena > 0:
                try:
                    await _create_sena_link(r2, sena)
                except Exception:
                    pass
    return _res_out(await _res().find_one({"_id": rid}))


@router.patch("/reservations/{rid}/huesped")
async def update_huesped(rid: str, body: HuespedBody):
    """Edita manualmente los datos del huésped (frecuente en pre-reservas incompletas)."""
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    huesped = dict(r.get("huesped") or {})
    for k, v in body.model_dump(exclude_unset=True).items():
        huesped[k] = v
    await _res().update_one({"_id": rid}, {"$set": {"huesped": huesped, "updatedAt": _now()}})
    return _res_out(await _res().find_one({"_id": rid}))


class DepositoBody(BaseModel):
    deposito: float | None = None  # None = volver a usar el depósito de la propiedad


@router.patch("/reservations/{rid}/deposito")
async def update_deposito(rid: str, body: DepositoBody):
    """Override del depósito de garantía para ESTA reserva puntual (ej. estadías cortas
    o acuerdos distintos al depósito configurado en la propiedad). No afecta otras reservas."""
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    await _res().update_one({"_id": rid}, {"$set": {"depositoOverride": body.deposito, "updatedAt": _now()}})
    return _res_out(await _res().find_one({"_id": rid}))


class LimpiezaBody(BaseModel):
    limpieza: float | None = None  # None = volver a usar el cargo de limpieza de la propiedad


@router.patch("/reservations/{rid}/limpieza")
async def update_limpieza(rid: str, body: LimpiezaBody):
    """Override del cargo de limpieza (se cobra siempre, se suma al total a abonar en el
    ingreso) para ESTA reserva puntual. No afecta otras reservas."""
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    await _res().update_one({"_id": rid}, {"$set": {"limpiezaOverride": body.limpieza, "updatedAt": _now()}})
    return _res_out(await _res().find_one({"_id": rid}))


@router.delete("/reservations/{rid}", status_code=204)
async def delete_reservation(rid: str):
    await _res().delete_one({"_id": rid})


@router.get("/properties/{pid}/calendar")
async def property_calendar(pid: str):
    await _get_prop(pid)
    return {"ocupados": await _occupied(pid)}


# ------------------------------ Ajustes -------------------------------- #
@router.get("/settings")
async def get_settings():
    s = await _settings().find_one({"_id": "global"}) or {}
    return {
        "condicionesGenerales": s.get("condicionesGenerales") or [],
        "avisoValidez": s.get("avisoValidez") or AVISO_VALIDEZ,
        "whatsappAgencia": s.get("whatsappAgencia") or "",
    }


@router.put("/settings")
async def update_settings(body: SettingsBody):
    await _settings().update_one(
        {"_id": "global"},
        {"$set": {
            "condicionesGenerales": [c.strip() for c in body.condicionesGenerales if c.strip()],
            "avisoValidez": (body.avisoValidez or "").strip() or AVISO_VALIDEZ,
            "whatsappAgencia": (body.whatsappAgencia or "").strip(),
            "updatedAt": _now(),
        }},
        upsert=True,
    )
    return await get_settings()


# ------------------------------ Finanzas -------------------------------- #
@router.get("/properties/{pid}/movimientos")
async def list_movimientos(pid: str):
    cur = _movs().find({"propertyId": pid}).sort("fecha", -1)
    return [_mov_out(m) async for m in cur]


@router.post("/movimientos", status_code=201)
async def create_movimiento(body: MovimientoBody):
    await _get_prop(body.propertyId)
    if body.tipo not in TIPOS_MOV:
        raise HTTPException(400, "Tipo de movimiento inválido.")
    doc = {**body.model_dump(), "_id": uuid4().hex, "createdAt": _now()}
    await _movs().insert_one(doc)
    return _mov_out(doc)


@router.delete("/movimientos/{mid}", status_code=204)
async def delete_movimiento(mid: str):
    await _movs().delete_one({"_id": mid})


class MovimientoEditBody(BaseModel):
    monto: float | None = None
    descripcion: str | None = None
    comisionPct: float | None = None


@router.put("/movimientos/{mid}")
async def update_movimiento(mid: str, body: MovimientoEditBody):
    """Edita UN movimiento puntual (p.ej. la comisión de una reserva específica), sin
    afectar la config de la propiedad ni otras reservas. Si se manda `comisionPct` en
    una comisión, recalcula el monto en base al total de ESA reserva (queda constancia
    de qué % se cobró realmente, y se refleja solo en la liquidación correspondiente)."""
    m = await _movs().find_one({"_id": mid})
    if not m:
        raise HTTPException(404, "Movimiento no encontrado")
    patch: dict = {}
    if body.comisionPct is not None and m.get("tipo") == "comision" and m.get("reservaId"):
        r = await _res().find_one({"_id": m["reservaId"]})
        if not r:
            raise HTTPException(400, "No se encontró la reserva asociada a esta comisión.")
        base = float(r.get("montoEstimado") or 0)
        pct = float(body.comisionPct)
        patch["comisionPct"] = pct
        patch["monto"] = round(base * pct / 100)
        nombre = r.get("huesped", {}).get("nombre", "")
        patch["descripcion"] = f"Comisión {pct}% · {nombre}".strip(" ·")
    elif body.monto is not None:
        patch["monto"] = round(float(body.monto))
    if body.descripcion is not None and "descripcion" not in patch:
        patch["descripcion"] = body.descripcion
    if not patch:
        raise HTTPException(400, "Nada para actualizar")
    await _movs().update_one({"_id": mid}, {"$set": patch})
    return _mov_out(await _movs().find_one({"_id": mid}))


@router.get("/liquidacion")
async def liquidacion(propertyId: str = Query(...), desde: str = Query(...), hasta: str = Query(...)):
    prop = await _get_prop(propertyId)
    tot = {"ingreso": 0.0, "gasto_prop": 0.0, "gasto_nuestro": 0.0, "comision": 0.0}
    movs = []
    cur = _movs().find({"propertyId": propertyId, "fecha": {"$gte": desde, "$lte": hasta}}).sort("fecha", 1)
    async for m in cur:
        t = m.get("tipo")
        if t in tot:
            tot[t] += float(m.get("monto") or 0)
        movs.append(_mov_out(m))
    neto = round(tot["ingreso"] - tot["comision"] - tot["gasto_prop"])
    return {
        "propiedad": {"id": prop["_id"], "codigo": prop.get("codigo"), "titulo": prop.get("titulo"), "moneda": prop.get("moneda", "ARS")},
        "propietario": prop.get("propietario") or {},
        "periodo": {"desde": desde, "hasta": hasta},
        "ingresos": round(tot["ingreso"]), "comision": round(tot["comision"]),
        "gastosPropietario": round(tot["gasto_prop"]), "gastosNuestros": round(tot["gasto_nuestro"]),
        "netoPropietario": neto, "movimientos": movs,
    }


@router.get("/liquidacion/pdf")
async def liquidacion_pdf(propertyId: str = Query(...), desde: str = Query(...), hasta: str = Query(...)):
    data = await liquidacion(propertyId=propertyId, desde=desde, hasta=hasta)
    from rentals_pdf import build_liquidacion_pdf
    pdf = build_liquidacion_pdf(data)
    cod = data["propiedad"].get("codigo") or "liquidacion"
    fname = f"Liquidacion-{cod}-{desde}_a_{hasta}.pdf"
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ---------------- Liquidación por reserva efectuada (seña pagada) --------- #
@router.get("/properties/{pid}/liquidables")
async def liquidables(pid: str):
    """Reservas efectuadas (seña pagada) de una propiedad, para liquidar al propietario."""
    await _get_prop(pid)
    cur = _res().find({"propertyId": pid, "pago.estado": "pagado"})
    out = [_res_out(r) async for r in cur]
    out.sort(key=lambda r: (r.get("pago") or {}).get("pagadoEl") or r.get("checkIn") or "", reverse=True)
    return out


async def _liquidacion_reserva(rid: str) -> dict:
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    prop = await _get_prop(r.get("propertyId"))
    mon = r.get("moneda", "ARS")
    tot = {"ingreso": 0.0, "gasto_prop": 0.0, "gasto_nuestro": 0.0, "comision": 0.0}
    movs = []
    # Imputamos los movimientos atados a la reserva + los gastos de la Ficha financiera
    # de la propiedad (sin reserva) que caen dentro de las fechas de la estadía.
    ci, co = r.get("checkIn"), r.get("checkOut")
    query = {"$or": [
        {"reservaId": rid},
        {"propertyId": r.get("propertyId"), "reservaId": None, "fecha": {"$gte": ci, "$lte": co}},
    ]}
    cur = _movs().find(query).sort("fecha", 1)
    async for m in cur:
        t = m.get("tipo")
        if t in tot:
            tot[t] += float(m.get("monto") or 0)
        movs.append(_mov_out(m))
    alquiler = float(r.get("montoEstimado") or 0)
    ingresos = round(alquiler + tot["ingreso"])
    neto = round(ingresos - tot["comision"] - tot["gasto_prop"])
    h = r.get("huesped") or {}
    return {
        "reserva": {"id": r["_id"], "checkIn": r.get("checkIn"), "checkOut": r.get("checkOut"), "noches": r.get("noches")},
        "huesped": h, "pago": r.get("pago") or {},
        "propiedad": {"id": prop["_id"], "codigo": prop.get("codigo"), "titulo": prop.get("titulo"), "moneda": mon},
        "propietario": prop.get("propietario") or {},
        "periodo": {"desde": r.get("checkIn"), "hasta": r.get("checkOut")},
        "alquiler": round(alquiler),
        "ingresos": ingresos, "comision": round(tot["comision"]),
        "gastosPropietario": round(tot["gasto_prop"]), "gastosNuestros": round(tot["gasto_nuestro"]),
        "netoPropietario": neto, "movimientos": movs,
    }


@router.get("/reservations/{rid}/liquidacion")
async def liquidacion_reserva(rid: str):
    return await _liquidacion_reserva(rid)


@router.get("/reservations/{rid}/liquidacion/pdf")
async def liquidacion_reserva_pdf(rid: str):
    data = await _liquidacion_reserva(rid)
    from rentals_pdf import build_liquidacion_pdf
    pdf = build_liquidacion_pdf(data)
    cod = data["propiedad"].get("codigo") or "liquidacion"
    nombre = (data.get("huesped") or {}).get("nombre", "reserva").split(" ")[0]
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Liquidacion-{cod}-{nombre}.pdf"'},
    )


# ------------------------------ Pagos (Mercado Pago) --------------------- #
async def _create_sena_link(r: dict, monto: float) -> dict:
    """Crea la preference de la seña en Mercado Pago y la guarda en la reserva."""
    prop = await _props().find_one({"_id": r.get("propertyId")})
    h = r.get("huesped") or {}
    titulo = f"Seña alquiler · {(prop or {}).get('codigo') or ''} {r.get('propertyTitulo') or ''}".strip()
    desc = f"{r.get('checkIn')} → {r.get('checkOut')} · {h.get('nombre') or 'Huésped'}"
    import payments_mp
    pref = await payments_mp.create_preference(
        titulo=titulo, descripcion=desc, monto=monto,
        external_reference=r["_id"], payer_email=h.get("email") or None,
    )
    pago = {
        "proveedor": "mercadopago", "monto": round(float(monto)), "moneda": "ARS",
        "estado": "pendiente", "preferenceId": pref["preference_id"],
        "initPoint": pref["init_point"], "creadoEl": _now(),
    }
    await _res().update_one({"_id": r["_id"]}, {"$set": {"pago": pago}})
    return pago


@router.get("/reservations/{rid}")
async def get_reservation(rid: str):
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    return _res_out(r)


@router.get("/reservations/{rid}/recibo-sena")
async def recibo_sena(rid: str, dl: int = 0):
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    pago = r.get("pago") or {}
    if not pago.get("monto"):
        raise HTTPException(400, "La reserva no tiene una seña registrada.")
    prop = await _props().find_one({"_id": r.get("propertyId")})
    from rentals_pdf import build_recibo_sena_pdf
    data = {
        "propiedad": {"codigo": (prop or {}).get("codigo"), "titulo": r.get("propertyTitulo") or (prop or {}).get("titulo")},
        "huesped": r.get("huesped") or {}, "pago": pago, "moneda": r.get("moneda", "ARS"),
        "checkIn": r.get("checkIn"), "checkOut": r.get("checkOut"),
        "noches": r.get("noches"), "montoEstimado": r.get("montoEstimado"),
    }
    pdf = build_recibo_sena_pdf(data)
    cod = data["propiedad"].get("codigo") or "reserva"
    nombre = (r.get("huesped") or {}).get("nombre", "huesped").split(" ")[0]
    disp = "attachment" if dl else "inline"
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'{disp}; filename="Recibo-sena-{cod}-{nombre}.pdf"'},
    )


@router.post("/reservations/{rid}/payment-link", status_code=201)
async def create_payment_link(rid: str, body: PaymentLinkBody):
    if not appconfig.mp_configured():
        raise HTTPException(503, "Mercado Pago no configurado.")
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    if body.monto is None or body.monto <= 0:
        raise HTTPException(400, "El monto de la seña debe ser mayor a cero.")
    try:
        pago = await _create_sena_link(r, body.monto)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"No se pudo generar el link de pago: {e}")
    return {"initPoint": pago["initPoint"], "preferenceId": pago["preferenceId"], "monto": pago["monto"]}


async def _apply_mp_payment(rid: str, p: dict) -> str:
    """Aplica el estado de un pago de MP a la reserva. Devuelve el estado resultante."""
    r = await _res().find_one({"_id": rid})
    if not r:
        return "no_encontrada"
    status = p.get("status")
    estado = {"approved": "pagado", "rejected": "rechazado", "cancelled": "rechazado"}.get(status, "pendiente")
    prev = r.get("pago") or {}
    pago = {**prev, "estado": estado, "metodo": "mercadopago",
            "paymentId": str(p.get("id") or prev.get("paymentId") or ""), "mpStatus": status,
            "monto": prev.get("monto") or round(float(p.get("transaction_amount") or 0)),
            "pagadoEl": _now() if estado == "pagado" else prev.get("pagadoEl")}
    await _res().update_one({"_id": rid}, {"$set": {"pago": pago}})
    if estado == "pagado" and prev.get("estado") != "pagado":
        try:
            from documents import notifications
            await notifications.notify_sena_pagada(reserva_id=rid, nombre=(r.get("huesped") or {}).get("nombre", "Huésped"),
                                                   monto=pago.get("monto"), propiedad=r.get("propertyTitulo", ""))
        except Exception:
            pass
    return estado


@router.post("/payment-webhook")
async def payment_webhook(request: Request):
    """Notificación de Mercado Pago (webhook v2 por body o IPN por query). Verifica server-side."""
    payload = {}
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    qp = dict(request.query_params)
    tipo = (payload.get("type") or payload.get("topic") or qp.get("type") or qp.get("topic") or "")
    if "payment" not in tipo:
        return {"received": True}
    payment_id = str((payload.get("data") or {}).get("id") or payload.get("id") or qp.get("id") or qp.get("data.id") or "")
    if not payment_id:
        return {"received": True}
    import payments_mp
    try:
        p = await payments_mp.get_payment(payment_id)
    except Exception:
        return {"received": True}
    rid = p.get("external_reference")
    if rid:
        await _apply_mp_payment(rid, p)
    return {"received": True}


@router.get("/payment/verify")
async def payment_verify(reservaId: str = Query(...), paymentId: str | None = Query(None)):
    """Verifica el pago contra Mercado Pago y actualiza la reserva. Usado por la página de resultado y el panel."""
    r = await _res().find_one({"_id": reservaId})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    estado = (r.get("pago") or {}).get("estado") or "pendiente"
    if estado != "pagado" and appconfig.mp_configured():
        import payments_mp
        try:
            p = await payments_mp.get_payment(paymentId) if paymentId else await payments_mp.search_approved_payment(reservaId)
            if p and (p.get("external_reference") in (None, reservaId)):
                estado = await _apply_mp_payment(reservaId, p)
        except Exception:
            pass
    s = await _settings().find_one({"_id": "global"}) or {}
    return {
        "estado": estado, "propertyTitulo": r.get("propertyTitulo"),
        "checkIn": r.get("checkIn"), "checkOut": r.get("checkOut"),
        "huesped": (r.get("huesped") or {}).get("nombre"),
        "whatsappAgencia": s.get("whatsappAgencia") or "",
    }


@router.post("/reservations/{rid}/verificar-pago")
async def verificar_pago(rid: str):
    data = await payment_verify(reservaId=rid)
    r = await _res().find_one({"_id": rid})
    return _res_out(r)


@router.post("/reservations/{rid}/marcar-pagada")
async def marcar_pagada(rid: str, monto: float = Form(0), metodo: str = Form("manual"), file: UploadFile | None = File(None)):
    """Marca la seña como pagada a mano (transferencia/efectivo), con comprobante opcional."""
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    prev = r.get("pago") or {}
    comp = prev.get("comprobante")
    push_comp = None
    if file is not None and appconfig.supabase_configured():
        from pathlib import Path
        ext = Path(file.filename or "comp.jpg").suffix.lower() or ".jpg"
        obj = f"rentals/{r.get('propertyId')}/comprobantes/{uuid4().hex}{ext}"
        content = await file.read()
        await get_storage().upload(appconfig.BUCKET_IMAGES, obj, content, file.content_type or "image/jpeg")
        comp = {"bucket": appconfig.BUCKET_IMAGES, "object_path": obj, "contentType": file.content_type or "image/jpeg"}
        push_comp = {"id": uuid4().hex, **comp, "nombre": file.filename or "comprobante seña", "fecha": _now()}
    monto_final = round(float(monto)) if monto else (prev.get("monto") or 0)
    pago = {**prev, "estado": "pagado", "metodo": metodo, "monto": monto_final,
            "moneda": "ARS", "comprobante": comp, "pagadoEl": _now()}
    upd: dict = {"$set": {"pago": pago}}
    if push_comp:
        upd["$push"] = {"comprobantes": push_comp}
    await _res().update_one({"_id": rid}, upd)
    if prev.get("estado") != "pagado":
        try:
            from documents import notifications
            await notifications.notify_sena_pagada(reserva_id=rid, nombre=(r.get("huesped") or {}).get("nombre", "Huésped"),
                                                   monto=monto_final, propiedad=r.get("propertyTitulo", ""))
        except Exception:
            pass
    return _res_out(await _res().find_one({"_id": rid}))


@router.get("/reservations/{rid}/comprobante")
async def get_comprobante(rid: str):
    r = await _res().find_one({"_id": rid})
    comp = ((r or {}).get("pago") or {}).get("comprobante")
    if not comp:
        raise HTTPException(404, "Sin comprobante")
    data = await get_storage().download(comp["bucket"], comp["object_path"])
    return Response(content=data, media_type=comp.get("contentType", "image/jpeg"))


@router.post("/reservations/{rid}/comprobantes", status_code=201)
async def add_comprobante(rid: str, file: UploadFile = File(...)):
    """Adjunta un comprobante (recibo/transferencia) a la ficha de la reserva."""
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    if not appconfig.supabase_configured():
        raise HTTPException(503, "Almacenamiento no configurado.")
    from pathlib import Path
    ext = Path(file.filename or "comp.jpg").suffix.lower() or ".jpg"
    obj = f"rentals/{r.get('propertyId')}/comprobantes/{uuid4().hex}{ext}"
    content = await file.read()
    await get_storage().upload(appconfig.BUCKET_IMAGES, obj, content, file.content_type or "image/jpeg")
    comp = {"id": uuid4().hex, "bucket": appconfig.BUCKET_IMAGES, "object_path": obj,
            "contentType": file.content_type or "image/jpeg", "nombre": file.filename or "comprobante", "fecha": _now()}
    await _res().update_one({"_id": rid}, {"$push": {"comprobantes": comp}})
    return _res_out(await _res().find_one({"_id": rid}))


@router.get("/reservations/{rid}/comprobantes/{cid}")
async def get_comprobante_item(rid: str, cid: str):
    r = await _res().find_one({"_id": rid})
    comp = next((c for c in ((r or {}).get("comprobantes") or []) if c.get("id") == cid), None)
    if not comp:
        raise HTTPException(404, "Comprobante no encontrado")
    data = await get_storage().download(comp["bucket"], comp["object_path"])
    return Response(content=data, media_type=comp.get("contentType", "image/jpeg"))


@router.delete("/reservations/{rid}/comprobantes/{cid}", status_code=204)
async def delete_comprobante_item(rid: str, cid: str):
    await _res().update_one({"_id": rid}, {"$pull": {"comprobantes": {"id": cid}}})
    return None


@router.post("/reservations/{rid}/cobrar-saldo")
async def cobrar_saldo(
    rid: str,
    monto: float = Form(...),
    metodo: str = Form("efectivo"),
    fecha: str | None = Form(None),
    file: UploadFile | None = File(None),
):
    """Registra un cobro de saldo (efectivo/transferencia/otro), el día antes o al ingresar. Comprobante opcional."""
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    if not monto or float(monto) <= 0:
        raise HTTPException(400, "El monto del saldo cobrado debe ser mayor a cero.")
    comprobante_id = None
    push: dict = {}
    if file is not None and appconfig.supabase_configured():
        from pathlib import Path
        ext = Path(file.filename or "comp.jpg").suffix.lower() or ".jpg"
        obj = f"rentals/{r.get('propertyId')}/comprobantes/{uuid4().hex}{ext}"
        content = await file.read()
        await get_storage().upload(appconfig.BUCKET_IMAGES, obj, content, file.content_type or "image/jpeg")
        comprobante_id = uuid4().hex
        push["comprobantes"] = {"id": comprobante_id, "bucket": appconfig.BUCKET_IMAGES, "object_path": obj,
                                "contentType": file.content_type or "image/jpeg",
                                "nombre": file.filename or "comprobante saldo", "fecha": _now()}
    saldo = {"id": uuid4().hex, "monto": round(float(monto)), "metodo": metodo,
             "fecha": fecha or date.today().isoformat(), "comprobanteId": comprobante_id, "createdAt": _now()}
    push["saldos"] = saldo
    await _res().update_one({"_id": rid}, {"$push": push})
    return _res_out(await _res().find_one({"_id": rid}))


@router.delete("/reservations/{rid}/saldos/{sid}", status_code=204)
async def delete_saldo(rid: str, sid: str):
    r = await _res().find_one({"_id": rid})
    if r:
        saldo = next((s for s in (r.get("saldos") or []) if s.get("id") == sid), None)
        if saldo and saldo.get("comprobanteId"):
            await _res().update_one({"_id": rid}, {"$pull": {"comprobantes": {"id": saldo["comprobanteId"]}}})
    await _res().update_one({"_id": rid}, {"$pull": {"saldos": {"id": sid}}})
    return None


@router.get("/reservations/{rid}/saldos/{sid}/recibo")
async def recibo_saldo(rid: str, sid: str, dl: int = 0):
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    saldo = next((s for s in (r.get("saldos") or []) if s.get("id") == sid), None)
    if not saldo:
        raise HTTPException(404, "Cobro de saldo no encontrado")
    prop = await _props().find_one({"_id": r.get("propertyId")})
    calc = _pagos_calc(r)
    from rentals_pdf import build_recibo_saldo_pdf
    data = {
        "propiedad": {"codigo": (prop or {}).get("codigo"), "titulo": r.get("propertyTitulo") or (prop or {}).get("titulo")},
        "huesped": r.get("huesped") or {}, "moneda": r.get("moneda", "ARS"),
        "checkIn": r.get("checkIn"), "checkOut": r.get("checkOut"), "noches": r.get("noches"),
        "montoEstimado": r.get("montoEstimado"), "saldo": saldo,
        "totalCobrado": calc["totalCobrado"], "saldoPendiente": calc["saldoPendiente"],
    }
    pdf = build_recibo_saldo_pdf(data)
    cod = data["propiedad"].get("codigo") or "reserva"
    nombre = (r.get("huesped") or {}).get("nombre", "huesped").split(" ")[0]
    disp = "attachment" if dl else "inline"
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'{disp}; filename="Recibo-saldo-{cod}-{nombre}.pdf"'},
    )


async def _next_numero(tipo: str) -> int:
    """Numeración secuencial por tipo de documento. Contrato arranca después de 3435."""
    base = {"contrato": 3435, "reserva": 0}.get(tipo, 0)
    doc = await _db()["rental_counters"].find_one_and_update(
        {"_id": tipo}, {"$inc": {"seq": 1}, "$setOnInsert": {"base": base}},
        upsert=True, return_document=ReturnDocument.AFTER)
    return int(doc.get("base", base)) + int(doc.get("seq", 0))


async def _assign_numero(rid: str, r: dict, campo: str, tipo: str) -> int:
    if r.get(campo):
        return r[campo]
    n = await _next_numero(tipo)
    await _res().update_one({"_id": rid}, {"$set": {campo: n}})
    return n


def _doc_prop(prop: dict, r: dict) -> dict:
    prop = prop or {}
    limpieza = r.get("limpiezaOverride")
    if limpieza is None:
        limpieza = prop.get("limpieza") or 0
    return {
        "codigo": prop.get("codigo"), "titulo": r.get("propertyTitulo") or prop.get("titulo"),
        "direccion": prop.get("direccion"), "localidad": prop.get("localidad"),
        "checkInHora": prop.get("checkInHora"), "checkOutHora": prop.get("checkOutHora"),
        "capacidad": prop.get("capacidad"), "aceptaMascotas": prop.get("aceptaMascotas"),
        "ropaBlanca": prop.get("ropaBlanca"), "tipo": prop.get("tipo"), "dormitorios": prop.get("dormitorios"),
        "penalidadDiaria": prop.get("penalidadDiaria") or 0, "limpieza": limpieza,
    }


@router.get("/reservations/{rid}/documento/reserva")
async def documento_reserva(rid: str, dl: int = 0):
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    prop = await _props().find_one({"_id": r.get("propertyId")})
    nro = await _assign_numero(rid, r, "nroReserva", "reserva")
    calc = _pagos_calc(r)
    # "sena" del documento = total cobrado hasta ahora (seña + adelantos registrados luego vía Cobrar saldo),
    # para que el texto (números y en letras) quede consistente con el saldo pendiente mostrado abajo.
    sena = float(calc["totalCobrado"])
    deposito = r.get("depositoOverride")
    if deposito is None:
        deposito = (prop or {}).get("depositoGarantia") or 0
    limpieza = r.get("limpiezaOverride")
    if limpieza is None:
        limpieza = (prop or {}).get("limpieza") or 0
    from rentals_pdf import build_reserva_pdf
    data = {
        "nroReserva": nro, "propiedad": _doc_prop(prop, r), "huesped": r.get("huesped") or {},
        "moneda": r.get("moneda", "ARS"), "checkIn": r.get("checkIn"), "checkOut": r.get("checkOut"),
        "noches": r.get("noches"), "montoEstimado": r.get("montoEstimado"), "sena": sena,
        "depositoGarantia": deposito, "limpieza": limpieza, "saldoPendiente": calc["saldoPendiente"],
    }
    pdf = build_reserva_pdf(data)
    disp = "attachment" if dl else "inline"
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'{disp}; filename="Reserva-{nro}.pdf"'})


@router.get("/reservations/{rid}/documento/contrato")
async def documento_contrato(rid: str, dl: int = 0):
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    prop = await _props().find_one({"_id": r.get("propertyId")})
    nro = await _assign_numero(rid, r, "nroContrato", "contrato")
    deposito = r.get("depositoOverride")
    if deposito is None:
        deposito = (prop or {}).get("depositoGarantia") or 0
    from rentals_pdf import build_contrato_pdf
    data = {
        "nroContrato": nro, "propiedad": _doc_prop(prop, r), "huesped": r.get("huesped") or {},
        "moneda": r.get("moneda", "ARS"), "checkIn": r.get("checkIn"), "checkOut": r.get("checkOut"),
        "noches": r.get("noches"), "montoEstimado": r.get("montoEstimado"),
        "depositoGarantia": deposito,
    }
    pdf = build_contrato_pdf(data)
    disp = "attachment" if dl else "inline"
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'{disp}; filename="Contrato-{nro}.pdf"'})


# --------------------- Importar desde el CRM de ventas -------------------- #
@router.get("/sale-properties")
async def sale_properties(query: str | None = Query(None)):
    if not appconfig.supabase_configured():
        raise HTTPException(503, "CRM de ventas no configurado.")
    import asyncio
    rows = await property_repository.list_properties(status=None, query=query)

    async def _cover(r: dict) -> str:
        imgs = r.get("property_images") or []
        c = next((i for i in imgs if i.get("is_cover")), None) or (imgs[0] if imgs else None)
        if not c:
            return ""
        try:
            return await get_storage().signed_url(c["bucket"], c["object_path"], appconfig.SIGNED_URL_TTL_SECONDS)
        except Exception:
            return ""

    covers = await asyncio.gather(*[_cover(r) for r in rows])
    return [{
        "id": r["id"], "titulo": r.get("title") or "Sin título",
        "direccion": r.get("address") or "", "localidad": r.get("city") or r.get("neighborhood") or "",
        "dormitorios": r.get("bedrooms") or 0, "banos": r.get("bathrooms") or 0,
        "fotos": len(r.get("property_images") or []), "cover": covers[i],
    } for i, r in enumerate(rows)]


@router.post("/import/{sale_id}", status_code=201)
async def import_from_sale(sale_id: str):
    if not appconfig.supabase_configured():
        raise HTTPException(503, "CRM de ventas no configurado.")
    sp = await property_repository.get(sale_id)
    if not sp:
        raise HTTPException(404, "Propiedad de venta no encontrada")
    from pathlib import Path
    pid = uuid4().hex
    bedrooms = int(sp.get("bedrooms") or 0)
    doc = {
        "_id": pid, "slug": _slugify(sp.get("title") or "propiedad"),
        "titulo": sp.get("title") or "Propiedad importada",
        "direccion": sp.get("address") or "",
        "localidad": sp.get("city") or sp.get("neighborhood") or "Costa del Este",
        "descripcion": sp.get("description") or "",
        "capacidad": max(2, bedrooms * 2) if bedrooms else 2,
        "dormitorios": bedrooms, "banos": int(sp.get("bathrooms") or 0),
        "amenities": [], "moneda": "ARS", "precioNoche": 0,
        "descSemana": 0, "descQuincena": 0, "descMes": 0,
        "descSemanaMin": 6, "descQuincenaMin": 12, "descMesMin": 25, "activa": False,
        "propietario": {}, "imagenes": [], "importadaDe": sale_id, "createdAt": _now(),
    }
    doc["codigo"] = await _next_code()
    imgs = sorted(sp.get("property_images") or [], key=lambda i: i.get("position", 0))
    for idx, im in enumerate(imgs[:15]):
        try:
            data = await get_storage().download(im["bucket"], im["object_path"])
            ext = Path(im.get("object_path") or "img.jpg").suffix.lower() or ".jpg"
            img_id = uuid4().hex
            object_path = f"rentals/{pid}/images/{img_id}{ext}"
            await get_storage().upload(appconfig.BUCKET_IMAGES, object_path, data, im.get("mime_type") or "image/jpeg")
            doc["imagenes"].append({
                "id": img_id, "bucket": appconfig.BUCKET_IMAGES, "object_path": object_path,
                "position": idx, "isCover": im.get("is_cover", idx == 0),
                "contentType": im.get("mime_type") or "image/jpeg",
            })
        except Exception:
            continue
    await _props().insert_one(doc)
    return _prop_out(doc)


# ================================ PÚBLICO =============================== #
@router.get("/public/properties")
async def public_properties():
    await _ensure_codes()
    cur = _props().find({"activa": True}).sort("createdAt", -1)
    return [_prop_out(p, public=True) async for p in cur]


@router.get("/public/properties/{slug}")
async def public_property(slug: str):
    p = await _props().find_one({"slug": slug})
    if not p or not p.get("activa", True):
        raise HTTPException(404, "Propiedad no encontrada")
    out = _prop_out(p, public=True)
    out["ocupados"] = await _occupied(p["_id"])
    out["descuentos"] = {
        "semana": p.get("descSemana", 0), "quincena": p.get("descQuincena", 0), "mes": p.get("descMes", 0),
        "semanaMin": p.get("descSemanaMin", 6), "quincenaMin": p.get("descQuincenaMin", 12), "mesMin": p.get("descMesMin", 25),
    }
    return out


@router.get("/public/quote")
async def public_quote(slug: str = Query(...), checkIn: str = Query(...), checkOut: str = Query(...)):
    p = await _props().find_one({"slug": slug})
    if not p:
        raise HTTPException(404, "Propiedad no encontrada")
    if _nights(checkIn, checkOut) < 1:
        raise HTTPException(400, "Rango inválido")
    return _quote(p, checkIn, checkOut)


@router.post("/public/properties/{slug}/prereserva", status_code=201)
async def public_prereserva(slug: str, body: PrereservaBody):
    p = await _props().find_one({"slug": slug})
    if not p or not p.get("activa", True):
        raise HTTPException(404, "Propiedad no encontrada")
    if not body.aceptaCondiciones:
        raise HTTPException(400, "Tenés que leer y aceptar las condiciones para enviar la pre-reserva.")
    await _assert_free(p["_id"], body.checkIn, body.checkOut)
    q = _quote(p, body.checkIn, body.checkOut)
    minima = int(p.get("estadiaMinima") or 0)
    if minima and q["noches"] < minima:
        raise HTTPException(400, f"La estadía mínima en esta propiedad es de {minima} noches.")
    doc = {
        "_id": uuid4().hex, "propertyId": p["_id"], "propertyTitulo": p.get("titulo"),
        "estado": "prereserva", "checkIn": body.checkIn, "checkOut": body.checkOut,
        "noches": q["noches"], "montoEstimado": q["total"], "moneda": p.get("moneda", "ARS"),
        "origen": body.origen or "Directo",
        "huesped": {
            "nombre": body.nombre, "telefono": body.telefono, "email": body.email,
            "dni": body.dni, "huespedes": body.huespedes, "comentario": body.comentario,
        },
        "condicionesAceptadas": {"aceptado": True, "fecha": _now()},
        "createdAt": _now(),
    }
    await _res().insert_one(doc)
    try:
        from documents import notifications
        h = doc["huesped"]
        await notifications.create(
            type="rental_prereserva",
            title="Nueva pre-reserva de alquiler",
            message=f"{h.get('nombre') or 'Un huésped'} solicitó {p.get('titulo')} · {body.checkIn} → {body.checkOut} ({q['noches']} noches) · Origen: {body.origen or 'Directo'}",
            link="/alquileres",
        )
    except Exception:
        pass
    return {"ok": True, "reservaId": doc["_id"], "estado": "prereserva", "total": q["total"], "moneda": q["moneda"]}


@router.get("/public/image/{img_id}")
async def public_image(img_id: str):
    p = await _props().find_one({"imagenes.id": img_id})
    if not p:
        raise HTTPException(404, "Imagen no encontrada")
    img = next((i for i in p["imagenes"] if i["id"] == img_id), None)
    if not img:
        raise HTTPException(404, "Imagen no encontrada")
    data = await get_storage().download(img["bucket"], img["object_path"])
    return Response(content=data, media_type=img.get("contentType", "image/jpeg"), headers={"Cache-Control": "public, max-age=86400"})
