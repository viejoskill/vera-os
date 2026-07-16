"""Delete the temporary Supabase auth user used for testing."""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("/app/backend/.env")
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
email = "qa_temp@vera.test"
deleted = 0
for u in sb.auth.admin.list_users():
    if getattr(u, "email", None) == email:
        sb.auth.admin.delete_user(u.id)
        deleted += 1
        print(f"Deleted user {u.id}")
print(f"Total deleted: {deleted}")
