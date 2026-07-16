"""Create a temporary Supabase auth user for testing. Prints email/password/id."""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("/app/backend/.env")
url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
sb = create_client(url, key)

email = "qa_temp@vera.test"
password = "QaPilot!2026xz"

# Cleanup any preexisting
try:
    users = sb.auth.admin.list_users()
    for u in users:
        if getattr(u, "email", None) == email:
            sb.auth.admin.delete_user(u.id)
            print(f"cleaned pre-existing {u.id}")
except Exception as e:
    print(f"cleanup pre skip: {e}")

resp = sb.auth.admin.create_user({
    "email": email,
    "password": password,
    "email_confirm": True,
    "user_metadata": {"full_name": "Sofía Martín"},
})
user = getattr(resp, "user", resp)
print("USER_ID:", user.id)
print("EMAIL:", email)
print("PASSWORD:", password)
