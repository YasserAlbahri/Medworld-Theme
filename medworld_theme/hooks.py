from . import __version__ as app_version

app_name = "medworld_theme"
app_title = "Medworld Theme"
app_publisher = "Yasser Albahri"
app_description = "Medworld theme for Frappe 15"
app_email = "info@ysa-tech.com"
app_license = "mit"
# required_apps = []
modules = ["Medworld Theme", "Medworld Integrations", "Medworld Settings", "Medworld Chat"]

# Includes in <head>
# ------------------

website_context = {
    "favicon": "/assets/medworld_theme/images/logo-xs.png",
    "splash_image": "/assets/medworld_theme/images/theme_splash_empty.jpg"
}

before_request = [
    "medworld_theme.utils.redirect_password_routes",
    "medworld_theme.utils.log_login_post_debug",
]

app_include_css = [
    f"/assets/medworld_theme/plugins/animate.css/animate.min.css?v={app_version}",
    "/assets/medworld_theme/plugins/fontawesome/all.min.css",
    "/assets/medworld_theme/plugins/tooltip/tooltip-theme-twipsy.css",
    "/assets/medworld_theme/plugins/flat-icons/flaticon.css",
    "/assets/medworld_theme/plugins/simple-calendar/simple-calendar.css",
    "medworld_theme.bundle.css",
    f"/assets/medworld_theme/css/mwy_brand_override.css?v={app_version}",
    f"/assets/medworld_theme/css/desk_nav_controls.css?v={app_version}",
    f"/assets/medworld_theme/css/pwa_install_mobile.css?v={app_version}",
]

app_include_js = [
	"/assets/medworld_theme/plugins/vue/vue.js",
	"/assets/medworld_theme/plugins/bootstrap4c-chosen/chosen.min.js",
	"/assets/medworld_theme/plugins/nicescroll/nicescroll.js",
	"/assets/medworld_theme/plugins/tooltip/tooltip.js",
	"/assets/medworld_theme/plugins/jquery-fullscreen/jquery.fullscreen.min.js?ver=1",
	"/assets/medworld_theme/plugins/simple-calendar/jquery.simple-calendar.js",
	f"/assets/medworld_theme/js/medworld_theme.app.min.js?v={app_version}",
	f"/assets/medworld_theme/js/navbar_user_info.js?v={app_version}",
	f"/assets/medworld_theme/js/mwy_rebrand.js?v={app_version}",
	f"/assets/medworld_theme/js/desk_nav_controls.js?v={app_version}",
	f"/assets/medworld_theme/js/smart_open_desktop.js?v={app_version}",
	f"/assets/medworld_theme/js/pwa_install_mobile.js?v={app_version}",
	f"/assets/medworld_theme/js/duplicate_tab_hotkey.js?v={app_version}",
	f"/assets/medworld_theme/js/assets_recovery_guard.js?v={app_version}",
	# "medworld_theme.bundle.js"
]

email_brand_image = "assets/medworld_theme/images/logo-v.png"

# include js, css files in header of web template
web_include_css = [
    "assets/medworld_theme/plugins/fontawesome/all.min.css",
    "assets/medworld_theme/css/login.css",
    "assets/medworld_theme/css/dv-login.css?ver=" + app_version,
    f"/assets/medworld_theme/css/pwa_install_mobile.css?v={app_version}",
]
web_include_js = [
    "/assets/frappe/js/lib/jquery/jquery.min.js",
    "/assets/medworld_theme/js/medworld_theme.web.min.js?ver=" + app_version,
    f"/assets/medworld_theme/js/smart_open_desktop.js?v={app_version}",
    f"/assets/medworld_theme/js/pwa_install_mobile.js?v={app_version}",
]

# include js, css files in header of desk.html
# app_include_css = "/assets/medworld_theme/css/medworld_theme.css"
# app_include_js = "/assets/medworld_theme/js/medworld_theme.js"

