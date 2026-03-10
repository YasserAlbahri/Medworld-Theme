import frappe


def extend_bootinfo(bootinfo: dict, **kwargs):
    """Enforce a "no in-app notifications / no update prompts" desk experience.

    Goal:
    - Prevent update available / changelog popups
    - Prevent update available / changelog popups
    - Avoid showing system "Notes" popups on login

    We intentionally do NOT disable:
    - Desk notifications (internal) like Notification Log / mentions / assignments
    - Essential UX alerts (validation errors, save success, etc.)
    """

    # Disable update prompts + changelog notifications.
    try:
        bootinfo["has_app_updates"] = 0
    except Exception:
        pass

    try:
        bootinfo["change_log"] = []
    except Exception:
        pass

    # Disable change log dialog even if some app injects change_log.
    try:
        sysdefaults = bootinfo.setdefault("sysdefaults", {}) or {}
        sysdefaults["disable_change_log_notification"] = 1
        bootinfo["sysdefaults"] = sysdefaults
    except Exception:
        pass

    # Avoid system "Note" popups on login.
    try:
        bootinfo["notes"] = []
    except Exception:
        pass
