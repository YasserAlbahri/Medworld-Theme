frappe.pages['pagem'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Page M',
		single_column: true
	});
}