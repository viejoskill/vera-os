"""Setup/cleanup helper for iter93 UI test: TEST property + reservation (neto 180k, seña pagada hace 20 días)."""
import asyncio
import os
import sys

import requests

sys.path.insert(0, "/app/backend")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api/rentals"


def mongo(rid, upd):
    import config as appconfig
    from motor.motor_asyncio import AsyncIOMotorClient

    async def go():
        c = AsyncIOMotorClient(appconfig.MONGO_URL)
        await c[appconfig.DB_NAME]["rental_reservations"].update_one({"_id": rid}, upd)
        c.close()
    asyncio.new_event_loop().run_until_complete(go())


if sys.argv[1] == "setup":
    pid = requests.post(f"{API}/properties", json={"titulo": "TEST_iter93_UI", "tipo": "casa", "precioNoche": 1000}).json()["id"]
    rid = requests.post(f"{API}/reservations/manual", json={"propertyId": pid, "nombre": "TEST UI Huesped",
                        "checkIn": "2026-11-01", "checkOut": "2026-11-05", "montoTotal": 180000}).json()["id"]
    mongo(rid, {"$set": {"pago.estado": "pagado", "pago.monto": 50000, "pago.pagadoEl": "2026-01-01T10:00:00+00:00"}})
    print(pid, rid)
else:
    pid, rid = sys.argv[2], sys.argv[3]
    print(requests.delete(f"{API}/reservations/{rid}").status_code, requests.delete(f"{API}/properties/{pid}").status_code)
