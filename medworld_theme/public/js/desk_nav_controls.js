(() => {
  const CONTROLS_ID = "mw-desk-nav-controls";
  const LI_ID = "mw-desk-nav-controls-li";

  function canGoBack() {
    if (window.history.length > 1) return true;
    if (window.frappe && Array.isArray(frappe.route_history) && frappe.route_history.length > 1) {
      return true;
    }
    return false;
  }

  function updateBackState() {
    const btn = document.querySelector(`#${CONTROLS_ID} .mw-nav-back`);
    if (!btn) return;
    btn.disabled = !canGoBack();
  }

  function getBackIconClass() {
    const dir = (document.documentElement.getAttribute("dir") || "").toLowerCase();
    return dir === "rtl" ? "fa-arrow-right" : "fa-arrow-left";
  }

  function buildControls() {
    const wrap = document.createElement("div");
    wrap.id = CONTROLS_ID;
    wrap.className = "mw-desk-nav-controls";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Navigation controls");

    const back = document.createElement("button");
    back.type = "button";
    back.className = "mw-nav-btn mw-nav-back";
    back.title = window.__ ? __("Back") : "Back";
    back.setAttribute("aria-label", back.title);
    back.innerHTML = `<i class="fa ${getBackIconClass()}"></i>`;

    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.className = "mw-nav-btn mw-nav-refresh";
    refresh.title = window.__ ? __("Refresh") : "Refresh";
    refresh.setAttribute("aria-label", refresh.title);
    refresh.innerHTML = '<i class="fa fa-rotate-right"></i>';

    wrap.appendChild(back);
    wrap.appendChild(refresh);
    return wrap;
  }

  function mountInDvNavbar() {
    const left = document.querySelector(".dv-navbar .dv-nav-left");
    if (!left) return false;

    if (document.getElementById(CONTROLS_ID)) {
      updateBackState();
      return true;
    }

    const controls = buildControls();
    const modulesBtn = left.querySelector(".btn-open-modules");

    if (modulesBtn && modulesBtn.nextSibling) {
      left.insertBefore(controls, modulesBtn.nextSibling);
    } else if (modulesBtn) {
      left.appendChild(controls);
    } else {
      left.insertBefore(controls, left.firstChild);
    }

    updateBackState();
    return true;
  }

  function mountInDefaultNavbar() {
    const nav = document.querySelector(".navbar .navbar-nav");
    if (!nav) return false;

    if (document.getElementById(CONTROLS_ID)) {
      updateBackState();
      return true;
    }

    const li = document.createElement("li");
    li.id = LI_ID;
    li.className = "nav-item";
    li.appendChild(buildControls());

    const first = nav.querySelector(".nav-item");
    if (first) {
      nav.insertBefore(li, first.nextSibling);
    } else {
      nav.appendChild(li);
    }

    updateBackState();
    return true;
  }

  function ensureMounted() {
    if (mountInDvNavbar()) return;
    mountInDefaultNavbar();
  }

  function handleBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    if (window.frappe && Array.isArray(frappe.route_history) && frappe.route_history.length > 1) {
      const prevRoute = frappe.route_history[frappe.route_history.length - 2];
      if (Array.isArray(prevRoute) && prevRoute.length) {
        frappe.set_route(prevRoute);
      }
    }
  }

  function handleRefresh() {
    window.location.reload();
  }

  function bindGlobalHandlers() {
    if (window.__mw_desk_nav_controls_bound) return;
    window.__mw_desk_nav_controls_bound = true;

    document.addEventListener("click", (event) => {
      const backBtn = event.target.closest(`#${CONTROLS_ID} .mw-nav-back`);
      if (backBtn) {
        event.preventDefault();
        handleBack();
        return;
      }

      const refreshBtn = event.target.closest(`#${CONTROLS_ID} .mw-nav-refresh`);
      if (refreshBtn) {
        event.preventDefault();
        handleRefresh();
      }
    });

    window.addEventListener("popstate", () => {
      setTimeout(updateBackState, 0);
    });

    if (window.$ && $(document).on) {
      $(document).on("toolbar_setup app-loaded page-change", () => {
        setTimeout(() => {
          ensureMounted();
          updateBackState();
        }, 0);
      });
    }
  }

  function boot() {
    bindGlobalHandlers();
    ensureMounted();
    setTimeout(ensureMounted, 400);
    setTimeout(updateBackState, 500);
  }

  if (window.frappe && frappe.ready) {
    frappe.ready(boot);
  } else {
    document.addEventListener("DOMContentLoaded", boot);
  }
})();
