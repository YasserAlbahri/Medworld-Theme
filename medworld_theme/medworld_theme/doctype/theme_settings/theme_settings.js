// Copyright (c) 2021, Yasser Albahri and contributors
// For license information, please see license.txt

frappe.ui.form.on('Theme Settings', {
    refresh: function (frm) {
        // أخفِ اختيار الخط عن الواجهة لكن اترك القيمة كما هي
        frm.toggle_display('font_family', false);
    },
    after_save: function (frm) {
        setTimeout(() => frappe.ui.toolbar.clear_cache(), 500);
    }
});
