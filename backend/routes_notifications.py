"""Notificaciones in-app (`/api/notifications`). Aviso nativo de VERA."""
from fastapi import APIRouter

from documents import notifications

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications():
    items = await notifications.list_recent()
    unread = await notifications.unread_count()
    return {"items": items, "unread": unread}


@router.post("/{notification_id}/read")
async def read_notification(notification_id: str):
    await notifications.mark_read(notification_id)
    return {"ok": True}


@router.post("/read-all")
async def read_all():
    await notifications.mark_all_read()
    return {"ok": True}
