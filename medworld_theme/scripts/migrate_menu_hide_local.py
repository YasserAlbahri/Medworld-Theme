from __future__ import unicode_literals

import frappe
from frappe.translate import get_all_translations
from frappe.desk.desktop import get_desktop_page as core_get_desktop_page


def _norm(val):
    return (val or "").strip().lower()


def _kind_bucket(kind):
    kind_val = _norm(kind)
    if kind_val in ("doctype", "report", "page", "link"):
        return "link"
    return kind_val


def _build_translation_maps():
    ar_translations = get_all_translations("ar") or {}
    ar_inverse = {}
    for eng, ar in ar_translations.items():
        if not ar:
            continue
        ar_inverse.setdefault(_norm(ar), set()).add(_norm(eng))
    return ar_translations, ar_inverse


def _label_candidates(label, label_ar, ar_translations, ar_inverse):
    candidates = set()
    if label:
        candidates.add(_norm(label))
        ar_label = ar_translations.get(label)
        if ar_label:
            candidates.add(_norm(ar_label))
        candidates.update(ar_inverse.get(_norm(label), set()))
    if label_ar:
        candidates.add(_norm(label_ar))
        candidates.update(ar_inverse.get(_norm(label_ar), set()))
    return [c for c in candidates if c]


def _add_index(index, kind, name, route, label, block_id, workspace):
    bucket = _kind_bucket(kind)
    if name:
        index["name"].setdefault((bucket, _norm(name)), set()).add(workspace)
    if route:
        index["route"].setdefault((bucket, _norm(route)), set()).add(workspace)
    if label:
        index["label"].setdefault((bucket, _norm(label)), set()).add(workspace)
    if block_id:
        index["block"].setdefault((bucket, _norm(block_id)), set()).add(workspace)


def _build_workspace_index():
    index = {"name": {}, "route": {}, "label": {}, "block": {}}
    workspaces = frappe.get_all("Workspace", fields=["name", "label", "title"], order_by="name")

    for ws in workspaces:
        ws_name = ws.get("name")
        ws_label = ws.get("label") or ws.get("title") or ws_name
        if not ws_name:
            continue

        _add_index(index, "workspace", ws_name, ws_name, ws_label, "", ws_name)

        page_doc = frappe.get_doc("Workspace", ws_name)
        page_data = core_get_desktop_page(page_doc.as_json()) or {}

        # Cards and links
        cards = (page_data.get("cards") or {}).get("items", []) if isinstance(page_data.get("cards"), dict) else []
        for card in cards:
            card_label = card.get("label") or ""
            _add_index(index, "card", "", "", card_label, "", ws_name)

            for link in card.get("links") or []:
                link_kind = link.get("link_type") or link.get("type") or "Link"
                route = link.get("link_to") or ""
                label = link.get("label") or route
                name = link.get("name") or ""
                _add_index(index, link_kind, name, route, label, "", ws_name)

        # Shortcuts
        shortcuts = (page_data.get("shortcuts") or {}).get("items", []) if isinstance(page_data.get("shortcuts"), dict) else []
        for sc in shortcuts:
            route = sc.get("link_to") or ""
            label = sc.get("label") or route
            name = sc.get("name") or ""
            _add_index(index, "shortcut", name, route, label, "", ws_name)

        # Number Cards
        number_cards = (page_data.get("number_cards") or {}).get("items", []) if isinstance(page_data.get("number_cards"), dict) else []
        for nc in number_cards:
            label = nc.get("label") or nc.get("name") or ""
            name = nc.get("name") or ""
            _add_index(index, "number card", name, "", label, "", ws_name)

        # Charts
        charts = (page_data.get("charts") or {}).get("items", []) if isinstance(page_data.get("charts"), dict) else []
        for ch in charts:
            label = ch.get("label") or ch.get("name") or ""
            name = ch.get("name") or ""
            _add_index(index, "chart", name, "", label, "", ws_name)

        # Quick Lists
        quick_lists = (page_data.get("quick_lists") or {}).get("items", []) if isinstance(page_data.get("quick_lists"), dict) else []
        for ql in quick_lists:
            label = ql.get("label") or ql.get("name") or ""
            name = ql.get("name") or ""
            _add_index(index, "quick list", name, "", label, "", ws_name)

        # Custom Blocks
        custom_blocks = (page_data.get("custom_blocks") or {}).get("items", []) if isinstance(page_data.get("custom_blocks"), dict) else []
        for cb in custom_blocks:
            label = cb.get("label") or cb.get("custom_block_name") or ""
            name = cb.get("custom_block_name") or ""
            _add_index(index, "custom block", name, "", label, name, ws_name)

    return index


def _row_key(row, workspace):
    return (
        row.get("parent"),
        _norm(workspace),
        _kind_bucket(row.get("item_kind") or row.get("item_type")),
        _norm(row.get("item_route")),
        _norm(row.get("item_label")),
        _norm(row.get("item_name")),
        _norm(row.get("block_id")),
    )


def _resolve_ar_label(label, label_ar, ar_translations):
    if label_ar:
        return label_ar
    if label and label in ar_translations:
        return ar_translations[label]
    return ""


