"""Domain models (input DTOs). Framework-agnostic contracts used by Services."""
from datetime import datetime, timezone
from typing import Optional
import uuid
from pydantic import BaseModel, Field


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class PropertyCreate(BaseModel):
    title: str
    operation: str = "venta"  # venta | alquiler
    type: str = "departamento"  # departamento | casa | ph | terreno | oficina | local
    price: float = 0
    currency: str = "USD"
    address: str = ""
    neighborhood: str = ""
    city: str = "Buenos Aires"
    bedrooms: int = 0
    bathrooms: int = 0
    area_m2: float = 0
    status: str = "active"  # active | reserved | sold
    cover_image: str = ""
    description: str = ""


class PropertyUpdate(BaseModel):
    title: Optional[str] = None
    operation: Optional[str] = None
    type: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    address: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    area_m2: Optional[float] = None
    status: Optional[str] = None
    cover_image: Optional[str] = None
    description: Optional[str] = None


class OperationCreate(BaseModel):
    property_id: str = ""
    property_title: str = ""
    client_name: str
    stage: str = "lead"  # lead | contacted | visit | negotiation | closed | lost
    value: float = 0
    currency: str = "USD"
    agent: str = ""
    notes: str = ""


class OperationUpdate(BaseModel):
    stage: Optional[str] = None
    value: Optional[float] = None
    agent: Optional[str] = None
    notes: Optional[str] = None
    property_title: Optional[str] = None


class StudioPostCreate(BaseModel):
    property_id: str = ""
    title: str
    channel: str = "mercadolibre"  # mercadolibre | meta | google | whatsapp
    status: str = "draft"  # draft | scheduled | published
    content: str = ""


class AiAsk(BaseModel):
    prompt: str
