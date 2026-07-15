"""SQLAlchemy ORM models — the persistent shape of VERA domain data."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    workspace_id: Mapped[str] = mapped_column(String(64), index=True, default="vera-default")
    title: Mapped[str] = mapped_column(String(255))
    operation: Mapped[str] = mapped_column(String(20), default="venta")
    type: Mapped[str] = mapped_column(String(30), default="departamento")
    price: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    address: Mapped[str] = mapped_column(String(255), default="")
    neighborhood: Mapped[str] = mapped_column(String(120), default="")
    city: Mapped[str] = mapped_column(String(120), default="")
    bedrooms: Mapped[int] = mapped_column(Integer, default=0)
    bathrooms: Mapped[int] = mapped_column(Integer, default=0)
    area_m2: Mapped[float] = mapped_column(Float, default=0)
    year_built: Mapped[str] = mapped_column(String(10), default="")
    video_url: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    images: Mapped[list["PropertyImage"]] = relationship(
        back_populates="property",
        cascade="all, delete-orphan",
        order_by="PropertyImage.position",
    )
    documents: Mapped[list["PropertyDocument"]] = relationship(
        back_populates="property", cascade="all, delete-orphan"
    )


class PropertyImage(Base):
    __tablename__ = "property_images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    property_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("properties.id", ondelete="CASCADE"), index=True
    )
    workspace_id: Mapped[str] = mapped_column(String(64), index=True, default="vera-default")
    bucket: Mapped[str] = mapped_column(String(64))
    object_path: Mapped[str] = mapped_column(String(500))
    original_name: Mapped[str] = mapped_column(String(255))
    stored_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(120), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_cover: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    property: Mapped["Property"] = relationship(back_populates="images")


class PropertyDocument(Base):
    __tablename__ = "property_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    property_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("properties.id", ondelete="CASCADE"), index=True
    )
    workspace_id: Mapped[str] = mapped_column(String(64), index=True, default="vera-default")
    doc_type: Mapped[str] = mapped_column(String(40), default="plano")
    bucket: Mapped[str] = mapped_column(String(64))
    object_path: Mapped[str] = mapped_column(String(500))
    original_name: Mapped[str] = mapped_column(String(255))
    stored_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(120), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    property: Mapped["Property"] = relationship(back_populates="documents")