def run(dry_run=0, reassign=0):
    frappe.set_user("Administrator")
    reassign = int(reassign or 0)

    if not frappe.db.has_column("User Menu Hide Item", "workspace"):
        print("workspace column missing; cannot migrate.")
        return

    has_label_ar = frappe.db.has_column("User Menu Hide Item", "item_label_ar")
    ar_translations, ar_inverse = _build_translation_maps()
    index = _build_workspace_index()

    select_fields = [
        "name",
        "parent",
        "item_type",
        "item_kind",
        "item_route",
        "item_label",
        "item_name",
        "block_id",
        "workspace",
        "hide",
    ]
    if has_label_ar:
        select_fields.append("item_label_ar")

    rows = frappe.db.get_all("User Menu Hide Item", fields=select_fields)
    existing_keys = {_row_key(r, r.get("workspace")) for r in rows if r.get("workspace")}

    updated = 0
    created = 0
    label_updated = 0
    unmatched = []

    reassigned = 0
    for row in rows:
        if has_label_ar and not row.get("item_label_ar"):
            ar_label = _resolve_ar_label(row.get("item_label"), "", ar_translations)
            if ar_label:
                if not dry_run:
                    frappe.db.set_value(
                        "User Menu Hide Item",
                        row.get("name"),
                        "item_label_ar",
                        ar_label,
                        update_modified=False,
                    )
                label_updated += 1

        if row.get("workspace"):
            continue

        kind_bucket = _kind_bucket(row.get("item_kind") or row.get("item_type"))
        matches = set()
        preferred = set()

        block_id = row.get("block_id") or ""
        if block_id:
            block_matches = index["block"].get((kind_bucket, _norm(block_id)), set())
            matches.update(block_matches)
            if block_matches:
                preferred.update(block_matches)

        name = row.get("item_name") or ""
        if name:
            name_matches = index["name"].get((kind_bucket, _norm(name)), set())
            matches.update(name_matches)
            if name_matches and not preferred:
                preferred.update(name_matches)

        route = row.get("item_route") or ""
        if route:
            route_matches = index["route"].get((kind_bucket, _norm(route)), set())
            matches.update(route_matches)
            if route_matches:
                preferred = set(route_matches)

        label = row.get("item_label") or ""
        label_ar = row.get("item_label_ar") if has_label_ar else ""
        for cand in _label_candidates(label, label_ar, ar_translations, ar_inverse):
            label_matches = index["label"].get((kind_bucket, cand), set())
            matches.update(label_matches)
            if label_matches and not preferred:
                preferred.update(label_matches)

        if not matches:
            unmatched.append(row)
            continue

        target_matches = sorted(preferred or matches)
        first_ws = target_matches[0]

        if row.get("workspace"):
            if reassign and _norm(row.get("workspace")) not in {_norm(m) for m in target_matches}:
                key = _row_key(row, first_ws)
                if key not in existing_keys:
                    if not dry_run:
                        frappe.db.set_value(
                            "User Menu Hide Item",
                            row.get("name"),
                            "workspace",
                            first_ws,
                            update_modified=False,
                        )
                    existing_keys.add(key)
                    reassigned += 1
        else:
            key = _row_key(row, first_ws)
            if key not in existing_keys:
                if not dry_run:
                    frappe.db.set_value(
                        "User Menu Hide Item",
                        row.get("name"),
                        "workspace",
                        first_ws,
                        update_modified=False,
                    )
                existing_keys.add(key)
                updated += 1

        for ws_name in target_matches[1:]:
            key = _row_key(row, ws_name)
            if key in existing_keys:
                continue

            if not dry_run:
                doc = {
                    "doctype": "User Menu Hide Item",
                    "parent": row.get("parent"),
                    "parenttype": "User",
                    "parentfield": "menu_hide_items",
                    "workspace": ws_name,
                    "item_type": row.get("item_type") or "",
                    "item_kind": row.get("item_kind") or row.get("item_type") or "",
                    "item_route": row.get("item_route") or "",
                    "item_label": row.get("item_label") or "",
                    "item_name": row.get("item_name") or "",
                    "block_id": row.get("block_id") or "",
                    "hide": row.get("hide", 1),
                }
                if has_label_ar:
                    doc["item_label_ar"] = _resolve_ar_label(
                        row.get("item_label"), row.get("item_label_ar"), ar_translations
                    )
                frappe.get_doc(doc).insert(ignore_permissions=True)

            existing_keys.add(key)
            created += 1

    if not dry_run:
        frappe.db.commit()

    print("Menu visibility migration completed.")
    print(f"Updated rows with workspace: {updated}")
    print(f"Created rows for extra workspaces: {created}")
    print(f"Arabic label updates: {label_updated}")
    print(f"Reassigned rows to matching workspace: {reassigned}")
    print(f"Unmatched rows: {len(unmatched)}")
    if unmatched:
        print("Sample unmatched rows (first 10):")
        for row in unmatched[:10]:
            print(
                f"- {row.get('name')} user={row.get('parent')} type={row.get('item_type')} "
                f"label={row.get('item_label')} route={row.get('item_route')}"
            )
