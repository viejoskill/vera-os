"""API contracts (Pydantic). camelCase on the wire to match the frontend types,
snake_case in Python. `from_attributes` lets us build straight from ORM objects."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, from_attributes=True
    )


class PropertyCreate(CamelModel):
    title: str
    operation: str = "venta"
    type: str = "departamento"
    price: float = 0
    currency: str = "USD"
    address: str = ""
    neighborhood: str = ""
    city: str = ""
    bedrooms: int = 0
    bathrooms: int = 0
    area_m2: float = 0
    year_built: str = ""
    video_url: str = ""
    status: str = "active"
    description: str = ""
    owner_id: str = ""
    owner_observations: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_place_id: str = ""
    formatted_address: str = ""
    province: str = ""
    postal_code: str = ""
    country: str = ""
    lot_area_m2: float = 0
    semi_covered_area_m2: float = 0
    rooms: int = 0
    toilettes: int = 0
    floors: int = 0
    floor_number: Optional[int] = None
    parking_covered: int = 0
    parking_uncovered: int = 0
    orientation: str = ""
    condition: str = ""
    amenities: list[str] = []
    radar: bool = False


class PropertyUpdate(CamelModel):
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
    year_built: Optional[str] = None
    video_url: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    owner_id: Optional[str] = None
    owner_observations: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_place_id: Optional[str] = None
    formatted_address: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    lot_area_m2: Optional[float] = None
    semi_covered_area_m2: Optional[float] = None
    rooms: Optional[int] = None
    toilettes: Optional[int] = None
    floors: Optional[int] = None
    floor_number: Optional[int] = None
    parking_covered: Optional[int] = None
    parking_uncovered: Optional[int] = None
    orientation: Optional[str] = None
    condition: Optional[str] = None
    amenities: Optional[list[str]] = None
    radar: Optional[bool] = None


class ImageResponse(CamelModel):
    id: str
    original_name: str
    mime_type: str
    size_bytes: int
    position: int
    is_cover: bool
    url: str = ""


class DocumentResponse(CamelModel):
    id: str
    doc_type: str
    original_name: str
    mime_type: str
    size_bytes: int
    url: str = ""


class PropertyResponse(CamelModel):
    id: str
    code: str = ""
    title: str
    operation: str
    type: str
    price: float
    currency: str
    address: str
    neighborhood: str
    city: str
    bedrooms: int
    bathrooms: int
    area_m2: float
    year_built: str
    video_url: str
    status: str
    cover_image: str = ""
    description: str
    owner_id: str = ""
    owner_observations: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_place_id: str = ""
    formatted_address: str = ""
    province: str = ""
    postal_code: str = ""
    country: str = ""
    lot_area_m2: float = 0
    semi_covered_area_m2: float = 0
    rooms: int = 0
    toilettes: int = 0
    floors: int = 0
    floor_number: Optional[int] = None
    parking_covered: int = 0
    parking_uncovered: int = 0
    orientation: str = ""
    condition: str = ""
    amenities: list[str] = []
    radar: bool = False
    publications: dict = {}
    public_url: Optional[str] = None
    archived: bool = False
    created_at: datetime
    updated_at: datetime


class ReorderRequest(CamelModel):
    image_ids: list[str]


class VisitCreate(CamelModel):
    date: str = ""
    time: str = ""
    interested: str = ""
    agent: str = ""
    comment: str = ""
    notify_owner: bool = False


class VisitResponse(CamelModel):
    id: str
    property_id: str
    date: str = ""
    time: str = ""
    interested: str = ""
    agent: str = ""
    comment: str = ""
    notify_owner: bool = False
    created_at: datetime


class PropertyDetailResponse(PropertyResponse):
    images: list[ImageResponse] = []
    documents: list[DocumentResponse] = []


class AiContentRequest(CamelModel):
    """Input for VERA content intelligence. `mode` selects the task
    (title / description / highlights / portal). Only known facts are sent;
    VERA never invents data."""
    mode: str = "title"
    portal: str = ""
    type: str = ""
    operation: str = ""
    city: str = ""
    neighborhood: str = ""
    address: str = ""
    title: str = ""
    description: str = ""
    rooms: Optional[float] = None
    bedrooms: Optional[float] = None
    bathrooms: Optional[float] = None
    toilettes: Optional[float] = None
    area_m2: Optional[float] = None
    semi_covered_area_m2: Optional[float] = None
    lot_area_m2: Optional[float] = None
    floors: Optional[float] = None
    floor_number: Optional[float] = None
    parking_covered: Optional[float] = None
    parking_uncovered: Optional[float] = None
    orientation: str = ""
    condition: str = ""
    year_built: str = ""
    amenities: list[str] = []
    near_sea: bool = False


class AiContentResponse(CamelModel):
    mode: str
    suggestions: list[str] = []
    title: str = ""
    body: str = ""


class PortalText(CamelModel):
    title: str = ""
    body: str = ""


class ExpressResponse(CamelModel):
    titles: list[str] = []
    description: str = ""
    highlights: list[str] = []
    mercadolibre: PortalText = Field(default_factory=PortalText)
    zonaprop: PortalText = Field(default_factory=PortalText)


class PublicationAction(CamelModel):
    action: str  # publish | update | unpublish
    url: Optional[str] = None  # None = no cambiar; "" = limpiar; valor = setear


class PersonCreate(CamelModel):
    """Persona (entidad de VERA Core). `roles` permite múltiples capacidades
    (propietario, comprador, inquilino, contacto, escribano...). primary_phone y
    primary_email son explícitos, además de las listas phones/emails."""
    full_name: str
    primary_phone: str = ""
    primary_email: str = ""
    phones: list[str] = []
    emails: list[str] = []
    document: str = ""
    notes: str = ""
    roles: list[str] = []
    status: str = "active"


class PersonUpdate(CamelModel):
    full_name: Optional[str] = None
    primary_phone: Optional[str] = None
    primary_email: Optional[str] = None
    phones: Optional[list[str]] = None
    emails: Optional[list[str]] = None
    document: Optional[str] = None
    notes: Optional[str] = None
    roles: Optional[list[str]] = None
    status: Optional[str] = None


class PersonResponse(CamelModel):
    id: str
    full_name: str = ""
    primary_phone: str = ""
    primary_email: str = ""
    phones: list[str] = []
    emails: list[str] = []
    document: str = ""
    notes: str = ""
    roles: list[str] = []
    status: str = "active"
    created_at: Optional[datetime] = None


class PersonListItem(PersonResponse):
    """Fila del listado de Personas, enriquecida con métricas de relación."""
    properties_count: int = 0
    conversations_count: int = 0
    last_contact: Optional[str] = None


class PersonResolveRequest(CamelModel):
    """Contrato genérico del PersonResolver. Hoy resuelve por teléfono/email; mañana
    podrá resolver por whatsapp/instagram/document/crm_id SIN cambiar la interfaz."""
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    document: Optional[str] = None
    crm_id: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
