from __future__ import unicode_literals

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def run():
    fields = {
        "User": [
            {
                "fieldname": "menu_visibility_section",
                "fieldtype": "Section Break",
                "label": "Menu Visibility",
                "insert_after": "block_modules",
                "collapsible": 1,
            },
            {
                "fieldname": "menu_tree_html",
                "fieldtype": "HTML",
                "label": "Menu Tree",
                "insert_after": "menu_visibility_section",
            },
            {
                "fieldname": "menu_hide_items",
                "fieldtype": "Table",
                "label": "Menu Hide Items",
                "options": "User Menu Hide Item",
                "hidden": 1,
                "insert_after": "menu_tree_html",
            },
        ],
    }

    create_custom_fields(fields, ignore_validate=True)
    frappe.clear_cache(doctype="User")
    frappe.db.commit()
