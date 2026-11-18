"""UI setup/cleanup for iter101 (legacy payment backfill). Usage: setup | cleanup pid rid1 rid2 | secre"""
import os, sys, json, uuid, requests
from pymongo import MongoClient
sys.path.insert(0, os.path.dirname(__file__))
import conftest
tok = conftest._fetch_admin_token()
H = {"Authorization": f"Bearer {tok}"}
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api/rentals"
col = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]["rental_reservations"]


def res(pid, ci, co):
    r = requests.post(f"{API}/reservations/manual", json={"propertyId": pid, "nombre": "TEST UI Huesped101", "checkIn": ci, "checkOut": co, "montoTotal": 1617000, "senaMonto": 808500, "senaTenedor": "nosotros", "senaMetodo": "transferencia"}, headers=H).json()["id"]
    requests.patch(f"{API}/reservations/{r}", json={"estado": "confirmada"}, headers=H)
    return r


def leg(rid, neto):
    i = f"legado-{uuid.uuid4().hex[:10]}"
    col.update_one({"_id": rid}, {"$push": {"pagosPropietario": {"id": i, "monto": neto, "metodo": "transferencia", "fecha": "2026-10-20", "notas": "TEST nota", "comprobanteId": None}}})
    return i


if sys.argv[1] == "setup":
    pid = requests.post(f"{API}/properties", json={"titulo": "AAA TEST_UI_iter101", "tipo": "casa", "precioNoche": 1000, "comisionPct": 18}, headers=H).json()["id"]
    r1 = res(pid, "2027-06-01", "2027-06-06")
    r2 = res(pid, "2027-07-01", "2027-07-06")
    p1 = leg(r1, 662970)      # partial (seña neto)
    p2 = leg(r2, 1325940)     # fully paid neto
    print(json.dumps({"pid": pid, "r1": r1, "r2": r2, "p1": p1, "p2": p2}))
elif sys.argv[1] == "secre":
    supa_url = os.environ["REACT_APP_SUPABASE_URL"]; key = os.environ["REACT_APP_SUPABASE_ANON_KEY"]
    t = requests.post(f"{supa_url}/auth/v1/token?grant_type=password", headers={"apikey": key}, json={"email": "qa.secretaria.roles@vera-qa.com", "password": "IJgnZ*prS5WO"}).json().get("access_token")
    print("secre token", bool(t))
    if t:
        S = {"Authorization": f"Bearer {t}"}
        print("GET legado", requests.get(f"{API}/liquidacion/pagos-legado", headers=S).status_code)
        print("POST aplicar empty", requests.post(f"{API}/liquidacion/pagos-legado/aplicar", json={"items": []}, headers=S).status_code)
        print("PUT bad pago", requests.put(f"{API}/reservations/x/liquidacion/pagos/y", data={"notas": "a"}, headers=S).status_code)
        print("DELETE pago (borrar, expect 403)", requests.delete(f"{API}/reservations/x/liquidacion/pagos/y", headers=S).status_code)
else:
    pid, r1, r2 = sys.argv[2:5]
    print(requests.delete(f"{API}/reservations/{r1}", headers=H).status_code, requests.delete(f"{API}/reservations/{r2}", headers=H).status_code,
          requests.delete(f"{API}/properties/{pid}", headers=H).status_code)
