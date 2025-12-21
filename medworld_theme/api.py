from __future__ import unicode_literals
import os, re, json
import frappe
from frappe.translate import get_all_translations
from frappe.utils import flt, cint, get_time, make_filter_tuple, get_filter, add_to_date, cstr, get_timespan_date_range, nowdate, add_days, getdate, add_months, get_datetime
from frappe import _
from frappe.desk.reportview import get_filters_cond
from frappe.cache_manager import clear_user_cache
from six import string_types


@frappe.whitelist(allow_guest=True)
def reset_password_disabled(**_):
    frappe.throw(_("Password reset is disabled for this site."), frappe.PermissionError)


@frappe.whitelist()
def get_module_name_from_doctype(doc_name, current_module=""):
    if not doc_name:
        return

    params = [doc_name]
    conditions = ["l.link_to = %s"]
    if current_module:
        conditions.append("w.name = %s")
        params.append(current_module)

    where = " AND ".join(conditions)
    query = """
        SELECT w.name AS module,
               (SELECT restrict_to_domain FROM `tabModule Def` WHERE name = w.module) AS restrict_to_domain
        FROM `tabWorkspace` w
        INNER JOIN `tabWorkspace Link` l ON w.name = l.parent
        WHERE {where}
    """.format(where=where)

    res = frappe.db.sql(query, params, as_dict=True, debug=False)
    if res:
        return [{"module": res[0]["module"]}]


@frappe.whitelist()
def change_language(language):
    frappe.db.set_value("User", frappe.session.user, "language", language)
    clear()
    return True


@frappe.whitelist()
def get_current_language():
    return frappe.db.get_value("User", frappe.session.user, "language")


@frappe.whitelist(allow_guest=True)
def get_label_translations(labels=None, lang=None):
    """Return translations for the given labels using language files/user translations."""
    lang = lang or frappe.local.lang or "en"
    if not labels:
        return {}

    if isinstance(labels, str):
        try:
            labels = json.loads(labels)
        except Exception:
            labels = [labels]

    if not isinstance(labels, (list, tuple, set)):
        labels = [labels]

    translations = get_all_translations(lang) or {}
    result = {}
    for label in labels:
        if not isinstance(label, str):
            continue
        translated = translations.get(label)
        if translated and translated != label:
            result[label] = translated

    return result


@frappe.whitelist(allow_guest=True)
def get_enabled_languages():
    """Return list of enabled languages with their details"""
    from frappe.translate import get_all_languages
    
    enabled_languages = get_all_languages(with_language_name=True)
    languages_list = []
    
    # Debug: طباعة البيانات المستلمة
    frappe.logger().info(f"get_enabled_languages: Received {len(enabled_languages) if enabled_languages else 0} languages from get_all_languages")
    
    # إذا كانت القائمة فارغة أو لم تُرجع البيانات بالشكل المتوقع
    if not enabled_languages:
        # محاولة بديلة: جلب اللغات مباشرة من قاعدة البيانات
        frappe.logger().info("get_enabled_languages: Using fallback method - fetching directly from database")
        languages = frappe.get_all("Language", 
            filters={"enabled": 1}, 
            fields=["language_code", "language_name"],
            order_by="language_name"
        )
        frappe.logger().info(f"get_enabled_languages: Found {len(languages)} languages from database")
        for lang in languages:
            lang_code = (lang.get('language_code') or '').upper()
            lang_name = lang.get('language_name') or lang_code

            # تحديد العلم بناءً على كود اللغة
            flag_class = 'dv-lang-flag lang-en'
            if lang_code == 'AR' or lang_code.startswith('AR'):
                flag_class = 'dv-lang-flag lang-ar'
            elif lang_code == 'EN' or lang_code.startswith('EN'):
                flag_class = 'dv-lang-flag lang-en'
            
            languages_list.append({
                'code': lang_code,
                'name': lang_name,
                'flag': flag_class,
                'label': lang_code
            })
    else:
        # استخدام البيانات من get_all_languages
        for lang in enabled_languages:
            # التحقق من نوع البيانات المرجعة
            if isinstance(lang, dict):
                lang_code = lang.get('language_code', '').upper()
                lang_name = lang.get('language_name', lang_code)
            else:
                # إذا كانت البيانات قائمة (tuple أو list)
                lang_code = (lang[0] if len(lang) > 0 else '').upper()
                lang_name = lang[1] if len(lang) > 1 else lang_code
            
            if not lang_code:
                continue
                
            # تحديد العلم بناءً على كود اللغة
            flag_class = 'dv-lang-flag lang-en'
            if lang_code == 'AR' or lang_code.startswith('AR'):
                flag_class = 'dv-lang-flag lang-ar'
            elif lang_code == 'EN' or lang_code.startswith('EN'):
                flag_class = 'dv-lang-flag lang-en'
            
            languages_list.append({
                'code': lang_code,
                'name': lang_name,
                'flag': flag_class,
                'label': lang_code
            })
    
    frappe.logger().info(f"get_enabled_languages: Returning {len(languages_list)} languages: {[lang['code'] for lang in languages_list]}")
    return languages_list


