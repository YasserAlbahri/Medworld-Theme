"""
Manual script to update Arabic labels for existing User Menu Hide Items
Run this script manually using: bench --site [site-name] execute medworld_theme.scripts.update_menu_hide_arabic_labels_manual.update_all
"""

from __future__ import unicode_literals
import frappe
from frappe.translate import get_all_translations


def update_all():
    """Update Arabic labels for all User Menu Hide Items"""
    
    print("Starting update of Arabic labels for User Menu Hide Items...")

    if not frappe.db.has_column("User Menu Hide Item", "item_label_ar"):
        print("item_label_ar column missing; run bench migrate first.")
        return
    
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
        print("No items found to update.")
        return
    
    print(f"Found {len(items)} items to update")
    
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
                print(f"✓ Updated: {item.name} - '{label}' -> '{ar_label}'")
            else:
                print(f"✗ No translation found for: '{label}' (item: {item.name})")
                failed_count += 1
                
        except Exception as e:
            failed_count += 1
            print(f"✗ Error updating item {item.name}: {str(e)}")
    
    # Commit all changes
    frappe.db.commit()
    
    print(f"\n{'='*60}")
    print(f"Update completed!")
    print(f"✓ Updated: {updated_count} items")
    print(f"✗ Failed/Skipped: {failed_count} items")
    print(f"{'='*60}")
    
    return {
        "updated": updated_count,
        "failed": failed_count,
        "total": len(items)
    }


if __name__ == "__main__":
    # For direct execution
    frappe.init(site="medworldyemen.com")
    frappe.connect()
    update_all()
    frappe.destroy()


