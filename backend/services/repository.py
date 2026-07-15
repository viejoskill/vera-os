"""Generic persistence abstraction. Services depend on this interface, not on Mongo.
To migrate to PostgreSQL/Supabase, implement the same methods against SQL and inject it."""
from typing import Any, Optional


class Repository:
    def __init__(self, collection):
        self._c = collection

    async def list(self, query: Optional[dict] = None, sort=None, limit: int = 1000):
        cursor = self._c.find(query or {}, {"_id": 0})
        if sort:
            cursor = cursor.sort(sort)
        return await cursor.to_list(limit)

    async def get(self, id: str) -> Optional[dict]:
        return await self._c.find_one({"id": id}, {"_id": 0})

    async def create(self, doc: dict) -> dict:
        await self._c.insert_one(dict(doc))
        doc.pop("_id", None)
        return doc

    async def update(self, id: str, patch: dict) -> Optional[dict]:
        clean = {k: v for k, v in patch.items() if v is not None}
        if clean:
            await self._c.update_one({"id": id}, {"$set": clean})
        return await self.get(id)

    async def delete(self, id: str) -> bool:
        res = await self._c.delete_one({"id": id})
        return res.deleted_count > 0

    async def count(self, query: Optional[dict] = None) -> int:
        return await self._c.count_documents(query or {})