@frappe.whitelist()
def get_company_logo():
    logo_path = ""
    current_company = frappe.defaults.get_user_default("company")
    if current_company:
        logo_path = frappe.db.get_value("Company", current_company, "company_logo")

    return logo_path


@frappe.whitelist(allow_guest=True)
def get_theme_settings():
    slideshow_photos = []
    settings_list = {}
    settings = frappe.db.sql("""
                       SELECT * FROM tabSingles WHERE doctype = 'Theme Settings';
    """, as_dict=True, debug=False)

    for setting in settings:
        settings_list[setting['field']] = setting['value']

    if (("background_type" in settings_list) and settings_list['background_type'] == 'Slideshow'):
        slideshow_photos = frappe.db.sql("""
                               SELECT `photo` FROM `tabSlideshow Photos` WHERE `parent` = 'Theme Settings';
            """, as_dict=True, debug=False)

    return {
        'enable_background': settings_list['enable_background'] if ("enable_background" in settings_list) else '',
        'background_photo': settings_list['background_photo'] if ("background_photo" in settings_list) else '',
        'background_type': settings_list['background_type'] if ("background_type" in settings_list) else '',
        'full_page_background': settings_list['full_page_background'] if ("full_page_background" in settings_list) else '',
        'transparent_background': settings_list['transparent_background'] if ("transparent_background" in settings_list) else '',
        'slideshow_photos': slideshow_photos,
        'dark_view': settings_list['dark_view'] if ("dark_view" in settings_list) else '',
        'theme_color': settings_list['theme_color'] if ("theme_color" in settings_list) else '',
        'open_workspace_on_mobile_menu': settings_list['open_workspace_on_mobile_menu'] if ("open_workspace_on_mobile_menu" in settings_list) else '',
        'show_icon_label': settings_list['show_icon_label'] if ("show_icon_label" in settings_list) else '',
        'hide_icon_tooltip': settings_list['hide_icon_tooltip'] if ("hide_icon_tooltip" in settings_list) else '',
        'always_close_sub_menu': settings_list['always_close_sub_menu'] if ("always_close_sub_menu" in settings_list) else '',
        'menu_opening_type': settings_list['menu_opening_type'] if ("menu_opening_type" in settings_list) else '',
        'loading_image': settings_list['loading_image'] if ("loading_image" in settings_list) else ''
    }


@frappe.whitelist()
def update_theme_settings(**data):
    data = frappe._dict(data)
    doc = frappe.get_doc("Theme Settings")
    doc.theme_color = data.theme_color
    doc.apply_on_menu = data.apply_on_menu
    doc.apply_on_dashboard = data.apply_on_dashboard
    doc.apply_on_workspace = data.apply_on_workspace
    doc.apply_on_navbar = data.apply_on_navbar
    doc.save(ignore_permissions=True)
    return doc


@frappe.whitelist()
def get_events(start=getdate(), end=getdate().year, user=None, for_reminder=False, filters=None):
    end = str(getdate().year) + "-12-31"
    if not user:
        user = frappe.session.user

    if isinstance(filters, string_types):
        filters = json.loads(filters)

    filter_condition = get_filters_cond('Event', filters, [])

    tables = ["`tabEvent`"]
    if "`tabEvent Participants`" in filter_condition:
        tables.append("`tabEvent Participants`")

    events = frappe.db.sql("""
        SELECT `tabEvent`.name,
                `tabEvent`.subject,
                `tabEvent`.description,
                `tabEvent`.color,
                `tabEvent`.starts_on,
                `tabEvent`.ends_on,
                `tabEvent`.owner,
                `tabEvent`.all_day,
                `tabEvent`.event_type,
                `tabEvent`.repeat_this_event,
                `tabEvent`.repeat_on,
                `tabEvent`.repeat_till,
                `tabEvent`.monday,
                `tabEvent`.tuesday,
                `tabEvent`.wednesday,
                `tabEvent`.thursday,
                `tabEvent`.friday,
                `tabEvent`.saturday,
                `tabEvent`.sunday
        FROM {tables}
        WHERE (
                (
                    (date(`tabEvent`.starts_on) BETWEEN date(%(start)s) AND date(%(end)s))
                    OR (date(`tabEvent`.ends_on) BETWEEN date(%(start)s) AND date(%(end)s))
                    OR (
                        date(`tabEvent`.starts_on) <= date(%(start)s)
                        AND date(`tabEvent`.ends_on) >= date(%(end)s)
                    )
                )
                OR (
                    date(`tabEvent`.starts_on) <= date(%(start)s)
                    AND `tabEvent`.repeat_this_event=1
                    AND coalesce(`tabEvent`.repeat_till, '3000-01-01') > date(%(start)s)
                )
            )
        {reminder_condition}
        {filter_condition}
        AND (
                `tabEvent`.event_type='Public'
                OR `tabEvent`.owner=%(user)s
                OR EXISTS(
                    SELECT `tabDocShare`.name
                    FROM `tabDocShare`
                    WHERE `tabDocShare`.share_doctype='Event'
                        AND `tabDocShare`.share_name=`tabEvent`.name
                        AND `tabDocShare`.user=%(user)s
                )
            )
        AND `tabEvent`.status='Open'
        ORDER BY `tabEvent`.starts_on""".format(
        tables=", ".join(tables),
        filter_condition=filter_condition,
        reminder_condition="AND coalesce(`tabEvent`.send_reminder, 0)=1" if for_reminder else ""
    ), {
        "start": start,
        "end": end,
        "user": user,
    }, as_dict=1)

    return events


