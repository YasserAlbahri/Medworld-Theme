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
