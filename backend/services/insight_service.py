"""Insight Service — turns raw data into metrics. Pure aggregation, no UI concerns."""
from services.repository import Repository


class InsightService:
    def __init__(self, db):
        self.properties = Repository(db.properties)
        self.operations = Repository(db.operations)

    async def overview(self):
        props = await self.properties.list()
        ops = await self.operations.list()

        active = [p for p in props if p.get("status") == "active"]
        reserved = [p for p in props if p.get("status") == "reserved"]
        sold = [p for p in props if p.get("status") == "sold"]
        open_ops = [o for o in ops if o.get("stage") not in ("closed", "lost")]

        portfolio_value = sum(p.get("price", 0) for p in active)
        avg_price = round(portfolio_value / len(active)) if active else 0

        by_type = {}
        for p in props:
            by_type[p.get("type", "otro")] = by_type.get(p.get("type", "otro"), 0) + 1

        stage_labels = {
            "lead": "Lead", "contacted": "Contactado", "visit": "Visita",
            "negotiation": "Negociación", "closed": "Cerrada", "lost": "Perdida",
        }
        by_stage = {}
        for o in ops:
            by_stage[o.get("stage", "lead")] = by_stage.get(o.get("stage", "lead"), 0) + 1

        return {
            "counts": {
                "properties": len(props),
                "active": len(active),
                "reserved": len(reserved),
                "sold": len(sold),
                "open_operations": len(open_ops),
                "operations": len(ops),
            },
            "portfolio_value": portfolio_value,
            "avg_price": avg_price,
            "currency": "USD",
            "properties_by_type": [{"name": k, "value": v} for k, v in by_type.items()],
            "operations_by_stage": [
                {"name": stage_labels.get(k, k), "value": v} for k, v in by_stage.items()
            ],
            "pipeline_value": sum(o.get("value", 0) for o in open_ops),
        }
