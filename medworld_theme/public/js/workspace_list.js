frappe.listview_settings.Workspace = {
	onload(listview) {
		ensure_new_button(listview);
	},
	refresh(listview) {
		ensure_new_button(listview);
	},
};

function ensure_new_button(listview) {
	if (!listview || !listview.page) return;

	const label = __("New Workspace");
	// Always (re)attach the primary action with label + handler
	listview.page.set_primary_action(label, () => {
		frappe.new_doc("Workspace");
	});

	const btn = listview.page.btn_primary;
	if (!btn || !btn.length) return;

	// Unhide and enforce label/text so it shows even if theme stripped contents
	btn.removeClass("hide").removeClass("btn-default").addClass("btn-primary");
	btn.attr("data-label", label);

	// If the button has an inner span (hidden-xs), set it; else set text directly
	const span = btn.find("span.hidden-xs");
	if (span && span.length) {
		span.text(label);
	} else {
		btn.text(label);
	}
}
