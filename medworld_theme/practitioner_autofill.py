import frappe


# Migrated from legacy Client Scripts that were auto-setting practitioner values
# with different fieldnames (practitioner / healthcare_practitioner / staff variants).
PRACTITIONER_FIELDS_BY_DOCTYPE = {
	"Advice And Plan Of Patient": {"healthcare_practitioner"},
	"Clinical Procedure": {"practitioner"},
	"Examination": {"practitioner"},
	"Examination Summary": {"practitioner"},
	"Follow Up": {"healthcare_practitioner"},
	"History": {"practitioner"},
	"History Summary": {"practitioner"},
	"Inpatient Medication Entry": {"practitioner"},
	"Inpatient Medication Order": {"practitioner"},
	"Inpatient Record": {"primary_practitioner"},
	"Input and Output Chart": {"healthcare_staff"},
	"Medication Request": {"practitioner"},
	"Nutrition Values Chart": {"healthcare_staff"},
	"Observation": {"healthcare_practitioner"},
	"Patient Assessment": {"healthcare_practitioner"},
	"Patient Encounter": {"practitioner"},
	"Patient Feedback": {"healthcare_practitioner"},
	"Patient Follow Up Summary": {"healthcare_staff"},
	"Patient Hospital Courses": {"healthcare_practitioner"},
	"Patient Morbidity Summary": {"healthcare_practitioner"},
	"Patient Mortality Summary": {"healthcare_practitioner"},
	"Patient Timeline": {"healthcare_staff"},
	"Service Request": {"practitioner"},
	"Therapy Session": {"practitioner"},
	"Vital Signs Chart": {"healthcare_staff"},
}

# Keep practitioner field immutable after first save on migrated doctypes.
LOCKED_PRACTITIONER_FIELDS = PRACTITIONER_FIELDS_BY_DOCTYPE


def _current_user_practitioner():
	"""Return current user's Healthcare Practitioner name, if linked."""
	user = frappe.session.user
	if not user or user in ("Guest", "Administrator"):
		return None

	cache_key = "_mwd_current_user_practitioner"
	cached = getattr(frappe.local, cache_key, None)
	if cached is not None:
		return cached or None

	practitioner = frappe.db.get_value("Healthcare Practitioner", {"user_id": user}, "name")
	setattr(frappe.local, cache_key, practitioner or "")
	return practitioner


@frappe.whitelist()
def get_current_user_practitioner():
	"""Return current logged-in user's linked Healthcare Practitioner for desk forms."""
	return {"practitioner": _current_user_practitioner()}


def _enforce_locked_fields(doc):
	"""Keep selected practitioner fields immutable after first save."""
	fieldnames = LOCKED_PRACTITIONER_FIELDS.get(doc.doctype)
	if not fieldnames or doc.is_new():
		return

	for fieldname in fieldnames:
		current_value = doc.get(fieldname)
		if not current_value:
			continue

		original_value = doc.get_db_value(fieldname)
		if original_value and current_value != original_value:
			doc.set(fieldname, original_value)


def _is_practitioner_link_field(doc, fieldname):
	df = doc.meta.get_field(fieldname)
	return bool(df and df.fieldtype == "Link" and df.options == "Healthcare Practitioner")


def autofill_practitioner_fields(doc, method=None):
	"""
	Auto-fill empty practitioner link fields from current logged-in user's practitioner
	for migrated doctypes only.

	Additionally, lock practitioner fields for selected doctypes once filled.
	"""
	if not getattr(doc, "meta", None):
		return

	_enforce_locked_fields(doc)

	fieldnames = PRACTITIONER_FIELDS_BY_DOCTYPE.get(doc.doctype) or set()
	if not fieldnames or not doc.is_new():
		return

	practitioner = _current_user_practitioner()
	if not practitioner:
		return

	for fieldname in fieldnames:
		if not _is_practitioner_link_field(doc, fieldname):
			continue
		current_value = doc.get(fieldname)
		# Keep the auto-linked practitioner authoritative on first save too.
		# This prevents client-side tampering before insert.
		if current_value and current_value != practitioner:
			doc.set(fieldname, practitioner)
			continue
		if not current_value:
			doc.set(fieldname, practitioner)
