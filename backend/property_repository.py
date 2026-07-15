"""Persistence for properties (Supabase Postgres via SQLAlchemy).
Routes/services depend on this class, never on raw SQL. Renaming or migrating the
underlying database touches only this file + db.py."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db_models import Property, PropertyDocument, PropertyImage


class SupabasePropertyRepository:
    async def list(
        self, db: AsyncSession, status: Optional[str] = None, query: Optional[str] = None
    ) -> list[Property]:
        stmt = (
            select(Property)
            .options(selectinload(Property.images))
            .order_by(Property.created_at.desc())
        )
        if status and status != "all":
            stmt = stmt.where(Property.status == status)
        result = await db.execute(stmt)
        items = list(result.scalars().all())
        if query:
            q = query.strip().lower()
            items = [
                p
                for p in items
                if q in f"{p.title} {p.neighborhood} {p.city} {p.address}".lower()
            ]
        return items

    async def get(self, db: AsyncSession, property_id: str) -> Optional[Property]:
        stmt = (
            select(Property)
            .options(selectinload(Property.images), selectinload(Property.documents))
            .where(Property.id == property_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, db: AsyncSession, data: dict, workspace_id: str) -> Property:
        prop = Property(workspace_id=workspace_id, **data)
        db.add(prop)
        await db.commit()
        return await self.get(db, prop.id)

    async def update(self, db: AsyncSession, property_id: str, patch: dict) -> Optional[Property]:
        prop = await self.get(db, property_id)
        if prop is None:
            return None
        for key, value in patch.items():
            setattr(prop, key, value)
        await db.commit()
        return await self.get(db, property_id)

    async def delete(self, db: AsyncSession, property_id: str) -> bool:
        prop = await self.get(db, property_id)
        if prop is None:
            return False
        await db.delete(prop)
        await db.commit()
        return True

    # --- files ---------------------------------------------------------------
    async def add_image(self, db: AsyncSession, image: PropertyImage) -> PropertyImage:
        db.add(image)
        await db.commit()
        await db.refresh(image)
        return image

    async def add_document(self, db: AsyncSession, doc: PropertyDocument) -> PropertyDocument:
        db.add(doc)
        await db.commit()
        await db.refresh(doc)
        return doc

    async def get_image(self, db: AsyncSession, image_id: str) -> Optional[PropertyImage]:
        result = await db.execute(select(PropertyImage).where(PropertyImage.id == image_id))
        return result.scalar_one_or_none()

    async def get_document(self, db: AsyncSession, doc_id: str) -> Optional[PropertyDocument]:
        result = await db.execute(
            select(PropertyDocument).where(PropertyDocument.id == doc_id)
        )
        return result.scalar_one_or_none()

    async def delete_image(self, db: AsyncSession, image: PropertyImage) -> None:
        await db.delete(image)
        await db.commit()

    async def delete_document(self, db: AsyncSession, doc: PropertyDocument) -> None:
        await db.delete(doc)
        await db.commit()


property_repository = SupabasePropertyRepository()
