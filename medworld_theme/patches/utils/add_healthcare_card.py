import frappe
import json


def run():
    """Ensure Healthcare workspace has a card 'Healthcare' with target doctypes and visible card block."""
    workspace_name = "Healthcare"
    card_label = "Healthcare"
    targets = [
        {"label": "Healthcare Service Unit", "doctype": "Healthcare Service Unit"},
        {"label": "Medical Department", "doctype": "Medical Department"},
        {"label": "Patient", "doctype": "Patient"},
        {"label": "Healthcare Practitioner", "doctype": "Healthcare Practitioner"},
        {"label": "Practitioner Schedule", "doctype": "Practitioner Schedule"},
    ]

    try:
        ws = frappe.get_doc("Workspace", workspace_name)
    except frappe.DoesNotExistError:
        frappe.throw(f"Workspace '{workspace_name}' not found")

    existing_links = ws.get("links") or []

    target_doctypes = {t["doctype"].lower() for t in targets}
    target_labels = {t["label"].lower() for t in targets}

    new_links = []
    # Keep other links that are not part of our target list
    for link in existing_links:
        if getattr(link, "type", "") == "Card Break" and link.label and link.label.lower() == card_label.lower():
            # skip old card break to replace with clean one
            continue
        if getattr(link, "label", "").lower() in target_labels:
            continue
        if getattr(link, "link_to", "").lower() in target_doctypes:
            continue
        new_links.append(link)

    # Add card break
    new_links.append(
        frappe._dict(
            {
                "type": "Card Break",
                "label": card_label,
            }
        )
    )

    # Add target doctypes
    for t in targets:
        new_links.append(
            frappe._dict(
                {
                    "type": "Link",
                    "label": t["label"],
                    "link_type": "DocType",
                    "link_to": t["doctype"],
                }
            )
        )

    # Reassign with proper idx
    for idx, link in enumerate(new_links, start=1):
        link.idx = idx

    ws.set("links", new_links)

    # Ensure a card block exists in content for this card_label
    content = ws.content or "[]"
    try:
        blocks = json.loads(content)
    except Exception:
        blocks = []

    # remove old card with same name
    blocks = [
        b
        for b in blocks
        if not (b.get("type") == "card" and b.get("data", {}).get("card_name") == card_label)
    ]

    insert_idx = None
    for i, b in enumerate(blocks):
        if b.get("type") == "header":
            insert_idx = i + 1
            break
        if b.get("type") == "card":
            insert_idx = i
            break
    if insert_idx is None:
        insert_idx = len(blocks)

    blocks.insert(
        insert_idx,
        {
            "id": frappe.generate_hash(length=10),
            "type": "card",
            "data": {
                "card_name": card_label,
                "col": 4,
            },
        },
    )
    ws.content = json.dumps(blocks)

    ws.save(ignore_permissions=True)
    frappe.db.commit()






