from __future__ import unicode_literals

import frappe
from medworld_theme.api import get_user_workspace_tree, _kind_bucket, _norm


def _flatten_tree(tree):
    items = []
    for ws in tree or []:
        ws_name = ws.get("workspace") or ""
        for ch in ws.get("children") or []:
            items.append(
                {
                    "workspace": ws_name,
                    "kind": ch.get("item_kind") or ch.get("kind") or "",
                    "name": ch.get("item_name") or "",
                    "route": ch.get("item_route") or "",
                    "label": ch.get("item_label") or "",
                }
            )
            for sub in ch.get("children") or []:
                items.append(
                    {
                        "workspace": ws_name,
                        "kind": sub.get("item_kind") or sub.get("kind") or "",
                        "name": sub.get("item_name") or "",
                        "route": sub.get("item_route") or "",
                        "label": sub.get("item_label") or "",
                    }
                )
    return items


def _match_workspace(row, items):
    row_kind = _kind_bucket(row.get("item_kind") or row.get("item_type") or "")
    row_name = _norm(row.get("item_name"))
    row_route = _norm(row.get("item_route"))
    row_label = _norm(row.get("item_label"))

    candidates = []
    for it in items:
        it_kind = _kind_bucket(it.get("kind"))
        if row_kind and it_kind and it_kind != row_kind:
            continue

        it_route = _norm(it.get("route"))
        it_name = _norm(it.get("name"))
        it_label = _norm(it.get("label"))

        if row_route and it_route and it_route == row_route:
            candidates.append(it)
            continue
        if row_name and it_name and it_name == row_name:
            candidates.append(it)
            continue
        if row_label and it_label and it_label == row_label:
            candidates.append(it)
            continue

    if not candidates:
        return None

    workspaces = {c.get("workspace") for c in candidates if c.get("workspace")}
    if len(workspaces) == 1:
        return next(iter(workspaces))

    return None


def run(user=None):
    filters = {"workspace": ("in", ("", None))}
    if user:
        filters["parent"] = user

    rows = frappe.get_all(
        "User Menu Hide Item",
        filters=filters,
        fields=["name", "parent", "item_type", "item_kind", "item_name", "item_route", "item_label"],
    )
    if not rows:
        print("No rows missing workspace.")
        return

    rows_by_user = {}
    for row in rows:
        rows_by_user.setdefault(row["parent"], []).append(row)

    updated = 0
    skipped = 0
    for parent, user_rows in rows_by_user.items():
        tree = get_user_workspace_tree(user=parent) or []
        items = _flatten_tree(tree)
        for row in user_rows:
            ws = _match_workspace(row, items)
            if ws:
                frappe.db.set_value("User Menu Hide Item", row["name"], "workspace", ws)
                updated += 1
            else:
                skipped += 1

    frappe.db.commit()
    print(f"Updated {updated} rows. Skipped {skipped} rows.")
