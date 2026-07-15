"""Operations Service — the commercial pipeline (deals) lifecycle."""
from models import OperationCreate, OperationUpdate, new_id, now_iso
from services.repository import Repository

STAGES = [
    {"id": "lead", "label": "Lead"},
    {"id": "contacted", "label": "Contactado"},
    {"id": "visit", "label": "Visita"},
    {"id": "negotiation", "label": "Negociación"},
    {"id": "closed", "label": "Cerrada"},
]


class OperationService:
    def __init__(self, db):
        self.repo = Repository(db.operations)

    def stages(self):
        return STAGES

    async def list_operations(self, stage=None):
        query = {}
        if stage and stage != "all":
            query["stage"] = stage
        return await self.repo.list(query, sort=[("updated_at", -1)])

    async def create_operation(self, data: OperationCreate):
        doc = data.model_dump()
        doc["id"] = new_id()
        doc["created_at"] = now_iso()
        doc["updated_at"] = now_iso()
        return await self.repo.create(doc)

    async def update_operation(self, id, patch: OperationUpdate):
        data = patch.model_dump(exclude_none=True)
        data["updated_at"] = now_iso()
        return await self.repo.update(id, data)

    async def board(self):
        ops = await self.list_operations()
        columns = []
        for st in STAGES:
            col_ops = [o for o in ops if o.get("stage") == st["id"]]
            columns.append({
                "stage": st["id"],
                "label": st["label"],
                "count": len(col_ops),
                "total_value": sum(o.get("value", 0) for o in col_ops),
                "operations": col_ops,
            })
        return columns
