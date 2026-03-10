(() => {
  if (window.__mw_smart_open_desktop_booted) return;
  window.__mw_smart_open_desktop_booted = true;

  const ua = navigator.userAgent || "";
  const DEEP_LINK_SCHEME = "medworld://open";
  const DEFAULT_DOWNLOAD_URL = "https://press.medworldyemen.com/files/desktop/releases/MedworldDesktopSetup.msi";
  const POLICY_SCRIPT_URL = "https://press.medworldyemen.com/files/desktop/policy/site-policy.js";
  const POLICY_REFRESH_WINDOW_MS = 5 * 60 * 1000;
  const DISMISS_KEY = "mw_desktop_prompt_ignored_v4";
  const INSTALLED_HINT_KEY = "mw_desktop_installed_hint_v4";
  const PENDING_INSTALL_KEY = "mw_desktop_pending_install_v4";
  const WRAPPER_SESSION_KEY = "mw_desktop_wrapper_runtime_v1";
  const WRAPPER_QUERY_KEY = "mwd_desktop";
  const FALLBACK_ID = "mw-openapp-fallback";
  const RECHECK_INTERVAL_MS = 5000;
  let promptBusy = false;
  let resolvedDownloadUrl = DEFAULT_DOWNLOAD_URL;
  let policyLoadPromise = null;

  function markWrapperSessionFromQuery() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      if (params.get(WRAPPER_QUERY_KEY) === "1") {
        sessionStorage.setItem(WRAPPER_SESSION_KEY, "1");
        return;
      }
      const mwd = params.get("mwd");
      const redirectTo = params.get("redirect-to");
      const looksLikeDesktopBootstrap =
        !!mwd && /^[0-9]{8,}$/.test(String(mwd)) && (redirectTo === "/app" || redirectTo === "%2Fapp");
      if (looksLikeDesktopBootstrap) {
        sessionStorage.setItem(WRAPPER_SESSION_KEY, "1");
      }
    } catch (_) {}
  }

  function hasWrapperSessionMarker() {
    try {
      return sessionStorage.getItem(WRAPPER_SESSION_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function isMobile() {
    return /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua);
  }

  function isDesktopWrapper() {
    if (hasWrapperSessionMarker()) return true;
    if (window.__TAURI_INTERNALS__ || window.__TAURI__ || window.__TAURI_IPC__) return true;
    if (window.chrome && window.chrome.webview) return true;

    try {
      const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
      if (brands.some((b) => /tauri|electron|medworld/i.test(String(b.brand || "")))) return true;
    } catch (_) {}

    return /Electron|Tauri|Medworld Desktop/i.test(ua);
  }

  function isDesktopBrowser() {
    return !isMobile() && !isDesktopWrapper();
  }

  function shouldRunOnCurrentRoute() {
    const p = window.location.pathname || "/";
    if (p === "/" || p === "/login" || p === "/app" || p.startsWith("/app/")) return true;
    return false;
  }

  function shouldAttempt() {
    if (!isDesktopBrowser()) return false;
    if (!window.isSecureContext) return false;
    if (!shouldRunOnCurrentRoute()) return false;

    const params = new URLSearchParams(window.location.search || "");
    if (params.get("noopenapp") === "1") return false;

    return true;
  }

  function normalizeHost(value) {
    try {
      let host = (value || "").trim().toLowerCase();
      if (!host) return "";
      if (host.includes("://")) host = host.split("://")[1];
      host = host.split("/")[0].split("?")[0].split("#")[0].split(":")[0];
      return host.replace(/\.+$/, "");
    } catch (_) {
      return "";
    }
  }

  function hostMatchesDomain(host, domain) {
    const cleanHost = normalizeHost(host);
    const cleanDomain = normalizeHost(domain).replace(/^\*\./, "");
    if (!cleanHost || !cleanDomain) return false;
    return cleanHost === cleanDomain || cleanHost.endsWith(`.${cleanDomain}`);
  }

  function resolveFromPolicy(policy, siteHost) {
    const host = normalizeHost(siteHost || window.location.hostname);
    const stableUrl = policy?.stable_download_url || DEFAULT_DOWNLOAD_URL;
    const enabled = policy?.enabled !== false;

    if (enabled && host) {
      const siteOverrides = Array.isArray(policy?.site_overrides) ? policy.site_overrides : [];
      for (const row of siteOverrides) {
        if (normalizeHost(row?.site) !== host) continue;
        const url = row?.release?.url;
        if (url) return { source: "site_override", url };
      }

      const domainRules = Array.isArray(policy?.domain_rules) ? policy.domain_rules : [];
      let chosenDomain = null;
      for (const row of domainRules) {
        if (!row?.apply_to_all_sites) continue;
        if (!hostMatchesDomain(host, row?.domain)) continue;
        const url = row?.release?.url;
        if (!url) continue;
        const domain = normalizeHost(row?.domain);
        if (!chosenDomain || domain.length > chosenDomain.domain.length) {
          chosenDomain = { domain, url };
        }
      }
      if (chosenDomain?.url) return { source: "domain_rule", url: chosenDomain.url };

      if (policy?.default_release?.url) {
        return { source: "global_default", url: policy.default_release.url };
      }
    }

    if (policy?.allow_fallback_to_active_stable !== false && policy?.fallback_active_release?.url) {
      return { source: "active_stable_fallback", url: policy.fallback_active_release.url };
    }

    return { source: "stable_download_fallback", url: stableUrl };
  }

  function buildPolicyScriptUrl() {
    const bucket = Math.floor(Date.now() / POLICY_REFRESH_WINDOW_MS);
    return `${POLICY_SCRIPT_URL}?v=${bucket}`;
  }

  function loadRemotePolicy(timeoutMs = 2500) {
    if (window.__MW_DESKTOP_POLICY && typeof window.__MW_DESKTOP_POLICY === "object") {
      return Promise.resolve(window.__MW_DESKTOP_POLICY);
    }
    if (policyLoadPromise) return policyLoadPromise;

    policyLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.src = buildPolicyScriptUrl();
      script.dataset.mwDesktopPolicy = "1";

      let done = false;
      const cleanup = () => {
        script.onload = null;
        script.onerror = null;
        if (script.parentNode) script.parentNode.removeChild(script);
      };
      const finish = (ok) => {
        if (done) return;
        done = true;
        cleanup();
        if (ok) {
          resolve(window.__MW_DESKTOP_POLICY || null);
        } else {
          reject(new Error("policy_load_failed"));
        }
      };

      const timer = setTimeout(() => finish(false), timeoutMs);
      script.onload = () => {
        clearTimeout(timer);
        finish(true);
      };
      script.onerror = () => {
        clearTimeout(timer);
        finish(false);
      };

      document.head.appendChild(script);
    })
      .catch(() => null)
      .finally(() => {
        policyLoadPromise = null;
      });

    return policyLoadPromise;
  }

  async function refreshResolvedDownloadUrl() {
    resolvedDownloadUrl = DEFAULT_DOWNLOAD_URL;
    try {
      const policy = await loadRemotePolicy();
      const resolved = resolveFromPolicy(policy, window.location.hostname);
      if (resolved?.url) {
        resolvedDownloadUrl = resolved.url;
      }
    } catch (_) {}
    return resolvedDownloadUrl;
  }

  function buildDeepLink() {
    const target = `${window.location.pathname || "/"}${window.location.search || ""}${window.location.hash || ""}`;
    const qp = new URLSearchParams({
      origin: window.location.origin,
      target,
    });
    return `${DEEP_LINK_SCHEME}?${qp.toString()}`;
  }

  function removeFallback() {
    document.getElementById(FALLBACK_ID)?.remove();
  }

  function resetPromptState() {
    clearKey(DISMISS_KEY);
    clearKey(INSTALLED_HINT_KEY);
    clearKey(PENDING_INSTALL_KEY);
    removeFallback();
  }

  window.__MWD_RESET_DESKTOP_PROMPT__ = function () {
    resetPromptState();
    attemptSmartPrompt();
  };

  function getBool(key) {
    try {
      const v = localStorage.getItem(key);
      if (v === "1") return true;
      if (v === "0") return false;
      return null;
    } catch (_) {
      return null;
    }
  }

  function setBool(key, value) {
    try {
      localStorage.setItem(key, value ? "1" : "0");
    } catch (_) {}
  }

  function clearKey(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }

  function injectFallbackStyleOnce() {
    if (document.getElementById("mw-openapp-fallback-style")) return;
    const style = document.createElement("style");
    style.id = "mw-openapp-fallback-style";
    style.textContent = `
      .mw-openapp-fallback {
        position: fixed;
        bottom: 14px;
        left: 14px;
        z-index: 10055;
        width: min(94vw, 360px);
        border-radius: 12px;
        border: 1px solid rgba(74, 127, 182, 0.7);
        background: linear-gradient(180deg, #103756, #0b2a44);
        box-shadow: 0 16px 32px rgba(4, 13, 24, 0.36);
        padding: 12px;
        color: #e6f0fc;
        direction: rtl;
      }
      .mw-openapp-fallback__title {
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .mw-openapp-fallback__desc {
        font-size: 12px;
        color: #c7dbf0;
        line-height: 1.45;
      }
      .mw-openapp-fallback__actions {
        margin-top: 10px;
        display: flex;
        gap: 8px;
      }
      .mw-openapp-fallback__note {
        margin-top: 8px;
        font-size: 11px;
        color: #a5c8e8;
      }
      .mw-openapp-fallback__btn {
        min-height: 34px;
        border-radius: 9px;
        border: 0;
        padding: 7px 10px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .mw-openapp-fallback__btn--primary {
        flex: 1;
        color: #fff;
        background: linear-gradient(180deg, #3da3ff, #1d74cf);
      }
      .mw-openapp-fallback__btn--secondary {
        color: #d8eafc;
        border: 1px solid rgba(102, 149, 196, 0.65);
        background: rgba(8, 24, 39, 0.35);
      }
      .mw-openapp-fallback__close {
        position: absolute;
        top: 8px;
        left: 8px;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        border: 0;
        background: transparent;
        color: #d9e8f9;
        font-size: 14px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function openDeepLink(url, userGesture = false) {
    if (userGesture) {
      // Use a real anchor click under user interaction for better browser compatibility.
      const a = document.createElement("a");
      a.href = url;
      a.style.display = "none";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => iframe.remove(), 1200);
  }

  function detectDesktopInstalled(deepLink, timeoutMs = 2200, userGesture = false) {
    return new Promise((resolve) => {
      let hiddenDetected = false;

      const onVisibilityChange = () => {
        if (document.hidden) hiddenDetected = true;
      };
      const onBlur = () => {
        hiddenDetected = true;
      };

      document.addEventListener("visibilitychange", onVisibilityChange, { passive: true });
      window.addEventListener("blur", onBlur, { passive: true });

      openDeepLink(deepLink, userGesture);

      setTimeout(() => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("blur", onBlur);
        resolve(hiddenDetected);
      }, timeoutMs);
    });
  }

  function upsertFallbackRoot() {
    let root = document.getElementById(FALLBACK_ID);
    if (root) return root;

    injectFallbackStyleOnce();

    root = document.createElement("section");
    root.id = FALLBACK_ID;
    root.className = "mw-openapp-fallback";
    document.body.appendChild(root);
    return root;
  }

  function renderFallback(mode, deepLink) {
    const root = upsertFallbackRoot();

    let title = "فتح تطبيق Medworld";
    let desc = "يمكنك فتح التطبيق مباشرة. إذا لم يكن مثبتًا، نزّل آخر إصدار ثم أعد المحاولة.";
    let primaryLabel = "فتح التطبيق";
    let primaryAct = "open";

    if (mode === "checking") {
      title = "جاري التحقق من التطبيق";
      desc = "يتم الآن التحقق من وجود تطبيق Medworld على هذا الجهاز...";
      primaryLabel = "التحقق...";
      primaryAct = "noop";
    }

    const secondaryLabel = mode === "checking" ? "تجاهل" : "تنزيل التطبيق";
    const secondaryAct = mode === "checking" ? "ignore" : "download";

    root.innerHTML = `
      <button type="button" class="mw-openapp-fallback__close" data-act="ignore" aria-label="إغلاق">×</button>
      <div class="mw-openapp-fallback__title">${title}</div>
      <div class="mw-openapp-fallback__desc">${desc}</div>
      <div class="mw-openapp-fallback__actions">
        <button type="button" class="mw-openapp-fallback__btn mw-openapp-fallback__btn--primary" data-act="${primaryAct}" ${primaryAct === "noop" ? "disabled" : ""}>${primaryLabel}</button>
        <button type="button" class="mw-openapp-fallback__btn mw-openapp-fallback__btn--secondary" data-act="${secondaryAct}">${secondaryLabel}</button>
      </div>
      <div class="mw-openapp-fallback__note">
        سيستمر ظهور هذا التنبيه حتى تختار فتح التطبيق أو التنزيل أو التجاهل.
      </div>
    `;

    root.onclick = async (event) => {
      const actionBtn = event.target.closest("button[data-act]");
      if (!actionBtn) return;
      const action = actionBtn.getAttribute("data-act");

      if (action === "ignore") {
        setBool(DISMISS_KEY, true);
        removeFallback();
        return;
      }

      if (action === "download") {
        setBool(PENDING_INSTALL_KEY, true);
        const downloadUrl = (await refreshResolvedDownloadUrl()) || DEFAULT_DOWNLOAD_URL;
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
        renderFallback("unknown", deepLink);
        return;
      }

      if (action === "open") {
        const ok = await detectDesktopInstalled(deepLink, 2200, true);
        if (ok) {
          setBool(INSTALLED_HINT_KEY, true);
          clearKey(PENDING_INSTALL_KEY);
          removeFallback();
        } else {
          // Do not classify as "not installed" on visibility failure:
          // protocol launch may succeed without blurring this tab.
          setBool(INSTALLED_HINT_KEY, false);
          renderFallback("unknown", deepLink);
        }
      }
    };
  }

  async function attemptSmartPrompt() {
    if (promptBusy) return;
    if (!shouldAttempt()) {
      removeFallback();
      return;
    }
    if (getBool(DISMISS_KEY) === true) {
      removeFallback();
      return;
    }
    promptBusy = true;
    try {
      await refreshResolvedDownloadUrl();
      const deepLink = buildDeepLink();
      renderFallback("unknown", deepLink);
    } finally {
      promptBusy = false;
    }
  }

  function boot() {
    if (!document.body) return;
    if (isDesktopWrapper()) {
      removeFallback();
      return;
    }
    refreshResolvedDownloadUrl();
    attemptSmartPrompt();
  }

  function bindDeskResetAction() {
    if (!window.frappe || !window.$) return;
    if (isDesktopWrapper()) return;
    if (window.__mw_desktop_reset_action_bound) return;
    window.__mw_desktop_reset_action_bound = true;

    const btnLabel = __("إعادة إظهار إشعار تطبيق Medworld");
    const groupLabel = __("Medworld");
    const runReset = () => {
      window.__MWD_RESET_DESKTOP_PROMPT__();
      try {
        frappe.show_alert({ message: __("تمت إعادة تفعيل إشعار التطبيق"), indicator: "green" });
      } catch (_) {}
    };

    const ensureUserMenuButton = () => {
      try {
        if (
          $("#toolbar-user .mwd-reset-desktop-prompt, #navbar-user .mwd-reset-desktop-prompt, .dropdown-navbar-user .dropdown-menu .mwd-reset-desktop-prompt")
            .length
        ) {
          return;
        }

        // Frappe variants differ: some use #navbar-user, newer ones use #toolbar-user.
        // Try official API first, then fallback to direct insertion.
        let inserted = false;
        try {
          if (frappe.ui?.toolbar?.add_dropdown_button) {
            const $a = frappe.ui.toolbar.add_dropdown_button(
              "user",
              btnLabel,
              runReset,
              "fa fa-refresh"
            );
            if ($a && $a.length) {
              $a.closest("li").addClass("mwd-reset-desktop-prompt");
              inserted = true;
            }
          }
        } catch (_) {}

        if (!inserted) {
          const $menu = $("#toolbar-user, #navbar-user, .dropdown-navbar-user .dropdown-menu")
            .first();
          if (!$menu.length) return;

          const $btn = $(
            '<button class="btn-reset dropdown-item mwd-reset-desktop-prompt" type="button"></button>'
          );
          $btn.text(btnLabel);
          $btn.on("click", runReset);

          const $divider = $menu.find(".dropdown-divider").first();
          if ($divider.length) {
            $btn.insertBefore($divider);
          } else {
            $menu.append('<div class="dropdown-divider mwd-reset-desktop-prompt"></div>');
            $menu.append($btn);
          }
        }
      } catch (_) {}
    };

    $(document).on("toolbar_setup", ensureUserMenuButton);
    $(document).on("page-change", ensureUserMenuButton);
    $(document).on("click", ".dropdown-navbar-user [data-toggle='dropdown'], .dropdown-navbar-user .nav-link", () => {
      setTimeout(ensureUserMenuButton, 30);
    });
    ensureUserMenuButton();

    if (frappe.ui?.form && typeof frappe.ui.form.on === "function") {
      frappe.ui.form.on("User", {
        refresh(frm) {
          if (!frm || frm.doc.name !== frappe.session.user) return;
          try {
            frm.page.remove_inner_button(btnLabel, groupLabel);
          } catch (_) {}
          frm.add_custom_button(btnLabel, runReset, groupLabel);
        },
      });
    }
  }

  markWrapperSessionFromQuery();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  if (window.frappe) {
    bindDeskResetAction();
  } else {
    window.addEventListener(
      "load",
      () => {
        if (window.frappe) bindDeskResetAction();
      },
      { once: true }
    );
  }

  window.addEventListener("focus", () => attemptSmartPrompt(), { passive: true });
  window.addEventListener("pageshow", () => attemptSmartPrompt(), { passive: true });
  window.addEventListener("hashchange", () => attemptSmartPrompt(), { passive: true });
  window.addEventListener("popstate", () => attemptSmartPrompt(), { passive: true });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) attemptSmartPrompt();
    },
    { passive: true }
  );
  setInterval(() => {
    attemptSmartPrompt();
  }, RECHECK_INTERVAL_MS);
})();
