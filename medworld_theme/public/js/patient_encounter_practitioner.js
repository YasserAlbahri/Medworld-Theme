let mwdPractitionerPromise;
let mwdLockedPractitioner;

function mwd_get_practitioner_field(frm) {
	const candidates = [
		"practitioner",
		"healthcare_practitioner",
		"healthcare_staff",
		"staff",
		"primary_practitioner",
	];
	return candidates.find((f) => Boolean(frm.fields_dict?.[f]));
}

function mwd_fetch_current_practitioner() {
	if (!mwdPractitionerPromise) {
		mwdPractitionerPromise = frappe
			.call("medworld_theme.practitioner_autofill.get_current_user_practitioner")
			.then((r) => r?.message?.practitioner || null)
			.catch(() => null);
	}
	return mwdPractitionerPromise;
}

async function mwd_set_patient_encounter_practitioner(frm) {
	if (!frm?.is_new?.()) return;

	const fieldname = mwd_get_practitioner_field(frm);
	if (!fieldname) return;

	const practitioner = await mwd_fetch_current_practitioner();
	if (!practitioner) return;
	mwdLockedPractitioner = practitioner;

	// Lock practitioner choice for users linked to a practitioner.
	frm.set_df_property(fieldname, "read_only", 1);

	if (frm.doc[fieldname] !== practitioner) {
		await frm.set_value(fieldname, practitioner);
	}
}

async function mwd_enforce_locked_practitioner(frm) {
	if (!frm?.is_new?.() || !mwdLockedPractitioner) return;
	const fieldname = mwd_get_practitioner_field(frm);
	if (!fieldname) return;
	if (frm.doc[fieldname] !== mwdLockedPractitioner) {
		await frm.set_value(fieldname, mwdLockedPractitioner);
	}
}

frappe.ui.form.on("Patient Encounter", {
	onload_post_render(frm) {
		mwd_set_patient_encounter_practitioner(frm);
	},
	refresh(frm) {
		mwd_set_patient_encounter_practitioner(frm);
	},
	appointment(frm) {
		// Core healthcare JS may clear practitioner when appointment is empty.
		setTimeout(() => mwd_set_patient_encounter_practitioner(frm), 0);
	},
	practitioner(frm) {
		mwd_enforce_locked_practitioner(frm);
	},
});
