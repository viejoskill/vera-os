"""CRM Legacy (exportador) — módulo AISLADO y DESECHABLE.

Representa el sistema viejo. Su única responsabilidad es EXPORTAR (`GET /api/export/
properties`). VERA sabe importar; el CRM sabe exportar. Ambos desacoplados: cuando
apagues el CRM, borrás este módulo y VERA sigue funcionando igual.
"""
