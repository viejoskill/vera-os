# Analytics (Estadísticas) API tests: POST /api/analytics/track (public) + GET /api/analytics/summary (admin-only)
import os
import uuid
import asyncio
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = "varelavendecde@gmail.com"
NON_ADMIN = "qa_temp@vera.test"
VISITOR_IDS = []


def _summary(days=1, actor=ADMIN):
    return requests.get(f"{BASE_URL}/api/analytics/summary", params={"actorEmail": actor, "days": days}, timeout=20)


def _track(**kw):
    vid = kw.pop("visitorId", f"TEST_vis_{uuid.uuid4().hex}")
    VISITOR_IDS.append(vid)
    body = {"path": "/web", "visitorId": vid, "section": "ventas", **kw}
    return requests.post(f"{BASE_URL}/api/analytics/track", json=body, timeout=20), vid


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    from motor.motor_asyncio import AsyncIOMotorClient

    async def _clean():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        await c[os.environ["DB_NAME"]]["page_views"].delete_many({"visitorId": {"$in": list(set(VISITOR_IDS))}})
    if VISITOR_IDS:
        asyncio.run(_clean())


class TestSummaryAuth:
    def test_admin_ok_structure(self):
        r = _summary(7)
        assert r.status_code == 200
        d = r.json()
        for k in ["days", "totalVisits", "uniqueVisitors", "visitsFromAds", "whatsappConsultas", "visitsByDay", "topPages", "topProperties"]:
            assert k in d
        assert d["days"] == 7
        assert isinstance(d["totalVisits"], int)
        assert d["totalVisits"] >= d["visitsFromAds"]
        assert d["totalVisits"] >= d["uniqueVisitors"] or d["totalVisits"] == 0
        assert sum(x["count"] for x in d["visitsByDay"]) == d["totalVisits"]

    def test_non_admin_forbidden(self):
        assert _summary(7, NON_ADMIN).status_code == 403

    def test_unknown_forbidden(self):
        assert _summary(7, "TEST_nobody@example.com").status_code == 403

    def test_missing_actor_422(self):
        r = requests.get(f"{BASE_URL}/api/analytics/summary", params={"days": 7}, timeout=20)
        assert r.status_code == 422

    def test_days_clamped(self):
        assert _summary(0).json()["days"] == 1
        assert _summary(9999).json()["days"] == 365

    def test_period_monotonic(self):
        t7 = _summary(7).json()["totalVisits"]
        t30 = _summary(30).json()["totalVisits"]
        t90 = _summary(90).json()["totalVisits"]
        assert t7 <= t30 <= t90


class TestTrack:
    def test_track_increments_and_ads(self):
        before = _summary(1).json()
        r, vid = _track(path="/web", fromAd=False)
        assert r.status_code == 200 and r.json() == {"ok": True}
        r2, _ = _track(path="/web", fromAd=True, visitorId=vid)
        assert r2.status_code == 200
        after = _summary(1).json()
        assert after["totalVisits"] >= before["totalVisits"] + 2
        assert after["visitsFromAds"] >= before["visitsFromAds"] + 1
        assert after["uniqueVisitors"] >= before["uniqueVisitors"] + 1

    def test_track_property_in_top(self):
        pid = f"TEST_prop_{uuid.uuid4().hex[:8]}"
        vid = f"TEST_vis_{uuid.uuid4().hex}"
        for _ in range(30):
            _track(path=f"/web/{pid}", propertyId=pid, propertyCode="TESTV1", visitorId=vid)
        d = _summary(1).json()
        match = [p for p in d["topProperties"] if p["propertyId"] == pid]
        assert match and match[0]["count"] == 30 and match[0]["code"] == "TESTV1" and match[0]["section"] == "ventas"

    def test_track_missing_fields_422(self):
        r = requests.post(f"{BASE_URL}/api/analytics/track", json={"path": "/x"}, timeout=20)
        assert r.status_code == 422
