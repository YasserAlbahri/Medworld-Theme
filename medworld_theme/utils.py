import frappe

# Redirect password reset/update routes back to login to disable self-service resets.
BLOCKED_PASSWORD_ROUTES = {
    "/forgot",
    "/forgot-password",
    "/forgot_password",
    "/reset-password",
    "/reset_password",
    "/update-password",
    "/update_password",
}

def redirect_password_routes():
    path = getattr(frappe.request, "path", "") or ""
    if not path:
        return

    normalized = path.rstrip("/") or "/"
    if normalized in BLOCKED_PASSWORD_ROUTES:
        frappe.local.flags.redirect_location = "/login"
        raise frappe.Redirect


def log_login_post_debug():
    """Log POST / payload shape (without password) for debugging login issues."""
    try:
        req = frappe.local.request
    except Exception:
        return

    if not req or req.method != "POST" or req.path not in ("/", "/api/method/login"):
        return

    form = frappe.form_dict or {}
    # Avoid logging sensitive data; capture only keys and password length.
    raw_body = ""
    try:
        raw_body = req.get_data(as_text=True) or ""
    except Exception:
        raw_body = ""

    pwd_len = None
    try:
        if "pwd=" in raw_body:
            from urllib.parse import parse_qs
            pwd_val = parse_qs(raw_body, keep_blank_values=True).get("pwd", [""])[0]
            pwd_len = len(pwd_val)
    except Exception:
        pwd_len = None

    payload = {
        "host": getattr(req, "host", None),
        "site": frappe.local.site,
        "cmd": form.get("cmd"),
        "usr": form.get("usr"),
        "pwd_present": "pwd=" in raw_body,
        "pwd_len": pwd_len,
        "raw_len": len(raw_body),
        "device": form.get("device"),
        "keys": sorted(list(form.keys())),
        "path": req.path,
    }
    frappe.logger("login_debug", allow_site=True).error(payload)


