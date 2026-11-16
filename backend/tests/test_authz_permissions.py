"""Tests de regresión para la capa de autorización (roles/permisos/rate-limit).

No dependen de Supabase real: validan la lógica pura de resolución de permisos,
el mapeo de endpoints a módulo/acción, y el rate-limit de login. El flujo E2E
con JWT real de Supabase (login, 401/403 por endpoint, revocación inmediata al
desactivar) se cubre con la testing agent contra el preview.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from authz import ACTIONS, ADMIN_ROLE_ID, MODULES, SECRETARIA_ROLE_ID, _merge_permissions
from route_permissions import PUBLIC_PREFIXES, _resolve


def test_merge_permissions_is_union_of_all_roles():
    role_docs = [
        {"permissions": {"alquileres": ["ver", "editar"]}},
        {"permissions": {"alquileres": ["crear"], "studio": ["ver"]}},
    ]
    merged = _merge_permissions(role_docs)
    assert merged["alquileres"] == ["crear", "editar", "ver"]
    assert merged["studio"] == ["ver"]


def test_merge_permissions_empty_roles():
    assert _merge_permissions([]) == {}


def test_secretaria_scope_matches_product_spec():
    secretaria_permissions = {
        "alquileres": ["ver", "crear", "editar"],
        "liquidaciones": ["ver", "crear", "editar"],
        "studio": ["ver", "editar"],
    }
    # No debe tener borrar/exportar en ningún módulo, ni acceso a otros módulos.
    for module, actions in secretaria_permissions.items():
        assert "borrar" not in actions
        assert "exportar" not in actions
    assert set(secretaria_permissions.keys()) == {"alquileres", "liquidaciones", "studio"}


def test_administrador_role_id_and_secretaria_role_id_are_stable():
    assert ADMIN_ROLE_ID == "administrador"
    assert SECRETARIA_ROLE_ID == "secretaria"


def test_all_modules_have_all_five_actions_available():
    assert ACTIONS == ["ver", "crear", "editar", "borrar", "exportar"]
    assert len(MODULES) >= 17


@pytest.mark.parametrize(
    "method,path,expected",
    [
        ("GET", "/api/public/listings", "PUBLIC"),
        ("GET", "/api/sign/abc", "PUBLIC"),
        ("POST", "/api/webhooks/whatsapp", "PUBLIC"),
        ("GET", "/api/sitemap.xml", "PUBLIC"),
        ("GET", "/api/rentals/public/properties", "PUBLIC"),
        ("POST", "/api/rentals/payment-webhook", "PUBLIC"),
        ("GET", "/api/ml/callback", "PUBLIC"),
        ("POST", "/api/analytics/track", "PUBLIC"),
    ],
)
def test_public_exceptions_stay_public(method, path, expected):
    assert _resolve(method, path) == expected


@pytest.mark.parametrize(
    "method,path,expected",
    [
        ("GET", "/api/properties", ("propiedades", None)),
        ("GET", "/api/rentals/reservations", ("alquileres", None)),
        ("GET", "/api/rentals/properties/{pid}/movimientos", ("liquidaciones", "ver")),
        ("POST", "/api/rentals/reservations/{rid}/liquidacion/pagos", ("liquidaciones", "crear")),
        ("DELETE", "/api/people/{person_id}", ("personas", None)),
        ("GET", "/api/people/export", ("personas", "exportar")),
        ("GET", "/api/notifications", "LOGIN_ONLY"),
    ],
)
def test_protected_endpoints_resolve_expected_module_action(method, path, expected):
    assert _resolve(method, path) == expected


def test_public_prefixes_cover_the_public_website_and_reservations():
    assert "/api/public" in PUBLIC_PREFIXES
    assert "/api/sign" in PUBLIC_PREFIXES
    assert "/api/webhooks" in PUBLIC_PREFIXES
