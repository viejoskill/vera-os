"""Studio Service — content & publications (drafts, scheduled, published)."""
from models import StudioPostCreate, new_id, now_iso
from services.repository import Repository


class StudioService:
    def __init__(self, db):
        self.repo = Repository(db.studio_posts)

    async def list_posts(self, status=None):
        query = {}
        if status and status != "all":
            query["status"] = status
        return await self.repo.list(query, sort=[("created_at", -1)])

    async def create_post(self, data: StudioPostCreate):
        doc = data.model_dump()
        doc["id"] = new_id()
        doc["created_at"] = now_iso()
        return await self.repo.create(doc)

    async def delete_post(self, id):
        return await self.repo.delete(id)