def run():
    """Create/update predefined Medworld users with roles and passwords."""
    try:
        from frappe.utils.password import set_password
    except ImportError:  # fallback for older Frappe
        from frappe.utils.password import update_password as set_password

    users = [
        {
            "email": "Admin@medworld.com",
            "full_name": "مدير النظام",
            "roles": ["System Manager"],
            "password": "123456789",
        },
        {
            "email": "Reception-Manager@medworld.com",
            "full_name": "مدير الاستقبال",
            "roles": ["Reception Manager"],
            "password": "123456",
        },
        {
            "email": "cashier1@medworld.com",
            "full_name": "كاشير 1",
            "roles": ["Reception User"],
            "password": "123456",
        },
        {
            "email": "cashier2@medworld.com",
            "full_name": "كاشير 2",
            "roles": ["Reception User"],
            "password": "123456",
        },
        {
            "email": "Healthcare-Manager@medworld.com",
            "full_name": "المدير الطبي",
            "roles": ["Healthcare Administrator"],
            "password": "123456",
        },
        {
            "email": "Doctor1@medworld.com",
            "full_name": "طبيب 1",
            "roles": ["Physician"],
            "password": "123456",
        },
        {
            "email": "Doctor2@medworld.com",
            "full_name": "طبيب 2",
            "roles": ["Physician"],
            "password": "123456",
        },
        {
            "email": "Doctor3@medworld.com",
            "full_name": "طبيب 3",
            "roles": ["Physician"],
            "password": "123456",
        },
        {
            "email": "Nurse-Manager@medworld.com",
            "full_name": "مدير التمريض",
            "roles": ["Nurse Manager"],
            "password": "123456",
        },
        {
            "email": "Nurse1@medworld.com",
            "full_name": "ممرض",
            "roles": ["Nursing User"],
            "password": "123456",
        },
        {
            "email": "Lab-Manager@medworld.com",
            "full_name": "مدير المختبر",
            "roles": ["Laboratory Manager"],
            "password": "123456",
        },
        {
            "email": "Lab-Technician1@medworld.com",
            "full_name": "مختبر 1",
            "roles": ["Laboratory User"],
            "password": "123456",
        },
        {
            "email": "Lab-Technician2@medworld.com",
            "full_name": "مختبر 2",
            "roles": ["Laboratory User"],
            "password": "123456",
        },
        {
            "email": "Lab-Technician3@medworld.com",
            "full_name": "مختبر 3",
            "roles": ["Laboratory User"],
            "password": "123456",
        },
        {
            "email": "Lab-Test-Approver@medworld.com",
            "full_name": "معتمد الفحوصات",
            "roles": ["LabTest Approver"],
            "password": "123456",
        },
        {
            "email": "Radiology-Manager@medworld.com",
            "full_name": "مدير الأشعة",
            "roles": ["Radiology Manager"],
            "password": "123456",
        },
        {
            "email": "Radiology-Technician1@medworld.com",
            "full_name": "فني أشعة 1",
            "roles": ["Radiology User"],
            "password": "123456",
        },
        {
            "email": "Pharmacy-Manager@medworld.com",
            "full_name": "مدير الصيدلية",
            "roles": ["Pharmacy Manager"],
            "password": "123456",
        },
        {
            "email": "pharmacist1@medworld.com",
            "full_name": "صيدلي",
            "roles": ["Pharmacy User"],
            "password": "123456",
        },
        {
            "email": "Financial-Manager@medworld.com",
            "full_name": "المدير المالي",
            "roles": ["Accounts Manager"],
            "password": "123456",
        },
        {
            "email": "HR-Manager@medworld.com",
            "full_name": "مدير الموارد البشرية",
            "roles": ["HR Manager"],
            "password": "123456",
        },
        {
            "email": "Stock-Manager@medworld.com",
            "full_name": "مدير المخازن",
            "roles": ["Stock Manager"],
            "password": "123456",
        },
        {
            "email": "Quality-Manager@medworld.com",
            "full_name": "مدير الجودة",
            "roles": ["Quality Manager"],
            "password": "123456",
        },
        {
            "email": "IT-Manager@medworld.com",
            "full_name": "مدير تقني",
            "roles": ["IT Manager"],
            "password": "123456",
        },
    ]

    created, updated, errors = [], [], []

    for entry in users:
        email = entry["email"].strip()
        full_name = entry["full_name"].strip()
        roles = entry["roles"]
        password = entry["password"]

        try:
            if frappe.db.exists("User", email):
                doc = frappe.get_doc("User", email)
                action = "updated"
            else:
                doc = frappe.get_doc({
                    "doctype": "User",
                    "email": email,
                    "first_name": full_name,
                    "full_name": full_name,
                    "enabled": 1,
                    "send_welcome_email": 0,
                })
                action = "created"

            doc.update({
                "first_name": full_name,
                "full_name": full_name,
                "enabled": 1,
            })
            doc.flags.ignore_permissions = True
            doc.save(ignore_permissions=True)

            # Enforce exact roles (manual because some branches lack set_roles)
            frappe.db.delete("Has Role", {"parent": email})
            for role in roles:
                frappe.get_doc({
                    "doctype": "Has Role",
                    "parenttype": "User",
                    "parentfield": "roles",
                    "parent": email,
                    "role": role,
                }).insert(ignore_permissions=True)

            # Set password
            set_password(email, password)

            if action == "created":
                created.append(email)
            else:
                updated.append(email)
        except Exception as exc:  # noqa: BLE001
            errors.append({"email": email, "error": str(exc)})
            frappe.log_error(
                message=frappe.as_json({"email": email, "exc": frappe.get_traceback()}),
                title="Create medworld users failed",
            )

    frappe.db.commit()

    return {
        "created": created,
        "updated": updated,
        "errors": errors,
    }


