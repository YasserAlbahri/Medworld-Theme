from __future__ import unicode_literals

import re

import frappe
from frappe.translate import get_all_translations


def _norm(val):
    return (val or "").strip().lower()


def _is_arabic(text):
    return bool(re.search(r"[\u0600-\u06FF]", text or ""))


def run(user=None):
    filters = {}
    if user:
        filters["parent"] = user

    rows = frappe.get_all(
        "User Menu Hide Item",
        filters=filters,
        fields=["name", "item_label", "item_label_ar"],
    )
    if not rows:
        print("No rows found.")
        return

    ar_map = get_all_translations("ar") or {}
    ar_rev = {_norm(v): k for k, v in ar_map.items() if v}

    updated = 0
    for row in rows:
        label = row.get("item_label") or ""
        label_ar = row.get("item_label_ar") or ""
        changed = False

        if label and not label_ar:
            if label in ar_map:
                label_ar = ar_map[label]
                changed = True
            elif _is_arabic(label):
                label_ar = label
                changed = True

        if label and _is_arabic(label):
            eng = ar_rev.get(_norm(label))
            if eng and eng != label:
                label = eng
                changed = True

        if changed:
            frappe.db.set_value(
                "User Menu Hide Item",
                row["name"],
                {"item_label": label, "item_label_ar": label_ar},
            )
            updated += 1

    if updated:
        frappe.db.commit()
    print(f"Updated {updated} rows.")
