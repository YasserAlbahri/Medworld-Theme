let mwdPractitionerPromise;

const MWD_DOCTYPE_PRACTITIONER_FIELD = {
	"Advice And Plan Of Patient": "healthcare_practitioner",
	"Clinical Procedure": "practitioner",
	"Examination": "practitioner",
	"Examination Summary": "practitioner",
	"Follow Up": "healthcare_practitioner",
	"History": "practitioner",
	"History Summary": "practitioner",
	"Inpatient Medication Entry": "practitioner",
	"Inpatient Medication Order": "practitioner",
	"Inpatient Record": "primary_practitioner",
	"Input and Output Chart": "healthcare_staff",
	"Medication Request": "practitioner",
	"Nutrition Values Chart": "healthcare_staff",
	"Observation": "healthcare_practitioner",
	"Patient Assessment": "healthcare_practitioner",
	"Patient Feedback": "healthcare_practitioner",
	"Patient Follow Up Summary": "healthcare_staff",
	"Patient Hospital Courses": "healthcare_practitioner",
	"Patient Morbidity Summary": "healthcare_practitioner",
	"Patient Mortality Summary": "healthcare_practitioner",
	"Patient Timeline": "healthcare_staff",
	"Service Request": "practitioner",
	"Therapy Session": "practitioner",
	"Vital Signs Chart": "healthcare_staff",
};

function mwd_fetch_current_practitioner() {
	if (!mwdPractitionerPromise) {
		mwdPractitionerPromise = frappe
			.call("medworld_theme.practitioner_autofill.get_current_user_practitioner")
			.then((r) => r?.message?.practitioner || null)
			.catch(() => null);
	}
	return mwdPractitionerPromise;
}

async function mwd_autofill_practitioner(frm) {
	if (!frm?.is_new?.()) return;
	const fieldname = MWD_DOCTYPE_PRACTITIONER_FIELD[frm.doctype];
	if (!fieldname || !frm.fields_dict?.[fieldname]) return;

	const practitioner = await mwd_fetch_current_practitioner();
	if (!practitioner) return;

	frm.__mwd_locked_practitioner = practitioner;
	frm.set_df_property(fieldname, "read_only", 1);

	if (frm.doc[fieldname] !== practitioner) {
		await frm.set_value(fieldname, practitioner);
	}
}

async function mwd_enforce_practitioner_lock(frm) {
	if (!frm?.is_new?.()) return;
	const fieldname = MWD_DOCTYPE_PRACTITIONER_FIELD[frm.doctype];
	if (!fieldname || !frm.fields_dict?.[fieldname]) return;
	const practitioner = frm.__mwd_locked_practitioner;
	if (!practitioner) return;

	if (frm.doc[fieldname] !== practitioner) {
		await frm.set_value(fieldname, practitioner);
	}
}

for (const [doctype, fieldname] of Object.entries(MWD_DOCTYPE_PRACTITIONER_FIELD)) {
	const handlers = {
		onload_post_render(frm) {
			mwd_autofill_practitioner(frm);
		},
		refresh(frm) {
			mwd_autofill_practitioner(frm);
		},
	};

	handlers[fieldname] = function (frm) {
		mwd_enforce_practitioner_lock(frm);
	};

	frappe.ui.form.on(doctype, handlers);
}
