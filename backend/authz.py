"""Autorización real de VERA OS: verifica el JWT de Supabase en cada request y
resuelve permisos efectivos (unión de todos los roles asignados) contra Mongo.

Modelo: permisos son por (módulo, acción) — acciones: ver, crear, editar, borrar,
exportar. Un rol agrupa permisos; un usuario puede tener varios roles. `roles` e
`app_access` viven en Mongo, nunca hardcodeados — así se pueden crear roles nuevos
sin tocar código. El rol "administrador" es `isSystem` (fijo, no se puede borrar ni
reducir) y siempre tiene acceso total, incluso a módulos agregados después (ver
`seed_roles`, que resincroniza sus permisos contra `MODULES` en cada arranque).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import lru_cache

from fastapi import Depends, HTTPException, Request
from jwt import PyJWKClient
from jwt import decode as jwt_decode
from jwt.exceptions import InvalidTokenError
from motor.motor_asyncio import AsyncIOMotorClient

import config
from supabase_client import get_supabase

MODULES = [
    "hoy", "vera-bot", "propiedades", "personas", "operaciones", "documentos",
    "tasaciones", "alquileres", "liquidaciones", "llaves", "bot-alquileres",
    "entrenar-vera", "contabilidad", "studio", "integraciones", "event-log",
    "equipo", "estadisticas",
]
ACTIONS = ["ver", "crear", "editar", "borrar", "exportar"]
ACTION_BY_METHOD = {"GET": "ver", "POST": "crear", "PUT": "editar", "PATCH": "editar", "DELETE": "borrar"}

ADMIN_ROLE_ID = "administrador"
SECRETARIA_ROLE_ID = "secretaria"
MIN_PASSWORD_LENGTH = 10

LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_MINUTES = 15
LOGIN_LOCK_MINUTES = 15

_client: AsyncIOMotorClient | None = None


def _db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]


def access_col():
    return _db()["app_access"]


def roles_col():
    return _db()["roles"]


def audit_col():
    return _db()["audit_log"]


def _login_col():
    return _db()["login_attempts"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def norm_email(email: str) -> str:
    return (email or "").strip().lower()


# --------------------------------------------------------------------------
# Verificación local del JWT de Supabase (JWKS, sin pegarle a Auth en cada request)
# --------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    url = f"{config.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(url, cache_jwk_set=True, lifespan=600)


def verify_access_token(token: str) -> dict:
    if not config.SUPABASE_URL:
        raise HTTPException(503, "Supabase no configurado")
    issuer = f"{config.SUPABASE_URL.rstrip('/')}/auth/v1"
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token).key
        return jwt_decode(
            token,
            signing_key,
            algorithms=["ES256", "RS256"],
            issuer=issuer,
            audience="authenticated",
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
    except InvalidTokenError:
        raise HTTPException(401, "Sesión inválida o expirada")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "No se pudo verificar la sesión (JWKS no disponible)")


# --------------------------------------------------------------------------
# Roles: seed + resolución de permisos efectivos
# --------------------------------------------------------------------------

async def seed_roles():
    """Crea los roles base si no existen. Al administrador le resincroniza los
    permisos contra `MODULES` en cada arranque, para que un módulo nuevo quede
    automáticamente dentro de su acceso total sin tocar datos a mano."""
    col = roles_col()
    now = now_iso()
    admin_perms = {m: list(ACTIONS) for m in MODULES}
    existing_admin = await col.find_one({"_id": ADMIN_ROLE_ID})
    if existing_admin:
        await col.update_one(
            {"_id": ADMIN_ROLE_ID},
            {"$set": {"name": "Administrador", "isSystem": True, "permissions": admin_perms, "updatedAt": now}},
        )
    else:
        await col.insert_one({
            "_id": ADMIN_ROLE_ID, "name": "Administrador", "isSystem": True,
            "permissions": admin_perms, "createdAt": now, "updatedAt": now, "createdBy": "system",
        })

    existing_sec = await col.find_one({"_id": SECRETARIA_ROLE_ID})
    if not existing_sec:
        await col.insert_one({
            "_id": SECRETARIA_ROLE_ID, "name": "Secretaria", "isSystem": False,
            "permissions": {
                "alquileres": ["ver", "crear", "editar"],
                "liquidaciones": ["ver", "crear", "editar"],
                "studio": ["ver", "editar"],
            },
            "createdAt": now, "updatedAt": now, "createdBy": "system",
        })


async def migrate_legacy_app_access():
    """Migración única (idempotente): a los `app_access` viejos (approved/isAdmin/
    sections) les agrega roleIds/active/mustChangePassword. Si ya tienen `roleIds`
    no se tocan — así es seguro correrla en cada arranque."""
    col = access_col()
    async for doc in col.find({"roleIds": {"$exists": False}}):
        is_admin = bool(doc.get("isAdmin"))
        role_ids = [ADMIN_ROLE_ID] if is_admin else [SECRETARIA_ROLE_ID]
        await col.update_one(
            {"_id": doc["_id"]},
            {"$set": {
                "roleIds": role_ids,
                "active": bool(doc.get("approved", True)),
                "mustChangePassword": False,
                "name": doc.get("name") or doc.get("email", doc["_id"]),
                "createdAt": doc.get("createdAt") or now_iso(),
            }},
        )


async def _role_docs(role_ids: list[str]) -> list[dict]:
    if not role_ids:
        return []
    return await roles_col().find({"_id": {"$in": role_ids}}).to_list(50)


def _merge_permissions(role_docs: list[dict]) -> dict[str, list[str]]:
    merged: dict[str, set[str]] = {}
    for r in role_docs:
        for module, actions in (r.get("permissions") or {}).items():
            merged.setdefault(module, set()).update(actions)
    return {m: sorted(a) for m, a in merged.items()}


async def get_access_doc(email: str) -> dict | None:
    return await access_col().find_one({"_id": norm_email(email)})


async def build_profile(doc: dict) -> dict:
    """Arma el perfil completo (roles + permisos efectivos) para `/auth/me`."""
    role_ids = doc.get("roleIds") or []
    role_docs = await _role_docs(role_ids)
    permissions = _merge_permissions(role_docs)
    is_admin = any(r.get("isSystem") for r in role_docs)
    return {
        "email": doc.get("email", doc.get("_id", "")),
        "name": doc.get("name") or doc.get("email", ""),
        "active": bool(doc.get("active", False)),
        "mustChangePassword": bool(doc.get("mustChangePassword", False)),
        "isAdmin": is_admin,
        "roles": [{"id": r["_id"], "name": r["name"]} for r in role_docs],
        "permissions": permissions,
    }


# --------------------------------------------------------------------------
# Dependencias FastAPI
# --------------------------------------------------------------------------

def _bearer_token(request: Request) -> str:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(401, "Se requiere un token de sesión")
    return auth.split(" ", 1)[1].strip()


# Endpoints a los que SÍ puede entrar un usuario con cambio de clave pendiente
# (si no, se queda sin forma de cambiarla).
MUST_CHANGE_PASSWORD_ALLOWLIST = {"/api/auth/me", "/api/auth/change-password-done"}


async def current_user_raw(request: Request) -> dict | None:
    """Valida el JWT y devuelve el doc de Mongo tal cual (puede estar inactivo
    o no existir) — lo usa `/auth/me` para poder mostrarle al frontend el motivo
    exacto (pendiente / desactivado) en vez de un 401 genérico."""
    token = _bearer_token(request)
    claims = verify_access_token(token)
    email = norm_email(claims.get("email") or "")
    if not email:
        raise HTTPException(401, "Token sin email verificado")
    return await get_access_doc(email)


async def current_access(request: Request) -> dict:
    """Exige sesión válida + cuenta activa + (si corresponde) clave ya cambiada.
    Corre en CADA request protegido, así que desactivar a alguien corta su
    acceso inmediato (sin esperar a que expire el JWT)."""
    doc = await current_user_raw(request)
    if not doc or not doc.get("active"):
        raise HTTPException(401, "No tenés acceso activo a VERA OS")
    if doc.get("mustChangePassword") and request.url.path not in MUST_CHANGE_PASSWORD_ALLOWLIST:
        raise HTTPException(403, "Tenés que cambiar tu contraseña temporal antes de seguir")
    profile = await build_profile(doc)
    profile["_raw"] = doc
    return profile


def require_login():
    async def _dep(access: dict = Depends(current_access)) -> dict:
        return access
    return _dep


def require_admin():
    async def _dep(access: dict = Depends(current_access)) -> dict:
        if not access["isAdmin"]:
            raise HTTPException(403, "Solo un administrador puede hacer esto")
        return access
    return _dep


def require_module(module: str, action: str | None = None):
    async def _dep(request: Request, access: dict = Depends(current_access)) -> dict:
        if access["isAdmin"]:
            return access
        act = action or ACTION_BY_METHOD.get(request.method, "ver")
        allowed = access["permissions"].get(module, [])
        if act not in allowed:
            raise HTTPException(403, "No tenés permiso para hacer esto")
        return access
    return _dep


# --------------------------------------------------------------------------
# Auditoría
# --------------------------------------------------------------------------

async def audit(actor_email: str, action: str, target_type: str, target_id: str, changes: dict | None = None):
    await audit_col().insert_one({
        "_id": f"{now_iso()}:{target_type}:{target_id}",
        "actorEmail": norm_email(actor_email),
        "action": action,
        "targetType": target_type,
        "targetId": target_id,
        "changes": changes or {},
        "at": now_iso(),
    })


# --------------------------------------------------------------------------
# Rate limit de intentos de login fallidos (el login en sí lo hace Supabase
# directo desde el browser; el front consulta/reporta acá para frenar fuerza bruta)
# --------------------------------------------------------------------------

async def check_login_lock(email: str) -> dict:
    doc = await _login_col().find_one({"_id": norm_email(email)})
    if not doc:
        return {"locked": False, "retryAfterSeconds": 0}
    locked_until = doc.get("lockedUntil")
    if locked_until:
        lu = datetime.fromisoformat(locked_until)
        now = datetime.now(timezone.utc)
        if now < lu:
            return {"locked": True, "retryAfterSeconds": int((lu - now).total_seconds())}
    return {"locked": False, "retryAfterSeconds": 0}


async def record_login_failure(email: str):
    email = norm_email(email)
    now = datetime.now(timezone.utc)
    doc = await _login_col().find_one({"_id": email})
    if not doc or (now - datetime.fromisoformat(doc["firstAt"])) > timedelta(minutes=LOGIN_WINDOW_MINUTES):
        doc = {"_id": email, "count": 0, "firstAt": now.isoformat()}
    count = int(doc.get("count", 0)) + 1
    update = {
        "count": count, "firstAt": doc["firstAt"],
        "expiresAt": now + timedelta(minutes=max(LOGIN_WINDOW_MINUTES, LOGIN_LOCK_MINUTES) + 5),
    }
    if count >= LOGIN_MAX_ATTEMPTS:
        update["lockedUntil"] = (now + timedelta(minutes=LOGIN_LOCK_MINUTES)).isoformat()
    await _login_col().update_one({"_id": email}, {"$set": update}, upsert=True)


# Límite por IP, solo sobre intentos FALLIDOS reportados (no sobre cada consulta
# de /login-check, que se dispara también en logins exitosos y penalizaría a una
# oficina entera detrás del mismo NAT). Sin esto, cualquiera podía bloquear la
# cuenta de otra persona a propósito posteando /login-failed muchas veces sin
# siquiera intentar loguearse.
IP_MAX_FAILURES = 40
IP_WINDOW_MINUTES = 5


def client_ip_from_request(request) -> str:
    """Usa el ÚLTIMO salto de X-Forwarded-For (el que agrega nuestro propio
    ingress, no el que declara el cliente) — el primero es spoofeable."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        hops = [h.strip() for h in fwd.split(",") if h.strip()]
        if hops:
            return hops[-1]
    return request.client.host if request.client else "unknown"


async def check_ip_abuse(ip: str) -> None:
    key = f"ip:{ip}"
    now = datetime.now(timezone.utc)
    doc = await _login_col().find_one({"_id": key})
    if not doc or (now - datetime.fromisoformat(doc["firstAt"])) > timedelta(minutes=IP_WINDOW_MINUTES):
        doc = {"_id": key, "count": 0, "firstAt": now.isoformat()}
    count = int(doc.get("count", 0)) + 1
    await _login_col().update_one(
        {"_id": key},
        {"$set": {"count": count, "firstAt": doc["firstAt"], "expiresAt": now + timedelta(minutes=IP_WINDOW_MINUTES + 5)}},
        upsert=True,
    )
    if count > IP_MAX_FAILURES:
        raise HTTPException(429, "Demasiados intentos. Esperá unos minutos.")


async def ensure_login_attempts_ttl_index():
    await _login_col().create_index("expiresAt", expireAfterSeconds=0)
