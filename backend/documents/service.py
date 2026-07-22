"""Servicios del módulo Documentos — orquestación y reglas de arquitectura.

CRUD básico + versionado de templates + ciclo de vida único con historial por
eventos. La generación de PDF y la firma NO se implementan en este sprint.
"""
import hashlib
import json
from datetime import datetime, timezone

from fastapi import HTTPException

from documents import events, resolver, signatures
from documents.models import (
    DOCUMENT_TRANSITIONS,
    ENTITY_TYPES,
    PARTICIPANT_TRANSITIONS,
    SIGNATURE_METHODS,
    TEMPLATE_CATEGORIES,
    signature_state,
)
from documents.repository import (
    document_repository,
    participant_repository,
    relationship_repository,
    signature_repository,
    template_repository,
)
from people.repository import people_repository


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# =========================== Templates (versionado) ======================== #
async def create_template(data: dict) -> dict:
    if data.get("category") not in TEMPLATE_CATEGORIES:
        raise HTTPException(422, f"category inválida. Válidas: {TEMPLATE_CATEGORIES}")
    existing = await template_repository.max_version(data["template_key"])
    if existing:
        raise HTTPException(409, "El template_key ya existe. Usá /versions para una nueva versión.")
    row = {
        "template_key": data["template_key"],
        "name": data["name"],
        "category": data["category"],
        "version": 1,
        "description": data.get("description", ""),
        "variables": data.get("variables", []),
        "body": data.get("body"),
        "status": data.get("status", "draft"),
    }
    return await template_repository.insert(row)


async def new_template_version(template_id: str, patch: dict) -> dict:
    """Crea v+1 a partir de una versión existente (las versiones son inmutables)."""
    base = await template_repository.get(template_id)
    if base is None:
        raise HTTPException(404, "Template no encontrado")
    next_version = await template_repository.max_version(base["template_key"]) + 1
    row = {
        "template_key": base["template_key"],
        "name": patch.get("name") or base["name"],
        "category": base["category"],
        "version": next_version,
        "description": patch.get("description") if patch.get("description") is not None else base.get("description", ""),
        "variables": patch.get("variables") if patch.get("variables") is not None else base.get("variables", []),
        "body": patch.get("body") if patch.get("body") is not None else base.get("body"),
        "status": "draft",
    }
    return await template_repository.insert(row)


async def update_template(template_id: str, patch: dict) -> dict:
    clean = {k: v for k, v in patch.items() if v is not None}
    updated = await template_repository.update(template_id, clean)
    if updated is None:
        raise HTTPException(404, "Template no encontrado")
    return updated


