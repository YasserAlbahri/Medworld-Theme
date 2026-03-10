frappe.pages["pagem"].on_page_load = function (wrapper) {
    const container = $(wrapper).find(".layout-main-section");
    if (container && container.length) {
        container.empty().append(`<div class="dv-page-blank"></div>`);
    }
};

frappe.pages["pagem"].on_page_show = function () {
    // page is blank; background handled by theme JS (dv-page-route class)
};








