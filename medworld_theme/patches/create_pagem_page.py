import frappe


def run():
    name = "pagem"
    if frappe.db.exists("Page", name):
        return

    doc = frappe.get_doc(
        {
            "doctype": "Page",
            "page_name": name,
            "title": "Page M",
            "module": "Medworld Theme",
            "standard": "Yes",
        }
    )
    doc.insert(ignore_permissions=True)
    frappe.db.commit()