@frappe.whitelist()
def update_menu_modules(modules):
    modules_list = json.loads(modules)
    for module in modules_list:
        if frappe.db.exists("Workspace", module["name"]):
            if (module["_is_deleted"] == 'true'):
                frappe.delete_doc("Workspace", module["name"], force=True)
            else:
                frappe.db.set_value("Workspace", module["name"], {
                    "title": module['title'],
                    "label": module["title"],
                    "icon": module["icon"],
                    "sequence_id": int(module["sequence_id"])
                })
        else:
            if (module["_is_new"] == 'true'):
                workspace = frappe.new_doc("Workspace")
                workspace.title = module["title"]
                workspace.icon = module["icon"]
                workspace.content = module["content"]
                workspace.label = module["label"]
                workspace.sequence_id = int(module["sequence_id"])
                workspace.for_user = ""
                workspace.public = 1
                workspace.save(ignore_permissions=True)

    return True


@frappe.whitelist()
def sync_workspace_cards(title, is_public=0, card_order=None):
    if not title or not card_order:
        return

    try:
        card_order = frappe.parse_json(card_order)
    except Exception:
        return

    if not isinstance(card_order, list) or not card_order:
        return

    is_public = cint(is_public)
    filters = {"public": is_public, "label": title}
    if not is_public:
        filters = {
            "for_user": frappe.session.user,
            "label": f"{title}-{frappe.session.user}",
        }

    workspace_name = frappe.db.get_value("Workspace", filters, "name")
    if not workspace_name:
        return

    doc = frappe.get_doc("Workspace", workspace_name)
    prefix_rows = []
    card_map = {}
    row_reference = []
    current_card = None

    for link in doc.get("links", []):
        row_reference.append(link)
        if link.type == "Card Break":
            current_card = link.label
            card_map.setdefault(current_card, []).append(link)
        elif current_card and current_card in card_map:
            card_map[current_card].append(link)
        else:
            prefix_rows.append(link)

    ordered_rows = [row.name for row in prefix_rows]
    seen = set()
    for label in card_order:
        section = card_map.get(label)
        if not section:
            continue
        ordered_rows.extend(row.name for row in section)
        seen.add(label)

    obsolete = []
    for label, rows in card_map.items():
        if label in seen:
            continue
        obsolete.extend(row.name for row in rows)

    if obsolete:
        frappe.db.delete("Workspace Link", {"name": ("in", obsolete)})
        ordered_rows = [name for name in ordered_rows if name not in obsolete]

    seen.clear()
    remaining = []
    for row in row_reference:
        if row.name in obsolete or row.name in ordered_rows:
            continue

        if row.type == "Card Break" and row.label not in seen:
            seen.add(row.label)
            ordered_rows.append(row.name)
        elif row.type != "Card Break":
            ordered_rows.append(row.name)

    card_boundaries = {}
    for name in ordered_rows:
        row = next((r for r in row_reference if r.name == name), None)
        if row and row.type == "Card Break":
            card_boundaries[name] = len(ordered_rows) + 1

    for card_name in card_boundaries:
        card_boundaries[card_name] = ordered_rows.index(card_name)

    current_card = None
    link_counts = {}
    for name in ordered_rows:
        row = next((r for r in row_reference if r.name == name), None)
        if not row:
            continue

        if row.type == "Card Break":
            current_card = row
            link_counts[current_card.name] = 0
        elif current_card:
            link_counts[current_card.name] += 1

    for idx, row_name in enumerate(ordered_rows, start=1):
        row = next((r for r in row_reference if r.name == row_name), None)
        if not row:
            continue
        values = {"idx": idx}
        if row.type == "Card Break":
            values["link_count"] = link_counts.get(row_name, row.link_count)
            values["link_type"] = ""
            values["link_to"] = ""
        frappe.db.set_value("Workspace Link", row_name, values, update_modified=False)

    return True


def clear():
    frappe.local.session_obj.update(force=True)
    frappe.local.db.commit()
    clear_user_cache(frappe.session.user)
    frappe.response['message'] = _("Cache Cleared")
