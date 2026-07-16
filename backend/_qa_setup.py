import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
EMAIL = "qa_temp@vera.test"
PWD = "QaPilot!2026xz"

# clean any leftover
try:
    for x in sb.auth.admin.list_users():
        if getattr(x, "email", None) == EMAIL:
            sb.auth.admin.delete_user(x.id)
except Exception as e:
    print("cleanup warn:", e)

u = sb.auth.admin.create_user({"email": EMAIL, "password": PWD, "email_confirm": True})
print("created:", EMAIL, PWD)
