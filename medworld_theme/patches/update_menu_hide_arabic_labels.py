"""
Patch to update Arabic labels for existing User Menu Hide Items
This script will automatically populate item_label_ar for all existing records
that have item_label but missing item_label_ar.
"""

from __future__ import unicode_literals
import frappe
from frappe.translate import get_all_translations


def execute():
    """Update Arabic labels for all User Menu Hide Items"""

    if not frappe.db.has_column("User Menu Hide Item", "item_label_ar"):
        frappe.log_error(
            "item_label_ar column missing; skip update_menu_hide_arabic_labels patch",
            "Menu Visibility Update",
        )
        return

    frappe.log_error("Starting update_menu_hide_arabic_labels patch", "Menu Visibility Update")
    
    # Get all User Menu Hide Items that have label but missing Arabic label
    items = frappe.db.sql("""
        SELECT 
            name,
            parent,
            item_label,
            item_label_ar,
            item_type,
            item_route
        FROM `tabUser Menu Hide Item`
        WHERE item_label IS NOT NULL 
        AND item_label != ''
        AND (item_label_ar IS NULL OR item_label_ar = '')
    """, as_dict=True)
    
    if not items:
        frappe.log_error("No items found to update", "Menu Visibility Update")
        return
    
    frappe.log_error(f"Found {len(items)} items to update", "Menu Visibility Update")
    
    # Get Arabic translations
    ar_translations = get_all_translations("ar") or {}
    
    updated_count = 0
    failed_count = 0
    
    for item in items:
        try:
            label = item.get("item_label", "").strip()
            if not label:
                continue
            
            # Try to get Arabic translation
            ar_label = None
            
            # Method 1: Direct lookup in translations
            if label in ar_translations:
                ar_label = ar_translations[label]
            
            # Method 2: Try using API method if available
            if not ar_label:
                try:
                    from medworld_theme.api import get_label_translations
                    translations = get_label_translations(labels=[label], lang="ar")
                    if translations and label in translations:
                        ar_label = translations[label]
                except Exception:
                    pass
            
            # Update the record
            if ar_label and ar_label != label:
                frappe.db.set_value(
                    "User Menu Hide Item",
                    item.name,
                    "item_label_ar",
                    ar_label,
                    update_modified=False
                )
                updated_count += 1
                frappe.log_error(
                    f"Updated: {item.name} - {label} -> {ar_label}",
                    "Menu Visibility Update"
                )
            else:
                # If no translation found, log it but don't fail
                frappe.log_error(
                    f"No translation found for: {item.name} - {label}",
                    "Menu Visibility Update"
                )
                failed_count += 1
                
        except Exception as e:
            failed_count += 1
            frappe.log_error(
                f"Error updating item {item.name}: {str(e)}",
                "Menu Visibility Update Error"
            )
    
    # Commit all changes
    frappe.db.commit()
    
    frappe.log_error(
        f"Update completed: {updated_count} updated, {failed_count} failed/skipped",
        "Menu Visibility Update"
    )
    
    frappe.msgprint(
        f"تم تحديث {updated_count} عنصر بنجاح. {failed_count} عنصر لم يتم العثور على ترجمة له.",
        title="تحديث التسميات العربية"
    )


