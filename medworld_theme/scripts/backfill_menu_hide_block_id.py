from __future__ import unicode_literals

import frappe
from frappe.translate import get_all_translations
from frappe.desk.desktop import get_desktop_page
from medworld_theme import api as theme_api


def _norm(val):
    return (val or "").strip().lower()


def _build_card_maps():
    ar_map = get_all_translations("ar") or {}
    ar_rev = {_norm(v): k for k, v in ar_map.items() if v}
    cards_by_ws = {}

    for ws in frappe.get_all("Workspace", pluck="name"):
        doc = frappe.get_doc("Workspace", ws)
        data = get_desktop_page(doc.as_json()) or {}
        cards = (
            (data.get("cards") or {}).get("items", [])
            if isinstance(data.get("cards"), dict)
            else []
        )
        label_map = {}
        for idx, card in enumerate(cards):
            label = (card.get("label") or "").strip()
            block_id = theme_api._card_block_id(card, ws, idx)
            if not label or not block_id:
                continue
            label_map[_norm(label)] = block_id
            ar_label = ar_map.get(label)
            if ar_label:
                label_map[_norm(ar_label)] = block_id
        cards_by_ws[ws] = label_map

    return cards_by_ws, ar_rev


def run(user=None):
    filters = {
        "block_id": ("in", ("", None)),
        "item_kind": ("in", ("Card", "card")),
    }
    if user:
        filters["parent"] = user

    rows = frappe.get_all(
        "User Menu Hide Item",
        filters=filters,
        fields=["name", "parent", "workspace", "item_label", "item_label_ar"],
    )
    if not rows:
        print("No card rows missing block_id.")
        return

    cards_by_ws, ar_rev = _build_card_maps()
    updated = 0
    skipped = 0

    for row in rows:
        ws = row.get("workspace") or ""
        label = row.get("item_label") or ""
        label_ar = row.get("item_label_ar") or ""
        if not ws or not label:
            skipped += 1
            continue

        label_map = cards_by_ws.get(ws) or {}
        candidates = []
        if label:
            candidates.append(label)
        if label_ar:
            candidates.append(label_ar)

        block_id = None
        for cand in candidates:
            cand_norm = _norm(cand)
            if not cand_norm:
                continue
            block_id = label_map.get(cand_norm)
            if block_id:
                break
            if cand_norm in ar_rev:
                block_id = label_map.get(_norm(ar_rev[cand_norm]))
                if block_id:
                    break

        if block_id:
            frappe.db.set_value(
                "User Menu Hide Item",
                row["name"],
                "block_id",
                block_id,
                update_modified=False,
            )
            updated += 1
        else:
            skipped += 1

    frappe.db.commit()
    print(f"Updated {updated} rows. Skipped {skipped} rows.")
