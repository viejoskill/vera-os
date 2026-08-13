"""Alquileres Temporarios (Fase 1).

Módulo independiente del CRM de ventas. Persistencia en MongoDB; las fotos van
al mismo storage (Supabase) vía StorageService y se sirven públicamente por un
proxy. Flujo estilo Airbnb: la web pública muestra disponibilidad y el huésped
crea una PRE-RESERVA que siempre requiere confirmación interna.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
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
OCUPA = {"prereserva", "confirmada", "encurso", "bloqueo"}


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
    doc = await _db()["rental_counters"].find_one_and_update(
        {"_id": "codigo"}, {"$inc": {"seq": 1}},
        upsert=True, return_document=ReturnDocument.AFTER,
    )
    return f"CDE{doc['seq']:03d}"


async def _ensure_codes() -> None:
    """Backfill: asigna código a propiedades que aún no lo tienen (más antiguas primero)."""
    cur = _props().find({"$or": [{"codigo": {"$exists": False}}, {"codigo": None}, {"codigo": ""}]}).sort("createdAt", 1)
    async for p in cur:
        await _props().update_one({"_id": p["_id"]}, {"$set": {"codigo": await _next_code()}})


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
    if n >= 30 and prop.get("descMes"):
        disc = float(prop["descMes"])
    elif n >= 15 and prop.get("descQuincena"):
        disc = float(prop["descQuincena"])
    elif n >= 7 and prop.get("descSemana"):
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
        "checkInHora": p.get("checkInHora", ""),
        "checkOutHora": p.get("checkOutHora", ""),
        "estadiaMinima": p.get("estadiaMinima", 0),
        "condiciones": p.get("condiciones") or [],
    }
    if not public:
        out.update({
            "descSemana": p.get("descSemana", 0), "descQuincena": p.get("descQuincena", 0),
            "descMes": p.get("descMes", 0), "createdAt": p.get("createdAt"),
            "comisionPct": p.get("comisionPct", 0), "comisionMinima": p.get("comisionMinima", 0),
            "notas": p.get("notas", ""),
            "propietario": p.get("propietario") or {},
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
    }


class MovimientoBody(BaseModel):
    propertyId: str
    fecha: str
    tipo: str
    monto: float
    descripcion: str | None = ""
    reservaId: str | None = None


def _res_out(r: dict) -> dict:
    return {
        "id": r["_id"], "propertyId": r.get("propertyId"), "propertyTitulo": r.get("propertyTitulo"),
        "estado": r.get("estado"), "checkIn": r.get("checkIn"), "checkOut": r.get("checkOut"),
        "noches": r.get("noches"), "montoEstimado": r.get("montoEstimado"), "moneda": r.get("moneda", "ARS"),
        "origen": r.get("origen"), "motivo": r.get("motivo"),
        "huesped": r.get("huesped") or {}, "createdAt": r.get("createdAt"),
        "pago": r.get("pago"),
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
    activa: bool = True
    comisionPct: float = 0
    comisionMinima: float = 0
    notas: str | None = ""
    propietario: OwnerBody | None = None
    ropaBlanca: bool = False
    aceptaMascotas: bool = False
    depositoGarantia: float = 0
    checkInHora: str | None = ""
    checkOutHora: str | None = ""
    estadiaMinima: int = 0
    condiciones: list[str] = []


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


class StatusBody(BaseModel):
    estado: str
    motivo: str | None = None


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


@router.patch("/reservations/{rid}")
async def update_status(rid: str, body: StatusBody):
    r = await _res().find_one({"_id": rid})
    if not r:
        raise HTTPException(404, "Reserva no encontrada")
    upd = {"estado": body.estado, "updatedAt": _now()}
    if body.motivo is not None:
        upd["motivo"] = body.motivo
    await _res().update_one({"_id": rid}, {"$set": upd})
    # Al confirmar, el huésped queda agendado en Personas como inquilino.
    if body.estado == "confirmada" and appconfig.supabase_configured():
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
    if body.estado == "confirmada":
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
    if body.estado == "confirmada" and appconfig.mp_configured():
        r2 = await _res().find_one({"_id": rid})
        pago_prev = (r2 or {}).get("pago") or {}
        if r2 and r2.get("moneda", "ARS") == "ARS" and not pago_prev.get("initPoint"):
            sena = round(float(r2.get("montoEstimado") or 0) * 0.3)
            if sena > 0:
                try:
                    await _create_sena_link(r2, sena)
                except Exception:
                    pass
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
    }


@router.put("/settings")
async def update_settings(body: SettingsBody):
    await _settings().update_one(
        {"_id": "global"},
        {"$set": {
            "condicionesGenerales": [c.strip() for c in body.condicionesGenerales if c.strip()],
            "avisoValidez": (body.avisoValidez or "").strip() or AVISO_VALIDEZ,
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


@router.post("/payment-webhook")
async def payment_webhook(payload: dict):
    """Notificación de Mercado Pago. Verifica el pago server-side y actualiza la reserva."""
    if (payload or {}).get("type") != "payment":
        return {"received": True}
    payment_id = str(((payload or {}).get("data") or {}).get("id") or "")
    if not payment_id:
        return {"received": True}
    import payments_mp
    try:
        p = await payments_mp.get_payment(payment_id)
    except Exception:
        return {"received": True}
    rid = p.get("external_reference")
    if not rid:
        return {"received": True}
    r = await _res().find_one({"_id": rid})
    if not r:
        return {"received": True}
    status = p.get("status")
    estado = {"approved": "pagado", "rejected": "rechazado", "cancelled": "rechazado"}.get(status, "pendiente")
    pago = {**(r.get("pago") or {}), "estado": estado, "paymentId": payment_id,
            "mpStatus": status, "pagadoEl": _now() if estado == "pagado" else None}
    await _res().update_one({"_id": rid}, {"$set": {"pago": pago}})
    return {"received": True}


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
        "descSemana": 0, "descQuincena": 0, "descMes": 0, "activa": False,
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
