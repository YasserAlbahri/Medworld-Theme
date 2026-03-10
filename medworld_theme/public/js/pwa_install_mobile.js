(() => {
  if (window.__mw_pwa_mobile_booted) return;
  window.__mw_pwa_mobile_booted = true;

  const ua = navigator.userAgent || "";
  const BANNER_ID = "mw-pwa-install-banner-global";
  const SPLASH_ID = "mw-pwa-launch-splash";
  const GATE_ID = "mw-pwa-runtime-gate";
  const DISMISS_KEY = "mw_pwa_install_dismiss_until_v3";
  const INSTALLED_KEY = "mw_pwa_install_state_v3";
  const DEVICE_KEY = "mw_pwa_device_id_v1";
  const RELEASE_KEY = "mw_pwa_release_version_v1";
  const LAST_TRACK_KEY = "mw_pwa_last_track_ms_v1";
  const CONTROL_SCRIPT_URL = "https://press.medworldyemen.com/files/mobile/pwa/control.js";
  const CONTROL_ORIGIN = (() => {
    try {
      return new URL(CONTROL_SCRIPT_URL).origin;
    } catch (_) {
      return "https://press.medworldyemen.com";
    }
  })();
  const CONTROL_REFRESH_WINDOW_MS = 5 * 60 * 1000;
  const ROUTE_TRACK_THROTTLE_MS = 15 * 1000;
  const TRACK_ENDPOINT_FALLBACK = `${CONTROL_ORIGIN}/api/method/press.api.mobile_pwa.track_session`;
  const DEFAULT_LOGO_URL = "/assets/medworld_theme/images/logo-xs.png";

  const DEFAULT_CONTROL = {
    enabled: true,
    force_install_prompt: false,
    force_pwa_usage_on_mobile: false,
    force_upgrade: false,
    maintenance_mode: false,
    maintenance_message: "",
    prompt_cooldown_minutes: 1440,
    install_banner_enabled: true,
    track_sessions_enabled: true,
    active_release: {
      version: "1.0.0",
      app_name: "Medworld",
      short_name: "Medworld",
      description: "Secure access to your hospital system.",
      start_url: "/app",
      scope: "/",
      display: "standalone",
      lang: "ar",
      dir: "rtl",
      manifest_url: "/pwa-manifest.json",
      service_worker_url: "/pwa-sw.js",
      icon_192_url: DEFAULT_LOGO_URL,
      icon_512_url: DEFAULT_LOGO_URL,
      theme_color: "#0b2e4f",
      background_color: "#061a2f",
      min_supported_version: "",
    },
    track_url: TRACK_ENDPOINT_FALLBACK,
  };

  let control = JSON.parse(JSON.stringify(DEFAULT_CONTROL));
  let deferredPrompt = null;
  let controlLoadPromise = null;
  let appReady = false;
  let bannerType = null;
  let lastRouteTrackMs = 0;
  let routeHooksBound = false;

  function isDesktopWrapper() {
    return (
      !!window.__TAURI_INTERNALS__ ||
      !!window.__TAURI__ ||
      !!window.__TAURI_IPC__ ||
      !!(window.chrome && window.chrome.webview) ||
      /Electron|Tauri|Medworld Desktop/i.test(ua)
    );
  }

  function isMobileDevice() {
    if (/Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua)) return true;
    return (
      navigator.maxTouchPoints > 1 &&
      window.matchMedia &&
      window.matchMedia("(max-width: 1024px)").matches
    );
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  }

  function isSafariIOS() {
    if (!isIOS()) return false;
    return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  }

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function shouldRun() {
    return isMobileDevice() && !isDesktopWrapper() && !!window.isSecureContext;
  }

  function safeGet(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function safeRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }

  function getCookie(name) {
    const key = `${name}=`;
    const parts = String(document.cookie || "").split(";");
    for (const part of parts) {
      const item = part.trim();
      if (item.startsWith(key)) {
        try {
          return decodeURIComponent(item.slice(key.length));
        } catch (_) {
          return item.slice(key.length);
        }
      }
    }
    return "";
  }

  function getSessionUser() {
    const frappeUser =
      (window.frappe && frappe.session && frappe.session.user) ||
      (window.boot && window.boot.user && window.boot.user.name) ||
      "";
    const cookieUser = getCookie("user_id") || "";
    const user = frappeUser || cookieUser;
    return user && user !== "Guest" ? user : "";
  }

  function boolish(value, fallback = false) {
    if (typeof value === "boolean") return value;
    if (value == null) return fallback;
    const s = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on", "y"].includes(s)) return true;
    if (["0", "false", "no", "off", "n"].includes(s)) return false;
    return fallback;
  }

  function normalizeUrl(pathOrUrl) {
    const raw = (pathOrUrl || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("//")) return `${window.location.protocol}${raw}`;
    if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
    return `${window.location.origin}/${raw}`;
  }

  function addVersionQuery(pathOrUrl, version) {
    const url = normalizeUrl(pathOrUrl);
    if (!url || !version) return url;
    try {
      const u = new URL(url, window.location.origin);
      u.searchParams.set("v", String(version));
      return u.toString();
    } catch (_) {
      return url;
    }
  }

  function getDeviceId() {
    let id = safeGet(DEVICE_KEY, "");
    if (id) return id;
    id = `mwpwa-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    safeSet(DEVICE_KEY, id);
    return id;
  }

  function getDismissUntil() {
    const parsed = Number(safeGet(DISMISS_KEY, "0"));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function dismissFor(minutes) {
    const ms = Math.max(0, Number(minutes || 0)) * 60 * 1000;
    safeSet(DISMISS_KEY, String(Date.now() + ms));
  }

  function removeBanner() {
    document.getElementById(BANNER_ID)?.remove();
    bannerType = null;
  }

  function removeGate() {
    document.getElementById(GATE_ID)?.remove();
  }

  function removeSplash() {
    const splash = document.getElementById(SPLASH_ID);
    if (!splash) return;
    splash.classList.add("is-leaving");
    setTimeout(() => splash.remove(), 300);
  }

  function detectOS() {
    if (/Android/i.test(ua)) return "Android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
    return "Other";
  }

  function detectBrowser() {
    if (/Edg\//i.test(ua)) return "Edge";
    if (/CriOS|Chrome\//i.test(ua)) return "Chrome";
    if (/FxiOS|Firefox\//i.test(ua)) return "Firefox";
    if (/Safari/i.test(ua) && !/Chrome|CriOS|Edg|OPR/i.test(ua)) return "Safari";
    return "Other";
  }

  function track(action, extra = {}) {
    if (!control.track_sessions_enabled) return;
    const now = Date.now();
    if (action === "heartbeat") {
      const last = Number(safeGet(LAST_TRACK_KEY, "0")) || 0;
      if (now - last < 5 * 60 * 1000) return;
      safeSet(LAST_TRACK_KEY, String(now));
    }

    let endpoint = TRACK_ENDPOINT_FALLBACK;
    const configured = normalizeUrl(control.track_url || "");
    if (configured) {
      try {
        const parsed = new URL(configured);
        if (parsed.origin === CONTROL_ORIGIN) {
          endpoint = configured;
        }
      } catch (_) {}
    }
    const params = new URLSearchParams({
      site: window.location.hostname,
      device_id: getDeviceId(),
      session_user: getSessionUser(),
      app_version: control.active_release?.version || "",
      installed: safeGet(INSTALLED_KEY, "0"),
      standalone_mode: isStandalone() ? "1" : "0",
      last_action: action || "",
      os_name: detectOS(),
      browser_name: detectBrowser(),
      source_url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      install_prompt_shown: extra.install_prompt_shown ? "1" : "0",
      _: String(now),
    });

    try {
      fetch(`${endpoint}?${params.toString()}`, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        credentials: "omit",
        keepalive: true,
      }).catch(() => {});
    } catch (_) {}
  }

  function trackRoute(reason = "change") {
    const now = Date.now();
    if (now - lastRouteTrackMs < ROUTE_TRACK_THROTTLE_MS) return;
    lastRouteTrackMs = now;
    track(`route_${reason}`);
  }

  function bindRouteTracking() {
    if (routeHooksBound) return;
    routeHooksBound = true;

    window.addEventListener("hashchange", () => trackRoute("hash"), { passive: true });
    window.addEventListener("popstate", () => trackRoute("popstate"), { passive: true });

    const wrapHistoryMethod = (name, reason) => {
      const original = window.history && window.history[name];
      if (typeof original !== "function") return;
      window.history[name] = function patchedHistoryMethod(...args) {
        const result = original.apply(this, args);
        setTimeout(() => trackRoute(reason), 0);
        return result;
      };
    };

    wrapHistoryMethod("pushState", "pushstate");
    wrapHistoryMethod("replaceState", "replacestate");

    const bindFrappeRouter = () => {
      try {
        if (window.frappe && frappe.router && typeof frappe.router.on === "function") {
          frappe.router.on("change", () => trackRoute("router"));
          return true;
        }
      } catch (_) {}
      return false;
    };

    if (!bindFrappeRouter()) {
      const timer = setInterval(() => {
        if (bindFrappeRouter()) clearInterval(timer);
      }, 1000);
      setTimeout(() => clearInterval(timer), 15000);
    }
  }

  function buildControlScriptUrl(forceNetwork = false) {
    if (forceNetwork) {
      return `${CONTROL_SCRIPT_URL}?v=${Date.now()}`;
    }
    const bucket = Math.floor(Date.now() / CONTROL_REFRESH_WINDOW_MS);
    return `${CONTROL_SCRIPT_URL}?v=${bucket}`;
  }

  function mergeControl(raw) {
    const incoming = raw && typeof raw === "object" ? raw : {};
    const mergedRelease = {
      ...DEFAULT_CONTROL.active_release,
      ...(incoming.active_release || {}),
    };
    return {
      ...DEFAULT_CONTROL,
      ...incoming,
      active_release: mergedRelease,
    };
  }

  function loadRemoteControl(timeoutMs = 2600, forceNetwork = false) {
    if (forceNetwork) {
      try {
        delete window.__MW_PWA_CONTROL;
      } catch (_) {
        window.__MW_PWA_CONTROL = null;
      }
    }

    if (!forceNetwork && window.__MW_PWA_CONTROL && typeof window.__MW_PWA_CONTROL === "object") {
      control = mergeControl(window.__MW_PWA_CONTROL);
      return Promise.resolve(control);
    }
    if (controlLoadPromise) return controlLoadPromise;

    controlLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.src = buildControlScriptUrl(forceNetwork);
      script.dataset.mwPwaControl = "1";

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
          control = mergeControl(window.__MW_PWA_CONTROL);
          resolve(control);
        } else {
          reject(new Error("pwa_control_load_failed"));
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
      .catch(() => {
        control = mergeControl(DEFAULT_CONTROL);
        return control;
      })
      .finally(() => {
        controlLoadPromise = null;
      });

    return controlLoadPromise;
  }

  function ensureManifestTag() {
    const release = control.active_release || {};
    const href = addVersionQuery(release.manifest_url, release.version);
    if (!href) return;

    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== href) {
      link.setAttribute("href", href);
    }
  }

  function ensureMeta(name, content) {
    let tag = document.querySelector(`meta[name="${name}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", name);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content || "");
  }

  function ensureIOSMeta() {
    const release = control.active_release || {};
    ensureMeta("theme-color", release.theme_color || "#0b2e4f");
    ensureMeta("apple-mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
    ensureMeta("apple-mobile-web-app-title", release.short_name || release.app_name || "Medworld");

    let icon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "apple-touch-icon";
      document.head.appendChild(icon);
    }
    icon.href = normalizeUrl(release.icon_192_url || DEFAULT_LOGO_URL);
  }

  async function unregisterServiceWorkers() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch (_) {}
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    const release = control.active_release || {};
    const swUrl = addVersionQuery(release.service_worker_url, release.version);
    if (!swUrl) return null;
    try {
      return await navigator.serviceWorker.register(swUrl, { scope: "/" });
    } catch (error) {
      console.warn("PWA service worker registration failed", error);
      return null;
    }
  }

  function canShowBanner() {
    if (!control.enabled || control.maintenance_mode) return false;
    if (control.force_pwa_usage_on_mobile) return false;
    if (document.getElementById(GATE_ID)) return false;
    if (!control.install_banner_enabled) return false;
    if (isStandalone()) return false;

    const installed = safeGet(INSTALLED_KEY, "0") === "1";
    if (!control.force_install_prompt && installed) return false;
    if (control.force_install_prompt) return true;

    return getDismissUntil() < Date.now();
  }

  function getBannerText(type) {
    if (type === "ios") {
      return {
        title: "تثبيت Medworld على الجوال",
        desc: "من زر المشاركة في Safari اختر إضافة إلى الشاشة الرئيسية.",
        primary: "تم",
        secondary: "لاحقًا",
      };
    }
    if (control.force_install_prompt) {
      return {
        title: "تثبيت التطبيق مطلوب",
        desc: "لضمان أفضل أداء وثبات، يرجى تثبيت Medworld على جهازك.",
        primary: "تثبيت الآن",
        secondary: "تذكير لاحقًا",
      };
    }
    return {
      title: "ثبّت Medworld كتطبيق",
      desc: "تجربة أسرع وثبات أعلى مع فتح مباشر من شاشة الجوال.",
      primary: "تثبيت الآن",
      secondary: "لاحقًا",
    };
  }

  function showBanner(type) {
    if (!canShowBanner()) return;
    if (document.getElementById(GATE_ID)) return;
    if (bannerType === type && document.getElementById(BANNER_ID)) return;

    bannerType = type;
    const strings = getBannerText(type);
    removeBanner();

    const wrap = document.createElement("section");
    wrap.id = BANNER_ID;
    wrap.className = "mw-pwa-install-banner";
    wrap.setAttribute("dir", "rtl");
    wrap.innerHTML = `
      <div class="mw-pwa-install-banner__content">
        <div class="mw-pwa-install-banner__title">${strings.title}</div>
        <div class="mw-pwa-install-banner__desc">${strings.desc}</div>
      </div>
      <div class="mw-pwa-install-banner__actions">
        <button type="button" class="mw-pwa-install-banner__btn mw-pwa-install-banner__btn--primary" data-role="primary">${strings.primary}</button>
        <button type="button" class="mw-pwa-install-banner__btn mw-pwa-install-banner__btn--secondary" data-role="secondary">${strings.secondary}</button>
      </div>
    `;

    wrap.addEventListener("click", async (event) => {
      const btn = event.target.closest("button[data-role]");
      if (!btn) return;
      const role = btn.getAttribute("data-role");

      if (role === "secondary") {
        const cooldown = control.force_install_prompt ? 15 : Math.max(1, Number(control.prompt_cooldown_minutes || 1));
        dismissFor(cooldown);
        removeBanner();
        track("install_prompt_dismiss");
        return;
      }

      if (type === "ios") {
        dismissFor(control.force_install_prompt ? 15 : Math.max(1, Number(control.prompt_cooldown_minutes || 1)));
        removeBanner();
        track("install_hint_ios_ack");
        return;
      }

      if (!deferredPrompt) {
        track("install_prompt_no_native");
        return;
      }

      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === "accepted") {
          safeSet(INSTALLED_KEY, "1");
          safeRemove(DISMISS_KEY);
          removeBanner();
          track("install_prompt_accepted");
        } else {
          dismissFor(control.force_install_prompt ? 15 : Math.max(1, Number(control.prompt_cooldown_minutes || 1)));
          removeBanner();
          track("install_prompt_rejected");
        }
      } catch (_) {
        dismissFor(control.force_install_prompt ? 15 : Math.max(1, Number(control.prompt_cooldown_minutes || 1)));
        removeBanner();
        track("install_prompt_error");
      } finally {
        deferredPrompt = null;
      }
    });

    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("is-visible"));
    track("install_prompt_shown", { install_prompt_shown: true });
  }

  function showGate(mode) {
    removeGate();
    const release = control.active_release || {};
    const title =
      mode === "maintenance"
        ? "توقف مؤقت للخدمة"
        : mode === "upgrade"
          ? "تحديث التطبيق مطلوب"
          : "يرجى استخدام تطبيق Medworld";

    const desc =
      mode === "maintenance"
        ? control.maintenance_message || "الخدمة تحت الصيانة المؤقتة."
        : mode === "upgrade"
          ? "تم إصدار نسخة جديدة. سيتم تحديث التطبيق الآن."
          : "تم فرض استخدام تطبيق الجوال. ثبّت التطبيق وافتحه من الشاشة الرئيسية.";

    const primaryLabel =
      mode === "maintenance" ? "إعادة المحاولة" : isSafariIOS() ? "طريقة التثبيت" : "تثبيت التطبيق";

    const gate = document.createElement("section");
    gate.id = GATE_ID;
    gate.className = "mw-pwa-runtime-gate";
    gate.setAttribute("dir", "rtl");
    gate.innerHTML = `
      <div class="mw-pwa-runtime-gate__card">
        <img src="${normalizeUrl(release.icon_192_url || DEFAULT_LOGO_URL)}" class="mw-pwa-runtime-gate__logo" alt="Medworld" />
        <div class="mw-pwa-runtime-gate__title">${title}</div>
        <div class="mw-pwa-runtime-gate__desc">${desc}</div>
        <div class="mw-pwa-runtime-gate__actions">
          <button type="button" class="mw-pwa-runtime-gate__btn mw-pwa-runtime-gate__btn--primary" data-role="primary">${primaryLabel}</button>
          <button type="button" class="mw-pwa-runtime-gate__btn mw-pwa-runtime-gate__btn--secondary" data-role="retry">تحقق الآن</button>
        </div>
      </div>
    `;

    const setGateDesc = (text) => {
      const descEl = gate.querySelector(".mw-pwa-runtime-gate__desc");
      if (!descEl) return;
      descEl.textContent = text;
    };

    const setBusy = (btn, busy, busyLabel) => {
      if (!btn) return;
      if (busy) {
        btn.dataset.prevLabel = btn.textContent || "";
        btn.disabled = true;
        btn.textContent = busyLabel;
      } else {
        btn.disabled = false;
        if (btn.dataset.prevLabel) btn.textContent = btn.dataset.prevLabel;
      }
    };

    gate.addEventListener("click", async (event) => {
      const btn = event.target.closest("button[data-role]");
      if (!btn) return;
      const role = btn.getAttribute("data-role");

      if (role === "retry") {
        setBusy(btn, true, "جاري التحقق...");
        if (mode === "upgrade") {
          window.location.reload();
          return;
        }
        await refreshRuntimeState(false, { forceNetwork: true });
        setBusy(btn, false);
        if (document.getElementById(GATE_ID)) {
          setGateDesc("تم التحقق. ما زال هذا الوضع مفعلًا حاليًا.");
        }
        return;
      }

      if (mode === "maintenance") {
        setBusy(btn, true, "جاري التحقق...");
        await refreshRuntimeState(false, { forceNetwork: true });
        setBusy(btn, false);
        if (document.getElementById(GATE_ID)) {
          setGateDesc("ما زالت الصيانة مفعلة حاليًا. أعد المحاولة لاحقًا.");
        }
        return;
      }

      if (isSafariIOS()) {
        setGateDesc("في Safari: اضغط زر المشاركة ثم اختر إضافة إلى الشاشة الرئيسية.");
        track("force_gate_ios_hint");
        return;
      }

      setBusy(btn, true, "جاري التنفيذ...");
      if (deferredPrompt) {
        try {
          deferredPrompt.prompt();
          const choice = await deferredPrompt.userChoice;
          if (choice?.outcome === "accepted") {
            safeSet(INSTALLED_KEY, "1");
            track("force_gate_install_accepted");
          } else {
            track("force_gate_install_rejected");
          }
        } catch (_) {
          track("force_gate_install_error");
        } finally {
          deferredPrompt = null;
        }
      } else {
        setGateDesc("استخدم خيار تثبيت التطبيق من قائمة المتصفح، ثم اضغط تحقق الآن.");
        track("force_gate_install_no_native");
      }
      await refreshRuntimeState(false, { forceNetwork: true });
      setBusy(btn, false);
    });

    document.body.appendChild(gate);
  }

  function showStandaloneSplash() {
    if (!isStandalone()) return;
    if (!isMobileDevice()) return;
    if (document.getElementById(SPLASH_ID)) return;

    const release = control.active_release || {};
    const splash = document.createElement("div");
    splash.id = SPLASH_ID;
    splash.className = "mw-pwa-launch-splash";
    splash.setAttribute("dir", "rtl");
    splash.innerHTML = `
      <div class="mw-pwa-launch-splash__glow"></div>
      <div class="mw-pwa-launch-splash__card" role="status" aria-live="polite">
        <img class="mw-pwa-launch-splash__logo" src="${normalizeUrl(release.icon_192_url || DEFAULT_LOGO_URL)}" alt="Medworld" />
        <div class="mw-pwa-launch-splash__name">${release.short_name || release.app_name || "Medworld"}</div>
        <div class="mw-pwa-launch-splash__subtitle">تهيئة النظام ...</div>
        <div class="mw-pwa-launch-splash__bar"></div>
      </div>
    `;

    const startedAt = Date.now();
    const minimumVisibleMs = 600;
    const hide = () => {
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, minimumVisibleMs - elapsed);
      setTimeout(removeSplash, wait);
    };

    document.body.appendChild(splash);
    window.addEventListener("load", hide, { once: true });
    setTimeout(hide, 1200);
    setTimeout(removeSplash, 3000);
  }

  function maybeShowIOSHint() {
    if (!isSafariIOS()) return;
    if (!canShowBanner()) return;
    setTimeout(() => {
      if (!deferredPrompt) showBanner("ios");
    }, 900);
  }

  function setupInstallPromptHandlers() {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredPrompt = event;
      if (control.force_pwa_usage_on_mobile && !isStandalone()) {
        removeBanner();
        showGate("force_usage");
        return;
      }
      if (canShowBanner()) {
        showBanner("native");
      }
    });

    window.addEventListener("appinstalled", () => {
      safeSet(INSTALLED_KEY, "1");
      safeRemove(DISMISS_KEY);
      deferredPrompt = null;
      removeBanner();
      track("app_installed");
      setTimeout(() => refreshRuntimeState(false, { forceNetwork: true }), 300);
    });
  }

  function compareVersions(a, b) {
    const pa = String(a || "").split(".").map((x) => parseInt(x, 10) || 0);
    const pb = String(b || "").split(".").map((x) => parseInt(x, 10) || 0);
    const n = Math.max(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
      const va = pa[i] || 0;
      const vb = pb[i] || 0;
      if (va > vb) return 1;
      if (va < vb) return -1;
    }
    return 0;
  }

  async function applyRuntimeControl(firstBoot = false) {
    const release = control.active_release || {};
    if (!control.enabled || !release.version) {
      removeBanner();
      removeGate();
      removeSplash();
      await unregisterServiceWorkers();
      return;
    }

    ensureManifestTag();
    ensureIOSMeta();
    await registerServiceWorker();

    const currentVersion = String(release.version || "");
    const previousVersion = safeGet(RELEASE_KEY, "");
    safeSet(RELEASE_KEY, currentVersion);

    if (
      control.force_upgrade &&
      previousVersion &&
      currentVersion &&
      compareVersions(previousVersion, currentVersion) < 0
    ) {
      showGate("upgrade");
      setTimeout(() => window.location.reload(), 900);
      track("force_upgrade_reload");
      return;
    }

    if (control.maintenance_mode) {
      showGate("maintenance");
      removeBanner();
      track("maintenance_gate");
      return;
    }

    if (control.force_pwa_usage_on_mobile && !isStandalone()) {
      showGate("force_usage");
      removeBanner();
      track("force_usage_gate");
      return;
    }

    removeGate();

    if (canShowBanner()) {
      if (deferredPrompt) {
        showBanner("native");
      } else {
        maybeShowIOSHint();
      }
    } else {
      removeBanner();
    }

    if (isStandalone()) {
      showStandaloneSplash();
    } else if (!firstBoot) {
      removeSplash();
    }
  }

  async function refreshRuntimeState(firstBoot = false, options = {}) {
    const forceNetwork = !!(options && options.forceNetwork);
    await loadRemoteControl(2600, forceNetwork);
    await applyRuntimeControl(firstBoot);
    if (appReady) {
      track("heartbeat");
    }
  }

  async function boot() {
    if (!shouldRun()) return;
    setupInstallPromptHandlers();
    await refreshRuntimeState(true);
    appReady = true;
    bindRouteTracking();
    track("boot");

    setInterval(() => {
      refreshRuntimeState(false);
    }, 60000);

    document.addEventListener(
      "visibilitychange",
      () => {
        if (!document.hidden) {
          trackRoute("visible");
          refreshRuntimeState(false);
        }
      },
      { passive: true }
    );

    window.addEventListener(
      "focus",
      () => {
        trackRoute("focus");
        refreshRuntimeState(false);
      },
      { passive: true }
    );
    window.addEventListener(
      "pageshow",
      () => {
        trackRoute("pageshow");
        refreshRuntimeState(false);
      },
      { passive: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