# include js, css files in header of web template
# web_include_css = "/assets/medworld_theme/css/medworld_theme.css"
# web_include_js = "/assets/medworld_theme/js/medworld_theme.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "medworld_theme/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
doctype_list_js = {
    # Keep Workspace list primary action visible without touching theme page mode
    "Workspace": "public/js/workspace_list.js",
}
# Inject menu visibility helper into User form
doctype_js = {
    "User": "public/js/user_menu_hide.js",
    "Patient Encounter": "public/js/patient_encounter_practitioner.js",
    "Advice And Plan Of Patient": "public/js/practitioner_autofill_form.js",
    "Clinical Procedure": "public/js/practitioner_autofill_form.js",
    "Examination": "public/js/practitioner_autofill_form.js",
    "Examination Summary": "public/js/practitioner_autofill_form.js",
    "Follow Up": "public/js/practitioner_autofill_form.js",
    "History": "public/js/practitioner_autofill_form.js",
    "History Summary": "public/js/practitioner_autofill_form.js",
    "Inpatient Medication Entry": "public/js/practitioner_autofill_form.js",
    "Inpatient Medication Order": "public/js/practitioner_autofill_form.js",
    "Inpatient Record": "public/js/practitioner_autofill_form.js",
    "Input and Output Chart": "public/js/practitioner_autofill_form.js",
    "Medication Request": "public/js/practitioner_autofill_form.js",
    "Nutrition Values Chart": "public/js/practitioner_autofill_form.js",
    "Observation": "public/js/practitioner_autofill_form.js",
    "Patient Assessment": "public/js/practitioner_autofill_form.js",
    "Patient Feedback": "public/js/practitioner_autofill_form.js",
    "Patient Follow Up Summary": "public/js/practitioner_autofill_form.js",
    "Patient Hospital Courses": "public/js/practitioner_autofill_form.js",
    "Patient Morbidity Summary": "public/js/practitioner_autofill_form.js",
    "Patient Mortality Summary": "public/js/practitioner_autofill_form.js",
    "Patient Timeline": "public/js/practitioner_autofill_form.js",
    "Service Request": "public/js/practitioner_autofill_form.js",
    "Therapy Session": "public/js/practitioner_autofill_form.js",
    "Vital Signs Chart": "public/js/practitioner_autofill_form.js",
}

# Auto-fill practitioner link fields using logged-in user's linked practitioner.
# If user has no linked practitioner, document stays unchanged.
doc_events = {
	"*": {
		"validate": "medworld_theme.practitioner_autofill.autofill_practitioner_fields",
	}
}

override_whitelisted_methods = {
    "frappe.desk.desktop.get_desktop_page": "medworld_theme.api.get_desktop_page",
    "frappe.desk.desktop.get_workspace_sidebar_items": "medworld_theme.api.get_workspace_sidebar_items",
    "frappe.desk.form.load.getdoc": "medworld_theme.api.safe_getdoc",
    "frappe.core.doctype.user.user.reset_password": "medworld_theme.api.reset_password_disabled",
    # Enforce "no notifications / no update prompts" at the session bootstrap endpoint.
    "frappe.sessions.get": "medworld_theme.api.sessions_get",
}

# Hard-disable desk notifications + update prompts for client delivery.
# This is enforced at boot time for every user.
extend_bootinfo = [
    "medworld_theme.boot.extend_bootinfo",
]
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "medworld_theme/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# (keep before_request defined above)

# website user home page (by Role)
# role_home_page = {
#	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
#	"methods": "medworld_theme.utils.jinja_methods",
#	"filters": "medworld_theme.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "medworld_theme.install.before_install"
# after_install = "medworld_theme.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "medworld_theme.uninstall.before_uninstall"
# after_uninstall = "medworld_theme.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "medworld_theme.utils.before_app_install"
# after_app_install = "medworld_theme.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "medworld_theme.utils.before_app_uninstall"
# after_app_uninstall = "medworld_theme.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "medworld_theme.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
#	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
#	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
#	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
#	"*": {
#		"on_update": "method",
#		"on_cancel": "method",
#		"on_trash": "method"
#	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
#	"all": [
#		"medworld_theme.tasks.all"
#	],
#	"daily": [
#		"medworld_theme.tasks.daily"
#	],
#	"hourly": [
#		"medworld_theme.tasks.hourly"
#	],
#	"weekly": [
#		"medworld_theme.tasks.weekly"
#	],
#	"monthly": [
#		"medworld_theme.tasks.monthly"
#	],
# }

# Testing
# -------

# before_tests = "medworld_theme.install.before_tests"

# Overriding Methods
# ------------------------------
#
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
#	"Task": "medworld_theme.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["medworld_theme.utils.before_request"]
# after_request = ["medworld_theme.utils.after_request"]

# Job Events
# ----------
# before_job = ["medworld_theme.utils.before_job"]
# after_job = ["medworld_theme.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
#	{
#		"doctype": "{doctype_1}",
#		"filter_by": "{filter_by}",
#		"redact_fields": ["{field_1}", "{field_2}"],
#		"partial": 1,
#	},
#	{
#		"doctype": "{doctype_2}",
#		"filter_by": "{filter_by}",
#		"partial": 1,
#	},
#	{
#		"doctype": "{doctype_3}",
#		"strict": False,
#	},
#	{
#		"doctype": "{doctype_4}"
#	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
#	"medworld_theme.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
#	"Logging DocType Name": 30  # days to retain logs
# }