def grant_full_roles_to_medworld_users():
    """
    Grant all enabled roles (except Guest/All) to the predefined Medworld users.
    Intended for testing environments only.
    """
    medworld_emails = {
        "Admin@medworld.com",
        "Reception-Manager@medworld.com",
        "cashier1@medworld.com",
        "cashier2@medworld.com",
        "Healthcare-Manager@medworld.com",
        "Doctor1@medworld.com",
        "Doctor2@medworld.com",
        "Doctor3@medworld.com",
        "Nurse-Manager@medworld.com",
        "Nurse1@medworld.com",
        "Lab-Manager@medworld.com",
        "Lab-Technician1@medworld.com",
        "Lab-Technician2@medworld.com",
        "Lab-Technician3@medworld.com",
        "Lab-Test-Approver@medworld.com",
        "Radiology-Manager@medworld.com",
        "Radiology-Technician1@medworld.com",
        "Pharmacy-Manager@medworld.com",
        "pharmacist1@medworld.com",
        "Financial-Manager@medworld.com",
        "HR-Manager@medworld.com",
        "Stock-Manager@medworld.com",
        "Quality-Manager@medworld.com",
        "IT-Manager@medworld.com",
    }

    all_roles = {
        r.name
        for r in frappe.get_all("Role", filters={"disabled": 0}, fields=["name"])
        if r.name not in {"Guest", "All"}
    }

    created_links, skipped_missing_user = [], []

    for email in medworld_emails:
        if not frappe.db.exists("User", email):
            skipped_missing_user.append(email)
            continue

        existing_roles = {
            r.role
            for r in frappe.get_all(
                "Has Role",
                filters={"parenttype": "User", "parent": email},
                fields=["role"],
            )
        }

        for role in all_roles - existing_roles:
            frappe.get_doc(
                {
                    "doctype": "Has Role",
                    "parenttype": "User",
                    "parentfield": "roles",
                    "parent": email,
                    "role": role,
                }
            ).insert(ignore_permissions=True)
            created_links.append((email, role))

    frappe.db.commit()

    return {
        "added_links": len(created_links),
        "skipped_missing_user": skipped_missing_user,
    }


def reset_medworld_roles_to_mapping():
    """
    Reset roles for predefined Medworld users to the intended single-role mapping.
    Use this after full-role testing to return to realistic permissions.
    """
    mapping = {
        # الإدارة العليا / النظام
        "Admin@medworld.com": ["System Manager", "Healthcare Administrator"],
        "IT-Manager@medworld.com": ["IT Manager"],
        # الاستقبال والفوترة
        "Reception-Manager@medworld.com": ["Reception Manager", "Healthcare User", "Accounts User"],
        "cashier1@medworld.com": ["Reception User", "Healthcare User", "Accounts User"],
        "cashier2@medworld.com": ["Reception User", "Healthcare User", "Accounts User"],
        # الإدارة الطبية
        "Healthcare-Manager@medworld.com": ["Healthcare Administrator"],
        # الأطباء
        "Doctor1@medworld.com": ["Physician", "Healthcare User"],
        "Doctor2@medworld.com": ["Physician", "Healthcare User"],
        "Doctor3@medworld.com": ["Physician", "Healthcare User"],
        # التمريض
        "Nurse-Manager@medworld.com": ["Nurse Manager", "Healthcare User"],
        "Nurse1@medworld.com": ["Nursing User", "Healthcare User"],
        # المختبر
        "Lab-Manager@medworld.com": ["Laboratory Manager", "LabTest Approver", "Healthcare User"],
        "Lab-Technician1@medworld.com": ["Laboratory User", "Healthcare User"],
        "Lab-Technician2@medworld.com": ["Laboratory User", "Healthcare User"],
        "Lab-Technician3@medworld.com": ["Laboratory User", "Healthcare User"],
        "Lab-Test-Approver@medworld.com": ["LabTest Approver", "Healthcare User"],
        # الأشعة
        "Radiology-Manager@medworld.com": ["Radiology Manager", "Healthcare User"],
        "Radiology-Technician1@medworld.com": ["Radiology User", "Healthcare User"],
        # الصيدلية
        "Pharmacy-Manager@medworld.com": ["Pharmacy Manager", "Healthcare User", "Stock User"],
        "pharmacist1@medworld.com": ["Pharmacy User", "Healthcare User"],
        # المالية والموارد البشرية والمخازن والجودة
        "Financial-Manager@medworld.com": ["Accounts Manager"],
        "HR-Manager@medworld.com": ["HR Manager"],
        "Stock-Manager@medworld.com": ["Stock Manager", "Buying User"],
        "Quality-Manager@medworld.com": ["Quality Manager"],
    }

    cleaned, missing = [], []

    for email, roles in mapping.items():
        if not frappe.db.exists("User", email):
            missing.append(email)
            continue

        # remove existing roles
        frappe.db.delete("Has Role", {"parenttype": "User", "parent": email})

        for role in roles:
            if not frappe.db.exists("Role", role):
                frappe.get_doc({"doctype": "Role", "role_name": role}).insert(
                    ignore_permissions=True
                )
            frappe.get_doc(
                {
                    "doctype": "Has Role",
                    "parenttype": "User",
                    "parentfield": "roles",
                    "parent": email,
                    "role": role,
                }
            ).insert(ignore_permissions=True)

        cleaned.append(email)

    frappe.db.commit()

    return {"reset": cleaned, "missing": missing}
