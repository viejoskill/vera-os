"""Mapea CADA endpoint interno de VERA OS a (módulo, acción) para exigir sesión +
permiso real en el backend — no confiamos en que el frontend oculte un botón.

Se aplica una sola vez al arrancar (`apply_authorization`, llamado desde
`server.py` después de registrar todos los routers), inyectando la dependencia
de autorización directamente sobre cada `APIRoute` ya registrada. Si aparece un
endpoint nuevo sin mapear, el arranque FALLA a propósito (fail-closed) en vez de
dejarlo desprotegido en silencio.

Excepciones públicas (sin JWT) — web pública, reservas públicas, firma por token,
tasación online pública, webhooks externos (con su propia verificación) y el
callback OAuth de Mercado Libre (no puede llevar nuestro Bearer, es un redirect).
"""
from __future__ import annotations

from fastapi import Depends
from fastapi.dependencies.utils import get_parameterless_sub_dependant
from fastapi.routing import APIRoute

from authz import ACTION_BY_METHOD, require_login, require_module

# Prefijos manejados a mano adentro del propio archivo de rutas (auth/users/roles
# ya traen su `Depends(...)` explícito en cada endpoint) — no se tocan acá.
EXCLUDED_PREFIXES = ["/api/auth", "/api/users", "/api/roles"]
EXCLUDED_EXACT = {"/api/health"}

# Rutas 100% públicas (sitio web, reservas, firma por token, tasación online,
# webhooks externos con su propia verificación de firma/token).
PUBLIC_PREFIXES = [
    "/api/public",      # incluye /api/public/tasacion (routes_tasacion_online.py)
    "/api/sign",
    "/api/webhooks",
    "/api/sitemap.xml",
]

# Cualquier usuario con sesión activa (sin importar módulo/rol) — campanita de
# notificaciones, visible en todas las pantallas.
LOGIN_ONLY_PREFIXES = [
    "/api/notifications",
]

# Prefijo -> módulo por defecto. La acción sale del método HTTP (ver/crear/editar/
# borrar) salvo que haya un override explícito abajo. Más específico primero.
PREFIX_MODULE: list[tuple[str, str]] = [
    ("/api/ml/rentals", "alquileres"),
    ("/api/rentals/bot", "entrenar-vera"),
    ("/api/integrations/whatsapp", "entrenar-vera"),
    ("/api/ai", "propiedades"),
    ("/api/analytics", "estadisticas"),
    ("/api/brain", "vera-bot"),
    ("/api/contabilidad", "contabilidad"),
    ("/api/core", "operaciones"),
    ("/api/events", "event-log"),
    ("/api/properties", "propiedades"),
    ("/api/insights", "hoy"),
    ("/api/integrations", "integraciones"),
    ("/api/knowledge", "propiedades"),
    ("/api/migration", "propiedades"),
    ("/api/ml", "integraciones"),
    ("/api/people", "personas"),
    ("/api/rentals", "alquileres"),
    ("/api/studio", "studio"),
    ("/api/tasacion", "tasaciones"),
    ("/api/documents", "documentos"),
]

