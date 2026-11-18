import os, sys, json, requests
sys.path.insert(0, os.path.dirname(__file__))
import conftest
tok = conftest._fetch_admin_token()
H = {"Authorization": f"Bearer {tok}"}
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api/rentals"
if sys.argv[1] == "setup":
    pid = requests.post(f"{API}/properties", json={"titulo": "AAA TEST_UI_iter100", "tipo": "casa", "precioNoche": 1000, "comisionPct": 18}, headers=H).json()["id"]
    r = requests.post(f"{API}/reservations/manual", json={"propertyId": pid, "nombre": "TEST UI Huesped", "telefono": "2257-111222", "dni": "30111222",
                      "checkIn": "2027-03-01", "checkOut": "2027-03-06", "montoTotal": 1617000, "senaMonto": 808500, "senaTenedor": "nosotros", "senaMetodo": "transferencia"}, headers=H)
    rid = r.json()["id"]
    print(requests.patch(f"{API}/reservations/{rid}", json={"estado": "confirmada"}, headers=H).status_code)
    print(json.dumps({"pid": pid, "rid": rid}))
    print([x["id"] for x in requests.get(f"{API}/properties/{pid}/liquidables", headers=H).json()])
else:
    pid, rid = sys.argv[2], sys.argv[3]
    print(requests.delete(f"{API}/reservations/{rid}", headers=H).status_code, requests.delete(f"{API}/properties/{pid}", headers=H).status_code)
