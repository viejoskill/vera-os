"""Limpieza única: elimina los templates de PRUEBA (templateKey empieza con
'TEST_') y los documentos que dependan de ellos. Conserva solo los templates
reales (autorizacion_venta, recibo_sena_reserva).

Uso: python -m scripts.cleanup_test_templates
"""
import asyncio

from supabase_client import get_supabase

TABLE_TEMPLATES = "document_templates"
TABLE_DOCUMENTS = "documents"


def _run():
    c = get_supabase()
    templates = c.table(TABLE_TEMPLATES).select("id,template_key,name").execute().data or []
    test_ids = [t["id"] for t in templates if str(t.get("template_key", "")).startswith("TEST_")]
    print(f"Templates de prueba a eliminar: {len(test_ids)}")
    if not test_ids:
        return

    # 1) Documentos que dependen de esos templates (FK sin cascade → borrar antes).
    docs = (c.table(TABLE_DOCUMENTS).select("id,template_id")
            .in_("template_id", test_ids).execute().data or [])
    doc_ids = [d["id"] for d in docs]
    print(f"Documentos dependientes a eliminar: {len(doc_ids)}")
    for did in doc_ids:
        # relationships/participants/signatures tienen ON DELETE CASCADE.
        c.table(TABLE_DOCUMENTS).delete().eq("id", did).execute()

    # 2) Borrar los templates de prueba.
    for tid in test_ids:
        c.table(TABLE_TEMPLATES).delete().eq("id", tid).execute()

    remaining = c.table(TABLE_TEMPLATES).select("template_key,version,name").execute().data or []
    print("Templates restantes:")
    for r in sorted(remaining, key=lambda x: (x["template_key"], x["version"])):
        print(f"  {r['template_key']} v{r['version']} — {r['name']}")


async def main():
    await asyncio.to_thread(_run)


if __name__ == "__main__":
    asyncio.run(main())
