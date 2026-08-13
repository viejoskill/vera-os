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
        "id": p["_id"], "slug": p.get("slug"), "titulo": p.get("titulo"),
        "direccion": p.get("direccion"), "localidad": p.get("localidad"),
        "descripcion": p.get("descripcion"), "capacidad": p.get("capacidad"),
        "dormitorios": p.get("dormitorios"), "banos": p.get("banos"),
        "amenities": p.get("amenities") or [], "moneda": p.get("moneda", "ARS"),
        "precioNoche": p.get("precioNoche"), "activa": p.get("activa", True),
        "imagenes": [{"id": i["id"], "url": _img_url(i["id"]), "isCover": i.get("isCover", False)} for i in imgs],
    }
    if not public:
        out.update({
            "descSemana": p.get("descSemana", 0), "descQuincena": p.get("descQuincena", 0),
            "descMes": p.get("descMes", 0), "createdAt": p.get("createdAt"),
            "propietario": p.get("propietario") or {},
        })
    return out


def _res_out(r: dict) -> dict:
    return {
        "id": r["_id"], "propertyId": r.get("propertyId"), "propertyTitulo": r.get("propertyTitulo"),
        "estado": r.get("estado"), "checkIn": r.get("checkIn"), "checkOut": r.get("checkOut"),
        "noches": r.get("noches"), "montoEstimado": r.get("montoEstimado"), "moneda": r.get("moneda", "ARS"),
        "origen": r.get("origen"), "motivo": r.get("motivo"),
        "huesped": r.get("huesped") or {}, "createdAt": r.get("createdAt"),
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
    propietario: OwnerBody | None = None


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
    cur = _props().find().sort("createdAt", -1)
    return [_prop_out(p) async for p in cur]


@router.post("/properties", status_code=201)
async def create_property(body: PropertyBody):
    doc = body.model_dump()
    doc["_id"] = uuid4().hex
    doc["slug"] = _slugify(body.titulo)
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
    return _res_out(await _res().find_one({"_id": rid}))


@router.delete("/reservations/{rid}", status_code=204)
async def delete_reservation(rid: str):
    await _res().delete_one({"_id": rid})


@router.get("/properties/{pid}/calendar")
async def property_calendar(pid: str):
    await _get_prop(pid)
    return {"ocupados": await _occupied(pid)}


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
    await _assert_free(p["_id"], body.checkIn, body.checkOut)
    q = _quote(p, body.checkIn, body.checkOut)
    doc = {
        "_id": uuid4().hex, "propertyId": p["_id"], "propertyTitulo": p.get("titulo"),
        "estado": "prereserva", "checkIn": body.checkIn, "checkOut": body.checkOut,
        "noches": q["noches"], "montoEstimado": q["total"], "moneda": p.get("moneda", "ARS"),
        "origen": body.origen or "Directo",
        "huesped": {
            "nombre": body.nombre, "telefono": body.telefono, "email": body.email,
            "dni": body.dni, "huespedes": body.huespedes, "comentario": body.comentario,
        },
        "createdAt": _now(),
    }
    await _res().insert_one(doc)
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
