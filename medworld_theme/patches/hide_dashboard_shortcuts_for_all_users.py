import frappe
from frappe.utils import now_datetime


TARGET_SHORTCUT_LABEL = "Dashboard"
TARGET_SHORTCUT_TYPE = "Dashboard"
NOTE_TAG = "AUTO: hide 'Dashboard' shortcut for all users"


def _get_targets():
    rows = frappe.db.sql(
        """
        SELECT parent AS workspace, link_to AS route
        FROM `tabWorkspace Shortcut`
        WHERE label = %s AND type = %s
        """,
        (TARGET_SHORTCUT_LABEL, TARGET_SHORTCUT_TYPE),
        as_dict=True,
    )
    targets = set()
    for r in rows:
        ws = (r.get("workspace") or "").strip()
        route = (r.get("route") or "").strip()
        if ws and route:
            targets.add((ws, route))
    return sorted(targets)


def _get_users(exclude_users=None, enabled_only=True):
    exclude_users = set(exclude_users or [])
    filters = {}
    if enabled_only:
        filters["enabled"] = 1
    users = frappe.get_all("User", filters=filters, pluck="name") or []
    return [u for u in users if u and u not in exclude_users]


def execute(enabled_only=True, exclude_users=None, dry_run=False):
    """Hide ONLY the Workspace Shortcut whose label is exactly 'Dashboard' for all users.

    Implementation: add per-user rows in child table `User Menu Hide Item` (Menu Visibility),
    so admins can later unhide it for specific users from the UI.
    """
    exclude_users = exclude_users or ["Administrator", "Guest"]

    targets = _get_targets()
    if not targets:
        frappe.msgprint("No Workspace Shortcut targets found (label=Dashboard, type=Dashboard).")
        return {"targets": 0, "users": 0, "inserted": 0}

    users = _get_users(exclude_users=exclude_users, enabled_only=enabled_only)
    if not users:
        frappe.msgprint("No users found to update.")
        return {"targets": len(targets), "users": 0, "inserted": 0}

    # Existing hide rows (shortcut kind) for any of the target workspaces/routes.
    workspaces = sorted({ws for ws, _ in targets})
    routes = sorted({r for _, r in targets})

    existing = frappe.db.sql(
        """
        SELECT parent, workspace, item_route, item_label, item_label_ar
        FROM `tabUser Menu Hide Item`
        WHERE parenttype='User'
          AND parentfield='menu_hide_items'
          AND parent IN %(users)s
          AND workspace IN %(workspaces)s
          AND (LOWER(item_kind)='shortcut' OR LOWER(item_type)='shortcut')
        """,
        {"users": tuple(users), "workspaces": tuple(workspaces)},
        as_dict=True,
    )

    existing_by_route = set()
    existing_label_only = set()
    for row in existing:
        parent = (row.get("parent") or "").strip()
        ws = (row.get("workspace") or "").strip()
        route = (row.get("item_route") or "").strip()
        label = (row.get("item_label") or "").strip()
        label_ar = (row.get("item_label_ar") or "").strip()
        if route:
            existing_by_route.add((parent, ws, route))
        else:
            # Legacy/label-only rows (still hide the shortcut); avoid duplicating.
            if label == TARGET_SHORTCUT_LABEL or label_ar == TARGET_SHORTCUT_LABEL:
                existing_label_only.add((parent, ws))

    # idx per user (append after current max)
    idx_rows = frappe.db.sql(
        """
        SELECT parent, COALESCE(MAX(idx), 0) AS mx
        FROM `tabUser Menu Hide Item`
        WHERE parenttype='User' AND parentfield='menu_hide_items' AND parent IN %(users)s
        GROUP BY parent
        """,
        {"users": tuple(users)},
        as_dict=True,
    )
    idx_map = {r["parent"]: int(r["mx"] or 0) for r in idx_rows}

    now = now_datetime()
    inserted = 0

    # Insert missing rows per user per workspace/route.
    for user in users:
        mx = idx_map.get(user, 0)
        for ws, route in targets:
            if (user, ws, route) in existing_by_route:
                continue
            if (user, ws) in existing_label_only:
                continue
            if route not in routes:
                # Defensive: should never happen since routes derived from targets.
                continue

            mx += 1
            if dry_run:
                inserted += 1
                continue

            row_name = frappe.generate_hash(length=12)
            frappe.db.sql(
                """
                INSERT INTO `tabUser Menu Hide Item`
                    (name, creation, modified, modified_by, owner, docstatus, idx,
                     parent, parenttype, parentfield,
                     workspace, item_type, item_kind, item_route, item_label, item_label_ar, hide, notes)
                VALUES
                    (%s, %s, %s, %s, %s, 0, %s,
                     %s, 'User', 'menu_hide_items',
                     %s, %s, %s, %s, %s, %s, 1, %s)
                """,
                (
                    row_name,
                    now,
                    now,
                    frappe.session.user,
                    frappe.session.user,
                    mx,
                    user,
                    ws,
                    "Shortcut",
                    "Shortcut",
                    route,
                    TARGET_SHORTCUT_LABEL,
                    TARGET_SHORTCUT_LABEL,  # ensures matching even before translations load
                    NOTE_TAG,
                ),
            )
            inserted += 1

        idx_map[user] = mx

    if not dry_run:
        frappe.db.commit()

    return {"targets": len(targets), "users": len(users), "inserted": inserted, "dry_run": dry_run}


def rollback(exclude_users=None):
    """Remove rows inserted by this patch (based on notes tag)."""
    exclude_users = exclude_users or []
    frappe.db.sql(
        """
        DELETE FROM `tabUser Menu Hide Item`
        WHERE notes=%(notes)s
          AND parenttype='User'
          AND parentfield='menu_hide_items'
          AND parent NOT IN %(exclude)s
        """,
        {"exclude": tuple(exclude_users) or ("",), "notes": NOTE_TAG},
    )
    frappe.db.commit()
    deleted = frappe.db.sql("SELECT ROW_COUNT()")[0][0]
    return {"deleted": int(deleted or 0)}
