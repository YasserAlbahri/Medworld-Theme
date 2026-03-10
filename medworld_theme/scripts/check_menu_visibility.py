from __future__ import unicode_literals

import frappe
from medworld_theme.api import get_user_workspace_tree


def _label(item):
    return item.get("item_label") or item.get("item_route") or item.get("item_name") or ""


def run(user=None, include_hidden=0):
    user = user or frappe.session.user
    include_hidden = int(include_hidden or 0)
    tree = get_user_workspace_tree(user=user) or []

    print(f"Menu visibility for user: {user}")
    print("Workspaces:")
    total_items = 0
    hidden_items = 0
    hidden_workspaces = 0

    for ws in tree:
        ws_hidden = bool(ws.get("hidden"))
        if ws_hidden and not include_hidden:
            continue
        if ws_hidden:
            hidden_workspaces += 1
        ws_label = ws.get("workspace_label") or ws.get("workspace") or ""
        ws_name = ws.get("workspace") or ""
        hidden_flag = " (hidden)" if ws_hidden else ""
        print(f"- {ws_label} [{ws_name}]{hidden_flag}")

        for ch in ws.get("children") or []:
            ch_hidden = bool(ch.get("hidden"))
            if ch_hidden and not include_hidden:
                continue
            kind = ch.get("item_kind") or ch.get("kind") or ""
            label = _label(ch)
            hidden_flag = " (hidden)" if ch_hidden else ""
            print(f"  - {kind}: {label}{hidden_flag}")
            total_items += 1
            if ch_hidden:
                hidden_items += 1

            for sub in ch.get("children") or []:
                sub_hidden = bool(sub.get("hidden"))
                if sub_hidden and not include_hidden:
                    continue
                sub_kind = sub.get("item_kind") or sub.get("kind") or ""
                sub_label = _label(sub)
                hidden_flag = " (hidden)" if sub_hidden else ""
                print(f"    - {sub_kind}: {sub_label}{hidden_flag}")
                total_items += 1
                if sub_hidden:
                    hidden_items += 1

    print(f"Hidden workspaces: {hidden_workspaces}")
    print(f"Hidden items: {hidden_items} / {total_items}")


def run_reception_manager():
    return run("reception-manager@medworld.com", include_hidden=1)
