"""Motor de firmas — transversal a TODOS los documentos de VERA.

Principio de producto: **el usuario firma un Documento, no un PDF**. La firma
pertenece al Documento; el PDF (o DOCX/HTML) es solo una representación que puede
generarse antes o después de firmar. Por eso este motor no conoce el formato de
salida: solo emite un *contrato de render* que un generador futuro consumirá.

Arquitectura (adapter): VERA nunca "sabe quién firma". Habla con un
`SignatureProvider`. Hoy el driver es `VeraNativeSignatureProvider` (firma dentro
de VERA + bloque de certificación propio). Mañana se suman DocuSign / Adobe Sign
implementando la MISMA interfaz, sin tocar el resto del sistema.
"""
from __future__ import annotations

import hashlib
import secrets
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

# El enlace de firma vence a los 7 días (configurable a futuro por template).
TOKEN_TTL = timedelta(days=7)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ============================ Tokens de firma ============================== #
def new_token() -> str:
    """Token seguro, único e imposible de adivinar (identifica al participante)."""
    return secrets.token_urlsafe(32)


def token_expiry() -> str:
    return (_now() + TOKEN_TTL).isoformat()


def is_token_valid(participant: dict) -> bool:
    """El token vale si no fue usado (participante sin firmar) y no venció."""
    if participant.get("signature_status") in ("signed", "rejected"):
        return False
    exp = participant.get("expires_at")
    if not exp:
        return True
    try:
        return datetime.fromisoformat(exp) > _now()
    except ValueError:
        return True


# ===================== Contrato de render (para el PDF) ==================== #
class SignatureRenderStrategy(ABC):
    """Cómo se REPRESENTA la firma en la salida (PDF/DOCX/HTML).

    NO genera archivos: devuelve una especificación declarativa que el generador
    de salida (futuro) traduce a su formato. Así el motor de firmas queda
    desacoplado del formato final.
    """

    method: str

    @abstractmethod
    def block(self, participant: dict) -> dict:
        ...


class PresencialRenderStrategy(SignatureRenderStrategy):
    method = "presencial"

    def block(self, participant: dict) -> dict:
        # Línea de firma manuscrita (papel) o imagen incrustada (dibujada/escaneada).
        data = participant.get("signature_data") or {}
        return {
            "kind": "handwritten",
            "role": participant.get("role"),
            "name": participant.get("person_name"),
            "image": data.get("image"),            # data URL si dibujó/escaneó
            "line": True,                           # siempre hay línea + aclaración
            "caption": participant.get("person_name") or "Aclaración",
        }


class DigitalRenderStrategy(SignatureRenderStrategy):
    method = "digital"

    def block(self, participant: dict) -> dict:
        # Bloque de certificación digital (firmante, fecha/hora, hash, estado).
        data = participant.get("signature_data") or {}
        return {
            "kind": "certification",
            "role": participant.get("role"),
            "name": participant.get("person_name"),
            "signedAt": participant.get("signed_at"),
            "hash": data.get("hash"),
            "typedName": data.get("typedName"),
            "status": participant.get("signature_status"),
            "issuer": "VERA · Firma electrónica",
        }


_STRATEGIES = {
    "presencial": PresencialRenderStrategy(),
    "digital": DigitalRenderStrategy(),
}


def render_strategy(method: str | None) -> SignatureRenderStrategy | None:
    return _STRATEGIES.get(method or "")


# ============================ SignatureProvider ============================ #
class SignatureProvider(ABC):
    """Contrato estable de firma. La app solo habla con esta interfaz."""

    id: str
    name: str

    @abstractmethod
    def build_signature_data(self, participant: dict, submission: dict) -> dict:
        """Materializa la firma (dibujo/tipeo/escaneo) → dato de firma a persistir."""
        ...


class VeraNativeSignatureProvider(SignatureProvider):
    """Firma nativa de VERA (sin proveedor externo). Arma la certificación propia."""

    id = "vera-native"
    name = "VERA · Firma electrónica"

    def build_signature_data(self, participant: dict, submission: dict) -> dict:
        method = participant.get("signature_method") or "digital"
        material = "|".join([
            participant.get("id", ""),
            participant.get("document_id", ""),
            participant.get("person_id", "") or "",
            submission.get("typed_name") or "",
            _now().isoformat(),
        ])
        integrity_hash = hashlib.sha256(material.encode("utf-8")).hexdigest()
        data: dict = {"provider": self.id, "hash": integrity_hash, "method": method}
        if submission.get("typed_name"):
            data["typedName"] = submission["typed_name"]
        if submission.get("signature_image"):
            data["image"] = submission["signature_image"]
        if submission.get("mode"):
            data["mode"] = submission["mode"]   # paper | drawn | scanned
        return data


# Punto ÚNICO de acoplamiento del proveedor (cambiar acá = cambiar de motor).
active_signature_provider: SignatureProvider = VeraNativeSignatureProvider()


# =============================== Canales =================================== #
def sign_url(base_url: str, token: str) -> str:
    """Enlace público de firma. El frontend sirve `/firma/{token}`."""
    base = (base_url or "").rstrip("/")
    return f"{base}/firma/{token}"


def channel_payload(channel: str, url: str, document: dict, participant: dict) -> dict:
    """Arma el envío para un canal. Todos usan EL MISMO token/enlace.

    VERA propone (genera enlace + mensaje sugerido); el envío efectivo es una
    acción del usuario (abrir WhatsApp / mail / copiar), coherente con el resto
    del producto (VERA no manda solo).
    """
    name = participant.get("person_name") or "Hola"
    title = document.get("title") or "un documento"
    message = (
        f"Hola {name}, te comparto {title} para tu firma. "
        f"Podés firmarlo desde este enlace seguro: {url}"
    )
    result = {"channel": channel, "url": url, "message": message}
    if channel == "whatsapp":
        result["whatsappUrl"] = f"https://wa.me/?text={quote(message)}"
    elif channel == "email":
        subject = quote(f"Firma de documento — {title}")
        result["mailtoUrl"] = f"mailto:?subject={subject}&body={quote(message)}"
    return result
