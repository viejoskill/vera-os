"""Delete TEST_ visits and temp qa user."""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("/app/backend/.env")
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

# Delete visits with TEST_ prefix on interested/agent/comment
try:
    rows = sb.table("property_visits").select("id, interested, agent, comment").execute().data or []
    print(f"Total visits before cleanup: {len(rows)}")
    to_del = [r for r in rows if
              (r.get("interested") or "").startswith("TEST_") or
              (r.get("agent") or "").startswith("TEST_") or
              (r.get("comment") or "").startswith("TEST_")]
    print(f"To delete: {len(to_del)}")
    for r in to_del:
        sb.table("property_visits").delete().eq("id", r["id"]).execute()
        print(f"deleted visit {r['id']} interested={r.get('interested')!r}")
except Exception as e:
    print(f"visits cleanup error: {e}")

# Delete temp user
email = "qa_temp@vera.test"
try:
    users = sb.auth.admin.list_users()
    for u in users:
        if getattr(u, "email", None) == email:
            sb.auth.admin.delete_user(u.id)
            print(f"deleted user {u.id}")
except Exception as e:
    print(f"user cleanup error: {e}")

# Verify
rows2 = sb.table("property_visits").select("id, interested").execute().data or []
print(f"Visits after cleanup: {len(rows2)}")