# Overrides explícitos por (método, path exacto con /api). "PUBLIC" = sin auth.
# Módulo/acción explícitos cuando el default por prefijo o por método no aplica
# (p.ej. togglear un publish es "editar", no "crear"; un export masivo es
# "exportar", no "ver"; liquidaciones vive en el mismo archivo que alquileres).
EXPLICIT_OVERRIDES: dict[tuple[str, str], tuple[str, str] | str] = {
    # ---- routes_rentals.py: endpoints públicos (reserva online, pagos) ----
    ("GET", "/api/rentals/public/properties"): "PUBLIC",
    ("GET", "/api/rentals/public/properties/{slug}"): "PUBLIC",
    ("GET", "/api/rentals/public/quote"): "PUBLIC",
    ("POST", "/api/rentals/public/properties/{slug}/prereserva"): "PUBLIC",
    ("GET", "/api/rentals/public/image/{img_id}"): "PUBLIC",
    ("POST", "/api/rentals/payment-webhook"): "PUBLIC",
    ("GET", "/api/rentals/payment/verify"): "PUBLIC",
    # ---- routes_rentals.py: liquidaciones (vive en el mismo router que alquileres) ----
    ("GET", "/api/rentals/properties/{pid}/movimientos"): ("liquidaciones", "ver"),
    ("POST", "/api/rentals/movimientos"): ("liquidaciones", "crear"),
    ("DELETE", "/api/rentals/movimientos/{mid}"): ("liquidaciones", "borrar"),
    ("PUT", "/api/rentals/movimientos/{mid}"): ("liquidaciones", "editar"),
    ("GET", "/api/rentals/liquidacion"): ("liquidaciones", "ver"),
    ("GET", "/api/rentals/liquidacion/pdf"): ("liquidaciones", "ver"),
    ("GET", "/api/rentals/properties/{pid}/liquidables"): ("liquidaciones", "ver"),
    ("GET", "/api/rentals/liquidaciones/pendientes"): ("liquidaciones", "ver"),
    ("GET", "/api/rentals/reservations/{rid}/liquidacion"): ("liquidaciones", "ver"),
    ("GET", "/api/rentals/reservations/{rid}/liquidacion/pdf"): ("liquidaciones", "ver"),
    ("POST", "/api/rentals/reservations/{rid}/liquidacion/pagos"): ("liquidaciones", "crear"),
    ("DELETE", "/api/rentals/reservations/{rid}/liquidacion/pagos/{pago_id}"): ("liquidaciones", "borrar"),
    # ---- routes_rentals.py: acciones de pago sobre una reserva existente = editar ----
    ("POST", "/api/rentals/reservations/{rid}/payment-link"): ("alquileres", "editar"),
    ("POST", "/api/rentals/reservations/{rid}/verificar-pago"): ("alquileres", "editar"),
    ("POST", "/api/rentals/reservations/{rid}/marcar-pagada"): ("alquileres", "editar"),
    ("POST", "/api/rentals/reservations/{rid}/comprobantes"): ("alquileres", "editar"),
    ("POST", "/api/rentals/reservations/{rid}/cobrar-saldo"): ("alquileres", "editar"),
    ("POST", "/api/rentals/properties/{pid}/export-to-ventas"): ("alquileres", "exportar"),
    # ---- routes_files.py / routes_properties.py ----
    ("GET", "/api/properties/{property_id}/export/photos.zip"): ("propiedades", "exportar"),
    ("POST", "/api/properties/{property_id}/publications/{channel}"): ("propiedades", "editar"),
    # ---- routes_rentals.py: export masivo de fotos ----
    ("GET", "/api/rentals/properties/{pid}/export/photos.zip"): ("alquileres", "exportar"),
    # ---- routes_people.py ----
    ("GET", "/api/people/export"): ("personas", "exportar"),
    # ---- rentals_bot.py: estos 2 son pantallas propias (fuera de Alquileres) ----
    ("POST", "/api/rentals/bot/simulate"): ("bot-alquileres", "crear"),
    # ---- rentals_bot.py: estos viven embebidos en la pantalla Alquileres ----
    ("POST", "/api/rentals/bot/digest/generate"): ("alquileres", "crear"),
    ("POST", "/api/rentals/bot/digest/email"): ("alquileres", "crear"),
    ("GET", "/api/rentals/bot/digests"): ("alquileres", "ver"),
    ("GET", "/api/rentals/bot/conversations"): ("alquileres", "ver"),
    ("PATCH", "/api/rentals/bot/conversations/{sid}"): ("alquileres", "editar"),
    # ---- routes_integrations.py: webhook externo (firma propia) ----
    ("POST", "/api/integrations/arturito/webhook"): "PUBLIC",
    # ---- routes_ml.py: OAuth (redirect, no puede llevar Bearer) + por-propiedad ----
    ("GET", "/api/ml/oauth/start"): "PUBLIC",
    ("GET", "/api/ml/callback"): "PUBLIC",
    ("POST", "/api/ml/disconnect"): ("integraciones", "editar"),
    ("POST", "/api/ml/listings/{property_id}/publish"): ("propiedades", "editar"),
    ("GET", "/api/ml/listings/{property_id}/state"): ("propiedades", "ver"),
    ("GET", "/api/ml/listings/{property_id}/duplicates"): ("propiedades", "ver"),
    ("POST", "/api/ml/items/{item_id}/pause"): ("propiedades", "editar"),
    ("POST", "/api/ml/listings/{property_id}/close"): ("propiedades", "editar"),
    ("POST", "/api/ml/listings/{property_id}/reactivate"): ("propiedades", "editar"),
    # ---- routes_ml_rentals.py: togglear publicación = editar ----
    ("POST", "/api/ml/rentals/{pid}/publish"): ("alquileres", "editar"),
    ("POST", "/api/ml/rentals/{pid}/close"): ("alquileres", "editar"),
    # ---- routes_analytics.py: /track lo dispara la web pública (visitante anónimo) ----
    ("POST", "/api/analytics/track"): "PUBLIC",
}


def _resolve(method: str, path: str):
    key = (method, path)
    if key in EXPLICIT_OVERRIDES:
        return EXPLICIT_OVERRIDES[key]
    for prefix in PUBLIC_PREFIXES:
        if path.startswith(prefix):
            return "PUBLIC"
    for prefix in LOGIN_ONLY_PREFIXES:
        if path.startswith(prefix):
            return "LOGIN_ONLY"
    for prefix, module in sorted(PREFIX_MODULE, key=lambda x: -len(x[0])):
        if path.startswith(prefix):
            return (module, None)
    return None


def apply_authorization(app) -> None:
    unmapped: list[str] = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if route.path in EXCLUDED_EXACT or any(route.path.startswith(p) for p in EXCLUDED_PREFIXES):
            continue
        methods = (route.methods or set()) - {"HEAD", "OPTIONS"}
        if not methods:
            continue
        method = next(iter(methods))
        resolved = _resolve(method, route.path)
        if resolved is None:
            unmapped.append(f"{method} {route.path}")
            continue
        if resolved == "PUBLIC":
            continue
        if resolved == "LOGIN_ONLY":
            dependency = require_login()
        else:
            module, action = resolved
            dependency = require_module(module, action)
        sub_dependant = get_parameterless_sub_dependant(depends=Depends(dependency), path=route.path_format)
        route.dependant.dependencies.insert(0, sub_dependant)

    if unmapped:
        raise RuntimeError(
            "Endpoints sin mapeo de autorización (agregalos a route_permissions.py): "
            + ", ".join(unmapped)
        )
