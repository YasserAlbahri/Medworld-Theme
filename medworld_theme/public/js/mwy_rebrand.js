(() => {
  const APP_MAP = {
    frappe: "MWY",
    erpnext: "Medworld",
  };

  const fmt = (v) => APP_MAP[v] || v;

  // Common formatter hook
  const applyFormatter = (doctype, field = "app_name") => {
    frappe.listview_settings[doctype] = Object.assign(
      {},
      frappe.listview_settings[doctype] || {},
      {
        formatters: Object.assign(
          {},
          (frappe.listview_settings[doctype] || {}).formatters,
          {
            [field]: fmt,
            application: fmt,
          }
        ),
        onload(listview) {
          listview.formatters = Object.assign({}, listview.formatters, {
            [field]: fmt,
            application: fmt,
          });
          relabelFilter(listview, field);
        },
      }
    );
  };

  const relabelFilter = (listview, fieldname) => {
    const filterField = listview?.page?.fields_dict?.[fieldname];
    if (!filterField) return;
    const relabelSelect = () => {
      const select = filterField.$input && filterField.$input[0];
      if (!select) return;
      Array.from(select.options || []).forEach((opt) => {
        const label = fmt(opt.value);
        if (label) opt.textContent = label;
      });
    };

    // Keep original options, just relabel text
    setTimeout(relabelSelect, 150);

    // Also relabel on focus/open (for dynamic option rendering)
    const selectEl = filterField.$input && filterField.$input[0];
    if (selectEl) {
      selectEl.addEventListener("click", () => setTimeout(relabelSelect, 0));
      // Observe mutations to handle re-render
      const obs = new MutationObserver(() => relabelSelect());
      obs.observe(selectEl, { childList: true, subtree: true });
    }
  };

  applyFormatter("Installed Application", "app_name");
  applyFormatter("Module Def", "app_name");

  // Form view masking
  frappe.ui.form.on("Installed Application", {
    refresh(frm) {
      const field = frm.get_field("app_name");
      if (field?.$input) {
        const label = fmt(frm.doc.app_name);
        if (label) field.$input.val(label);
      }
    },
  });
})();
