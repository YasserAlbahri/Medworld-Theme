"""
Manual script to add Read permission for Page DocType to all roles in Medworld
Run this script manually using: bench --site [site-name] execute medworld_theme.scripts.add_page_read_permissions_manual.execute
"""

from __future__ import unicode_literals
import frappe


def execute():
    """Add Read permission for Page DocType to all roles"""
    
    frappe.log_error("Starting add_page_read_permissions manual script", "Page Permissions Update")
    
    # Get all roles in the system
    all_roles = frappe.db.sql("""
        SELECT DISTINCT name 
        FROM `tabRole`
        WHERE name NOT IN ('Guest', 'Administrator', 'System Manager', 'All')
        ORDER BY name
    """, as_dict=True)
    
    if not all_roles:
        frappe.log_error("No roles found to update", "Page Permissions Update")
        frappe.msgprint("لم يتم العثور على أي رولات لتحديثها", title="إضافة صلاحيات Page")
        return
    
    frappe.log_error(f"Found {len(all_roles)} roles to update", "Page Permissions Update")
    
    # Get Page DocType once
    try:
        page_doc = frappe.get_doc("DocType", "Page")
    except Exception as e:
        frappe.log_error(f"Error loading Page DocType: {str(e)}", "Page Permissions Update Error")
        frappe.msgprint(f"خطأ في تحميل Page DocType: {str(e)}", title="خطأ")
        return
    
    # Get existing permissions for quick lookup
    existing_permissions = {}
    for perm in page_doc.permissions:
        if perm.permlevel == 0:
            existing_permissions[perm.role] = perm
    
    updated_count = 0
    skipped_count = 0
    failed_count = 0
    needs_save = False
    
    for role_data in all_roles:
        role_name = role_data.name
        
        try:
            # Check if permission already exists for this role
            if role_name in existing_permissions:
                existing_permission = existing_permissions[role_name]
                # Update existing permission to ensure Read is enabled
                if not existing_permission.read:
                    existing_permission.read = 1
                    needs_save = True
                    updated_count += 1
                    frappe.log_error(
                        f"Updated Read permission for role: {role_name}",
                        "Page Permissions Update"
                    )
                else:
                    skipped_count += 1
                    frappe.log_error(
                        f"Permission already exists for role: {role_name}",
                        "Page Permissions Update"
                    )
                continue
            
            # Add new permission
            page_doc.append("permissions", {
                "role": role_name,
                "permlevel": 0,
                "read": 1,
                "write": 0,
                "create": 0,
                "delete": 0,
                "submit": 0,
                "cancel": 0,
                "amend": 0,
                "report": 0,
                "export": 0,
                "import": 0,
                "share": 0,
                "print": 0,
                "email": 0
            })
            
            existing_permissions[role_name] = page_doc.permissions[-1]
            needs_save = True
            updated_count += 1
            
            frappe.log_error(
                f"Added Read permission for role: {role_name}",
                "Page Permissions Update"
            )
            
        except Exception as e:
            failed_count += 1
            frappe.log_error(
                f"Error adding permission for role {role_name}: {str(e)}",
                "Page Permissions Update Error"
            )
    
    # Save once if there were any changes
    if needs_save:
        try:
            page_doc.save(ignore_permissions=True)
            frappe.db.commit()
        except Exception as e:
            frappe.log_error(
                f"Error saving Page DocType: {str(e)}",
                "Page Permissions Update Error"
            )
            failed_count += updated_count
            updated_count = 0
            frappe.msgprint(f"خطأ في حفظ Page DocType: {str(e)}", title="خطأ")
            return
    
    # Clear cache to apply permissions
    frappe.clear_cache()
    
    frappe.log_error(
        f"Update completed: {updated_count} added, {skipped_count} already existed, {failed_count} failed",
        "Page Permissions Update"
    )
    
    frappe.msgprint(
        f"تم إضافة صلاحية Read لـ Page لـ {updated_count} رول. {skipped_count} رول كانت لديها الصلاحية مسبقاً. {failed_count} فشل.",
        title="إضافة صلاحيات Page"
    )

