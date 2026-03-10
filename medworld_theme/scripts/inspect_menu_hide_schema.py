from __future__ import unicode_literals

import frappe


def run():
    exists = frappe.db.exists("DocType", "User Menu Hide Item")
    print(f"DocType exists: {bool(exists)}")

    cols = frappe.db.sql("SHOW COLUMNS FROM `tabUser Menu Hide Item`", as_dict=True)
    col_names = [c.get("Field") for c in cols]
    print("User Menu Hide Item columns:")
    print(col_names)

    custom_fields = frappe.get_all(
        "Custom Field",
        filters={"dt": "User Menu Hide Item"},
        fields=["fieldname", "fieldtype"],
        order_by="fieldname",
    )
    print("Custom Fields on User Menu Hide Item:")
    for row in custom_fields:
        print(f"- {row.get('fieldname')} ({row.get('fieldtype')})")
