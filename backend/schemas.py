"""API contracts (Pydantic). camelCase on the wire to match the frontend types,
snake_case in Python. `from_attributes` lets us build straight from ORM objects."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict
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
