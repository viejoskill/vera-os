"""Property Service — single responsibility: the property portfolio.
All business logic about properties lives here. Apps only consume it."""
from models import PropertyCreate, PropertyUpdate, new_id, now_iso
from services.repository import Repository


class PropertyService:
    def __init__(self, db):
        self.repo = Repository(db.properties)

    async def list_properties(self, status=None, type=None, operation=None, q=None):
        query = {}
        if status and status != "all":
            query["status"] = status
        if type and type != "all":
            query["type"] = type
        if operation and operation != "all":
            query["operation"] = operation
        items = await self.repo.list(query, sort=[("created_at", -1)])
        if q:
            ql = q.lower()
            items = [
                p for p in items
                if ql in (p.get("title", "") + p.get("neighborhood", "") + p.get("address", "")).lower()
            ]
        return items

    async def get_property(self, id):
        return await self.repo.get(id)

    async def create_property(self, data: PropertyCreate):
        doc = data.model_dump()
        doc["id"] = new_id()
        doc["created_at"] = now_iso()
        doc["updated_at"] = now_iso()
        return await self.repo.create(doc)

    async def update_property(self, id, patch: PropertyUpdate):
        data = patch.model_dump(exclude_none=True)
        data["updated_at"] = now_iso()
        return await self.repo.update(id, data)

    async def delete_property(self, id):
        return await self.repo.delete(id)
