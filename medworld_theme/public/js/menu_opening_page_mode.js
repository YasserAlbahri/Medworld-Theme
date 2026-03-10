(() => {
  const NON_WORKSPACE_PREFIXES = new Set([
    "doctype",
    "report",
    "query-report",
    "page",
    "list",
    "form",
    "dashboard-view",
    "print",
  ]);

  let workspaceSlugs = null;

  const slugify = (val) => {
    if (!val) return "";
    return val
      .toString()
      .trim()
      .toLowerCase()
      .replace(/^#/, "")
      .replace(/^\/+/, "")
      .replace(/^app\//i, "")
      .replace(/[_\s]+/g, "-")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/--+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const buildWorkspaceSlugs = () => {
    if (workspaceSlugs) return workspaceSlugs;
    workspaceSlugs = new Set();
    const boot = (window.frappe && frappe.boot) || {};
    const pools = [];
    if (Array.isArray(boot.allowed_workspaces)) {
      pools.push(...boot.allowed_workspaces);
    } else if (Array.isArray(boot.workspaces)) {
      pools.push(...boot.workspaces);
    }
    pools.forEach((ws) => {
      const candidates = [];
      if (typeof ws === "string") {
        candidates.push(ws);
      } else if (ws) {
        candidates.push(ws.route, ws.name, ws.title, ws.label, ws.link_to);
      }
      candidates
        .filter(Boolean)
        .forEach((c) => {
          const parts = slugify(c).split("/").filter(Boolean);
          const slug = parts.length ? parts[0] : "";
          if (slug) workspaceSlugs.add(slug);
        });
    });
    return workspaceSlugs;
  };

  const getRouteParts = () => {
    if (window.frappe && frappe.get_route) {
      const route = frappe.get_route();
      if (Array.isArray(route) && route.length) {
        return route.map((p) => (p || "").toString());
      }
    }
    const hash = (window.location.hash || "").replace(/^#/, "").trim();
    const path = (window.location.pathname || "").replace(/^\/+/, "").trim();
    let raw = "";
    if (hash && hash.toLowerCase().startsWith("app/")) {
      raw = hash.slice(4);
    } else if (path && path.toLowerCase().startsWith("app/")) {
      raw = path.slice(4);
    } else {
      raw = hash || path;
    }
    return raw.split("/").filter(Boolean);
  };

  const isPageMode = () => {
    const body = document.body;
    if (!body) return false;
    const raw =
      body.dataset.menuOpeningType ||
      body.getAttribute("data-menu-opening-type") ||
      "";
    return raw.toString().toLowerCase() === "page";
  };

  const isWorkspaceRoute = () => {
    const parts = getRouteParts();
    if (!parts.length) return false;
    const first = (parts[0] || "").toString().toLowerCase();
    if (first === "workspace") return !!parts[1];
    if (NON_WORKSPACE_PREFIXES.has(first)) return false;
    const slugs = buildWorkspaceSlugs();
    if (slugs && slugs.size) {
      return slugs.has(slugify(first));
    }
    return parts.length === 1;
  };

  const ensureStyles = () => {
    if (document.getElementById("mw-menu-opening-page-style")) return;
    const settings = (window.frappe && frappe.theme_settings) || {};
    const pick = (value, fallback) => {
      if (!value || value === "None" || value === "null" || value === "undefined") {
        return fallback;
      }
      return value;
    };
    const lightImage = pick(settings.menu_opening_page_light_image, "/assets/medworld_theme/images/logonight.png");
    const darkImage = pick(settings.menu_opening_page_dark_image, "/files/pagem_dark.png");
    const style = document.createElement("style");
    style.id = "mw-menu-opening-page-style";
    style.type = "text/css";
    style.textContent = `
      .mw-menu-opening-page {
        position: relative;
        overflow: hidden;
        min-height: 100vh;
        background: transparent;
      }
      #mw-menu-opening-landing {
        position: absolute;
        inset: 0;
        background-image: url("${lightImage}");
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        background-color: #f8fafb;
        min-height: 100vh;
        z-index: 0;
        pointer-events: none;
        display: none;
      }
      html[data-theme-mode="dark"] #mw-menu-opening-landing,
      html[data-theme="dark"] #mw-menu-opening-landing,
      body.dv-dark-style #mw-menu-opening-landing {
        background-color: #1b1e23 !important;
        background-image: url("${darkImage}") !important;
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        filter: none;
      }
      body.mw-page-mode-active #mw-menu-opening-landing {
        display: block !important;
      }
      body.mw-page-mode-active .layout-main .layout-main-section,
      body.mw-page-mode-active .layout-main .page-main-content,
      body.mw-page-mode-active .layout-main .page-content,
      body.mw-page-mode-active .layout-main .page-content-wrapper {
        display: none !important;
      }
      body.mw-page-mode-active .layout-main > *:not(#mw-menu-opening-landing):not(.page-head):not(.navbar):not(.dv-navbar) {
        display: none !important;
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);
  };

  const ensureLanding = () => {
    const content = document.querySelector(".dv-app-content");
    if (!content) return;
    const target =
      content.querySelector(".layout-main") || content;
    if (!target) return;
    target.classList.add("mw-menu-opening-page");
    if (document.getElementById("mw-menu-opening-landing")) return;
    const landing = document.createElement("div");
    landing.id = "mw-menu-opening-landing";
    target.prepend(landing);
  };

  const showLanding = () => {
    ensureStyles();
    ensureLanding();
    document.body.classList.add("mw-page-mode-active");
    const footer = document.getElementById("app-footer");
    if (footer) footer.style.display = "none";
  };

  const hideLanding = () => {
    document.body.classList.remove("mw-page-mode-active");
    const footer = document.getElementById("app-footer");
    if (footer) footer.style.display = "";
  };

  const applyPageMode = () => {
    if (!document.body) return;
    if (!isPageMode()) {
      hideLanding();
      return;
    }
    if (isWorkspaceRoute()) {
      showLanding();
    } else {
      hideLanding();
    }
  };

  const boot = () => {
    applyPageMode();
    setTimeout(applyPageMode, 150);
    if (window.$ && $(document).on) {
      $(document).on("page-change", applyPageMode);
    }
    if (window.MutationObserver && document.body) {
      const observer = new MutationObserver(() => applyPageMode());
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-menu-opening-type", "class"],
      });
    }
  };

  if (window.frappe && frappe.ready) {
    frappe.ready(boot);
  } else {
    document.addEventListener("DOMContentLoaded", boot);
  }
})();
