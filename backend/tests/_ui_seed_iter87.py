"""Seed/cleanup for iteration 87 UI test. usage: python _ui_seed_iter87.py seed|cleanup"""
import json
import os
import sys
import requests
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
import config as c  # noqa: E402

B = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api/rentals"
db = MongoClient(c.MONGO_URL)[c.DB_NAME]
ST = "/tmp/iter87_seed.json"

if sys.argv[1] == "seed":
    a = requests.post(f"{B}/properties", json={"titulo": "TEST_iter87_sin_pct", "tipo": "casa"}).json()["id"]
    requests.post(f"{B}/reservations/manual", json={"propertyId": a, "nombre": "TEST_A", "checkIn": "2027-03-01", "checkOut": "2027-03-03", "montoTotal": 1000})
    b = requests.post(f"{B}/properties", json={"titulo": "TEST_iter87_con_pct", "tipo": "casa", "comisionPct": 10}).json()["id"]
    requests.post(f"{B}/reservations/manual", json={"propertyId": b, "nombre": "TEST_B", "checkIn": "2027-04-01", "checkOut": "2027-04-03", "montoTotal": 1000})
    db.rental_movimientos.update_many({"propertyId": b, "tipo": "comision"}, {"$set": {"fecha": "2027-04-01"}})
    db.rental_movimientos.insert_one({"_id": "TEST_ITER87_ORPH", "propertyId": b, "reservaId": "TEST_ITER87_NOPE", "fecha": "2026-01-02",
                                      "tipo": "comision", "monto": 1, "createdAt": "2026-01-02T00:00:00+00:00"})
    json.dump({"a": a, "b": b}, open(ST, "w"))
    print("seeded", a, b)
else:
    s = json.load(open(ST))
    for pid in (s["a"], s["b"]):
        for r in requests.get(f"{B}/reservations", params={"propertyId": pid}).json():
            requests.delete(f"{B}/reservations/{r['id']}")
        requests.delete(f"{B}/properties/{pid}")
        db.rental_movimientos.delete_many({"propertyId": pid})
    db.rental_movimientos.delete_one({"_id": "TEST_ITER87_ORPH"})
    print("cleaned")
