(() => {
  const getFullName = () => {
    const bootUser = (window.frappe && frappe.boot && frappe.boot.user) || {};
    const session = (window.frappe && frappe.session) || {};
    const cookies = (window.frappe && frappe.get_cookies && frappe.get_cookies()) || {};
    return (
      bootUser.full_name ||
      session.user_fullname ||
      cookies.full_name ||
      session.user ||
      ""
    );
  };

  const getUserType = () => {
    const bootUser = (window.frappe && frappe.boot && frappe.boot.user) || {};
    const session = (window.frappe && frappe.session) || {};
    if (bootUser.user_type) {
      return bootUser.user_type;
    }
    if (session.user === "Administrator") {
      return "Administrator";
    }
    return "User";
  };

  const applyUserInfo = () => {
    const fullName = getFullName();
    const userType = getUserType();
    const userTypeLabel = window.__ ? __(userType) : userType;
    document.querySelectorAll(".user-name").forEach((el) => {
      el.textContent = fullName || "";
    });
    document.querySelectorAll(".user-status").forEach((el) => {
      el.textContent = userTypeLabel || "";
    });
  };

  const isAdministrator = () => {
    const bootUser = (window.frappe && frappe.boot && frappe.boot.user) || {};
    const session = (window.frappe && frappe.session) || {};
    const cookies = (window.frappe && frappe.get_cookies && frappe.get_cookies()) || {};
    const userId = bootUser.name || session.user || cookies.user_id || "";
    return userId === "Administrator";
  };

  const applySearchVisibility = () => {
    if (isAdministrator()) {
      return;
    }
    document
      .querySelectorAll(".dv-nav-search, .dropdown-search, #navbar-search, .navbar-search")
      .forEach((el) => el.remove());
  };

  const applyLogoPath = (logoPath) => {
    if (!logoPath) return;
    const logo = document.querySelector("#medworld-app-logo");
    if (!logo) return;
    let link = logo.querySelector("a");
    if (!link) {
      link = document.createElement("a");
      link.href = "/app";
      logo.appendChild(link);
    }
    let img = link.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      link.appendChild(img);
    }
    img.setAttribute("src", logoPath);
    img.removeAttribute(":src");
    img.removeAttribute("v-if");
  };

  const getThemeLogo = () => {
    if (window.frappe && frappe.theme_settings && frappe.theme_settings.theme_logo) {
      return frappe.theme_settings.theme_logo;
    }
    return "/files/logo with slogan.png";
  };

  const ensureLogo = () => {
    applyLogoPath(getThemeLogo());
    if (window.__mwy_logo_fetching || window.__mwy_logo_loaded) return;
    if (!window.frappe || !frappe.call) return;
    window.__mwy_logo_fetching = true;
    frappe.call({
      method: "medworld_theme.api.get_company_logo",
      callback: (response) => {
        if (response && response.message) {
          applyLogoPath(response.message);
        }
        window.__mwy_logo_loaded = true;
        window.__mwy_logo_fetching = false;
      },
      error: () => {
        window.__mwy_logo_loaded = true;
        window.__mwy_logo_fetching = false;
      },
    });
  };

  const applyNavbar = () => {
    applyUserInfo();
    applySearchVisibility();
    ensureLogo();
    ensureModulesButton();
  };

  const boot = () => {
    applyNavbar();
    bindModulesToggle();
    if (window.$ && $(document).on) {
      $(document).on("page-change", applyNavbar);
      $(document).on("toolbar_setup", applyNavbar);
    }
  };

  const forceShowButton = (btn) => {
    if (!btn) return;
    btn.style.setProperty("display", "inline-flex", "important");
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
  };

  const ensureModulesButton = () => {
    const navLeft = document.querySelector(".dv-navbar .dv-nav-left");
    if (navLeft) {
      let btn = navLeft.querySelector(".btn-open-modules");
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-open-modules";
        btn.innerHTML = '<i class="flaticon-menu"></i>';
        const mobileBtn = navLeft.querySelector(".btn-open-mobile-menu");
        if (mobileBtn && mobileBtn.parentNode === navLeft) {
          navLeft.insertBefore(btn, mobileBtn.nextSibling);
        } else {
          navLeft.insertBefore(btn, navLeft.firstChild);
        }
      }
      forceShowButton(btn);
      return;
    }

    const dvNavbar = document.querySelector(".dv-navbar");
    if (dvNavbar && !dvNavbar.querySelector(".btn-open-modules")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-open-modules";
      btn.innerHTML = '<i class="flaticon-menu"></i>';
      forceShowButton(btn);
      const right = dvNavbar.querySelector(".dv-nav-right");
      if (right && right.parentNode === dvNavbar) {
        dvNavbar.insertBefore(btn, right);
      } else {
        dvNavbar.insertBefore(btn, dvNavbar.firstChild);
      }
      return;
    }

    const defaultNav = document.querySelector(".navbar .navbar-nav");
    if (defaultNav) {
      let btn = document.querySelector(".navbar .btn-open-modules");
      if (!btn) {
        const li = document.createElement("li");
        li.className = "nav-item";
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-open-modules";
        btn.innerHTML = '<i class="flaticon-menu"></i>';
        li.appendChild(btn);
        defaultNav.insertBefore(li, defaultNav.firstChild);
      }
      forceShowButton(btn);
    }
  };

  const bindModulesToggle = () => {
    if (window.__mwy_modules_toggle_bound) return;
    window.__mwy_modules_toggle_bound = true;
    // If jQuery is present, medworld_theme.js binds the toggle. Avoid double-binding.
    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.on) {
      return;
    }
    document.addEventListener("click", (event) => {
      const btn = event.target.closest(".btn-open-modules");
      if (!btn) return;
      event.preventDefault();
      const $menu = window.$ ? window.$(".modules-menu") : null;
      if ($menu && $menu.length) {
        btn.classList.toggle("active");
        btn.querySelector("i")?.classList.toggle("fa-times");
        btn.querySelector("i")?.classList.toggle("flaticon-menu");
        $menu.toggle(300);
        return;
      }
      const menu = document.querySelector(".modules-menu");
      if (!menu) return;
      const active = btn.classList.toggle("active");
      if (active) {
        menu.style.display = "block";
      } else {
        menu.style.display = "none";
      }
    });
  };

  if (window.frappe && frappe.ready) {
    frappe.ready(boot);
  } else {
    document.addEventListener("DOMContentLoaded", boot);
  }
})();
