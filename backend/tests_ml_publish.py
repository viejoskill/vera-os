"""Test determinístico de la lógica anti-duplicados de mercadolibre.service.publish.
Simula las respuestas de ML (sin llamadas reales). Verifica que NUNCA se cree un aviso
nuevo en silencio cuando ya existe un itemId."""
import asyncio
import types

from mercadolibre import service as ml


class FakeResp:
    def __init__(self, status_code=200, data=None, text=""):
        self.status_code = status_code
        self._data = data or {}
        self.text = text

    def json(self):
        return self._data


class FakeClient:
    """Registra los requests (method, url) y responde según ruta."""

    def __init__(self, calls, put_status=200):
        self.calls = calls
        self.put_status = put_status

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def put(self, url, headers=None, json=None):
        self.calls.append(("PUT", url, json))
        return FakeResp(self.put_status, {"id": url.rsplit("/", 1)[-1], "permalink": "http://ml/EXISTING"})

    async def post(self, url, headers=None, json=None):
        self.calls.append(("POST", url, json))
        return FakeResp(201, {"id": "MLA-NEW-999", "permalink": "http://ml/NEW"})


async def _run_case(name, *, existing, item_status, allow_relist, expect):
    calls = []

    # Patch helpers para aislar la lógica de branching.
    ml._valid_token = lambda: _coro("token")  # type: ignore
    ml._resolve_listing = lambda access, prop: _coro(("MLA401685", []))  # type: ignore
    ml._category_attributes = lambda access, cat, prop: _coro([])  # type: ignore
    ml._location = lambda access, prop: _coro({"country": {"id": "AR"}})  # type: ignore
    ml._item_status = lambda access, iid: _coro(item_status)  # type: ignore
    ml._set_description = lambda h, headers, iid, text: _coro(True)  # type: ignore
    ml.httpx = types.SimpleNamespace(AsyncClient=lambda timeout=0: FakeClient(calls))  # type: ignore

    prop = {"id": "p1", "title": "Nuevo título", "price": 123, "currency": "USD",
            "type": "casa", "operation": "venta", "description": "desc"}
    try:
        res = await ml.publish(prop, [{"url": "http://img"}], existing, allow_relist=allow_relist)
        outcome = ("ok", res.get("item_id"))
    except Exception as e:  # noqa: BLE001
        outcome = ("raise", type(e).__name__)

    methods = [c[0] for c in calls]
    created = "POST" in methods
    updated = "PUT" in methods
    ok = expect(outcome, created, updated, calls)
    print(f"[{'PASS' if ok else 'FAIL'}] {name} -> outcome={outcome} created={created} updated={updated}")
    return ok


def _coro(value):
    async def _c():
        return value
    return _c()


async def main():
    results = []

    # 1) Aviso activo → actualiza (PUT) el mismo item, NO crea. Incluye título.
    results.append(await _run_case(
        "activo -> update (con titulo)", existing="MLA-1", item_status="active", allow_relist=True,
        expect=lambda o, c, u, calls: o[0] == "ok" and o[1] == "MLA-1" and u and not c
        and any(cc[0] == "PUT" and (cc[2] or {}).get("title") == "Nuevo título" for cc in calls),
    ))

    # 2) Estado no verificable (None) en re-sync automática → NO duplica, lanza error.
    results.append(await _run_case(
        "None + auto (allow_relist=False) -> raise, no crea", existing="MLA-1", item_status=None,
        allow_relist=False, expect=lambda o, c, u, calls: o[0] == "raise" and not c,
    ))

    # 3) Estado no verificable (None) en publicación manual → NO duplica, lanza error.
    results.append(await _run_case(
        "None + manual (allow_relist=True) -> raise, no crea", existing="MLA-1", item_status=None,
        allow_relist=True, expect=lambda o, c, u, calls: o[0] == "raise" and not c,
    ))

    # 4) Aviso muerto (closed) + manual → relista (crea uno nuevo).
    results.append(await _run_case(
        "closed + manual -> relista (crea)", existing="MLA-1", item_status="closed", allow_relist=True,
        expect=lambda o, c, u, calls: o[0] == "ok" and o[1] == "MLA-NEW-999" and c,
    ))

    # 5) Aviso muerto (closed) + auto-resync → NO relista, lanza error.
    results.append(await _run_case(
        "closed + auto (allow_relist=False) -> raise, no crea", existing="MLA-1", item_status="closed",
        allow_relist=False, expect=lambda o, c, u, calls: o[0] == "raise" and not c,
    ))

    # 6) Sin publicación previa → crea (POST).
    results.append(await _run_case(
        "sin itemId -> crea", existing=None, item_status=None, allow_relist=False,
        expect=lambda o, c, u, calls: o[0] == "ok" and o[1] == "MLA-NEW-999" and c,
    ))

    # 7) Aviso en activación (under_review) → lanza 'reintentá', NO crea.
    results.append(await _run_case(
        "under_review -> raise, no crea", existing="MLA-1", item_status="under_review", allow_relist=True,
        expect=lambda o, c, u, calls: o[0] == "raise" and not c,
    ))

    print(f"\n{sum(results)}/{len(results)} casos PASS")
    assert all(results), "Hay casos FAIL"


if __name__ == "__main__":
    asyncio.run(main())