# =============================== Documents ================================= #
def _hash_document(document: dict) -> str:
    """Hash de integridad sobre el snapshot del template + variables resueltas."""
    material = json.dumps(
        {"snapshot": document.get("template_snapshot"), "resolved": document.get("resolved_variables")},
        sort_keys=True, ensure_ascii=False, default=str,
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


async def _hydrate(document: dict) -> dict:
    document["relationships"] = await relationship_repository.list(document["id"])
    document["signatures"] = await signature_repository.list(document["id"])
    try:
        participants = await participant_repository.list(document["id"])
    except Exception:  # noqa: BLE001 — tabla document_participants aún sin migrar
        participants = []
    document["participants"] = await _hydrate_participants(participants)
    document["signature_state"] = signature_state(document["participants"])
    return document


async def _hydrate_participants(participants: list[dict]) -> list[dict]:
    """Completa `person_name` desde el repositorio de Personas (para la UI)."""
    for p in participants:
        if p.get("person_id"):
            person = await people_repository.get(p["person_id"])
            p["person_name"] = person.get("full_name") if person else None
    return participants


async def resolve_document(data: dict) -> dict:
    """Previsualiza qué completa VERA y qué datos obligatorios faltan (sin crear)."""
    template = await template_repository.get(data["template_id"])
    if template is None:
        raise HTTPException(404, "Template no encontrado")
    return await resolver.resolve(
        template, data.get("property_id"), data.get("persons") or [], data.get("inputs") or {},
    )


async def create_document(data: dict) -> dict:
    template = await template_repository.get(data["template_id"])
    if template is None:
        raise HTTPException(404, "Template no encontrado")
    _validate_signature_method(template, data.get("signature_method"))

    # Relaciones desde el wizard (property + persons con rol) y/o explícitas.
    rels: list[dict] = []
    if data.get("property_id"):
        rels.append({"entity_type": "property", "entity_id": data["property_id"], "role": None})
    for p in data.get("persons") or []:
        rels.append({"entity_type": "person", "entity_id": p["person_id"], "role": p.get("role")})
    for r in data.get("relationships") or []:
        rels.append(r)
    if not rels:
        raise HTTPException(422, "Un documento nunca existe aislado: requiere al menos una relación.")
    for r in rels:
        if r["entity_type"] not in ENTITY_TYPES:
            raise HTTPException(422, f"entity_type inválido: {r['entity_type']}")

    # VERA completa automáticamente; si falta un dato obligatorio, no se crea.
    resolution = await resolver.resolve(
        template, data.get("property_id"), data.get("persons") or [], data.get("inputs") or {},
    )
    if resolution["missing"]:
        raise HTTPException(422, {
            "message": "Faltan datos obligatorios para crear el documento.",
            "missing": resolution["missing"],
        })

    # Snapshot CONGELADO de la versión del template (trazabilidad/auditoría).
    snapshot = {
        "templateId": template["id"],
        "name": template["name"],
        "version": template["version"],
        "variables": template.get("variables", []),
        "signatureMethods": template.get("signature_methods", []),
        "body": template.get("body"),
    }
    row = {
        "template_id": template["id"],
        "template_key": template["template_key"],
        "template_version": template["version"],
        "template_snapshot": snapshot,
        "category": template["category"],
        "title": data.get("title") or template["name"],
        "status": "draft",
        "pdf_status": "none",
        "origin": data.get("origin", "manual"),
        "resolved_variables": resolution["resolved"],
        "created_by": data.get("created_by"),
        "last_modified_by": data.get("created_by"),
    }
    if data.get("signature_method"):
        row["signature_method"] = data["signature_method"]
    document = await document_repository.insert(row)

    await relationship_repository.insert_many([{
        "document_id": document["id"], "entity_type": r["entity_type"],
        "entity_id": r["entity_id"], "role": r.get("role"),
    } for r in rels])

    sig_rows = [{
        "document_id": document["id"],
        "signer_person_id": s["signer_person_id"],
        "signer_role": s.get("signer_role"),
        "sign_order": s.get("sign_order"),
        "status": "pending",
    } for s in (data.get("signatures") or [])]
    await signature_repository.insert_many(sig_rows)

    # Motor de firmas: participantes (paso "Firma" del wizard). Si hay método y no
    # se detallan firmantes, se derivan de las personas (todos obligatorios, en orden).
    await _create_participants(document, data)

    await events.record(events.CREATED, document, actor=data.get("created_by"))
    return await _hydrate(document)


def _validate_signature_method(template: dict, method: str | None) -> None:
    if method is None:
        return
    if method not in SIGNATURE_METHODS:
        raise HTTPException(422, f"signatureMethod inválido. Válidos: {SIGNATURE_METHODS}")
    allowed = template.get("signature_methods") or []
    if allowed and method not in allowed:
        raise HTTPException(422, f"El template no permite firma '{method}'. Permitidos: {allowed}")


async def _create_participants(document: dict, data: dict) -> None:
    method = data.get("signature_method")
    if not method:
        return
    signers = data.get("signers") or []
    if not signers:
        # Derivar de las personas seleccionadas, en orden de selección.
        signers = [
            {"person_id": p["person_id"], "role": p.get("role"),
             "signature_required": True, "order": i}
            for i, p in enumerate(data.get("persons") or [])
        ]
    rows = [{
        "document_id": document["id"],
        "person_id": s.get("person_id"),
        "role": s.get("role"),
        "signature_required": s.get("signature_required", True),
        "signature_method": s.get("signature_method") or method,
        "order": s.get("order") if s.get("order") is not None else i,
        "signature_status": "pending",
    } for i, s in enumerate(signers)]
    await participant_repository.insert_many(rows)


async def list_documents(**filters) -> list[dict]:
    rows = await document_repository.list(**filters)
    return rows  # lista liviana (sin hidratar relaciones/firmas)


async def get_document(document_id: str) -> dict:
    document = await document_repository.get(document_id)
    if document is None:
        raise HTTPException(404, "Documento no encontrado")
    return await _hydrate(document)


async def update_document(document_id: str, patch: dict) -> dict:
    document = await document_repository.get(document_id)
    if document is None:
        raise HTTPException(404, "Documento no encontrado")
    if document.get("locked_at"):
        raise HTTPException(409, "El documento está bloqueado (firmado): no puede editarse.")
    clean = {k: v for k, v in patch.items() if v is not None}
    if clean:
        document = await document_repository.update(document_id, clean)
        await events.record(events.EDITED, document, actor=patch.get("last_modified_by"))
    return await _hydrate(document)


async def transition_document(document_id: str, target: str, actor: str | None = None) -> dict:
    document = await document_repository.get(document_id)
    if document is None:
        raise HTTPException(404, "Documento no encontrado")
    current = document.get("status", "draft")
    if target not in DOCUMENT_TRANSITIONS.get(current, set()):
        raise HTTPException(422, f"Transición inválida: {current} → {target}")

    patch: dict = {"status": target, "last_modified_by": actor}
    if target == "generated":
        # No se genera PDF en este sprint; se congela el hash de integridad.
        patch["document_hash"] = _hash_document(document)
    if target == "signed":
        patch["locked_at"] = _now()  # queda inmutable
    document = await document_repository.update(document_id, patch)

    await events.record(events.LIFECYCLE_EVENT[target], document, actor=actor)
    return await _hydrate(document)


async def document_history(document_id: str) -> list[dict]:
    if await document_repository.get(document_id) is None:
        raise HTTPException(404, "Documento no encontrado")
    return await events.history(document_id)


# ============================ Relationships ================================ #
async def add_relationship(document_id: str, rel: dict) -> dict:
    if await document_repository.get(document_id) is None:
        raise HTTPException(404, "Documento no encontrado")
    if rel["entity_type"] not in ENTITY_TYPES:
        raise HTTPException(422, f"entity_type inválido: {rel['entity_type']}")
    rows = await relationship_repository.insert_many([{
        "document_id": document_id,
        "entity_type": rel["entity_type"],
        "entity_id": rel["entity_id"],
        "role": rel.get("role"),
    }])
    return rows[0]


async def remove_relationship(document_id: str, rel_id: str) -> None:
    rels = await relationship_repository.list(document_id)
    if len(rels) <= 1:
        raise HTTPException(422, "Un documento no puede quedar sin relaciones.")
    await relationship_repository.delete(rel_id)


# ============================== Signatures ================================= #
async def add_signature(document_id: str, sig: dict) -> dict:
    if await document_repository.get(document_id) is None:
        raise HTTPException(404, "Documento no encontrado")
    rows = await signature_repository.insert_many([{
        "document_id": document_id,
        "signer_person_id": sig["signer_person_id"],
        "signer_role": sig.get("signer_role"),
        "sign_order": sig.get("sign_order"),
        "status": "pending",
    }])
    return rows[0]


async def update_signature(document_id: str, sig_id: str, status: str) -> dict:
    from documents.models import SIGNATURE_STATUSES
    if status not in SIGNATURE_STATUSES:
        raise HTTPException(422, f"status inválido. Válidos: {SIGNATURE_STATUSES}")
    stamp_field = {"shared": "shared_at", "signed": "signed_at", "rejected": "rejected_at"}.get(status)
    patch = {"status": status}
    if stamp_field:
        patch[stamp_field] = _now()
    updated = await signature_repository.update(sig_id, patch)
    if updated is None:
        raise HTTPException(404, "Firma no encontrada")
    return updated



# ========================= Motor de firmas (participantes) ================= #
async def list_participants(document_id: str) -> list[dict]:
    if await document_repository.get(document_id) is None:
        raise HTTPException(404, "Documento no encontrado")
    return await _hydrate_participants(await participant_repository.list(document_id))


async def set_signature_method(document_id: str, method: str, actor: str | None = None) -> dict:
    document = await document_repository.get(document_id)
    if document is None:
        raise HTTPException(404, "Documento no encontrado")
    if document.get("locked_at"):
        raise HTTPException(409, "El documento está firmado: no se puede cambiar el método.")
    template = await template_repository.get(document["template_id"])
    _validate_signature_method(template or {}, method)
    document = await document_repository.update(document_id, {"signature_method": method})
    # El método del documento se propaga a participantes que aún no eligieron uno.
    for p in await participant_repository.list(document_id):
        if not p.get("signature_method"):
            await participant_repository.update(p["id"], {"signature_method": method})
    await events.record(events.METHOD_SET, document, actor=actor, extra={"signatureMethod": method})
    return await _hydrate(document)


def _check_participant_transition(current: str, target: str) -> None:
    if target not in PARTICIPANT_TRANSITIONS.get(current, set()):
        raise HTTPException(422, f"Transición de firma inválida: {current} → {target}")


async def send_signature(document_id: str, participant_id: str, channel: str,
                         base_url: str, actor: str | None = None) -> dict:
    """Genera (o refresca) el token del participante y arma el envío por canal.

    Todos los canales usan EL MISMO token de firma. VERA no envía sola: devuelve
    el enlace + mensaje sugerido para que el usuario lo comparta.
    """
    document = await document_repository.get(document_id)
    if document is None:
        raise HTTPException(404, "Documento no encontrado")
    participant = await participant_repository.get(participant_id)
    if participant is None or participant["document_id"] != document_id:
        raise HTTPException(404, "Participante no encontrado")
    if participant.get("signature_status") == "signed":
        raise HTTPException(409, "El participante ya firmó.")

    token = signatures.new_token()
    await participant_repository.update(participant_id, {
        "sign_token": token,
        "expires_at": signatures.token_expiry(),
        "signature_status": "sent",
        "sent_at": _now(),
    })
    # Enviar mueve el documento a "compartido" (evento de ciclo de vida).
    if document.get("status") in ("draft", "generated"):
        document = await document_repository.update(document_id, {"status": "shared"})
        await events.record(events.SHARED, document, actor=actor)

    hydrated = await _hydrate_participants([await participant_repository.get(participant_id)])
    url = signatures.sign_url(base_url, token)
    payload = signatures.channel_payload(channel, url, document, hydrated[0])
    await events.record(events.PARTICIPANT_SENT, document, actor=actor, extra={
        "participantId": participant_id, "channel": channel, "role": hydrated[0].get("role"),
    })
    return payload


async def public_sign_view(token: str) -> dict:
    """Vista pública para el firmante (sin auth). Registra la apertura (visto)."""
    participant = await participant_repository.find_by_token(token)
    if participant is None:
        raise HTTPException(404, "Enlace de firma inválido.")
    document = await document_repository.get(participant["document_id"])
    if document is None:
        raise HTTPException(404, "Documento no encontrado")
    expired = not signatures.is_token_valid(participant)

    # Marcar "visto" la primera vez que se abre (si sigue pendiente de firma).
    if not expired and participant.get("signature_status") == "sent":
        await participant_repository.update(participant["id"],
                                            {"signature_status": "viewed", "viewed_at": _now()})
        participant["signature_status"] = "viewed"
        await events.record(events.PARTICIPANT_VIEWED, document,
                            extra={"participantId": participant["id"]})

    hydrated = (await _hydrate_participants([participant]))[0]
    snapshot = document.get("template_snapshot") or {}
    return {
        "token": token,
        "expired": expired,
        "alreadySigned": participant.get("signature_status") == "signed",
        "document": {
            "id": document["id"],
            "title": document.get("title"),
            "category": document.get("category"),
            "signatureMethod": participant.get("signature_method") or document.get("signature_method"),
            "body": snapshot.get("body"),
            "resolvedVariables": document.get("resolved_variables") or {},
        },
        "participant": {
            "id": hydrated["id"],
            "name": hydrated.get("person_name"),
            "role": hydrated.get("role"),
            "status": hydrated.get("signature_status"),
            "signatureMethod": hydrated.get("signature_method"),
        },
    }


async def submit_signature(token: str, submission: dict) -> dict:
    """El firmante firma o rechaza desde el enlace público. Invalida el token."""
    participant = await participant_repository.find_by_token(token)
    if participant is None:
        raise HTTPException(404, "Enlace de firma inválido.")
    if not signatures.is_token_valid(participant):
        raise HTTPException(410, "El enlace de firma venció o ya fue usado.")
    document = await document_repository.get(participant["document_id"])
    if document is None:
        raise HTTPException(404, "Documento no encontrado")

    action = submission.get("action", "sign")
    current = participant.get("signature_status", "pending")

    if action == "reject":
        _check_participant_transition(current, "rejected")
        await participant_repository.update(participant["id"], {
            "signature_status": "rejected", "rejected_at": _now(),
            "sign_token": None,  # invalida el token
            "signature_data": {"reason": submission.get("reason")},
        })
        await events.record(events.PARTICIPANT_REJECTED, document,
                            extra={"participantId": participant["id"], "reason": submission.get("reason")})
        return await _recompute_and_return(document)

    _check_participant_transition(current, "signed")
    data = signatures.active_signature_provider.build_signature_data(participant, submission)
    await participant_repository.update(participant["id"], {
        "signature_status": "signed", "signed_at": _now(),
        "sign_token": None,  # el token se invalida tras firmar
        "presencial_mode": submission.get("mode"),
        "signature_data": data,
    })
    await events.record(events.PARTICIPANT_SIGNED, document, extra={
        "participantId": participant["id"], "role": participant.get("role"),
        "provider": data.get("provider"),
    })
    return await _recompute_and_return(document)


async def _recompute_and_return(document: dict) -> dict:
    """Recalcula el estado agregado; si todos los obligatorios firmaron, firma el doc."""
    participants = await participant_repository.list(document["id"])
    state = signature_state(participants)
    if state == "signed" and not document.get("locked_at"):
        document = await document_repository.update(document["id"], {
            "status": "signed", "locked_at": _now(),
        })
        await events.record(events.SIGNED, document)
    return {"signatureState": state, "documentStatus": document.get("status")}
