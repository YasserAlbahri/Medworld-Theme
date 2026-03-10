/*
* Medworld Custom Scripts
*/

(function ($) {
    'use strict';

    // طھط®ظ…ظٹظ† ظ…ط¨ظƒط± ظ„ظ…ط³ط§ط± ظˆظˆط±ظƒط³ط¨ظٹط³ ظ…ظ† ط§ظ„ظ€ URL (ظ‚ط¨ظ„ طھظˆط§ظپط± frappe)
    function url_looks_like_workspace() {
        try {
            const pickRoute = () => {
                const hash = (window.location.hash || '').replace(/^#/, '').trim();
                const path = (window.location.pathname || '').replace(/^\/+/, '').trim();
                if (hash && hash.toLowerCase().startsWith('app/')) return hash.slice(4);
                if (path && path.toLowerCase().startsWith('app/')) return path.slice(4);
                return '';
            };
            const route = pickRoute();
            if (!route) return false;

            // Explicit workspace route always treated as workspace.
            if (/^workspace\//i.test(route)) {
                const rest = route.replace(/^workspace\//i, '').replace(/\/pagem\/?$/i, '').trim();
                return !!rest;
            }

            const clean = route.replace(/\/pagem\/?$/i, '').trim();
            if (!clean) return false;
            const parts = clean.split('/').filter(Boolean);
            if (parts.length !== 1) return false;

            const first = (parts[0] || '').toString().toLowerCase();
            const nonWorkspacePrefixes = new Set([
                'doctype', 'report', 'query-report', 'page', 'list', 'form', 'dashboard-view', 'print'
            ]);
            if (nonWorkspacePrefixes.has(first)) return false;
            if (first === 'home') return true;

            // Only treat one-segment URLs as workspace if they match known workspace slugs from boot.
            const boot = (window.frappe && frappe.boot) || {};
            const pools = (Array.isArray(boot.allowed_workspaces) && boot.allowed_workspaces.length)
                ? boot.allowed_workspaces
                : (Array.isArray(boot.workspaces) ? boot.workspaces : []);
            if (!pools.length) return false;

            const toSlug = (val) => (val || '').toString().trim().toLowerCase()
                .replace(/^#/, '')
                .replace(/^\/+/, '')
                .replace(/^app\//i, '')
                .replace(/[_\s]+/g, '-')
                .replace(/[^a-z0-9-]+/g, '-')
                .replace(/--+/g, '-')
                .replace(/^-+|-+$/g, '');

            const known = new Set();
            pools.forEach((ws) => {
                const candidates = [];
                if (typeof ws === 'string') {
                    candidates.push(ws);
                } else if (ws) {
                    candidates.push(ws.route, ws.name, ws.title, ws.label, ws.link_to);
                }
                candidates.filter(Boolean).forEach((c) => {
                    const slug = toSlug((c || '').toString().split('/')[0] || '');
                    if (slug) known.add(slug);
                });
            });

            return known.has(toSlug(first));
        } catch (e) {
            return false;
        }
    }

    // ط­ط§ط±ط³ ظپظˆط±ظٹ: ط¥ط®ظپط§ط، ظ…ط­طھظˆظ‰ layout-main ظپظٹ ظˆط¶ط¹ Page ط­طھظ‰ ظٹظ‚ط±ط± JS ط¥ط¸ظ‡ط§ط±ظ‡
    (function dvInstallPageGuard() {
        try {
            const head = document.head || document.documentElement;
            if (!head) return;
            if (!document.getElementById('dv-page-guard-style')) {
                const style = document.createElement('style');
                style.id = 'dv-page-guard-style';
                style.type = 'text/css';
                style.textContent = `
                    body[data-menu-opening-type="page"]:not(.dv-allow-main) .layout-main > *:not(#dv-menu-opening-landing) {
                        visibility: hidden !important;
                    }
                `;
                head.appendChild(style);
            }
            const looksWorkspace = url_looks_like_workspace();
            const body = document.body;
            if (looksWorkspace) {
                document.documentElement.classList.add('dv-prehide-workspace', 'dv-pagem-auto-hide');
                if (body) {
                    body.classList.add('dv-prehide-workspace', 'dv-pagem-auto-hide');
                }
            }
            const ensurePageFlag = (attempt = 0) => {
                const b = document.body;
                const isPage = b && (b.dataset.menuOpeningType || '').toLowerCase() === 'page';
                if (isPage && looksWorkspace) {
                    document.documentElement.classList.add('dv-prehide-workspace', 'dv-pagem-auto-hide');
                    b.classList.add('dv-prehide-workspace', 'dv-pagem-auto-hide');
                } else if (!isPage && b) {
                    document.documentElement.classList.add('dv-allow-main');
                    b.classList.add('dv-allow-main');
                } else if (attempt < 10) {
                    setTimeout(() => ensurePageFlag(attempt + 1), 20);
                }
            };
            ensurePageFlag();
        } catch (e) {
            /* ignore */
        }
})();

// Hide global search for non-Administrator users
const run_after_ready = (cb) => {
	try {
		if (window.frappe && typeof frappe.ready === "function") {
			frappe.ready(cb);
			return;
		}
	} catch (e) {
		/* ignore */
	}
	if (window.$) {
		$(cb);
	} else {
		document.addEventListener("DOMContentLoaded", cb);
	}
};

run_after_ready(() => {
	const isAdministrator = () => {
		const bootUser = (window.frappe && frappe.boot && frappe.boot.user) || {};
		const session = (window.frappe && frappe.session) || {};
		const cookies = (window.frappe && frappe.get_cookies && frappe.get_cookies()) || {};
		const userId = bootUser.name || session.user || cookies.user_id || "";
		return userId === "Administrator";
	};

	const hideSearch = () => {
		if (isAdministrator()) {
			return;
		}
		// Remove search form and button entirely
		$(".dv-nav-search, .dropdown-search").remove();
		$("#navbar-search, .navbar-search").remove();
	};

	// Hide search for everyone except Administrator
	hideSearch();
	$(document).on("page-change", hideSearch);

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

	ensureModulesButton();
	$(document).on("page-change toolbar_setup", () => setTimeout(ensureModulesButton, 150));

	const setPageBackgroundByTheme = () => {
		const body = document.body;
		if (!body) return;
		const getMenuOpeningPageImages = () => {
			const settings = (window.frappe && frappe.theme_settings) || {};
			const pick = (value, fallback) => {
				if (!value || value === "None" || value === "null" || value === "undefined") {
					return fallback;
				}
				return value;
			};
			const light = pick(settings.menu_opening_page_light_image, "/assets/medworld_theme/images/logonight.png");
			const dark = pick(settings.menu_opening_page_dark_image, "/files/pagem_dark.png");
			return { light, dark };
		};
		const themeMode =
			(body.dataset.menuOpeningType || "").toLowerCase() === "page"
				? (body.dataset.themeMode || body.dataset.theme || "").toLowerCase()
				: "";
		if (!themeMode) return;
		const landing = document.getElementById("dv-menu-opening-landing");
		if (!landing) return;
		const isDark =
			themeMode.includes("dark") ||
			document.documentElement.classList.contains("dv-dark-style") ||
			body.classList.contains("dv-dark-style");
		const { light, dark } = getMenuOpeningPageImages();
		const url = isDark ? dark : light;
		landing.style.backgroundImage = `url("${url}")`;
	};

	setPageBackgroundByTheme();
	$(document).on("page-change toolbar_setup", () => setTimeout(setPageBackgroundByTheme, 200));

	// Keep internal Desk notifications, but remove update-related UI and external feeds.
	const disable_update_prompts_ui = () => {
		// Remove "What's New" tab + panel from the notifications dropdown.
		try {
			$("#changelog_feed").remove();
			$(".panel-changelog-feed").remove();
		} catch (e) {
			// ignore
		}

		// Remove update popups triggered via realtime event.
		// In socket.io, `off(event)` removes all listeners for the event.
		try {
			if (window.frappe && frappe.realtime && frappe.realtime.off) {
				frappe.realtime.off("version-update");
			}
		} catch (e) {
			// ignore
		}
	};

	disable_update_prompts_ui();
	setTimeout(disable_update_prompts_ui, 800);
	$(document).on("toolbar_setup app_ready page-change", () => setTimeout(disable_update_prompts_ui, 200));

	// Post-auth "hard reload" (best-effort) after:
	// - coming from /login
	// - switching auth context (impersonate / stop impersonate)
	//
	// Browsers don't allow forcing a true Ctrl+Shift+R, but we can:
	// - clear Frappe's localStorage caches
	// - reload the Desk once per auth context transition
	//
	// This is bounded (no loops) and keeps the UX stable in large deployments.
	const reload_once_after_auth_transition = () => {
		try {
			if (!window.frappe || !frappe.session || frappe.session.user === "Guest") return;

			const ctx = JSON.stringify({
				user: frappe.session.user,
				impersonated_by: (frappe.boot && frappe.boot.user && frappe.boot.user.impersonated_by) || null,
			});

			const prev_ctx = sessionStorage.getItem("__dv_auth_ctx");
			sessionStorage.setItem("__dv_auth_ctx", ctx);

			const ref = (document.referrer || "").toLowerCase();
			const from_login = ref.includes("/login");
			const ctx_changed = !!prev_ctx && prev_ctx !== ctx;

			// Only reload when we are sure this is an auth transition.
			if (!from_login && !ctx_changed) return;

			// Reload at most once per ctx to avoid loops.
			const reload_done_for = sessionStorage.getItem("__dv_post_auth_reload_done_for");
			if (reload_done_for === ctx) return;
			sessionStorage.setItem("__dv_post_auth_reload_done_for", ctx);

			try {
				frappe.assets && frappe.assets.clear_local_storage && frappe.assets.clear_local_storage();
			} catch (e) {
				// ignore
			}

			// Reload once. This is the closest safe equivalent to the built-in "Reload" action.
			window.location.reload();
		} catch (e) {
			// ignore
		}
	};
	setTimeout(reload_once_after_auth_transition, 50);

	// Fix user info placeholders in navbar
	const setUserInfo = () => {
		const full_name =
			(frappe.boot && frappe.boot.user && frappe.boot.user.full_name) ||
			frappe.session.user_fullname ||
			frappe.session.user;
		const user_type =
			(frappe.boot && frappe.boot.user && frappe.boot.user.user_type) || "";

		document.querySelectorAll(".user-name").forEach((el) => {
			el.textContent = full_name || "";
		});
		document.querySelectorAll(".user-status").forEach((el) => {
			el.textContent = user_type || "";
		});
	};
	setUserInfo();
	$(document).on("page-change", setUserInfo);
});

    function sidebar_niceScroll() {
        if (!$.fn.niceScroll) {
            return;
        }
        const scrollSelector = '.side-menu .side-menu-icons > ul, .side-menu .side-menu-items > ul.dropdown-list, .side-menu .side-menu-items > ul.shortcuts-list';
        $(scrollSelector).niceScroll({
            cursorcolor: "rgba(0,0,0,0.35)",
            cursorborder: "0px",
            cursorwidth: "3px",
        });
    }

    // ط§ط­طھظپط¸ ط¨ط£ظٹ ط®طµط§ط¦طµ ظ…ظˆط¬ظˆط¯ط© ظ…ط³ط¨ظ‚ط§ظ‹ ظ…ظ† Frappe ط¨ط¯ظ„ط§ظ‹ ظ…ظ† ظ…ط³ط­ظ‡ط§
    frappe.auth = frappe.auth || {};

    // طھط±ط¬ظ…ط© ط¹ظ†ط§ظˆظٹظ† ط§ظ„ط³ط§ظٹط¯ط¨ط§ط± ظˆط§ظ„ظ‚ط§ط¦ظ…ط© ط§ظ„ظ…ظ†ط¨ط«ظ‚ط©
    function translate_menu_labels(allow_retry) {
        // ط­ظپط¸ ط§ظ„ظ†طµظˆطµ ط§ظ„ظ…طھط±ط¬ظ…ط© ظ„طھط¬ظ†ط¨ ط¥ط¹ط§ط¯ط© ط§ظ„طھط±ط¬ظ…ط© ط§ظ„ظ…ط³طھظ…ط±ط©
        if (!window.__translated_texts) {
            window.__translated_texts = new Map();
        }
        if (!window.__server_translations) {
            window.__server_translations = {};
        }
        // Reverse translations cache (Arabic -> English) for cases where some workspace/card labels
        // were saved in Arabic and must be shown in English when lang=en.
        if (!window.__server_reverse_translations) {
            window.__server_reverse_translations = {};
        }

        // Detect current language early.
        // If English: restore any Arabic menu/sidebar labels back to English (best-effort).
        try {
            const currentLang =
                ((window.frappe && frappe.boot && frappe.boot.lang) || (window.frappe && frappe.lang) || "en")
                    .toString()
                    .toLowerCase();

            if (currentLang.startsWith("en")) {
                if (!window.__reverse_translation_fetch_state) {
                    window.__reverse_translation_fetch_state = {
                        in_flight: false,
                        fetched: false,
                        failed: false,
                        lang: "ar",
                    };
                }

                const stripPrefix = (txt) => {
                    const raw = (txt || "").toString();
                    const m = raw.match(/^(\s*[-–—•]+\\s*)/);
                    const prefix = m ? m[1] : "";
                    const body = raw.replace(/^(\s*[-–—•]+\\s*)/, "").trim();
                    return { prefix, body };
                };

                const selectors_en = [
                    ".modules-menu .modules-menu-list a",
                    ".side-menu-icons.menu-icons-with-label > ul > li > a > span",
                    ".side-menu .side-menu-items > ul.dropdown-list > li > a > span",
                    ".side-mobile-menu ul.mobile-modules-menu-list > li > a > span",
                    ".side-mobile-menu ul.mobile-modules-list > li > a",
                    "ul.mobile-modules-list > li > a",
                ];

                const missing_reverse = new Set();

                const set_text_with_title = ($el, val) => {
                    if (!val) return;
                    $el.text(val);
                    const $a = $el.closest("a");
                    if ($a.length) $a.attr("title", val);
                };

                selectors_en.forEach((sel) => {
                    $(sel).each(function () {
                        const $el = $(this);
                        const currentText = ($el.text() || "").toString().trim();
                        if (!currentText) return;

                        const parts = stripPrefix(currentText);
                        const body = parts.body;
                        if (!body) return;
                        if (!/[\u0600-\u06FF]/.test(body)) return;

                        const dataLabel = ($el.data("label") || $el.attr("data-label") || "")
                            .toString()
                            .trim();
                        if (dataLabel && !/[\u0600-\u06FF]/.test(dataLabel)) {
                            set_text_with_title($el, parts.prefix + dataLabel);
                            return;
                        }

                        const fromReverse = window.__server_reverse_translations[body];
                        if (fromReverse && fromReverse !== body) {
                            set_text_with_title($el, parts.prefix + fromReverse);
                            return;
                        }

                        missing_reverse.add(body);
                    });
                });

                // Restore the active module header in the sidebar (preserve icon markup).
                $(".navigation-divider-module-name").each(function () {
                    const $el = $(this);
                    const el = $el.get(0);
                    if (!el) return;
                    const currentLabel = $el.clone().children().remove().end().text().toString().trim();
                    if (!currentLabel) return;

                    const parts = stripPrefix(currentLabel);
                    const body = parts.body;
                    if (!body) return;
                    if (!/[\u0600-\u06FF]/.test(body)) return;

                    const set_tail_text = (value) => {
                        try {
                            Array.from(el.childNodes || []).forEach((n) => {
                                if (n && n.nodeType === Node.TEXT_NODE) el.removeChild(n);
                            });
                            el.appendChild(document.createTextNode(" " + (parts.prefix + value)));
                        } catch (e) {
                            $el.text(parts.prefix + value);
                        }
                    };

                    const fromReverse = window.__server_reverse_translations[body];
                    if (fromReverse && fromReverse !== body) {
                        set_tail_text(fromReverse);
                        $el.attr("title", fromReverse);
                        return;
                    }

                    missing_reverse.add(body);
                });

                if (
                    missing_reverse.size &&
                    !window.__reverse_translation_fetch_state.in_flight &&
                    !window.__reverse_translation_fetch_state.failed
                ) {
                    window.__reverse_translation_fetch_state.in_flight = true;
                    frappe.call({
                        method: "medworld_theme.api.get_reverse_label_translations",
                        args: {
                            labels: Array.from(missing_reverse),
                            lang: "ar",
                        },
                        callback: (r) => {
                            window.__reverse_translation_fetch_state.in_flight = false;
                            window.__reverse_translation_fetch_state.fetched = true;
                            if (r && r.message) {
                                Object.assign(window.__server_reverse_translations, r.message);
                                setTimeout(() => translate_menu_labels(false), 80);
                            }
                        },
                        error: () => {
                            window.__reverse_translation_fetch_state.in_flight = false;
                            window.__reverse_translation_fetch_state.failed = true;
                        },
                    });
                }

                return;
            }
        } catch (e) {
            // ignore
        }
        // ط­ط§ظ„ط© ط¬ظ„ط¨ ط§ظ„طھط±ط¬ظ…ط§طھ ظ…ظ† ط§ظ„ط³ظٹط±ظپط± (ظ„ظ…ظ†ط¹ ط§ظ„طھظƒط±ط§ط±)
        if (!window.__translation_fetch_state) {
            window.__translation_fetch_state = {
                in_flight: false,
                fetched: false,
                failed: false,
                lang: null,
            };
        }
        
        const selectors = [
            '.modules-menu .modules-menu-list a',
            '.side-menu-icons.menu-icons-with-label > ul > li > a > span',
            '.side-menu .side-menu-items > ul.dropdown-list > li > a > span',
            '.side-mobile-menu ul.mobile-modules-menu-list > li > a > span',
            '.side-mobile-menu ul.mobile-modules-list > li > a',
            'ul.mobile-modules-list > li > a'
        ];

        let translated = 0;
        const missing_for_server = new Set();
        selectors.forEach(sel => {
            $(sel).each(function () {
                const $el = $(this);
                let baseText = ($el.data('label') || $el.text() || '').toString().trim();
                if (!baseText) return;
                
                // طھط®ط·ظٹ ط¥ط°ط§ ظƒط§ظ† ط§ظ„ظ†طµ ط¨ط§ظ„ظپط¹ظ„ ط¨ط§ظ„ط¹ط±ط¨ظٹط©
                if (/[\u0600-\u06FF]/.test(baseText)) return;
                
                // ط¥ظ†ط´ط§ط، ظ…ط¹ط±ظپ ظپط±ظٹط¯ ظ„ظ„ط¹ظ†طµط±
                const elementId = $el.attr('data-label') || $el.attr('data-route') || baseText;
                const currentText = $el.text().trim();
                
                // ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ط£ظ† ط§ظ„ظ†طµ ظ„ظ… ظٹطھظ… طھط±ط¬ظ…طھظ‡ ط¨ط§ظ„ظپط¹ظ„
                if (window.__translated_texts.has(elementId)) {
                    const savedTranslation = window.__translated_texts.get(elementId);
                    // ط¥ط°ط§ ظƒط§ظ† ط§ظ„ظ†طµ ط§ظ„ط­ط§ظ„ظٹ ظ‡ظˆ ط§ظ„طھط±ط¬ظ…ط© ط§ظ„ظ…ط­ظپظˆط¸ط©طŒ ظ„ط§ ط­ط§ط¬ط© ظ„ط¥ط¹ط§ط¯ط© ط§ظ„طھط±ط¬ظ…ط©
                    if (currentText === savedTranslation) {
                        return;
                    }
                    // ط¥ط°ط§ ظƒط§ظ† ط§ظ„ظ†طµ ط§ظ„ط­ط§ظ„ظٹ ظ‡ظˆ ط§ظ„ظ†طµ ط§ظ„ط¥ظ†ط¬ظ„ظٹط²ظٹ ط§ظ„ط£طµظ„ظٹطŒ ط£ط¹ط¯ ط§ظ„طھط±ط¬ظ…ط©
                    if (currentText === baseText && savedTranslation) {
                        $el.text(savedTranslation);
                        const $a = $el.closest('a');
                        if ($a.length) {
                            $a.attr('title', savedTranslation);
                        }
                        translated += 1;
                        return;
                    }
                }

                const localized = __(baseText);
                if (localized && localized.length && localized !== baseText) {
                    $el.text(localized);
                    window.__translated_texts.set(elementId, localized);
                    const $a = $el.closest('a');
                    if ($a.length) {
                        $a.attr('title', localized);
                    }
                    translated += 1;
                    return;
                }

                // ظ…ط­ط§ظˆظ„ط© ظ…ظ† ط§ظ„ظ…ط®ط²ظ† ط§ظ„ظ‚ط§ط¯ظ… ظ…ظ† ط§ظ„ط³ظٹط±ظپط±
                const fromServer = window.__server_translations[baseText];
                if (fromServer && fromServer !== baseText) {
                    $el.text(fromServer);
                    window.__translated_texts.set(elementId, fromServer);
                    const $a = $el.closest('a');
                    if ($a.length) {
                        $a.attr('title', fromServer);
                    }
                    translated += 1;
                    return;
                }

                missing_for_server.add(baseText);
            });
        });

        // Translate the active workspace/module header in the sidebar without destroying the icon markup.
        // Example DOM:
        // <div class="navigation-divider-module-name">
        //   <span class="sub-menu-icon"><i ...></i></span> Receivables
        // </div>
        $('.navigation-divider-module-name').each(function () {
            const $el = $(this);
            const el = $el.get(0);
            if (!el) return;

            // Extract the visible label (ignore nested elements like the icon span).
            const baseText = $el.clone().children().remove().end().text().toString().trim();
            if (!baseText) return;
            if (/[\u0600-\u06FF]/.test(baseText)) return; // already Arabic

            const elementId = `nav-divider:${baseText}`;

            const set_tail_text = (value) => {
                // remove existing text nodes only, keep children (icon)
                try {
                    Array.from(el.childNodes || []).forEach((n) => {
                        if (n && n.nodeType === Node.TEXT_NODE) el.removeChild(n);
                    });
                    el.appendChild(document.createTextNode(" " + value));
                } catch (e) {
                    // fallback (may drop icon, but should be rare)
                    $el.text(value);
                }
            };

            // If we translated it before, re-apply if needed.
            if (window.__translated_texts && window.__translated_texts.has(elementId)) {
                const saved = window.__translated_texts.get(elementId);
                const currentText = $el.clone().children().remove().end().text().toString().trim();
                if (saved && currentText === baseText) {
                    set_tail_text(saved);
                    $el.attr('title', saved);
                    translated += 1;
                }
                return;
            }

            const localized = __(baseText);
            if (localized && localized.length && localized !== baseText) {
                set_tail_text(localized);
                window.__translated_texts.set(elementId, localized);
                $el.attr('title', localized);
                translated += 1;
                return;
            }

            const fromServer = window.__server_translations[baseText];
            if (fromServer && fromServer !== baseText) {
                set_tail_text(fromServer);
                window.__translated_texts.set(elementId, fromServer);
                $el.attr('title', fromServer);
                translated += 1;
                return;
            }

            missing_for_server.add(baseText);
        });

        // ظ…ط¹ط§ظ„ط¬ط© ط®ط§طµط© ظ„ط¹ظ†ط§طµط± mobile-modules-list ط§ظ„طھظٹ ظ‚ط¯ ظ„ط§ طھط­طھظˆظٹ ط¹ظ„ظ‰ span
        $('ul.mobile-modules-list > li > a').each(function() {
            const $el = $(this);
            let baseText = ($el.data('label') || $el.text() || '').toString().trim();
            if (!baseText) return;
            // طھط®ط·ظٹ ط¥ط°ط§ ظƒط§ظ† ط§ظ„ظ†طµ ط¨ط§ظ„ظپط¹ظ„ ط¨ط§ظ„ط¹ط±ط¨ظٹط© (ظٹط­طھظˆظٹ ط¹ظ„ظ‰ ط£ط­ط±ظپ ط¹ط±ط¨ظٹط©)
            if (/[\u0600-\u06FF]/.test(baseText)) return;
            
            // ط¥ظ†ط´ط§ط، ظ…ط¹ط±ظپ ظپط±ظٹط¯ ظ„ظ„ط¹ظ†طµط±
            const elementId = $el.attr('data-label') || $el.attr('data-route') || baseText;
            const currentText = $el.text().trim();
            
            // ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ط£ظ† ط§ظ„ظ†طµ ظ„ظ… ظٹطھظ… طھط±ط¬ظ…طھظ‡ ط¨ط§ظ„ظپط¹ظ„
            if (window.__translated_texts.has(elementId)) {
                const savedTranslation = window.__translated_texts.get(elementId);
                // ط¥ط°ط§ ظƒط§ظ† ط§ظ„ظ†طµ ط§ظ„ط­ط§ظ„ظٹ ظ‡ظˆ ط§ظ„طھط±ط¬ظ…ط© ط§ظ„ظ…ط­ظپظˆط¸ط©طŒ ظ„ط§ ط­ط§ط¬ط© ظ„ط¥ط¹ط§ط¯ط© ط§ظ„طھط±ط¬ظ…ط©
                if (currentText === savedTranslation) {
                    return;
                }
                // ط¥ط°ط§ ظƒط§ظ† ط§ظ„ظ†طµ ط§ظ„ط­ط§ظ„ظٹ ظ‡ظˆ ط§ظ„ظ†طµ ط§ظ„ط¥ظ†ط¬ظ„ظٹط²ظٹ ط§ظ„ط£طµظ„ظٹطŒ ط£ط¹ط¯ ط§ظ„طھط±ط¬ظ…ط©
                if (currentText === baseText && savedTranslation) {
                    $el.text(savedTranslation);
                    $el.attr('title', savedTranslation);
                    translated += 1;
                    return;
                }
            }
            
            const localized = __(baseText);
            if (localized && localized.length && localized !== baseText) {
                $el.text(localized);
                window.__translated_texts.set(elementId, localized);
                $el.attr('title', localized);
                translated += 1;
                return;
            }

            const fromServer = window.__server_translations[baseText];
            if (fromServer && fromServer !== baseText) {
                $el.text(fromServer);
                window.__translated_texts.set(elementId, fromServer);
                $el.attr('title', fromServer);
                translated += 1;
                return;
            }

            missing_for_server.add(baseText);
        });

        // ط¥ط°ط§ ط¨ظ‚ظٹطھ ظ†طµظˆطµ ط؛ظٹط± ظ…طھط±ط¬ظ…ط© ظˆظ†ط³طھط·ظٹط¹ ط¬ظ„ط¨ظ‡ط§ ظ…ظ† ط§ظ„ط³ظٹط±ظپط± (ظ…ظ„ظپط§طھ ط§ظ„ظ„ط؛ط©)
        if (
            missing_for_server.size &&
            !window.__translation_fetch_state.in_flight &&
            !window.__translation_fetch_state.failed
        ) {
            const safeLang =
                (window.frappe &&
                    frappe.boot &&
                    (frappe.boot.lang || (frappe.boot.user && frappe.boot.user.language))) ||
                (window.frappe && frappe.lang) ||
                "ar";

            // ط¥ط°ط§ طھظ… ط§ظ„ط¬ظ„ط¨ ظ…ط³ط¨ظ‚ط§ظ‹ ظ„ظ‡ط°ظ‡ ط§ظ„ظ„ط؛ط©طŒ ظ„ط§ طھط¹ط§ظˆط¯ ط§ظ„ط·ظ„ط¨
            if (window.__translation_fetch_state.fetched && window.__translation_fetch_state.lang === safeLang) {
                return;
            }
            window.__translation_fetch_state.in_flight = true;
            frappe.call({
                method: "medworld_theme.api.get_label_translations",
                args: {
                    labels: Array.from(missing_for_server),
                    lang: safeLang,
                },
                callback: (r) => {
                    window.__translation_fetch_state.in_flight = false;
                    window.__translation_fetch_state.fetched = true;
                    window.__translation_fetch_state.lang = safeLang;
                    if (r && r.message) {
                        Object.assign(window.__server_translations, r.message);
                        // ط­ط§ظˆظ„ ظ…ط¬ط¯ط¯ط§ظ‹ ط¨ط¹ط¯ ط¬ظ„ط¨ ط§ظ„طھط±ط¬ظ…ط§طھ
                        setTimeout(() => translate_menu_labels(false), 50);
                    }
                },
                error: () => {
                    window.__translation_fetch_state.in_flight = false;
                    window.__translation_fetch_state.failed = true; // ظ„ط§ طھط­ط§ظˆظ„ ظ…ط¬ط¯ط¯ط§ظ‹ ظ„طھط¬ظ†ط¨ طھظƒط±ط§ط± ط§ظ„ط£ط®ط·ط§ط،
                },
            });
        }

        // ظ…ط­ط§ظˆظ„ط© ط«ط§ظ†ظٹط© ظ…ط¨ظƒط±ط© ط¥ط°ط§ ظ„ظ… طھطھظ… ط£ظٹ طھط±ط¬ظ…ط© (ط§ظ„ط¹ظ†ط§طµط± ظ‚ط¯ طھطµظ„ ظ…طھط£ط®ط±ط©)
        if (allow_retry && translated === 0) {
            setTimeout(() => translate_menu_labels(false), 120);
        }
    }

    // -------------------------------
    // ط¥ط®ظپط§ط، ط¹ظ†ط§طµط± ط§ظ„ظ…ظ†ظٹظˆ ط­ط³ط¨ ط§ظ„ظ…ط³طھط®ط¯ظ…
    // -------------------------------
    const hiddenMenuState = {
        items: [],
        fetched: false,
        fetching: false,
    };

    // ترجمة القوائم مرة واحدة لكل صفحة/مسار لتقليل التكرار
    let lastMenuTranslateRoute = '';
    function translate_menus_once(force) {
        const route =
            (frappe && frappe.get_route_str && frappe.get_route_str()) ||
            window.location.hash ||
            window.location.pathname ||
            '';
        if (!force && route === lastMenuTranslateRoute) return;
        lastMenuTranslateRoute = route;
        setTimeout(() => translate_menu_labels(true), 120);
        setTimeout(apply_hidden_menu_filter, 220);
    }

    function hidden_storage_key() {
        const user = (window.frappe && frappe.session && frappe.session.user) || "guest";
        return `hidden_menu_items_${user}`;
    }

    function load_hidden_from_storage() {
        try {
            const raw = sessionStorage.getItem(hidden_storage_key());
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return false;
            hiddenMenuState.items = parsed;
            hiddenMenuState.fetched = true;
            return true;
        } catch (e) {
            return false;
        }
    }

    function save_hidden_to_storage(items) {
        try {
            sessionStorage.setItem(hidden_storage_key(), JSON.stringify(items || []));
        } catch (e) {
            // ignore storage errors
        }
    }

    // ظٹط­ط§ظˆظ„ طھط­ط¯ظٹط¯ ظ†ظˆط¹ ط§ظ„ط¹ظ†طµط± (Workspace ط£ظˆ ط؛ظٹط±ظ‡) ط¨ظ†ط§ط،ظ‹ ط¹ظ„ظ‰ ظ…ظˆظ‚ط¹ظ‡ ظپظٹ ط§ظ„ظ€ DOM
    function detect_element_kind($el) {
        if (
            $el.closest(".side-menu-icons").length ||
            $el.closest(".modules-menu").length ||
            $el.closest(".side-mobile-menu").length
        ) {
            return "workspace";
        }
        return "";
    }

    function normalize_route(val) {
        return (val || "")
            .toString()
            .trim()
            .replace(/^#/, "")
            .replace(/^\/+/, "")
            .toLowerCase();
    }

    function normalize_label(val) {
        return (val || "").toString().trim().toLowerCase();
    }

    function fetch_hidden_menu_items(cb) {
        // ط­ط§ظˆظ„ ط§ط³طھط®ط¯ط§ظ… ط§ظ„ظƒط§ط´ ظ„ظƒظ„ ط¬ظ„ط³ط© طھط³ط¬ظٹظ„ ط¯ط®ظˆظ„
        if (hiddenMenuState.fetched) {
            if (cb) cb(hiddenMenuState.items);
            // ط·ط¨ظ‘ظ‚ ط§ظ„ط¥ط®ظپط§ط، ظپظˆط±ط§ظ‹ ط¥ط°ط§ ط¬ظڈظ„ط¨ ظ…ظ† ط§ظ„ظƒط§ط´
            setTimeout(apply_hidden_menu_filter, 30);
            return;
        }
        if (hiddenMenuState.fetching) {
            if (cb) cb();
            return;
        }
        if (!window.frappe || !frappe.call) {
            return;
        }
        hiddenMenuState.fetching = true;
        frappe.call({
            method: "medworld_theme.api.get_hidden_menu_items",
            args: {},
            callback: (r) => {
                hiddenMenuState.fetching = false;
                hiddenMenuState.fetched = true;
                hiddenMenuState.items = Array.isArray(r && r.message) ? r.message : [];
                save_hidden_to_storage(hiddenMenuState.items);
                if (cb) cb(hiddenMenuState.items);
                // طھط·ط¨ظٹظ‚ ط§ظ„ط¥ط®ظپط§ط، ظپظˆط±ط§ظ‹ ط¨ط¹ط¯ ط§ظ„ط¬ظ„ط¨
                setTimeout(apply_hidden_menu_filter, 30);
            },
            error: () => {
                hiddenMenuState.fetching = false;
            },
        });
    }

    function anchor_info($el) {
        const route =
            normalize_route($el.data("route")) ||
            normalize_route($el.attr("href")) ||
            "";
        const label =
            normalize_label($el.data("label")) ||
            normalize_label($el.text()) ||
            "";
        const kind = normalize_label($el.data("kind")) || detect_element_kind($el);
        const name = normalize_label($el.data("name") || "");
        return { route, label, kind, name };
    }

    function should_hide(info) {
        if (!hiddenMenuState.items || !hiddenMenuState.items.length) return false;
        return hiddenMenuState.items.some((it) => {
            if (it && it.hide === 0) return false;
            const route = normalize_route(it.item_route);
            const label_en = normalize_label(it.item_label);
            const label_ar = normalize_label(it.item_label_ar);
            const entry_labels = Array.from(new Set([label_en, label_ar].filter(Boolean)));
            const kind = normalize_label(it.item_kind || it.item_type);
            const name = normalize_label(it.item_name || "");

            if (kind && kind !== "workspace") return false;

            // ط¥ط°ط§ ظƒط§ظ† ط§ظ„ط¥ط®ظپط§ط، ظ…ط­ط¯ط¯ط§ظ‹ ط¨ظ†ظˆط¹ (ظƒظ€ Workspace/Card/Link)طŒ ظپظ„ط§ طھط·ط§ط¨ظ‚ ط¹ظ†ط§طµط± ط£ظ†ظˆط§ط¹ ظ…ط®طھظ„ظپط©
            if (kind && info.kind && kind !== info.kind) return false;

            const matchRoute = route && info.route && info.route === route;
            const matchLabel = entry_labels.some((lbl) => lbl && info.label && info.label === lbl);
            const matchName = name && info.name && info.name === name;
            const matchKind = kind && info.kind && info.kind === kind;

            // Workspace sidebar matches ظپظ‚ط· ط¹ظ†ط¯ظ…ط§ ظٹظƒظˆظ† ط§ظ„ط¥ط®ظپط§ط، ظ…ظ† ظ†ظˆط¹ Workspace
            if (info.kind === "workspace" && kind && kind !== "workspace") return false;

            return matchRoute || matchLabel || (matchKind && (matchRoute || matchLabel || matchName));
        });
    }

    // ط¥ط®ظپط§ط، ط¹ظ„ظ‰ ظ…ط³طھظˆظ‰ DOM ط¯ط§ط®ظ„ طµظپط­ط© ط§ظ„ظ€ Workspace (ظƒط§ط±ط¯/ط¹ظ†طµط±)
    function hide_workspace_dom() {
        if (!hiddenMenuState.items || !hiddenMenuState.items.length) return;
        const $page = $(".desk-page");
        if (!$page.length) return;

        hiddenMenuState.items.forEach((it) => {
            if (!it || it.hide === 0) return;
            const route = normalize_route(it.item_route);
            const label = normalize_label(it.item_label);
            const label_ar = normalize_label(it.item_label_ar);
            const name = normalize_label(it.item_name || "");
            const kind = normalize_label(it.item_kind || it.item_type || "");

            if (kind && kind !== "workspace") return;

            // ط¥ط®ظپط§ط، ط§ظ„ظƒط§ط±ط¯
            if (kind === "card") {
                const labels = [label, label_ar].filter(Boolean);
                $page.find(".widget").filter(function () {
                    const text = normalize_label($(this).find(".widget-title, .card-title, h4, h5").first().text());
                    return text && labels.includes(text);
                }).hide();
                return;
            }

            // ط¥ط®ظپط§ط، ط§ظ„ط¹ظ†ط§طµط± ط¯ط§ط®ظ„ ط§ظ„ظƒط§ط±ط¯/ط§ظ„ط´ظˆط±طھظƒطھ
            const candidates = [];
            if (route) {
                candidates.push(`[data-link-to='${route}']`);
                candidates.push(`[data-doctype='${route}']`);
                candidates.push(`a[href='/app/${route}']`);
                candidates.push(`a[href*='/app/${route}']`);
            }
            if (name) {
                candidates.push(`[data-name='${name}']`);
            }
            if (label && it.item_label) {
                candidates.push(`a:contains('${it.item_label}')`);
                candidates.push(`div:contains('${it.item_label}')`);
                candidates.push(`span:contains('${it.item_label}')`);
            }

            const selector = candidates.join(",");
            const $matches = selector ? $page.find(selector) : $();

            // ظ…ط·ط§ط¨ظ‚ط© ط¥ط¶ط§ظپظٹط© ط¨ط§ظ„ظ†طµ ط¨ط¹ط¯ ط§ظ„طھط·ط¨ظٹط¹ ظ„ظ…ظ† ظٹظپط´ظ„ ط§ظ„ظ€ selector
            const extraMatches = [];
            if (label) {
                $page.find(".link-item, .shortcut-widget-box, .links-widget-box, .widget a").each(function () {
                    const txt = normalize_label($(this).text());
                    if (txt && txt === label) {
                        extraMatches.push(this);
                    }
                });
            }

            $matches.add(extraMatches).each(function () {
                const $el = $(this);
                const $container = $el.closest(".link-item, .shortcut-widget-box, .links-widget-box, .widget, li, .col");
                if ($container.length) $container.hide();
                else $el.hide();
            });
        });
    }

    function apply_hidden_menu_filter() {
        if (!hiddenMenuState.items || !hiddenMenuState.items.length) return;
        const selectors = [
            ".modules-menu .modules-menu-list a",
            ".side-menu-icons.menu-icons-with-label > ul > li > a",
            ".side-menu .side-menu-items > ul.dropdown-list > li > a",
            ".side-mobile-menu ul.mobile-modules-menu-list > li > a",
            ".side-mobile-menu ul.mobile-modules-list > li > a",
            "ul.mobile-modules-list > li > a",
        ];
        selectors.forEach((sel) => {
            $(sel).each(function () {
                const $el = $(this);
                const info = anchor_info($el);
                if (should_hide(info)) {
                    const $li = $el.closest("li");
                    if ($li.length) {
                        $li.hide();
                    } else {
                        $el.hide();
                    }
                }
            });
        });

        // ظ…ط¹ط§ظ„ط¬ط© ط¹ظ†ط§طµط± ط¨ط¯ظˆظ† ط±ظˆط§ط¨ط· (ظ†طµظˆطµ ظپظ‚ط· ظپظٹ ط§ظ„ظ…ظ†ظٹظˆ/ط§ظ„ظ…ظˆط¨ط§ظٹظ„)
        const textSelectors = [
            ".side-menu li",
            ".side-mobile-menu li",
            "ul.mobile-modules-menu-list li",
            "ul.mobile-modules-list li",
        ];
        hiddenMenuState.items.forEach((it) => {
            if (!it || it.hide === 0) return;
            const label = normalize_label(it.item_label) || normalize_label(it.item_label_ar);
            const entry_kind = normalize_label(it.item_kind || it.item_type);
            if (entry_kind && entry_kind !== "workspace") return;
            if (!label) return;
            textSelectors.forEach((sel) => {
                $(sel).each(function () {
                    const isWorkspaceLi = $(this).closest(".side-menu-icons, .modules-menu, .side-mobile-menu").length > 0;
                    if (entry_kind === "workspace" && !isWorkspaceLi) return;
                    if (entry_kind && entry_kind !== "workspace" && isWorkspaceLi) return;
                    const txt = normalize_label($(this).text());
                    if (txt && txt === label) {
                        $(this).hide();
                    }
                });
            });
        });
    }


    $(document).ready(function () {

        // navbar search
        // ظپط¹ظ‘ظ„ طھظ…ط±ظٹط± ط§ظ„ط³ط§ظٹط¯ط¨ط§ط± ط¥ط°ط§ طھظˆظپط± ط§ظ„ظ…ظ„ط­ظ‚
        sidebar_niceScroll();

        // ط¬ظ„ط¨ ظ‚ط§ط¦ظ…ط© ط§ظ„ط¹ظ†ط§طµط± ط§ظ„ظ…ط®ظپظٹط© ظ„ظ„ظ…ط³طھط®ط¯ظ… ظˆطھط·ط¨ظٹظ‚ظ‡ط§ ط¨ط¹ط¯ ط¨ظ†ط§ط، ط§ظ„ظ…ظ†ظٹظˆ
        fetch_hidden_menu_items(() => apply_hidden_menu_filter());
        // Chat icon: place icon in custom nav if exists, else default nav; create fallback if missing
        const move_chat_icon_to_nav = () => {
            const $customNavbar = $('.dv-navbar .dv-nav-right > ul');
            // Fallback to default ERPNext nav (right-most ul)
            const $defaultNav = $('header.navbar .navbar-collapse ul.navbar-nav').last();
            const $targetNav = $customNavbar.length ? $customNavbar : $defaultNav;
            if (!$targetNav.length) return;

            const $defaultIcon = $('header.navbar .chat-navbar-icon');
            if ($customNavbar.length && $defaultIcon.length) {
                $targetNav.prepend($defaultIcon);
            }
            let $icon = $targetNav.find('.chat-navbar-icon').first();
            // إذا لم توجد أيقونة أصلية، أنشئ واحدة بسيطة تعمل كزر chat
            if (!$icon.length) {
                const iconHtml = `
                    <li class="nav-item dropdown dropdown-notifications chat-navbar-icon" role="button" tabindex="0" aria-label="${__("Show Chats")}" title="${__("Show Chats")}">
                        ${frappe.utils.icon ? frappe.utils.icon("small-message", "md") : '<i class="fa fa-comments"></i>'}
                        <span class="badge" id="chat-notification-count"></span>
                    </li>
                `;
                $targetNav.prepend(iconHtml);
                $icon = $targetNav.find('.chat-navbar-icon').first();
            }
            if ($icon.length) {
                $icon.show().css('display', 'inline-block').css('cursor', 'pointer');
                // إزالة أي نسخ مكررة في كل الـnavs
                $('.chat-navbar-icon').not($icon).remove();
            }
        };
        move_chat_icon_to_nav();
        $(document).on('page-change', () => setTimeout(move_chat_icon_to_nav, 200));

        // تأكد من تحميل CSS الخاص بالدردشة حسب assets.json (بدون هاشات ثابتة)
        const get_chat_asset_path = (filename, is_rtl = false) => {
            try {
                if (frappe?.assets?.bundled_asset) {
                    return frappe.assets.bundled_asset(filename, is_rtl);
                }
                if (frappe?.boot?.assets_json) {
                    if (is_rtl && filename.endsWith('.css')) {
                        return (
                            frappe.boot.assets_json[`rtl_${filename}`] ||
                            frappe.boot.assets_json[filename] ||
                            filename
                        );
                    }
                    return frappe.boot.assets_json[filename] || filename;
                }
            } catch (e) {
                /* ignore */
            }
            return filename;
        };

        const ensure_chat_css = () => {
            const is_rtl = frappe?.utils?.is_rtl?.() || false;
            const href = get_chat_asset_path('chat.bundle.css', is_rtl);
            if (!href || !href.startsWith('/assets/')) return;
            if (!$(`link[data-chat-css="${href}"]`).length) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                link.setAttribute('data-chat-css', href);
                document.head.appendChild(link);
            }
        };

        // Ensure chat bundle loads and toggles on click
        let chatScriptPromise = null;
        const load_chat_bundle = () => {
            if (window.frappe && window.frappe.Chat) return Promise.resolve();
            if (chatScriptPromise) return chatScriptPromise;
            chatScriptPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                const src = get_chat_asset_path('chat.bundle.js', false);
                if (!src || !src.startsWith('/assets/')) {
                    reject(new Error('Chat bundle path not resolved'));
                    return;
                }
                script.src = src;
                script.onload = () => resolve();
                script.onerror = (err) => reject(err);
                document.head.appendChild(script);
            });
            return chatScriptPromise;
        };
        const ensure_socketio_ready = () => {
            if (!(frappe && frappe.socketio)) return;
            // إذا لم يكن متصلاً، حاول التهيئة بالمنفذ الافتراضي من boot
            try {
                const sock = frappe.socketio.socket;
                if (sock && sock.connected) return;
            } catch (e) {
                /* ignore */
            }
            try {
                const port = (frappe.boot && frappe.boot.socketio_port) || undefined;
                frappe.socketio.init(port);
            } catch (e) {
                console.error('socketio init failed', e);
            }
        };

        const ensure_chat_instance = () =>
            load_chat_bundle().then(() => {
                if (!window.frappe || !window.frappe.Chat) throw new Error('Chat bundle not available');
                ensure_socketio_ready();
                ensure_chat_css();
                if (!frappe.chat) frappe.chat = new frappe.Chat();

                const chatInstance = frappe.chat;
                // أعد ربط المستمعات ومنع إغلاق الفقاعة مباشرة بسبب click-outside
                bind_chat_icon_handlers();
                if (chatInstance) {
                    chatInstance.should_close = function (e) {
                        const $app = $('.chat-app');
                        const $navbar = $('.navbar, .dv-navbar');
                        const $icon = $('.chat-navbar-icon');
                        const $modal = $('.modal');
                        const insideApp = $app.is(e.target) || $app.has(e.target).length > 0;
                        const insideNavbar = $navbar.is(e.target) || $navbar.has(e.target).length > 0;
                        const insideIcon = $icon.is(e.target) || $icon.has(e.target).length > 0;
                        const insideModal = $modal.is(e.target) || $modal.has(e.target).length > 0;
                        return !(insideApp || insideNavbar || insideIcon || insideModal);
                    };
                }

                // reposition chat bubble/widget near the navbar icon (below it)
                setTimeout(() => {
                    const $icon = $('.dv-navbar .chat-navbar-icon:visible').first();
                    const $app = $('.chat-app');
                    if ($icon.length && $app.length) {
                        const iconOffset = $icon.offset();
                        const iconHeight = $icon.outerHeight() || 24;
                        const left = iconOffset ? iconOffset.left : 0;
                        const top = iconOffset ? iconOffset.top + iconHeight + 8 : 0;
                        $app.css({
                            position: 'absolute',
                            top: `${top}px`,
                            left: `${left}px`,
                            right: 'auto',
                            bottom: 'auto'
                        });
                    } else if ($app.length) {
                        // fallback to bottom-right
                        $app.css({position: 'fixed', right: '18px', bottom: '18px'});
                    }
                }, 200);
                return chatInstance;
            });
        const toggle_chat = () =>
            ensure_chat_instance()
                .then((chat) => {
                    if (chat && chat.chat_bubble) {
                        chat.chat_bubble.change_bubble();
                    }
            })
            .catch((err) => console.error('Chat init/toggle failed', err));

        // منع تنفيذ التبديل مرتين في نفس اللحظة (يُغلق فورياً)
        let chatToggleLock = false;
        const safe_toggle_chat = () => {
            if (chatToggleLock) return;
            chatToggleLock = true;
            toggle_chat().finally(() => {
                setTimeout(() => {
                    chatToggleLock = false;
                }, 350);
            });
        };

        // أزل أي مستمعات قديمة على الأيقونة وثبّت مستمعاً آمناً لمنع التبديل المزدوج
        const bind_chat_icon_handlers = () => {
            // أزل أي مستمعات مربوطة مباشرة أو تفويضاً
            $('.chat-navbar-icon').off('click').off('keydown');
            $(document).off('click', '.chat-navbar-icon'); // يشمل الافتراضي من الحزمة
            $(document).off('click.medworldChat', '.chat-navbar-icon');
            $(document)
                .on('click.medworldChat', '.chat-navbar-icon', function (e) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    safe_toggle_chat();
                })
                .off('keydown.medworldChat', '.chat-navbar-icon')
                .on('keydown.medworldChat', '.chat-navbar-icon', function (e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        safe_toggle_chat();
                    }
                });
        };
        bind_chat_icon_handlers();

        // ترجمة القوائم بعد التحميل (عدة محاولات مبكرة)
        const trigger_initial_menu_translation = () => {
            [100, 700, 1800].forEach((ms) => {
                setTimeout(() => translate_menu_labels(true), ms);
            });
        };
        trigger_initial_menu_translation();

        // تفعيل الترجمة مرة واحدة لكل مسار/صفحة لتقليل التكرار
        $(document).on('dv-app-loaded', function () {
            setTimeout(() => translate_menu_labels(true), 300);
            try { window.__dv_start_menu_observer_window && window.__dv_start_menu_observer_window(2500); } catch (e) {}
        });
        $(document).on('click', '.btn-open-modules', function () {
            setTimeout(() => translate_menu_labels(true), 200);
            try { window.__dv_start_menu_observer_window && window.__dv_start_menu_observer_window(2500); } catch (e) {}
        });
        // ترجم بعد فتح أي صفحة جديدة
        $(document).on('page-change', function () {
            setTimeout(() => translate_menu_labels(true), 300);
            try { window.__dv_start_menu_observer_window && window.__dv_start_menu_observer_window(2500); } catch (e) {}
        });

        // طھط­ط¯ظٹط« ظ†طµ ط§ظ„ظ€ footer ط¥ظ„ظ‰ "Powered By Medworld"
        ensure_footer_brand();
        setTimeout(ensure_footer_brand, 500);
        setTimeout(ensure_footer_brand, 1500);
        // طھط·ط¨ظٹط¹ ط§ظ„ط±ظˆط§ط¨ط· ط®ط§طµ ط¨ظˆط¶ط¹ Page ظپظ‚ط·
        if (is_page_mode()) {
            // طھط·ط¨ظٹط¹ ط£ظٹ ط±ط§ط¨ط· workspace ظٹظ†طھظ‡ظٹ ط¨ظ€ pagem ط¥ظ„ظ‰ ط§ظ„ط±ط§ط¨ط· ط§ظ„ظ‚ظٹط§ط³ظٹ ط¨ط¯ظˆظ†ظ‡ط§
            normalize_pagem_url();
            // طھط·ط¨ظٹط¹ ط£ظٹ ط±ط§ط¨ط· workspace ط¨ط§ظ„طµظٹط؛ط© ط§ظ„ظ‚ط¯ظٹظ…ط© /app/workspace/<slug> ط¥ظ„ظ‰ /app/<slug>
            normalize_workspace_prefix_url();
        }
        
        // ظ…ط±ط§ظ‚ط¨ط© طھط؛ظٹظٹط±ط§طھ ط§ظ„ظ€ footer (ظ„ظ„ظ…ظƒظˆظ†ط§طھ ط§ظ„ط¯ظٹظ†ط§ظ…ظٹظƒظٹط© ظ…ط«ظ„ Vue)
        const footerObserver = new MutationObserver(function() {
            ensure_footer_brand();
        });
        const footerElement = document.getElementById('app-footer');
        if (footerElement) {
            footerObserver.observe(footerElement, { childList: true, subtree: true, characterData: true });
        }

	        // مراقبة تغييرات القوائم لضمان ترجمة السايدبار بشكل موثوق عند إعادة بناء العناصر.
	        // تنفيذ "Enterprise-ish": نافذة مراقبة قصيرة (bounded) + debounce + disconnect لتقليل الحمل.
	        (function setup_menu_translation_observer() {
	            const should_observe = () => {
	                try {
	                    const currentLang =
	                        ((window.frappe && frappe.boot && frappe.boot.lang) || (window.frappe && frappe.lang) || "en")
	                            .toString()
	                            .toLowerCase();
	                    return !currentLang.startsWith("en");
	                } catch (e) {
	                    return true;
	                }
	            };

	            const disconnect = () => {
	                try {
	                    if (window.__dv_menu_observer) window.__dv_menu_observer.disconnect();
	                } catch (e) {
	                    // ignore
	                }
	                window.__dv_menu_observer = null;

	                if (window.__dv_menu_observer_timer) {
	                    clearTimeout(window.__dv_menu_observer_timer);
	                    window.__dv_menu_observer_timer = null;
	                }
	            };

	            const start_menu_observer_window = (windowMs) => {
	                if (!should_observe()) return;

	                disconnect();

	                let menuTranslationTimeout;
	                const menuObserver = new MutationObserver(function (mutations) {
	                    let shouldTranslate = false;
	                    let shouldHide = false;
	                    mutations.forEach(function (mutation) {
	                        if (mutation.type !== "childList" && mutation.type !== "characterData") return;
	                        const target = mutation.target;
	                        const hasClassList =
	                            target && target.classList && typeof target.classList.contains === "function";
	                        const canClosest = target && typeof target.closest === "function";
	                        const hitClass =
	                            hasClassList &&
	                            (target.classList.contains("mobile-modules-list") ||
	                                target.classList.contains("mobile-modules-menu-list") ||
	                                target.classList.contains("modules-menu-list"));
	                        const hitClosest =
	                            canClosest &&
	                            (target.closest(".side-menu") ||
	                                target.closest(".side-mobile-menu") ||
	                                target.closest(".modules-menu"));
	                        if (hitClass || hitClosest) {
	                            shouldTranslate = true;
	                            shouldHide = true;
	                        }
	                    });
	                    if (shouldTranslate) {
	                        clearTimeout(menuTranslationTimeout);
	                        menuTranslationTimeout = setTimeout(function () {
	                            try {
	                                translate_menu_labels(false);
	                            } catch (e) {
	                                // ignore
	                            }
	                            if (shouldHide) {
	                                setTimeout(apply_hidden_menu_filter, 60);
	                            }
	                        }, 120);
	                    }
	                });

	                window.__dv_menu_observer = menuObserver;

	                const observeMenus = function () {
	                    const menus = [
	                        document.querySelector(".side-menu"),
	                        document.querySelector(".side-mobile-menu"),
	                        document.querySelector(".modules-menu"),
	                        document.querySelector("ul.mobile-modules-list"),
	                        document.querySelector("ul.mobile-modules-menu-list"),
	                    ];
	                    menus.forEach(function (menu) {
	                        if (!menu) return;
	                        try {
	                            menuObserver.observe(menu, { childList: true, subtree: true, characterData: true });
	                        } catch (e) {
	                            // ignore
	                        }
	                    });
	                };

	                // Observe now and retry shortly in case menus are mounted after boot.
	                observeMenus();
	                setTimeout(observeMenus, 500);
	                setTimeout(observeMenus, 1500);

	                // Apply translation once immediately as well.
	                setTimeout(() => {
	                    try {
	                        translate_menu_labels(true);
	                    } catch (e) {
	                        // ignore
	                    }
	                    setTimeout(apply_hidden_menu_filter, 80);
	                }, 50);

	                window.__dv_menu_observer_timer = setTimeout(disconnect, windowMs || 6000);
	            };

	            // expose for lang-change hook
	            window.__dv_start_menu_observer_window = start_menu_observer_window;

	            // Start a short window on boot (covers initial sidebar render)
	            start_menu_observer_window(7000);
	        })();

        $(this).on('click', '.dv-navbar .open-search', function (event) {
            event.preventDefault();
            $('.dv-navbar .dv-nav-search').fadeIn();
            $('.dv-navbar .dv-nav-search .form-control').trigger('focus');
        });
        $(this).on('click', '.dv-navbar .dv-nav-search .dv-nav-search-close', function (event) {
            event.preventDefault();
            $('.dv-navbar .dv-nav-search').fadeOut();
        });

        $(this).on('click', '.dv-navbar .btn-open-mobile-menu', function (event) {
            event.preventDefault();
            if ($(this).hasClass('show-menu')) {
                $(this).removeClass('show-menu').find('i').addClass('fa-bars').removeClass('fa-times');
                $('.side-menu').hide();
                $('.side-mobile-menu').hide();
            } else {
                $(this).addClass('show-menu').find('i').removeClass('fa-bars').addClass('fa-times');
                $('.side-menu').show();
                $('.side-mobile-menu').show();
                // طھط±ط¬ظ…ط© ط¹ظ†ط§طµط± ظ‚ط§ط¦ظ…ط© ط§ظ„ظ…ظˆط¨ط§ظٹظ„ ط¹ظ†ط¯ ظپطھط­ظ‡ط§
                setTimeout(() => translate_menu_labels(true), 100);
                try { window.__dv_start_menu_observer_window && window.__dv_start_menu_observer_window(2500); } catch (e) {}
            }
        });
        // $(this).on('focus', '.dv-navbar .dv-nav-search .form-control', function (event) {
        //     $('.dv-app-theme').addClass('show-overlay');
        // }).on('blur', '.dv-navbar .dv-nav-search .form-control', function (event) {
        //     $('.dv-app-theme').removeClass('show-overlay');
        // });

        $(this).on("page-change", function () {
            $('.dv-app-theme').removeClass('show-overlay');
            // $('.dv-navbar .dv-nav-search').fadeOut();
            // $('.dv-navbar .dv-nav-search .form-control').trigger('blur');
        });

        // tooltip
        $('[data-toggle="tooltip"]').tooltip({boundary: 'window'});
        $('[data-toggle="tipsy"]').tipsy({fade: true, gravity: 'w'});

        // طھط£ظƒط¯ ط£ظ† ط§ظ„ط±ظˆط§ط¨ط· طھط°ظ‡ط¨ ظ„ط³ظ„ظژط¬ طµط­ظٹط­ ظپظٹ ظˆط¶ط¹ Page
        $(document).on('click.dvSlugFix', '.side-menu .side-menu-icons > ul > li > a, .modules-menu .modules-menu-list a, .side-mobile-menu a', function (event) {
            const mode = ($('body').data('menu-opening-type') || '').toString().toLowerCase();
            if (mode !== 'page') {
                return;
            }
            const raw = $(this).data('route') || $(this).data('label') || $(this).attr('href') || $(this).text();
            const slug = slugify_workspace(raw);
            if (!slug) {
                return;
            }
            event.preventDefault();
            // ط§ظپطھط­ ط§ظ„ظˆظˆط±ظƒط³ط¨ظٹط³ ظ…ط¨ط§ط´ط±ط© (ط¨ط¯ظˆظ† prefix workspace ظˆط¨ط¯ظˆظ† suffix)
            if (frappe && frappe.set_route) frappe.set_route(slug);
            else window.location.href = `/app/${slug}`;
        });

        // side menu
        $(this).on('click', '.side-menu .side-menu-icons > ul > li > a', function (event) {
            $(this).parents('ul').find('>li').removeClass('active');
            $(this).parent().addClass('active');
            // ط¥ط¹ط§ط¯ط© ط§ظ„طھط±ط¬ظ…ط© ط¨ط¹ط¯ ط§ظ„ظ†ظ‚ط±
            setTimeout(() => translate_menu_labels(false), 100);
        })
        // files icon
        $(this).on('click', '.dv-navbar .files-icon', function (event) {
            event.preventDefault();
            frappe.set_route("List", "File");
        });
        // files icon
        $(this).on('click', '.dv-navbar .full-screen-icon', function (event) {
            event.preventDefault();
            if (!$.fullscreen || !$.fullscreen.isFullScreen) {
                return;
            }

            const isFullScreen = $.fullscreen.isFullScreen();
            if (isFullScreen) {
                $.fullscreen.exit();
                $('i', this).removeClass('fa-compress').addClass('fa-expand');
            } else {
                $('body').fullscreen();
                $('i', this).removeClass('fa-expand').addClass('fa-compress');
            }
        });

        $(document).off('shown.bs.dropdown', '.dv-navbar .dropdown-user');

        // ط¥طµظ„ط§ط­ ظ…ط´ظƒظ„ط© ظپطھط­ ظ‚ط§ط¦ظ…ط© Help
        function fix_help_dropdown() {
            // ط¥ط؛ظ„ط§ظ‚ ط§ظ„ظ‚ط§ط¦ظ…ط© ط§ظپطھط±ط§ط¶ظٹط§ظ‹
            $('.dv-navbar .dropdown-help .dropdown-menu').removeClass('show');
            $('.dv-navbar .dropdown-help').removeClass('show');
            
            $('.dv-navbar .dropdown-help > a, .dv-navbar .dropdown-help .dropdown-lang-link').each(function() {
                const $link = $(this);
                // ط¥ط²ط§ظ„ط© onclick="return false;" ط¥ط°ط§ ظƒط§ظ† ظ…ظˆط¬ظˆط¯ط§ظ‹
                if ($link.attr('onclick') === 'return false;' || $link.attr('onclick') === 'return false') {
                    $link.removeAttr('onclick');
                }
                // ط¥ط¶ط§ظپط© data-toggle="dropdown" ط¥ط°ط§ ظ„ظ… ظٹظƒظ† ظ…ظˆط¬ظˆط¯ط§ظ‹
                if (!$link.attr('data-toggle')) {
                    $link.attr('data-toggle', 'dropdown');
                }
            });
            
            // طھظ‡ظٹط¦ط© Bootstrap dropdown ظ„ظ„ظ€ Help
            if ($.fn.dropdown) {
                $('.dv-navbar .dropdown-help > a, .dv-navbar .dropdown-help .dropdown-lang-link').dropdown();
            }
        }

        // ط¥ط؛ظ„ط§ظ‚ ظ‚ط§ط¦ظ…ط© Help ط§ظپطھط±ط§ط¶ظٹط§ظ‹ ط¹ظ†ط¯ طھط­ظ…ظٹظ„ ط§ظ„طµظپط­ط©
        setTimeout(function() {
            $('.dv-navbar .dropdown-help .dropdown-menu').removeClass('show').css('display', 'none');
            $('.dv-navbar .dropdown-help').removeClass('show');
        }, 100);
        
        // ط¥طµظ„ط§ط­ ظ‚ط§ط¦ظ…ط© Help ط¹ظ†ط¯ طھط­ظ…ظٹظ„ ط§ظ„طµظپط­ط©
        fix_help_dropdown();
        setTimeout(fix_help_dropdown, 500);
        setTimeout(fix_help_dropdown, 1500);

        // ط¥طµظ„ط§ط­ ظ‚ط§ط¦ظ…ط© Help ط¹ظ†ط¯ طھط­ظ…ظٹظ„ ط§ظ„طھط·ط¨ظٹظ‚
        $(document).on('app-loaded', function() {
            // ط¥ط؛ظ„ط§ظ‚ ط§ظ„ظ‚ط§ط¦ظ…ط© ط§ظپطھط±ط§ط¶ظٹط§ظ‹
            setTimeout(function() {
                $('.dv-navbar .dropdown-help .dropdown-menu').removeClass('show').css('display', 'none');
                $('.dv-navbar .dropdown-help').removeClass('show');
            }, 50);
            
            setTimeout(fix_help_dropdown, 300);
            
            // ط¥طµظ„ط§ط­ CSS ظ„ظ‚ط§ط¦ظ…ط© Help ط¨ط¹ط¯ طھط­ظ…ظٹظ„ ط§ظ„طھط·ط¨ظٹظ‚
            setTimeout(function() {
                const $helpMenu = $('#toolbar-help');
                if ($helpMenu.length) {
                    // ط¥ط؛ظ„ط§ظ‚ ط§ظ„ظ‚ط§ط¦ظ…ط© ط§ظپطھط±ط§ط¶ظٹط§ظ‹
                    $helpMenu.removeClass('show').css('display', 'none');
                    $helpMenu.closest('.dropdown-help').removeClass('show');
                    
                    // ط¥ط¸ظ‡ط§ط± documentation-links ط¯ط§ط¦ظ…ط§ظ‹ ط­طھظ‰ ظ„ظˆ ظ„ظ… طھظƒظ† ظ‡ظ†ط§ظƒ help links
                    const $docLinks = $helpMenu.find('.documentation-links');
                    if ($docLinks.length) {
                        $docLinks.show().css({
                            'display': 'block !important',
                            'visibility': 'visible !important',
                            'opacity': '1 !important'
                        });
                    }
                    
                    // ط§ظ„طھط£ظƒط¯ ظ…ظ† ط£ظ† ط¹ظ†ط§طµط± help_dropdown ظ…ط±ط¦ظٹط©
                    $helpMenu.find('.dropdown-item').each(function() {
                        const $item = $(this);
                        // ط¥ط¸ظ‡ط§ط± ط§ظ„ط¹ظ†طµط± ط¥ط°ط§ ظƒط§ظ† ظٹط­طھظˆظٹ ط¹ظ„ظ‰ ظ†طµ ط£ظˆ ط±ط§ط¨ط· ط£ظˆ action
                        if ($item.text().trim() || $item.attr('href') || $item.attr('onclick')) {
                            $item.show().css({
                                'display': 'block !important',
                                'visibility': 'visible !important',
                                'opacity': '1 !important',
                                'height': 'auto !important',
                                'min-height': 'auto !important'
                            });
                        }
                    });
                }
            }, 500);
        });

        // ط¥طµظ„ط§ط­ ظ…ط´ظƒظ„ط© ط¥ط®ظپط§ط، documentation-links ظپظٹ Frappe
        $(document).on('page-change', function() {
            // ط¥ط؛ظ„ط§ظ‚ ط§ظ„ظ‚ط§ط¦ظ…ط© ط¹ظ†ط¯ طھط؛ظٹظٹط± ط§ظ„طµظپط­ط©
            $('.dv-navbar .dropdown-help .dropdown-menu').removeClass('show').css('display', 'none');
            $('.dv-navbar .dropdown-help').removeClass('show');
            
            setTimeout(function() {
                const $helpMenu = $('#toolbar-help');
                if ($helpMenu.length) {
                    // ط¥ط¸ظ‡ط§ط± documentation-links ط¯ط§ط¦ظ…ط§ظ‹ (ط¥ط¬ط¨ط§ط±) - ط­طھظ‰ ظ„ظˆ ظƒط§ظ† Frappe ظٹط®ظپظٹظ‡ط§
                    const $docLinks = $helpMenu.find('.documentation-links');
                    if ($docLinks.length) {
                        $docLinks.show().css({
                            'display': 'block !important',
                            'visibility': 'visible !important',
                            'opacity': '1 !important',
                            'height': 'auto !important'
                        });
                    }
                    
                    // ط¥ط¸ظ‡ط§ط± ط¬ظ…ظٹط¹ ط¹ظ†ط§طµط± help_dropdown
                    $helpMenu.find('.dropdown-item').each(function() {
                        const $item = $(this);
                        // طھط®ط·ظٹ ط§ظ„ط¹ظ†ط§طµط± ط§ظ„ظپط§ط±ط؛ط© ط£ظˆ ط§ظ„طھظٹ ظ„ط§ طھط­طھظˆظٹ ط¹ظ„ظ‰ ظ†طµ
                        if ($item.text().trim() || $item.attr('href') || $item.attr('onclick')) {
                            $item.show().css({
                                'display': 'block !important',
                                'visibility': 'visible !important',
                                'opacity': '1 !important',
                                'height': 'auto !important',
                                'min-height': 'auto !important'
                            });
                        }
                    });
                    
                    // ط¥ط¸ظ‡ط§ط± dividers
                    $helpMenu.find('.dropdown-divider').css({
                        'display': 'block !important',
                        'visibility': 'visible !important',
                        'opacity': '1 !important',
                        'height': '1px !important',
                        'min-height': '1px !important'
                    });
                }
            }, 100);
        });

        // ظ…ط±ط§ظ‚ط¨ط© طھط؛ظٹظٹط±ط§طھ ظ‚ط§ط¦ظ…ط© Help ظˆط¥طµظ„ط§ط­ظ‡ط§ طھظ„ظ‚ط§ط¦ظٹط§ظ‹
        const helpMenuObserver = new MutationObserver(function(mutations) {
            const $helpMenu = $('#toolbar-help');
            if ($helpMenu.length) {
                // ط¥ط¸ظ‡ط§ط± documentation-links ط¯ط§ط¦ظ…ط§ظ‹
                const $docLinks = $helpMenu.find('.documentation-links');
                if ($docLinks.length && $docLinks.is(':hidden')) {
                    $docLinks.show().css({
                        'display': 'block !important',
                        'visibility': 'visible !important',
                        'opacity': '1 !important'
                    });
                }
                
                // ط§ظ„طھط£ظƒط¯ ظ…ظ† ط£ظ† ط¹ظ†ط§طµط± help_dropdown ظ…ط±ط¦ظٹط©
                $helpMenu.find('.dropdown-item').each(function() {
                    const $item = $(this);
                    if ($item.text().trim() && $item.is(':hidden')) {
                        $item.show().css({
                            'display': 'block !important',
                            'visibility': 'visible !important',
                            'opacity': '1 !important'
                        });
                    }
                });
                
                // ط§ظ„طھط£ظƒط¯ ظ…ظ† ط£ظ† ط§ظ„ظ‚ط§ط¦ظ…ط© ظ…ط±ط¦ظٹط© ط¹ظ†ط¯ ظپطھط­ظ‡ط§ ظپظ‚ط·
                if ($helpMenu.hasClass('show')) {
                    $helpMenu.css({
                        'display': 'block !important',
                        'visibility': 'visible !important',
                        'opacity': '1 !important',
                        'z-index': '1050 !important'
                    });
                } else {
                    // ط¥ط؛ظ„ط§ظ‚ ط§ظ„ظ‚ط§ط¦ظ…ط© ط¥ط°ط§ ظ„ظ… طھظƒظ† ظ…ظپطھظˆط­ط©
                    $helpMenu.css({
                        'display': 'none !important'
                    });
                }
            }
        });

        // ط¨ط¯ط، ظ…ط±ط§ظ‚ط¨ط© ظ‚ط§ط¦ظ…ط© Help
        setTimeout(function() {
            const $helpMenu = $('#toolbar-help');
            if ($helpMenu.length) {
                helpMenuObserver.observe($helpMenu[0], {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'style']
                });
                
                // ط¥ط¬ط¨ط§ط± ط¥ط¸ظ‡ط§ط± ط¹ظ†ط§طµط± help_dropdown ط¹ظ†ط¯ طھط­ظ…ظٹظ„ ط§ظ„طµظپط­ط©
                const $docLinks = $helpMenu.find('.documentation-links');
                if ($docLinks.length) {
                    $docLinks.show().css({
                        'display': 'block !important',
                        'visibility': 'visible !important',
                        'opacity': '1 !important'
                    });
                }
                
                // ط¥ط¸ظ‡ط§ط± ط¬ظ…ظٹط¹ ط¹ظ†ط§طµط± help_dropdown
                $helpMenu.find('.dropdown-item').each(function() {
                    const $item = $(this);
                    if ($item.text().trim() || $item.attr('href') || $item.attr('onclick')) {
                        $item.show().css({
                            'display': 'block !important',
                            'visibility': 'visible !important',
                            'opacity': '1 !important'
                        });
                    }
                });
            }
        }, 1000);

        // ظ…ط¹ط§ظ„ط¬ط© ط§ظ„ظ†ظ‚ط± ط¹ظ„ظ‰ ط²ط± Help ظٹط¯ظˆظٹط§ظ‹ ط¥ط°ط§ ظ„ظ… ظٹط¹ظ…ظ„ Bootstrap dropdown
        $(document).on('click', '.dv-navbar .dropdown-help > a, .dv-navbar .dropdown-help .dropdown-lang-link', function(event) {
            const $link = $(this);
            const $dropdown = $link.closest('.dropdown-help');
            const $menu = $dropdown.find('.dropdown-menu');
            
            // ط¥ط°ط§ ظƒط§ظ† onclick="return false;" ظ…ظˆط¬ظˆط¯طŒ طھط¹ط§ظ…ظ„ ظ…ط¹ظ‡ ظٹط¯ظˆظٹط§ظ‹
            if ($link.attr('onclick') && $link.attr('onclick').includes('return false')) {
                event.preventDefault();
                event.stopPropagation();
                
                // طھط¨ط¯ظٹظ„ ط­ط§ظ„ط© ط§ظ„ظ‚ط§ط¦ظ…ط©
                if ($menu.hasClass('show')) {
                    // ط¥ط؛ظ„ط§ظ‚ ط§ظ„ظ‚ط§ط¦ظ…ط©
                    $menu.removeClass('show');
                    $dropdown.removeClass('show');
                    $menu.css('display', 'none');
                } else {
                    // ط¥ط؛ظ„ط§ظ‚ ط¬ظ…ظٹط¹ ط§ظ„ظ‚ظˆط§ط¦ظ… ط§ظ„ط£ط®ط±ظ‰
                    $('.dv-navbar .dropdown-menu.show').removeClass('show');
                    $('.dv-navbar .dropdown.show').removeClass('show');
                    $('.dv-navbar .dropdown-menu.show').css('display', 'none');
                    
                    // ظپطھط­ ظ‚ط§ط¦ظ…ط© Help
                    $menu.addClass('show');
                    $dropdown.addClass('show');
                    
                    // ط¥طµظ„ط§ط­ CSS ظ„ط¶ظ…ط§ظ† ط¸ظ‡ظˆط± ط§ظ„ظ‚ط§ط¦ظ…ط©
                    $menu.css({
                        'display': 'block !important',
                        'visibility': 'visible !important',
                        'opacity': '1 !important',
                        'z-index': '1050 !important',
                        'min-height': 'auto !important',
                        'max-height': 'none !important',
                        'overflow': 'visible !important',
                        'position': 'absolute !important'
                    });
                    
                    // ط¥ط¸ظ‡ط§ط± documentation-links ط¯ط§ط¦ظ…ط§ظ‹
                    const $docLinks = $menu.find('.documentation-links');
                    if ($docLinks.length) {
                        $docLinks.show().css({
                            'display': 'block !important',
                            'visibility': 'visible !important',
                            'opacity': '1 !important'
                        });
                    }
                    
                    // ط§ظ„طھط£ظƒط¯ ظ…ظ† ط£ظ† ط¹ظ†ط§طµط± help_dropdown ظ…ط±ط¦ظٹط©
                    $menu.find('.dropdown-item').each(function() {
                        const $item = $(this);
                        if ($item.text().trim()) {
                            $item.css({
                                'display': 'block !important',
                                'visibility': 'visible !important',
                                'opacity': '1 !important',
                                'height': 'auto !important',
                                'min-height': 'auto !important'
                            });
                        }
                    });
                }
            }
        });

        // ط¥ط؛ظ„ط§ظ‚ ظ‚ط§ط¦ظ…ط© Help ط¹ظ†ط¯ ط§ظ„ظ†ظ‚ط± ط®ط§ط±ط¬ظ‡ط§
        $(document).on('click', function(event) {
            if (!$(event.target).closest('.dropdown-help').length) {
                const $helpMenu = $('.dv-navbar .dropdown-help .dropdown-menu');
                $helpMenu.removeClass('show');
                $helpMenu.css('display', 'none');
                $('.dv-navbar .dropdown-help').removeClass('show');
            }
        });

        // change language according to data-language of dropdown item
        $(this).on("click", "#header-navbar-change-lang .dropdown-item", function (event) {
            event.preventDefault();
            let $this = $(this);
            // $this.siblings(".selected").removeClass("selected");
            let language = $this.data('lang');
            let selected_flag = $this.find(".dv-lang-flag").attr("class");
            $("#header-navbar-change-lang .dropdown-lang-link").html(`<span class="${selected_flag}"></span> ${language}`);
            frappe.call({
                method: "medworld_theme.api.change_language",
                args: {
                    language: language.toLowerCase()
	                },
	                callback: function (r) {
	                    const newLang = (language || "").toString().toLowerCase();
	                    localStorage.setItem("active_lang", (language || "").toString().toUpperCase());

	                    // Make sidebar translation use the new language immediately (even before reload).
	                    // This avoids cases where the sidebar stays in English until a later re-render.
	                    try {
	                        if (window.frappe) {
	                            frappe.lang = newLang || frappe.lang;
	                            if (frappe.boot) {
	                                frappe.boot.lang = newLang || frappe.boot.lang;
	                                if (frappe.boot.user) {
	                                    frappe.boot.user.language = newLang || frappe.boot.user.language;
	                                }
	                            }
	                        }
	                    } catch (e) {
	                        // ignore
	                    }

	                    try {
	                        translate_menu_labels(true);
	                        setTimeout(() => translate_menu_labels(true), 120);
	                        setTimeout(() => translate_menu_labels(true), 350);
	                    } catch (e) {
	                        // ignore
	                    }

	                    // Open a short-lived observer window to translate any sidebar/menu nodes that render after the lang switch.
	                    // This avoids relying on user interactions and keeps overhead bounded.
	                    try {
	                        window.__dv_start_menu_observer_window && window.__dv_start_menu_observer_window(12000);
	                    } catch (e) {
	                        // ignore
	                    }
	                    // Do a single, deterministic "hard reload" (similar to the built-in Clear Cache action),
	                    // but without the toolbar throttle so we don't wait for user interaction.
	                    if (window.__dv_lang_reload_in_progress) return;
	                    window.__dv_lang_reload_in_progress = true;

                    let did_reload = false;
                    const reload_once = () => {
                        if (did_reload) return;
                        did_reload = true;
                        try {
                            window.location.reload(true);
                        } catch (e) {
                            window.location.reload();
                        }
                    };

                    // Fallback: never get stuck waiting for a request.
                    setTimeout(reload_once, 1500);

                    try {
                        frappe.assets && frappe.assets.clear_local_storage && frappe.assets.clear_local_storage();
                    } catch (e) {
                        // ignore
                    }

                    if (frappe && frappe.xcall) {
                        frappe.xcall("frappe.sessions.clear").finally(reload_once);
                    } else {
                        reload_once();
                    }
                }
            });
        });

        $(this).on('click', '.side-menu .side-menu-items > ul.dropdown-list > li > a, .side-menu ul.mobile-modules-menu-list > li > a', function () {
            if ($(this).parent().hasClass('active')) {
                if (!$(this).parent().hasClass('hide-sub-menu')) {
                    $(this).parent().addClass('hide-sub-menu');
                    $(this).parent().find('>ul').slideUp();
                } else {
                    $(this).parent().removeClass('hide-sub-menu');
                    $(this).parent().find('>ul').slideDown();
                }
            } else {
                $('.side-menu .side-menu-items > ul.dropdown-list > li, .side-menu ul.mobile-modules-menu-list > li').removeClass('hide-sub-menu active').find('>ul').slideUp();
                $(this).parent().removeClass('hide-sub-menu').addClass('active');
                $(this).parent().find('>ul').slideDown();
            }
            setTimeout(() => {
                const $lists = $('.side-menu .side-menu-items > ul.dropdown-list, .side-menu .side-menu-items > ul.shortcuts-list');
                if ($lists.getNiceScroll) {
                    $lists.getNiceScroll().resize();
                } else if ($.fn.niceScroll) {
                    sidebar_niceScroll();
                }
                // ط¥ط¹ط§ط¯ط© ط§ظ„طھط±ط¬ظ…ط© ط¨ط¹ط¯ ظپطھط­/ط¥ط؛ظ„ط§ظ‚ ط§ظ„ظ‚ظˆط§ط¦ظ…
                translate_menu_labels(false);
            }, 500);
        });

        $(this).on('mouseover', '.animated-tada', function () {
            $('.animated-icon', this).addClass('animated tada');
        }).on('mouseout', '.animated-tada', function () {
            $('.animated-icon', this).removeClass('animated tada');
        });

        $(this).on('mouseover', '.btn-toggle-main-menu', function () {
            let is_menu_shown = $(this).hasClass('menu-shown');
            if (is_menu_shown) {
                $('>i.far', this).removeClass('fa-bars fa-chevron-double-right').addClass('fa-chevron-double-left');
            } else {
                $('>i.far', this).removeClass('fa-bars fa-chevron-double-left').addClass('fa-chevron-double-right');
            }
        }).on('mouseout', '.btn-toggle-main-menu', function () {
            $('>i.far', this).removeClass('fa-chevron-double-left fa-chevron-double-right').addClass('fa-bars');
        });

        $(this).on('click', '.btn-toggle-main-menu', function () {
            let is_menu_shown = $(this).hasClass('menu-shown');
            if (is_menu_shown) {
                $(this).removeClass('menu-shown');
                $('body').addClass('hide-main-menu');
            } else {
                $(this).addClass('menu-shown');
                $('body').removeClass('hide-main-menu');
            }
        });


        $(this).on('click', '.btn-open-modules', function () {
            if ($(this).hasClass('active')) {
                $(this).removeClass('active').find('i').removeClass().addClass('flaticon-menu');
                $('.modules-menu').fadeOut();
            } else {
                $(this).addClass('active').find('i').removeClass().addClass('fal fa-times');
                translate_menu_labels(false);
                $('.modules-menu').toggle(300);
            }
        });

    });

    $(document).on("page-change", function () {
        $('.btn-open-modules').removeClass('active').find('i').removeClass().addClass('flaticon-menu');
        $('.modules-menu').fadeOut();
        if (window.innerWidth <= 820) {
            $('.dv-navbar .dv-nav-search').hide();
            $('.dv-navbar .btn-open-mobile-menu').removeClass('show-menu').find('i').addClass('fa-bars').removeClass('fa-times');
            $('.side-menu').hide();
            $('.side-mobile-menu').hide();
        }

        // طھط£ظƒط¯ ظ…ظ† ط³ظ„ظˆظƒ ظˆط¶ط¹ Page ظپظ‚ط· (ظ„ط§ طھط¹ظٹط¯ ط§ظ„طھظˆط¬ظٹظ‡ ظ„ظ„ط±ظˆط§ط¨ط· ط§ظ„ظپط±ط¹ظٹط©)
        const $content = $('.dv-app-content');
        const route = (frappe && frappe.get_route) ? frappe.get_route() : [];
        const routeMissing = !route || !route.length || !(route[0] || '').length;
        const isWorkspaceRoute = is_page_workspace_route(route) || url_looks_like_workspace();
        const pageMode = is_page_mode();
        const forcedPrehide = !!window.__dv_prehide_forced;
        const forceLogo = !!window.__dv_logo_force_overlay;

        // ط¹ظ†ط¯ ط¹ط¯ظ… طھظˆظپط± route ط¨ط¹ط¯ (ط±ظٹظپط±ط´ ظ‚ظˆظٹ)طŒ ظ„ط§ طھظپط±ظ‘ط؛ ط§ظ„ظ…ط­طھظˆظ‰ ظˆط§ظ†طھط¸ط± ط¥ط¹ط§ط¯ط© ط§ظ„ظپط­طµ
        if ((pageMode || forcedPrehide) && routeMissing) {
            setTimeout(enforce_blank_page_mode, 120);
            return;
        }

        if ((pageMode || forcedPrehide || forceLogo) && (isWorkspaceRoute || forceLogo)) {
            window.__dv_page_mode_active = true;
            window.__dv_prehide_forced = false;
            show_page_mode_landing($content);
            $('body, html')
                .removeClass('dv-prehide')
                .addClass('dv-prehide-workspace dv-pagem-auto-hide dv-logo-hard-hide')
                .removeClass('dv-allow-main');
            clear_prehide_visibility();
            if (forceLogo) {
                window.__dv_logo_force_overlay = false;
            }
        } else {
            window.__dv_prehide_forced = false;
            teardown_page_mode($content);
            window.__dv_page_mode_active = false;
            window.__dv_page_mode_target = '';
        }
        setTimeout(() => translate_menu_labels(true), 80);
        ensure_footer_brand();
        
        // ط¥ط¹ط§ط¯ط© ط§ظ„طھط±ط¬ظ…ط© ط¨ط¹ط¯ ط£ظٹ طھظپط§ط¹ظ„ ظ…ط¹ ط§ظ„ظ‚ظˆط§ط¦ظ…
        setTimeout(() => translate_menu_labels(false), 300);
    });

    $(document).on("app-loaded", function () {

        if (frappe.is_app_loaded)
            return;

        hide_quick_actions_for_non_admin();
        
        // ط¥ط¹ط§ط¯ط© ط¨ظ†ط§ط، ظ‚ط§ط¦ظ…ط© ط§ظ„ظ„ط؛ط§طھ ط¨ظ†ط§ط،ظ‹ ط¹ظ„ظ‰ ط§ظ„ظ„ط؛ط§طھ ط§ظ„ظ…ظپط¹ظ„ط©
        function rebuild_language_dropdown() {
            console.log('[Language Dropdown] Starting rebuild_language_dropdown...');
            frappe.call({
                method: "medworld_theme.api.get_enabled_languages",
                args: {},
                callback: function (response) {
                    console.log('[Language Dropdown] API Response:', response);
                    if (response && response.message && Array.isArray(response.message)) {
                        const enabledLanguages = response.message;
                        console.log('[Language Dropdown] Enabled languages:', enabledLanguages);
                        const enabledCodes = enabledLanguages.map(function(lang) {
                            return lang.code.toUpperCase();
                        });
                        console.log('[Language Dropdown] Enabled codes:', enabledCodes);
                        
                        const $dropdownMenu = $('#header-navbar-change-lang .dropdown-menu');
                        if (!$dropdownMenu.length) {
                            console.warn('[Language Dropdown] Dropdown menu not found!');
                            return;
                        }
                        console.log('[Language Dropdown] Dropdown menu found, current items:', $dropdownMenu.find('.dropdown-item').length);
                        
                        // ظ…ط³ط­ ط§ظ„ظ‚ط§ط¦ظ…ط© ط§ظ„ط­ط§ظ„ظٹط© (ظ…ط§ ط¹ط¯ط§ EO ط¥ط°ط§ ظƒط§ظ† ظ…ظˆط¬ظˆط¯ط§ظ‹)
                        let removedCount = 0;
                        $dropdownMenu.find('.dropdown-item').each(function() {
                            const $item = $(this);
                            const langCode = ($item.data('lang') || '').toUpperCase();
                            if (langCode !== 'EO') {
                                console.log('[Language Dropdown] Removing item:', langCode);
                                $item.remove();
                                removedCount++;
                            }
                        });
                        console.log('[Language Dropdown] Removed', removedCount, 'items');
                        
                        // ط¥ط¶ط§ظپط© ط§ظ„ظ„ط؛ط§طھ ط§ظ„ظ…ظپط¹ظ„ط©
                        const hideIcon = $('body').data('hide-language-icon') == 1;
                        let addedCount = 0;
                        enabledLanguages.forEach(function(lang) {
                            const langCode = (lang.code || '').toUpperCase();
                            if (!langCode) {
                                console.warn('[Language Dropdown] Skipping language with no code:', lang);
                                return;
                            }
                            const langLabel = lang.label || langCode;
                            const flagClass = lang.flag || 'dv-lang-flag lang-en';
                            
                            // ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ط¹ط¯ظ… ظˆط¬ظˆط¯ ط§ظ„ط¹ظ†طµط± ظ…ط³ط¨ظ‚ط§ظ‹
                            if (!$dropdownMenu.find('.dropdown-item[data-lang="' + langCode + '"]').length) {
                                let itemHtml = '';
                                if (!hideIcon) {
                                    itemHtml = '<span class="' + flagClass + '"></span> ';
                                }
                                itemHtml += langLabel;
                                
                                const $newItem = $('<a>', {
                                    'class': 'dropdown-item',
                                    'data-lang': langCode,
                                    'html': itemHtml
                                });
                                
                                console.log('[Language Dropdown] Adding language:', langCode, langLabel);
                                
                                // ط¥ط¶ط§ظپط© ظ‚ط¨ظ„ EO ط¥ط°ط§ ظƒط§ظ† ظ…ظˆط¬ظˆط¯ط§ظ‹طŒ ظˆط¥ظ„ط§ ط£ط¶ظپظ‡ ظپظٹ ط§ظ„ظ†ظ‡ط§ظٹط©
                                const $eoItem = $dropdownMenu.find('.dropdown-item[data-lang="EO"]');
                                if ($eoItem.length) {
                                    $eoItem.before($newItem);
                                } else {
                                    $dropdownMenu.append($newItem);
                                }
                                addedCount++;
                            } else {
                                console.log('[Language Dropdown] Language already exists:', langCode);
                            }
                        });
                        console.log('[Language Dropdown] Added', addedCount, 'languages. Total items now:', $dropdownMenu.find('.dropdown-item').length);
                    } else {
                        console.error('[Language Dropdown] Invalid response format:', response);
                    }
                },
                error: function(r) {
                    console.error('[Language Dropdown] API Error:', r);
                }
            });
        }
        
        // ط§ط³طھط¯ط¹ط§ط، ط§ظ„ط¯ط§ظ„ط© ط¨ط¹ط¯ طھط­ظ…ظٹظ„ ط§ظ„طµظپط­ط©
        setTimeout(rebuild_language_dropdown, 500);
        setTimeout(rebuild_language_dropdown, 1500);

        // ط­ط¶ظ‘ط± ظ‚ط§ط¦ظ…ط© ط§ظ„ظˆظˆط±ظƒط³ط¨ظٹط³ ظ…ط¨ظƒط±ط§ظ‹
        prime_workspace_slugs();
        // Ensure Menu Opening Type is present on body even if not injected by template
        function ensure_menu_opening_type() {
            try {
                const $body = $('body');
                if (!$body.length) return;
                const current = ($body.data('menu-opening-type') || $body.attr('data-menu-opening-type') || '').toString().trim();
                if (current) return;
                const fromSettings = (frappe && frappe.theme_settings && frappe.theme_settings.menu_opening_type) || '';
                if (fromSettings) {
                    $body.attr('data-menu-opening-type', fromSettings);
                }
            } catch (e) {
                /* ignore */
            }
        }

        ensure_menu_opening_type();

        setup_menu_opening_page();

        // طھط£ظƒظٹط¯ طھط·ط¨ظٹظ‚ ظˆط¶ط¹ Page ط¹ظ„ظ‰ ط£ظˆظ„ طھط­ظ…ظٹظ„ ط¨ط¹ط¯ طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„
        enforce_blank_page_mode();
        setTimeout(enforce_blank_page_mode, 250);
        // ظپط±ط¶ ط§ظ„طھط­ظˆظٹظ„ ط¥ظ„ظ‰ ط£ظˆظ„ ظˆظˆط±ظƒط³ط¨ظٹط³ ظ…طھط§ط­ط©طŒ ظˆطھط¬ط§ظ‡ظ„ ط£ظٹ ظƒط§ط´ ط³ط§ط¨ظ‚
        enforce_default_workspace_route();
        setTimeout(() => translate_menu_labels(true), 180);

        let AppLogoVM = new Vue({
            el: '#medworld-app-logo',
            delimiters: ["[[", "]]"],
            data: {
                logo_path: '',
                logo_class: '',
                user: {},
            },
            methods: {
                get_company_logo: function () {
                    const $this = this;
                    const logo = '/assets/medworld_theme/images/default-logo.png';
                    frappe.call({
                        type: 'POST',
                        method: 'medworld_theme.api.get_company_logo',
                        args: {},
                        callback: async function (response) {
                            if (response.message && response.message.length) {
                                $this.logo_path = response.message;
                                $this.logo_class = 'has-company-logo';
                            } else {
                                $this.logo_class = '';
                                $this.logo_path = logo;
                            }
                        }
                    });
                }
            },
            async mounted() {
                const logo = '/assets/medworld_theme/images/default-logo.png';
                if (frappe.theme_settings && frappe.theme_settings.theme_logo && frappe.theme_settings.theme_logo.length) {
                    this.logo_path = frappe.theme_settings.theme_logo;
                    this.logo_class = 'has-company-logo';
                } else {
                    this.logo_class = '';
                    this.logo_path = logo;
                }
                this.get_company_logo();
            },
            created: function () {
                this.user = frappe.get_cookies();
            }
        });

        function guard_logo_link() {
            const $a = $('#medworld-app-logo a');
            if (!$a.length) return;
            const targetSlug = get_first_workspace_slug() || 'home';
            if (is_page_mode()) {
                $a.attr('href', '#')
                    .attr('data-dv-logo-target', `/app/${targetSlug}`)
                    .attr('role', 'presentation')
                    .removeClass('dv-logo-disabled');
            } else {
                $a.attr('href', '/app').removeClass('dv-logo-disabled');
            }
        }
        // ط§ط¬ط¹ظ„ظ‡ط§ ظ…طھط§ط­ط© ط¹ط§ظ„ظ…ظٹط§ظ‹ ظ„طھظپط§ط¯ظٹ ReferenceError ظپظٹ ط£ظٹ ط³ظٹط§ظ‚ طھط­ظ…ظٹظ„/ط±ظٹظپط±ط´
        window.guard_logo_link = guard_logo_link;

        guard_logo_link();
        guard_invalid_print_route();

        // ظ…ظ†ط¹ ط§ظ„ظˆطµظˆظ„ ظ„ظ…ط­طھظˆظ‰ ط§ظ„ظˆظˆط±ظƒط³ط¨ظٹط³ ط¹ط¨ط± ط´ط¹ط§ط± ط§ظ„ط±ط£ط³ ظپظٹ ظˆط¶ط¹ Page
        $(document).off('click.dvLogoGuard').on('click.dvLogoGuard', '#medworld-app-logo, #medworld-app-logo a, #medworld-app-logo img', function (event) {
            if (!is_page_mode()) {
                guard_logo_link();
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            window.__dv_logo_force_overlay = true;
            guard_logo_link();
            const $content = $('.dv-app-content');
            window.__dv_page_mode_active = true;
            window.__dv_prehide_forced = false;
            show_page_mode_landing($content);
            $('body, html')
                .removeClass('dv-allow-main dv-prehide')
                .addClass('dv-prehide-workspace dv-pagem-auto-hide dv-logo-hard-hide');
            clear_prehide_visibility();
            const targetHref = $(this).closest('#medworld-app-logo').find('a').data('dv-logo-target') || `/app/${get_first_workspace_slug() || 'home'}`;
            const targetClean = (targetHref || '').replace(/^\/+/, '').replace(/^app\//, '');
            if (frappe && frappe.set_route) {
                frappe.set_route(targetClean);
            } else if (targetHref) {
                window.location.href = targetHref;
            }
            setTimeout(() => {
                $('body, html')
                    .removeClass('dv-allow-main')
                    .addClass('dv-prehide-workspace dv-pagem-auto-hide dv-logo-hard-hide');
                show_page_mode_landing($content);
            }, 30);
            return false;
        });

        new Vue({
            el: '#header-navbar-user',
            delimiters: ["[[", "]]"],
            data: {
                user: {
                    full_name: '',
                    user_id: ''
                },
                user_type: ''
            },
            created: function () {
                // Get user data from multiple sources
                const cookies = frappe.get_cookies();
                const bootUser = frappe.boot && frappe.boot.user;
                
                // Set user_id
                this.user.user_id = cookies.user_id || frappe.session.user || '';
                
                // Set full_name from multiple sources
                this.user.full_name = 
                    (bootUser && bootUser.full_name) ||
                    frappe.session.user_fullname ||
                    cookies.full_name ||
                    this.user.user_id;
                
                // Get user_type and full_name from database if needed
                if (this.user.user_id) {
                    frappe.db.get_value('User', this.user.user_id, ['user_type', 'full_name'], (response) => {
                        if (response && response.message) {
                            // Update full_name from database if available
                            if (response.message.full_name) {
                                this.user.full_name = response.message.full_name;
                            }
                            
                            // Set user_type
                            if (this.user.user_id == 'Administrator') {
                                this.user_type = __('Administrator');
                            } else {
                                this.user_type = (response.message.user_type) ? __(response.message.user_type) : __('User');
                            }
                        } else {
                            // Fallback if database query fails
                            this.user_type = (this.user.user_id == 'Administrator') ? __('Administrator') : __('User');
                        }
                        
                        // Update frappe.auth for compatibility
                        frappe.auth['user'] = this.user;
                        frappe.auth['user'].user_type = this.user_type;
                        frappe.auth['user'].user_roles = frappe.user_roles;
                    });
                } else {
                    // Fallback if no user_id
                    this.user.full_name = frappe.session.user || '';
                    this.user_type = __('User');
                }
            }
        });

        new Vue({
            el: '#header-navbar-change-lang',
            delimiters: ["[[", "]]"],
            data: {
                hide_language_icon: $('body').data('hide-language-icon'),
                lang_list: {},
                enabled_languages: [],
                active_lang: 'EN'
            },
            methods: {
                get_current_language: function () {
                    const $this = this;
                    frappe.call({
                        method: "medworld_theme.api.get_current_language",
                        args: {},
                        callback: function (response) {
                            if (response && response.message && response.message) {
                                $this.active_lang = (response.message).toUpperCase();
                            } else {
                                $this.active_lang = localStorage.getItem("active_lang") || 'EN';
                            }
                        }
                    });
                },
                get_enabled_languages: function () {
                    const $this = this;
                    console.log('[Vue Language Component] get_enabled_languages called');
                    frappe.call({
                        method: "medworld_theme.api.get_enabled_languages",
                        args: {},
                        callback: function (response) {
                            console.log('[Vue Language Component] API Response:', response);
                            if (response && response.message && Array.isArray(response.message)) {
                                $this.enabled_languages = response.message;
                                console.log('[Vue Language Component] Enabled languages set:', $this.enabled_languages);
                                
                                // ط¨ظ†ط§ط، lang_list ظ„ظ„طھظˆط§ظپظ‚ ظ…ط¹ ط§ظ„ظƒظˆط¯ ط§ظ„ظ‚ط¯ظٹظ…
                                const langListObj = {};
                                response.message.forEach(function(lang) {
                                    langListObj[lang.code] = {
                                        label: lang.label,
                                        flag: lang.flag,
                                        name: lang.name
                                    };
                                });
                                $this.lang_list = langListObj;
                                console.log('[Vue Language Component] lang_list built:', $this.lang_list);
                                
                                // ط¥ط¹ط§ط¯ط© ط¨ظ†ط§ط، ط§ظ„ظ‚ط§ط¦ظ…ط© ط¨ط¹ط¯ طھط­ط¯ظٹط« ط§ظ„ط¨ظٹط§ظ†ط§طھ
                                setTimeout(function() {
                                    console.log('[Vue Language Component] Calling hide_disabled_languages');
                                    $this.hide_disabled_languages();
                                }, 100);
                            } else {
                                console.error('[Vue Language Component] Invalid response format:', response);
                            }
                        },
                        error: function(r) {
                            console.error('[Vue Language Component] Error fetching enabled languages:', r);
                        }
                    });
                },
                hide_disabled_languages: function () {
                    const $this = this;
                    console.log('[Vue Language Component] hide_disabled_languages called');
                    console.log('[Vue Language Component] enabled_languages:', $this.enabled_languages);
                    const enabledCodes = $this.enabled_languages.map(function(lang) {
                        return (lang.code || '').toUpperCase();
                    });
                    console.log('[Vue Language Component] Enabled codes:', enabledCodes);
                    
                    // ط¥ط¹ط§ط¯ط© ط¨ظ†ط§ط، ظ‚ط§ط¦ظ…ط© ط§ظ„ظ„ط؛ط§طھ ط¯ظٹظ†ط§ظ…ظٹظƒظٹط§ظ‹
                    const $dropdownMenu = $('#header-navbar-change-lang .dropdown-menu');
                    if (!$dropdownMenu.length) {
                        console.warn('[Vue Language Component] Language dropdown menu not found');
                        return;
                    }
                    console.log('[Vue Language Component] Dropdown menu found, current items:', $dropdownMenu.find('.dropdown-item').length);
                    
                    if ($this.enabled_languages.length > 0) {
                        // ظ…ط³ط­ ط§ظ„ظ‚ط§ط¦ظ…ط© ط§ظ„ط­ط§ظ„ظٹط© ظˆط¥ط¹ط§ط¯ط© ط¨ظ†ط§ط¦ظ‡ط§ ط¨ظ†ط§ط،ظ‹ ط¹ظ„ظ‰ ط§ظ„ظ„ط؛ط§طھ ط§ظ„ظ…ظپط¹ظ„ط© ظپظ‚ط·
                        console.log('[Vue Language Component] Clearing dropdown menu');
                        $dropdownMenu.empty();
                        
                        // ط¥ط¶ط§ظپط© ط§ظ„ظ„ط؛ط§طھ ط§ظ„ظ…ظپط¹ظ„ط©
                        const hideIcon = $this.hide_language_icon == 1;
                        let addedCount = 0;
                        $this.enabled_languages.forEach(function(lang) {
                            const langCode = (lang.code || '').toUpperCase();
                            const langLabel = lang.label || langCode;
                            const flagClass = lang.flag || 'dv-lang-flag lang-en';
                            
                            let itemHtml = '';
                            if (!hideIcon) {
                                itemHtml = '<span class="' + flagClass + '"></span> ';
                            }
                            itemHtml += langLabel;
                            
                            const $newItem = $('<a>', {
                                'class': 'dropdown-item',
                                'data-lang': langCode,
                                'html': itemHtml
                            });
                            
                            console.log('[Vue Language Component] Adding language:', langCode, langLabel);
                            $dropdownMenu.append($newItem);
                            addedCount++;
                        });
                        console.log('[Vue Language Component] Added', addedCount, 'languages. Total items now:', $dropdownMenu.find('.dropdown-item').length);
                    } else {
                        // ط¥ط°ط§ ظ„ظ… طھظƒظ† ظ‡ظ†ط§ظƒ ظ„ط؛ط§طھ ظ…ظپط¹ظ„ط©طŒ ط£ط®ظپظگ ط§ظ„ط¹ظ†ط§طµط± ط؛ظٹط± ط§ظ„ظ…ظپط¹ظ„ط© ظپظ‚ط·
                        $('#header-navbar-change-lang .dropdown-menu .dropdown-item').each(function() {
                            const $item = $(this);
                            const langCode = ($item.data('lang') || '').toUpperCase();
                            
                            // ط¥ط°ط§ ظƒط§ظ†طھ ط§ظ„ظ„ط؛ط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط© ظپظٹ ظ‚ط§ط¦ظ…ط© ط§ظ„ظ„ط؛ط§طھ ط§ظ„ظ…ظپط¹ظ„ط©طŒ ط£ط®ظپظ‡ط§
                            if (langCode && !enabledCodes.includes(langCode)) {
                                $item.hide();
                            } else if (langCode && enabledCodes.includes(langCode)) {
                                $item.show();
                            }
                        });
                    }
                }
            },
            created: function () {
                this.get_current_language();
            },
            mounted: function () {
                const $this = this;
                console.log('[Vue Language Component] Component mounted');
                // ط¬ظ„ط¨ ط§ظ„ظ„ط؛ط§طھ ط§ظ„ظ…ظپط¹ظ„ط© ط¨ط¹ط¯ طھط­ظ…ظٹظ„ ط§ظ„ط¹ظ†طµط±
                setTimeout(function() {
                    console.log('[Vue Language Component] Calling get_enabled_languages after mount');
                    $this.get_enabled_languages();
                }, 300);
            }
        });


        // list-sidebar .sidebar-section
        $(document).on('click', '.list-sidebar .sidebar-section > li.sidebar-label, .form-sidebar > .sidebar-menu > li.sidebar-label', function () {
            let parent = $(this).parent();
            parent.toggleClass('hide-content');
        });

        setup_workspace_save_sync();

        // طھط­ط¯ظٹط« ظ†طµ ط§ظ„ظ€ footer ط¨ط¹ط¯ طھط­ظ…ظٹظ„ ط§ظ„طھط·ط¨ظٹظ‚
        ensure_footer_brand();
        setTimeout(ensure_footer_brand, 500);
        setTimeout(ensure_footer_brand, 1500);

    });

    $(document).on("page-change", function () {
        guard_invalid_print_route();
        hide_quick_actions_for_non_admin();
        const route = (frappe && frappe.get_route) ? frappe.get_route() : [];
        const onPageSuffix = route_has_page_suffix(route) || route_has_page_suffix(get_initial_route_string());
        if (is_page_mode() && onPageSuffix) {
            window.__dv_page_mode_active = true;
            show_page_mode_landing($('.dv-app-content'));
        } else if (!is_page_mode()) {
            window.__dv_page_mode_active = false;
            relax_blank_page_mode($('.dv-app-content'));
        }
        // طھط£ظƒط¯ ظ…ظ† طھط±ط¬ظ…ط© ط§ظ„ط³ط§ظٹط¯ط¨ط§ط± ط¨ط¹ط¯ ط£ظٹ طھظ†ظ‚ظ„
        setTimeout(() => translate_menu_labels(true), 200);
        ensure_footer_brand();
        // طھط­ط¯ظٹط« ظˆط¶ط¹ ط±ط§ط¨ط· ط§ظ„ط´ط¹ط§ط± ط¨ط¹ط¯ ظƒظ„ طھظ†ظ‚ظ„
        guard_logo_link();
        
        // ط¥ط¹ط§ط¯ط© ط§ظ„طھط±ط¬ظ…ط© ط¨ط¹ط¯ ط£ظٹ طھظپط§ط¹ظ„ ظ…ط¹ ط§ظ„ظ‚ظˆط§ط¦ظ…
        setTimeout(() => translate_menu_labels(false), 400);
    });

    function setup_menu_opening_page() {
        const $content = $('.dv-app-content');
        if (!$content.length) {
            return;
        }

        if (is_page_mode()) {
            $('body, html').addClass('dv-pagem-auto-hide');
        }

        if (!$content.data('dv-menu-opening-page-initialized')) {
            $content.data('dv-menu-opening-page-initialized', true);
            inject_menu_opening_page_styles();
        }

        // ط¹ظ†ط¯ ط§ظ„ط¶ط؛ط· ط¹ظ„ظ‰ ط¹ظ†ط§طµط± ط§ظ„ط³ط§ظٹط¯ط¨ط§ط± ط§ظ„ط±ط¦ظٹط³ظٹط© ط£ظˆ ط¹ظ†ط§طµط± modules menu (ط£ظٹظ‚ظˆظ†ط§طھ/ظˆظˆط±ظƒط³ط¨ظٹط³)طŒ ظپط¹ظ‘ظ„ طµظپط­ط© ط§ظ„ط®ظ„ظپظٹط©
        // ط§ط³طھظ‡ط¯ظپ ط£ظٹظ‚ظˆظ†ط§طھ ط§ظ„ط³ط§ظٹط¯ط¨ط§ط± ط§ظ„ط¬ط§ظ†ط¨ظٹط© ظپظ‚ط· (ط§ظ„ط¬ط°ط±ظٹط©) ظˆط±ظˆط§ط¨ط· modules-menu
        $(document).off('click.dvPageMode').on('click.dvPageMode', '.side-menu .side-menu-icons > ul > li > a, .side-mobile-menu a, .modules-menu .modules-menu-list a', function (event) {
            if (!is_page_mode()) {
                relax_blank_page_mode($content);
                window.__dv_page_mode_active = false;
                return;
            }

            const isModulesMenuLink = $(this).closest('.modules-menu').length > 0;
            const isTopSidebar = is_top_level_sidebar_link(this);

            if (!isModulesMenuLink && !isTopSidebar) {
                // ظ„ظٹط³طھ ط¹ظ†طµط±ظ‹ط§ ط±ط¦ظٹط³ظٹظ‹ط§ ظپظٹ ط§ظ„ط³ط§ظٹط¯ط¨ط§ط± ظˆظ„ط§ modules menuط› ط§طھط±ظƒظ‡ط§ طھط¹ظ…ظ„ ط¨ط´ظƒظ„ ط·ط¨ظٹط¹ظٹ
                return;
            }

            const target = extract_workspace_target(this);
            const isWorkspace = is_workspace_target(target) || (!get_workspace_slugs().size && isTopSidebar);
            const slug = target.slug;

            if (isWorkspace) {
                event.preventDefault();
                window.__dv_page_mode_active = true;
                window.__dv_page_mode_target = slug || '';
                show_page_mode_landing($content);

                navigate_to_target_if_needed(target);
                return false;
            }

            // ط±ظˆط§ط¨ط· ط§ظ„ط³ط§ظٹط¯ط¨ط§ط± ط§ظ„ط¬ط°ط±ظٹط© ظٹظپطھط±ط¶ ط£ظ† طھظƒظˆظ† ظˆظˆط±ظƒط³ط¨ظٹط³ط› ط¥ظ† ظ„ظ… ظ†طھط¹ط±ظپ ط¹ظ„ظٹظ‡ط§طŒ ظپط¹ظ‘ظ„ ط§ظ„ط®ظ„ظپظٹط© ظˆط§طھط±ظƒ ط§ظ„طھظˆط¬ظٹظ‡ ط§ظ„ط§ظپطھط±ط§ط¶ظٹ
            if (isTopSidebar) {
                window.__dv_page_mode_active = true;
                window.__dv_page_mode_target = '';
                show_page_mode_landing($content);
                // ظ„ط§ ظ†ظ…ظ†ط¹ ط§ظ„طھظˆط¬ظٹظ‡ ظ‡ظ†ط§ ظ„ظٹظƒظ…ظ„ ط§ظ„ظ€href ط§ظ„ط§ظپطھط±ط§ط¶ظٹ (ظ‚ط¯ ظٹظƒظˆظ† Doctype)
            }
        });

        // ط­ط§ظپط¸ ط¹ظ„ظ‰ ظˆط¶ط¹ Page ط­طھظ‰ ط¹ط¨ط± روابط الـ breadcrumb (مثل Users)
        // ظ„ط§ نسمح بإظهار محتوى Workspace؛ فقط نظهر الشعار.
        $(document)
            .off('click.dvPageModeBreadcrumb')
            .on('click.dvPageModeBreadcrumb', '#navbar-breadcrumbs a, .navbar-breadcrumbs a', function () {
                if (!is_page_mode()) {
                    return;
                }

                const href = ($(this).attr('href') || '').toString();
                const target = extract_workspace_target(this);
                const isWorkspaceLink =
                    is_workspace_target(target) ||
                    route_points_to_workspace(href);

                if (!isWorkspaceLink) {
                    return;
                }

                window.__dv_logo_force_overlay = true;
                window.__dv_prehide_forced = true;
                $('body, html').addClass('dv-prehide-workspace dv-pagem-auto-hide dv-logo-hard-hide');
            });

        // ط­ط§ظپط¸ ط¹ظ„ظ‰ طھظ†ط§ط³ظ‚ ط§ظ„ط­ط§ظ„ط© ط§ظ„ط£ظˆظ„ظٹط©
        if (!is_page_mode()) {
            relax_blank_page_mode($content);
            window.__dv_page_mode_active = false;
        } else if (is_page_route()) {
            window.__dv_page_mode_active = true;
            show_page_mode_landing($content);
        }
    }

    function inject_menu_opening_page_styles() {
        if ($('#dv-menu-opening-page-style').length) {
            return;
        }

        const settings = (window.frappe && frappe.theme_settings) || {};
        const pick = (value, fallback) => {
            if (!value || value === "None" || value === "null" || value === "undefined") {
                return fallback;
            }
            return value;
        };
        const lightImage = pick(settings.menu_opening_page_light_image, "/assets/medworld_theme/images/logonight.png");
        const darkImage = pick(settings.menu_opening_page_dark_image, "/files/pagem_dark.png");

        const css = `
            .dv-app-content.dv-menu-opening-page {
                position: relative;
                overflow: hidden;
                min-height: 100vh;
                background: transparent;
            }
            body[data-menu-opening-type="page"] .layout-main {
                background-image: url("${lightImage}");
                background-size: contain;
                background-position: center;
                background-repeat: no-repeat;
                background-attachment: fixed;
                background-color: #f8fafb;
            }
            .layout-main.dv-menu-opening-page,
            body.dv-pagem-auto-hide:not(.dv-allow-main) .layout-main,
            body.dv-prehide-workspace:not(.dv-allow-main) .layout-main {
                background-image: url("${lightImage}");
                background-size: contain;
                background-position: center;
                background-repeat: no-repeat;
                background-color: #f8fafb;
            }
            .dv-menu-opening-landing {
                position: absolute;
                inset: 0;
                background-image: url("${lightImage}");
                background-size: contain;
                background-position: center;
                background-repeat: no-repeat;
                background-color: #f8fafb;
                min-height: 100vh;
                z-index: 20;
                pointer-events: none;
            }
            .dv-menu-opening-landing__layer {
                position: absolute;
                inset: 0;
                /* background: linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.2) 100%); */
                z-index: 3;
                pointer-events: none;
            }
            html[data-theme-mode="dark"] .dv-menu-opening-landing,
            html[data-theme="dark"] .dv-menu-opening-landing,
            body.dv-dark-style .dv-menu-opening-landing {
                background-color: #1b1e23 !important;
                background-image: url("${darkImage}") !important;
                background-size: contain;
                background-position: center;
                background-repeat: no-repeat;
                filter: none;
            }
            html[data-theme-mode="dark"] .layout-main.dv-menu-opening-page,
            html[data-theme-mode="dark"] body[data-menu-opening-type="page"] .layout-main,
            html[data-theme-mode="dark"] body.dv-pagem-auto-hide:not(.dv-allow-main) .layout-main,
            html[data-theme-mode="dark"] body.dv-prehide-workspace:not(.dv-allow-main) .layout-main,
            html[data-theme="dark"] .layout-main.dv-menu-opening-page,
            html[data-theme="dark"] body[data-menu-opening-type="page"] .layout-main,
            html[data-theme="dark"] body.dv-pagem-auto-hide:not(.dv-allow-main) .layout-main,
            html[data-theme="dark"] body.dv-prehide-workspace:not(.dv-allow-main) .layout-main,
            body.dv-dark-style .layout-main.dv-menu-opening-page,
            body.dv-dark-style[data-menu-opening-type="page"] .layout-main,
            body.dv-dark-style.dv-pagem-auto-hide:not(.dv-allow-main) .layout-main,
            body.dv-dark-style.dv-prehide-workspace:not(.dv-allow-main) .layout-main {
                background-color: #1b1e23 !important;
                background-image: url("${darkImage}") !important;
                background-size: contain;
                background-position: center;
                background-repeat: no-repeat;
            }
            html[data-theme-mode="dark"] .dv-menu-opening-landing__layer,
            html[data-theme="dark"] .dv-menu-opening-landing__layer,
            body.dv-dark-style .dv-menu-opening-landing__layer {
                background: transparent;
            }
            /* ط£ط®ظپظگ ظ…ط­طھظˆظ‰ ط§ظ„ظ…ظ†ط·ظ‚ط© ط§ظ„ط±ط¦ظٹط³ظٹط© ظپظ‚ط· (ط¯ط§ط®ظ„ layout-main) ظˆط§طھط±ظƒ ط§ظ„ط´ط±ظٹط· ط§ظ„ط¬ط§ظ†ط¨ظٹ/ط§ظ„ظ‡ظٹط¯ط± */
            .layout-main.dv-menu-opening-page .layout-main-section,
            .layout-main.dv-menu-opening-page .page-main-content,
            .layout-main.dv-menu-opening-page .page-content,
            .layout-main.dv-menu-opening-page .page-content-wrapper {
                display: none !important;
            }
            /* ط¥ط®ظپط§ط، ظ…ط¨ظƒط± ظ„ظ„ظ…ظ†ط·ظ‚ط© ط§ظ„ط±ط¦ظٹط³ظٹط© ط¹ظ†ط¯ ط§ظ„طھط­ظ…ظٹظ„ ظپظٹ ظˆط¶ط¹ Page ظ„ظ…ط³ط§ط±ط§طھ ط§ظ„ظˆظˆط±ظƒط³ط¨ظٹط³ */
            body.dv-prehide-workspace .layout-main .layout-main-section,
            body.dv-prehide-workspace .layout-main .page-main-content,
            body.dv-prehide-workspace .layout-main .page-content,
            body.dv-prehide-workspace .layout-main .page-content-wrapper {
                display: none !important;
            }
            /* ط¥ط®ظپط§ط، ظƒظ„ ظ…ط­طھظˆظ‰ layout-main ط¨ط§ظ„ظƒط§ظ…ظ„ ظپظٹ ظˆط¶ط¹ ط§ظ„ط­ط¬ط¨ */
            body.dv-prehide-workspace .layout-main > *:not(#dv-menu-opening-landing):not(.page-head):not(.navbar):not(.dv-navbar) {
                display: none !important;
                visibility: hidden !important;
            }
            /* ط¥ط®ظپط§ط، ظ‚ط³ط±ظٹ ط¹ظ†ط¯ ط§ظ„ط¶ط؛ط· ط¹ظ„ظ‰ ط§ظ„ط´ط¹ط§ط± ظپظٹ ظˆط¶ط¹ Page */
            body.dv-logo-hard-hide .layout-main > *:not(#dv-menu-opening-landing):not(.page-head):not(.navbar):not(.dv-navbar),
            html.dv-logo-hard-hide .layout-main > *:not(#dv-menu-opening-landing):not(.page-head):not(.navbar):not(.dv-navbar) {
                display: none !important;
                visibility: hidden !important;
            }
            body.dv-logo-hard-hide #dv-menu-opening-landing,
            html.dv-logo-hard-hide #dv-menu-opening-landing {
                display: block !important;
                visibility: visible !important;
            }
            /* ظپظٹ ظˆط¶ط¹ PageطŒ ط£ط®ظپظگ ظƒظ„ ط¹ظ†ط§طµط± layout-main ظ…ط§ ط¹ط¯ط§ ط·ط¨ظ‚ط© ط§ظ„ط´ط¹ط§ط± ط­طھظ‰ ظٹظƒطھظ…ظ„ ط§ظ„طھط­ظ…ظٹظ„ */
            body.dv-pagem-auto-hide:not(.dv-allow-main) .layout-main > *:not(#dv-menu-opening-landing):not(.page-head):not(.navbar):not(.dv-navbar) {
                visibility: hidden !important;
            }
            body.dv-hide-desk-content .page-container,
            body.dv-hide-desk-content .layout-main,
            body.dv-hide-desk-content .layout-main-section,
            body.dv-hide-desk-content .layout-main-section-wrapper,
            body.dv-hide-desk-content .page-head,
            body.dv-hide-desk-content .layout-side-section,
            body.dv-hide-desk-content .page-content,
            body.dv-hide-desk-content .page-main-content,
            body.dv-hide-desk-content .page-content-wrapper {
                display: none !important;
            }
        `;

        $('<style id="dv-menu-opening-page-style" type="text/css"></style>')
            .text(css)
            .appendTo('head');
    }

    function ensure_landing_layer($content) {
        if ($('#dv-menu-opening-landing').length) {
            return;
        }
        const landing = $(`
            <div id="dv-menu-opening-landing" class="dv-menu-opening-landing">
                <div class="dv-menu-opening-landing__layer"></div>
            </div>
        `);
        // ط¶ط¹ ط§ظ„ط·ط¨ظ‚ط© ط¯ط§ط®ظ„ ط§ظ„ظ…ظ†ط·ظ‚ط© ط§ظ„ط±ط¦ظٹط³ظٹط© ظپظ‚ط·طŒ ظˆط§ط­طھظپط¸ ط¨ط§ظ„ط´ط±ظٹط· ط§ظ„ط¬ط§ظ†ط¨ظٹ/ط§ظ„ظ‡ظٹط¯ط±
        const $main = $content.find('.layout-main').first();
        const $target = $main.length ? $main : $content;
        $target.addClass('dv-menu-opening-page').css('position', 'relative').prepend(landing);
    }

    function set_prehide_visibility() {
        // ط£ط®ظپظگ ط£ظٹ ظ…ط­طھظˆظ‰ ظ…ط¨ظƒط±ط§ظ‹ ظ„طھط¬ظ†ط¨ ظˆظ…ظٹط¶ ط§ظ„ظˆظˆط±ظƒط³ط¨ظٹط³ ظ‚ط¨ظ„ طھظپط¹ظٹظ„ ط·ط¨ظ‚ط© ط§ظ„طµظپط­ط©
        document.documentElement.style.visibility = 'hidden';
        if (document.body) {
            document.body.style.visibility = 'hidden';
        }
    }

    function clear_prehide_visibility() {
        document.documentElement.style.removeProperty('visibility');
        document.body.style.removeProperty('visibility');
    }

    // ط­ط§ط±ط³ ظ…ط¨ظƒط± ظٹظ…ظ†ط¹ ظˆظ…ظٹط¶ ظ…ط­طھظˆظ‰ ط§ظ„ظ€Workspace ط¨ط¹ط¯ ط±ظٹظپط±ط´ ظ‚ظˆظٹ ظپظٹ ظˆط¶ط¹ Page
    // ظٹط¨ط¯ط£ ط¨ط§ظ„ط­ط¬ط¨ ظپظ‚ط· ط¥ط°ط§ ظƒط§ظ† ط§ظ„ظ…ط³ط§ط± ظٹط¨ط¯ظˆ ظˆظˆط±ظƒط³ط¨ظٹط³
    (function early_prehide_workspace_on_load() {
        try {
            const initialRoute = get_initial_route_string();
            const looksLikeWorkspace = (initialRoute && route_points_to_workspace(initialRoute)) || url_looks_like_workspace();
            if (!looksLikeWorkspace) {
                return;
            }

            const applyInlineHide = () => {
                if (document.getElementById('dv-prehide-inline')) return;
                const style = document.createElement('style');
                style.id = 'dv-prehide-inline';
                style.type = 'text/css';
                style.textContent = `
                    .dv-prehide-workspace .layout-main {
                        visibility: hidden !important;
                    }
                `;
                document.head.appendChild(style);
            };

            const apply = (attempt = 0) => {
                if (!is_page_mode()) {
                    if (attempt < 5) {
                        setTimeout(() => apply(attempt + 1), 20);
                    }
                    return;
                }
                inject_prehide_styles();
                inject_menu_opening_page_styles();
                applyInlineHide();

                document.documentElement.classList.add('dv-prehide-workspace', 'dv-page-route');
                if (document.body) {
                    document.body.classList.add('dv-prehide-workspace', 'dv-page-route');
                } else if (attempt < 5) {
                    setTimeout(() => apply(attempt + 1), 20);
                }

                // ط­ظ…ظ‘ظ„ ظ‚ط§ط¦ظ…ط© ط§ظ„ظˆظˆط±ظƒط³ط¨ظٹط³ ظ…ط¨ط§ط´ط±ط© ظ„طھط³ط±ظٹط¹ ط§ظ„طھط¹ط±ظپ ط¹ظ„ظ‰ ط§ظ„ظ…ط³ط§ط±
                fetch_workspace_slugs_now(true);
            };

            apply();
        } catch (e) {
            /* ignore */
        }
    })();

    function enforce_blank_page_mode() {
        const $content = $('.dv-app-content');
        const pageMode = is_page_mode();
        if (!pageMode) {
            window.__dv_page_mode_active = false;
            window.__dv_prehide_forced = false;
            teardown_page_mode($content);
            clear_prehide_visibility();
            teardown_body_observer();
            $('body, html').addClass('dv-allow-main');
            return;
        }

        const route = (frappe && frappe.get_route) ? frappe.get_route() : [];
        const routeMissing = !route || !route.length || !(route[0] || '').length;
        const forceLogo = !!window.__dv_logo_force_overlay;
        const looksLikeWorkspace = (!routeMissing && is_page_workspace_route(route)) || url_looks_like_workspace() || forceLogo;

        if (looksLikeWorkspace) {
            window.__dv_page_mode_active = true;
            window.__dv_prehide_forced = false;
            show_page_mode_landing($content);
            $('body, html')
                .removeClass('dv-prehide')
                .addClass('dv-prehide-workspace dv-pagem-auto-hide dv-logo-hard-hide')
                .removeClass('dv-allow-main');
            clear_prehide_visibility();
        } else if (routeMissing) {
            // ط§ظ†طھط¸ط± ط§ظ„ظ…ط³ط§ط± ط«ظ… ط£ط¹ط¯ ط§ظ„ظپط­طµ ط¯ظˆظ† ط¥ط®ظپط§ط، ظƒط§ظ…ظ„
            setTimeout(enforce_blank_page_mode, 80);
        } else {
            window.__dv_page_mode_active = false;
            window.__dv_prehide_forced = false;
            teardown_page_mode($content);
            $('body, html').removeClass('dv-prehide-workspace').addClass('dv-allow-main');
            clear_prehide_visibility();
            teardown_body_observer();
        }

        if (forceLogo) {
            window.__dv_logo_force_overlay = false;
        }

        setup_body_observer();
    }

    function recover_page_mode_landing_if_needed() {
        if (!is_page_mode()) {
            return;
        }

        const route = (frappe && frappe.get_route) ? frappe.get_route() : [];
        const workspaceLike = is_page_workspace_route(route) || url_looks_like_workspace();
        if (!workspaceLike) {
            return;
        }

        const $content = $('.dv-app-content');
        if (!$content.length) {
            return;
        }

        const $main = $content.find('.layout-main').first();
        ensure_landing_layer($content);
        $main.addClass('dv-menu-opening-page');
        $content.addClass('dv-menu-opening-page');
        $('#dv-menu-opening-landing').show();
        $('body, html')
            .addClass('dv-prehide-workspace dv-pagem-auto-hide dv-logo-hard-hide')
            .removeClass('dv-allow-main');
        window.__dv_page_mode_active = true;
    }

    function setup_page_mode_visibility_guard() {
        if (window.__dv_page_mode_visibility_guard) {
            return;
        }
        window.__dv_page_mode_visibility_guard = true;

        const recoverSoon = () => setTimeout(recover_page_mode_landing_if_needed, 60);

        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') {
                recoverSoon();
            }
        });
        window.addEventListener('focus', recoverSoon);
        window.addEventListener('pageshow', recoverSoon);
    }

    function setup_page_mode_watchdog() {
        if (window.__dv_page_mode_watchdog) {
            return;
        }
        window.__dv_page_mode_watchdog = setInterval(function () {
            if (!is_page_mode()) {
                return;
            }
            const routeWorkspace = is_page_workspace_route();
            if (routeWorkspace) {
                recover_page_mode_landing_if_needed();
                return;
            }
            const shouldRecover =
                ($('body').hasClass('dv-pagem-auto-hide') && !$('body').hasClass('dv-allow-main')) ||
                ($('body').hasClass('dv-prehide-workspace') && !$('body').hasClass('dv-allow-main'));
            if (shouldRecover) {
                recover_page_mode_landing_if_needed();
            }
        }, 1500);
    }

    function setup_body_observer() {
        if (window.__dv_page_mode_observer) {
            return;
        }
        const target = document.body;
        if (!target) {
            return;
        }
        window.__dv_page_mode_observer = new MutationObserver(function () {
            if (!is_page_mode()) {
                teardown_body_observer();
                return;
            }
            if (is_page_workspace_route()) {
                // ظ„ط§ طھظپط±ط؛ ط§ظ„ظ…ط­طھظˆظ‰ط› ط§طھط±ظƒ ظپط±ط¨ظ‘ظ‡ ظٹط¯ظٹط± ط§ظ„طµظپط­ط§طھطŒ ظˆط§ظƒطھظپظگ ط¨ط§ظ„ط®ظ„ظپظٹط©
                recover_page_mode_landing_if_needed();
            }
        });
        window.__dv_page_mode_observer.observe(target, { childList: true, subtree: true });
    }

    function teardown_body_observer() {
        if (window.__dv_page_mode_observer) {
            window.__dv_page_mode_observer.disconnect();
            window.__dv_page_mode_observer = null;
        }
    }

    // ط­ظٹظ„ط© ط¨ط³ظٹط·ط© ظ„طھظ‚ظ„ظٹظ„ ط§ظ„طھظپط§ط¹ظ„ ظ…ط¹ ط§ظ„ط´ط¹ط§ط± ظپظٹ ظˆط¶ط¹ Page
    function relax_blank_page_mode($content) {
        if (!$content || !$content.length) {
            return;
        }
        const $main = $content.find('.layout-main').first();
        $('body').removeClass('dv-hide-desk-content dv-prehide dv-prehide-workspace');
        $('body, html').addClass('dv-allow-main');
        $main.removeClass('dv-menu-opening-page');
        $content.removeClass('dv-menu-opening-page');
        $('#dv-menu-opening-landing').hide();
        $('#app-footer').show();
        $('body, html').removeClass('dv-logo-hard-hide dv-pagem-auto-hide');
    }

    function teardown_page_mode($content) {
        if (!$content || !$content.length) {
            return;
        }
        const $main = $content.find('.layout-main').first();
        window.__dv_page_mode_active = false;
        $('body, html').removeClass('dv-hide-desk-content dv-page-route dv-prehide dv-prehide-workspace');
        $('body, html').addClass('dv-allow-main');
        clear_prehide_visibility();
        $main.removeClass('dv-menu-opening-page');
        $content.removeClass('dv-menu-opening-page');
        $('#dv-menu-opening-landing').hide();
        $('#app-footer').show();
        $('body, html').removeClass('dv-logo-hard-hide dv-pagem-auto-hide');
    }

    // ط¥ط²ط§ظ„ط© suffix pagem ظ…ظ† ط§ظ„ظ…ط³ط§ط± (ط¥ط°ط§ ظˆظڈط¬ط¯) ظ„طھظپط§ط¯ظٹ طµظپط­ط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©
    function normalize_pagem_url() {
        try {
            const path = window.location.pathname || "";
            const search = window.location.search || "";
            const hash = window.location.hash || "";
            const match = path.match(/^(.*\/app\/workspace\/[^/]+)\/pagem\/?$/i);
            if (match && match[1]) {
                const clean = `${match[1]}${search}${hash}`;
                if (window.history && window.history.replaceState) {
                    window.history.replaceState({}, document.title, clean);
                } else {
                    window.location.href = clean;
                }
            }
        } catch (e) {
            /* ignore */
        }
    }

    // طھط·ط¨ظٹط¹ ظ…ط³ط§ط± /app/workspace/<slug> ط¥ظ„ظ‰ /app/<slug> ظ„طھط¬ظ†ط¨ 404
    function normalize_workspace_prefix_url() {
        try {
            const path = window.location.pathname || "";
            const search = window.location.search || "";
            const hash = window.location.hash || "";
            const match = path.match(/^(.*\/app\/)workspace\/([^/]+)(?:\/pagem\/?)?$/i);
            if (match && match[1] && match[2]) {
                const clean = `${match[1]}${match[2]}${search}${hash}`;
                if (window.history && window.history.replaceState) {
                    window.history.replaceState({}, document.title, clean);
                } else {
                    window.location.href = clean;
                }
            }
        } catch (e) {
            /* ignore */
        }
    }

    // طھط­ط¯ظٹط« ظ†طµ "Powered By" ط¥ظ„ظ‰ "Powered By Medworld"
    function ensure_footer_brand() {
        const $footer = $('#app-footer .app-footer, footer#app-footer .app-footer, .app-footer');
        if ($footer.length) {
            $footer.each(function() {
                const $el = $(this);
                const currentText = $el.text().trim();
                if (currentText === 'Powered By' || currentText === 'Powered by') {
                    $el.text('Powered By Medworld');
                }
            });
        }
    }

    function is_page_mode() {
        const $body = $('body');
        let raw = ($body.data('menu-opening-type') || $body.attr('data-menu-opening-type') || '');
        if (!raw) {
            raw = (frappe && frappe.theme_settings && frappe.theme_settings.menu_opening_type) || '';
            if (raw) {
                $body.attr('data-menu-opening-type', raw);
            }
        }
        return raw.toString().toLowerCase() === 'page';
    }

    function get_active_workspace_slug_from_sidebar() {
        const $activeLink = $('.side-menu-icons > ul > li.active > a, .side-menu-icons > ul > li.selected > a').first();
        if (!$activeLink.length) {
            return '';
        }
        const candidate = $activeLink.data('route') || $activeLink.attr('href') || '';
        const parts = normalize_route(candidate);
        return parts.length ? to_workspace_slug(parts[0]) : '';
    }

    function has_workspace_slug_in_sidebar(slug) {
        if (!slug) return false;
        let found = false;
        $('.side-menu-icons > ul > li > a').each(function () {
            if (found) return;
            const candidate = $(this).data('route') || $(this).attr('href') || '';
            const parts = normalize_route(candidate);
            const ws = parts.length ? to_workspace_slug(parts[0]) : '';
            if (ws && ws === slug) {
                found = true;
            }
        });
        return found;
    }

    function is_page_workspace_route(routeArr) {
        const route = Array.isArray(routeArr)
            ? routeArr
            : (frappe && frappe.get_route ? frappe.get_route() : []);
        if (!route || !route.length) return false;
        if (route_has_page_suffix(route) || route_points_to_workspace(route.join('/'))) {
            return true;
        }

        // Fallback for idle/resume cases where workspace slugs are not ready yet.
        const normalized = normalize_route(route.join('/'));
        if (normalized.length === 1) {
            const current = to_workspace_slug(normalized[0]);
            const activeWorkspace = get_active_workspace_slug_from_sidebar();
            if (current && activeWorkspace && current === activeWorkspace) {
                return true;
            }
            if (current && has_workspace_slug_in_sidebar(current)) {
                return true;
            }
        }

        return false;
    }

    // ظٹطھط­ظ‚ظ‚ ظ‡ظ„ ط§ظ„ظ…ط³ط§ط± ط§ظ„ط­ط§ظ„ظٹ ظ‡ظˆ طµظپط­ط© ظˆظˆط±ظƒط³ط¨ظٹط³ ط§ظ„ط®ط§طµط© ط¨ظˆط¶ط¹ Page
    function is_page_route() {
        return is_page_workspace_route();
    }

    function guard_invalid_print_route() {
        try {
            if (!window.frappe || !frappe.get_route) return;
            const route = frappe.get_route() || [];
            const first = (route[0] || "").toString().toLowerCase();
            if (first !== "print") return;

            // Print route must include at least doctype + document name.
            if (!route[1] || !route[2]) {
                const target = get_first_workspace_slug() || "home";
                if (frappe.set_route) {
                    frappe.set_route(target);
                } else {
                    window.location.href = "/app/" + target;
                }
            }
        } catch (e) {
            /* ignore */
        }
    }

    function hide_quick_actions_for_non_admin() {
        try {
            const user = (frappe.session && frappe.session.user) || '';
            const is_admin = user && user.toLowerCase() === 'administrator';

            if (is_admin) {
                $('body, html').addClass('dv-admin-quick-actions');
            } else {
                $('body, html').removeClass('dv-admin-quick-actions');
            }
        } catch (e) {
            /* ignore */
        }
    }

    function is_top_level_sidebar_link(el) {
        const $li = $(el).closest('li');
        if (!$li.length) return false;
        const $ul = $li.parent();
        if (!$ul.length) return false;

        // ط¬ط°ظˆط± ط§ظ„ط£ظٹظ‚ظˆظ†ط§طھ ط£ظˆ ظ‚ظˆط§ط¦ظ… ط§ظ„ظˆظˆط±ظƒط³ط¨ظٹط³ ط§ظ„ط±ط¦ظٹط³ظٹط© ظپظ‚ط·
        const isIconsRoot = $ul.is('.side-menu-icons > ul');
        const isDropdownRoot = $ul.is('.side-menu-items > ul.dropdown-list') && !$li.parents('li').length;
        const isMobileRoot = $ul.is('.side-mobile-menu ul.mobile-modules-menu-list');

        return isIconsRoot || isDropdownRoot || isMobileRoot;
    }

    // Helpers ظ„طھط­ط¯ظٹط¯ ط±ظˆط§ط¨ط· ط§ظ„ظ€ Workspace ط¨ط¯ظ‚ط©
    const __dv_workspace_slugs = new Set();

    let __dv_workspace_ready = false;
    let __dv_workspace_fetching = false;
    let __dv_first_workspace_slug = '';

    // ط£ط³ظ…ط§ط، طھط¹طھط¨ط± ط¯ط§ط¦ظ…ط§ظ‹ Workspace ط­طھظ‰ ظ„ظˆ ظ„ظ… طھط±ط¯ ظپظٹ boot ط£ظˆ ظ‚ط§ط¦ظ…ط© ط§ظ„ط³ظٹط±ظپط±
    const __dv_default_workspace_names = new Set(['home']);

    // ط¥ط®ظپط§ط، ظ…ط¨ظƒط± ط¬ط¯ط§ظ‹ ظ„طھط¬ظ†ط¨ ظˆظ…ظٹط¶ ظ…ط­طھظˆظ‰ ط§ظ„ظˆظˆط±ظƒط³ط¨ظٹط³ ط¹ظ†ط¯ ط§ظ„طھط­ظ…ظٹظ„/ط§ظ„ظ‡ط§ط±ط¯ ط±ظٹظ„ظˆط¯
    early_pre_hide();

    function early_pre_hide() {
        // ط£ط¨ظ‚ظگ ط§ظ„ط³ظ„ظˆظƒ ط§ظ„ط§ظپطھط±ط§ط¶ظٹط› ظ„ط§ طھط®ظپظگ ط§ظ„ظ…ط­طھظˆظ‰ ظ…ط¨ظƒط±ط§ظ‹
        return;
    }

    // ظٹط­inject ط³طھط§ظٹظ„ ظ…ط¨ظƒط± ظ„ط¥ط®ظپط§ط، ظ…ط­طھظˆظ‰ ط§ظ„ط¯ظٹط³ظƒ ط¹ظ†ط¯ ط§ظ„ط­ط§ط¬ط© (dv-prehide)
    function inject_prehide_styles() {
        if (document.getElementById('dv-prehide-style')) {
            return;
        }
        const css = `
            body.dv-prehide #body,
            body.dv-prehide .page-head,
            body.dv-prehide .layout-main,
            body.dv-prehide .layout-main-section,
            body.dv-prehide .layout-main-section-wrapper,
            body.dv-prehide .page-content,
            body.dv-prehide .page-main-content,
            body.dv-prehide .page-content-wrapper,
            body.dv-prehide .layout-side-section,
            html.dv-prehide #body,
            html.dv-prehide .page-head,
            html.dv-prehide .layout-main,
            html.dv-prehide .layout-main-section,
            html.dv-prehide .layout-main-section-wrapper,
            html.dv-prehide .page-content,
            html.dv-prehide .page-main-content,
            html.dv-prehide .page-content-wrapper,
            html.dv-prehide .layout-side-section {
                display: none !important;
            }
        `;
        const styleEl = document.createElement('style');
        styleEl.id = 'dv-prehide-style';
        styleEl.type = 'text/css';
        styleEl.appendChild(document.createTextNode(css));
        document.head.appendChild(styleEl);
    }

    function safe_decode_route(routeStr) {
        const raw = (routeStr || '').toString();
        try {
            return decodeURIComponent(raw);
        } catch (e) {
            return raw;
        }
    }

    function strip_route_prefix(routeStr) {
        const route = safe_decode_route(routeStr).trim();
        return route
            .replace(/^#/, '')
            .replace(/^\/+/, '')
            .replace(/^app\//i, '')
            .trim();
    }

    function to_workspace_slug(val) {
        if (!val) return '';
        return safe_decode_route(val)
            .toString()
            .trim()
            .replace(/^#/, '')
            .replace(/^\/+/, '')
            .replace(/^app\//i, '')
            .replace(/[_\s]+/g, '-')
            .replace(/[^a-zA-Z0-9-]+/g, '-')
            .replace(/--+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();
    }

    function slugify_workspace(val) {
        return to_workspace_slug(val);
    }

    function build_workspace_slugs() {
        if (__dv_workspace_ready && __dv_workspace_slugs.size) return __dv_workspace_slugs;

        const boot = (window.frappe && frappe.boot) || {};
        const pools = [];
        if (Array.isArray(boot.allowed_workspaces)) pools.push(...boot.allowed_workspaces);
        if (Array.isArray(boot.workspaces)) pools.push(...boot.workspaces);

        pools.forEach(ws => add_workspace_candidates(ws));
        if (!__dv_first_workspace_slug) {
            const first = get_first_workspace_slug_from_list(pools);
            if (first) {
                __dv_first_workspace_slug = first;
            }
        }

        __dv_workspace_ready = true;
        return __dv_workspace_slugs;
    }

    function fetch_workspace_slugs_now(force = false) {
        if (__dv_workspace_fetching && !force) {
            return;
        }
        if (!window.frappe || !frappe.call) {
            return;
        }
        __dv_workspace_fetching = true;
        frappe.call({
            method: 'frappe.desk.desktop.get_workspace_sidebar_items',
            args: {},
            callback: function (r) {
                __dv_workspace_fetching = false;
                const message = (r && r.message) || {};
                const sections = []
                    .concat(message.modules || [])
                    .concat(message.pages || [])
                    .concat(message.dashboards || []);
                sections.forEach(section => {
                    if (!section) return;
                    if (Array.isArray(section.items)) {
                        section.items.forEach(add_workspace_candidates);
                    } else {
                        add_workspace_candidates(section);
                    }
                });
                __dv_workspace_ready = true;
                // ط¨ط¹ط¯ طھط­ظ…ظٹظ„ ط§ظ„ظ‚ط§ط¦ظ…ط©طŒ ط£ط¹ط¯ ظپط±ط¶ ط­ط§ظ„ط© Page ظ„ط¶ظ…ط§ظ† ط¨ظ‚ط§ط، ط§ظ„ط­ط¬ط¨ ط¥ط°ط§ ظ„ط²ظ…
                setTimeout(enforce_blank_page_mode, 20);
            },
            error: function () {
                __dv_workspace_fetching = false;
            }
        });
    }

    function add_workspace_candidates(ws) {
        if (!ws) return;
        const candidates = [];
        if (typeof ws === 'string') {
            candidates.push(ws);
        } else {
            candidates.push(ws.route, ws.name, ws.title, ws.label);
            if (ws.link_to) candidates.push(ws.link_to);
        }
        candidates
            .filter(Boolean)
            .forEach(c => {
                const parts = normalize_route(c);
                const slug = parts.length ? to_workspace_slug(parts[0]) : '';
                if (slug) {
                    __dv_workspace_slugs.add(slug);
                }
            });
    }

    function normalize_route(routeStr) {
        const cleaned = strip_route_prefix(routeStr);
        if (!cleaned) {
            return [];
        }
        const parts = cleaned.split('/').map(part => part.trim());
        if (!parts.length) {
            return [];
        }
        // ط¥ط°ط§ ظƒط§ظ† ط£ظˆظ„ ط¬ط²ط، ظ‡ظˆ workspace/workspaces (ط§ظ„ظ…ط³ط§ط± ط§ظ„ظ‚ط¯ظٹظ…) ط§ط­ط°ظپظ‡
        if ((parts[0].toLowerCase() === 'workspace' || parts[0].toLowerCase() === 'workspaces') && parts.length > 1) {
            parts.shift();
        }
        // طھط¬ط§ظ‡ظ„ ظ„ط§ط­ظ‚ط© pagem ط¥ظ† ظˆظڈط¬ط¯طھ
        if (parts.length && parts[parts.length - 1].toLowerCase() === 'pagem') {
            parts.pop();
        }
        // ط·ط¨ظ‘ظ‚ ط§ظ„ظ€ slugify ط¹ظ„ظ‰ ط£ظˆظ„ ط¬ط²ط، ظ„ط¶ظ…ط§ظ† طھط·ط§ط¨ظ‚ ظ…ط³ط§ط±ط§طھ ط§ظ„ظˆظˆط±ظƒط³ط¨ظٹط³
        parts[0] = to_workspace_slug(parts[0]) || parts[0];
        return parts;
    }

    function route_has_page_suffix(routeArrOrStr) {
        if (Array.isArray(routeArrOrStr)) {
            if (!routeArrOrStr.length) return false;
            const last = (routeArrOrStr[routeArrOrStr.length - 1] || '').toString().toLowerCase();
            return last === 'pagem';
        }
        const str = (routeArrOrStr || '').toString().toLowerCase();
        return /(^|\/)pagem(\/|$)/.test(str);
    }

    // ظٹط¹ظٹط¯ طھظ…ط«ظٹظ„ط§ظ‹ ظ†طµظٹط§ظ‹ ظ„ظ„ظ…ط³ط§ط± ط§ظ„ط­ط§ظ„ظٹ ظ…ط¨ظƒط±ط§ظ‹ (hash ط£ظˆ pathname)
    function get_initial_route_string() {
        const hash = (window.location && window.location.hash || '').replace(/^#/, '').trim();
        const path = (window.location && window.location.pathname || '').replace(/^\/+/, '').trim();
        // ط¥ط°ط§ ظƒط§ظ† ط§ظ„ظ€hash ظٹط¨ط¯ط£ ط¨ظ€ app/ ط§ط³طھط®ط¯ظ…ظ‡طŒ ظˆط¥ظ„ط§ ط§ط³طھط®ط¯ظ… ط§ظ„ظ€pathname
        if (hash && hash.toLowerCase().startsWith('app/')) {
            return hash;
        }
        return hash || path;
    }

    function get_first_workspace_slug() {
        const boot = (window.frappe && frappe.boot) || {};
        const pools = [];
        if (Array.isArray(boot.allowed_workspaces) && boot.allowed_workspaces.length) {
            pools.push(...boot.allowed_workspaces);
        } else if (Array.isArray(boot.workspaces)) {
            pools.push(...boot.workspaces);
        }

        for (let i = 0; i < pools.length; i++) {
            const ws = pools[i];
            const slug = get_first_workspace_slug_from_item(ws);
            if (slug) return slug;
        }
        return '';
    }

    function get_first_workspace_slug_from_item(ws) {
        if (!ws) return '';
        const candidates = [];
        if (typeof ws === 'string') {
            candidates.push(ws);
        } else {
            candidates.push(ws.route, ws.name, ws.title, ws.label);
            if (ws.link_to) candidates.push(ws.link_to);
        }
        for (let j = 0; j < candidates.length; j++) {
            const parts = normalize_route(candidates[j]);
            if (parts.length) {
                const slug = to_workspace_slug(parts[0]);
                if (slug) {
                    return slug;
                }
            }
        }
        return '';
    }

    function get_first_workspace_slug_from_list(list) {
        if (!Array.isArray(list)) return '';
        for (let i = 0; i < list.length; i++) {
            const slug = get_first_workspace_slug_from_item(list[i]);
            if (slug) return slug;
        }
        return '';
    }

    function fetch_first_workspace_slug(callback) {
        if (!window.frappe || !frappe.call) {
            return;
        }
        if (__dv_workspace_fetching) {
            return;
        }
        __dv_workspace_fetching = true;
        frappe.call({
            method: 'frappe.desk.desktop.get_workspace_sidebar_items',
            args: {},
            callback: function (r) {
                __dv_workspace_fetching = false;
                const message = (r && r.message) || {};
                const pages = message.pages || message.modules || [];
                const slug = get_first_workspace_slug_from_list(pages);
                if (slug) {
                    __dv_first_workspace_slug = slug;
                }
                if (typeof callback === 'function') {
                    callback(slug);
                }
            },
            error: function () {
                __dv_workspace_fetching = false;
            }
        });
    }

    // ط­ط§ظˆظ„ ط¬ظ„ط¨ ظ‚ط§ط¦ظ…ط© ط§ظ„ظˆظˆط±ظƒط³ط¨ظٹط³ ظ…ظ† ط§ظ„ط³ظٹط±ظپط± ط¥ط°ط§ ظ„ظ… طھطھظˆظپط± ظپظٹ boot
    function prime_workspace_slugs() {
        build_workspace_slugs();
        if (__dv_workspace_fetching || __dv_workspace_slugs.size) {
            return;
        }
        if (!window.frappe || !frappe.call) {
            return;
        }
        __dv_workspace_fetching = true;
        frappe.call({
            method: 'frappe.desk.desktop.get_workspace_sidebar_items',
            args: {},
            callback: function (r) {
                __dv_workspace_fetching = false;
                const message = (r && r.message) || {};
                const sections = []
                    .concat(message.modules || [])
                    .concat(message.pages || [])
                    .concat(message.dashboards || []);
                sections.forEach(section => {
                    if (!section) return;
                    if (Array.isArray(section.items)) {
                        section.items.forEach(add_workspace_candidates);
                    } else {
                        add_workspace_candidates(section);
                    }
                });
            },
            error: function () {
                __dv_workspace_fetching = false;
            }
        });
    }

    function route_points_to_workspace(routeStr) {
        const raw = strip_route_prefix(routeStr);
        if (/^workspaces?\//i.test(raw || '')) {
            const rest = (raw || '').replace(/^workspaces?\//i, '').trim();
            return !!rest;
        }

        const parts = normalize_route(routeStr);
        if (!parts.length) return false;

        const first = to_workspace_slug(parts[0]);
        const second = to_workspace_slug(parts[1] || '');

        if (__dv_default_workspace_names.has(first)) {
            return true;
        }

        if (is_non_workspace_prefix(first)) {
            return false;
        }

        const slugs = get_workspace_slugs();
        if (!slugs.size) {
            return __dv_default_workspace_names.has(first) || (first === 'workspace' && !!second);
        }
        if (first === 'workspace' && second && slugs.has(second)) {
            return true;
        }

        return slugs.has(first);
    }

    function is_workspace_target(target) {
        if (!target || !target.slug) return false;
        // ط§ظ„ظ…ط³ط§ط± ط§ظ„ط·ط¨ظٹط¹ظٹ (ظ…ط¹ ظ‚ط§ط¦ظ…ط© ط§ظ„ظˆظˆط±ظƒط³ط¨ظٹط³)
        if (route_points_to_workspace(target.slug)) return true;
        // ظ„ظˆ ط§ظ„ظ…ط³ط§ط± ظٹط­ظ…ظ„ prefix workspace طµط±ظٹط­
        if (target.hasWorkspacePrefix) return true;
        return false;
    }

    function slugify_label(str) {
        if (!str) return '';
        return str.toString();
    }

    function extract_workspace_target(el) {
        const empty = { slug: '', routeParts: [], hasWorkspacePrefix: false };
        if (!el) return empty;
        const $el = $(el);
        const routeAttr = $el.data('route') || $el.attr('href') || '';
        if (routeAttr) {
            const raw = routeAttr.toString();
            const hasWorkspacePrefix = /^#?\s*\/?\s*(app\/)?workspace\//i.test(raw);
            const parts = normalize_route(raw);
            const slug = to_workspace_slug(parts[0] || '');
            // ط¨ط¹ط¯ normalize_route ظ„ظ† ظٹط¨ظ‚ظ‰ prefix workspaceط› ط§ط¨ظ†ظگ ط§ظ„ظ…ط³ط§ط± ط¨ط¯ظˆظ† ط£ظٹ prefix ظ‚ط¯ظٹظ…
            const routeParts = [slug].concat(parts.slice(1));
            return { slug, routeParts, hasWorkspacePrefix };
        }

        // fallback ظپظ‚ط· ط¥ط°ط§ ظ„ظ… ظٹظˆط¬ط¯ route/href
        const textCandidate = ($el.text() || '').toString();
        const parts = normalize_route(textCandidate);
        const slug = to_workspace_slug(parts[0] || '');
        return { slug, routeParts: [slug].concat(parts.slice(1)), hasWorkspacePrefix: /^workspace\//i.test(textCandidate) };
    }

    function navigate_to_target_if_needed(target) {
        if (!target || !target.slug) return;
        const routeParts = target.routeParts || [];
        if (!routeParts.length || !routeParts[0]) return;

        const current = (frappe && frappe.get_route) ? frappe.get_route() : [];
        const currentNorm = normalize_route((current || []).join('/'));
        const targetNorm = normalize_route(routeParts.join('/'));
        const arraysEqual = (a, b) => {
            if (!Array.isArray(a) || !Array.isArray(b)) return false;
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) return false;
            }
            return true;
        };

        if (arraysEqual(currentNorm, targetNorm)) {
            return;
        }

        // ظپظٹ ظˆط¶ط¹ Page ظ„ط§ ظ†ط¶ظٹظپ suffix "pagem" ط­طھظ‰ ظ„ط§ ظٹطھط³ط¨ط¨ ظپظٹ ظ…ط³ط§ط± ط؛ظٹط± ظ…ظˆط¬ظˆط¯
        let finalRouteParts = routeParts.slice();

        if (frappe && frappe.set_route) {
            frappe.set_route.apply(null, finalRouteParts);
        } else {
            const path = '/app/' + finalRouteParts.join('/');
            window.location.href = path;
        }
    }

    function get_workspace_slugs() {
        prime_workspace_slugs();
        return build_workspace_slugs();
    }

    function is_non_workspace_prefix(first) {
        const nonWorkspacePrefixes = ['doctype', 'report', 'query-report', 'page', 'list', 'form'];
        return nonWorkspacePrefixes.includes(first);
    }

    // ظٹظپط±ط¶ ط§ظ„طھط­ظˆظٹظ„ ط¥ظ„ظ‰ ط£ظˆظ„ ظˆظˆط±ظƒط³ط¨ظٹط³ ظ…طھط§ط­ط© ظˆظٹطھط¬ط§ظ‡ظ„ ط£ظٹ ظƒط§ط´ ظ…ط³ط§ط± ط³ط§ط¨ظ‚
    function enforce_default_workspace_route() {
        if (window.__dv_default_ws_forced) {
            return;
        }
        const slug = get_first_workspace_slug();
        if (!slug && __dv_first_workspace_slug) {
            // ط§ط³طھط®ط¯ظ… slug ط§ظ„ظ…ط­ط³ظˆط¨ ظ…ظ† ظ‚ط§ط¦ظ…ط© ط§ظ„ط³ظٹط±ظپط±
            return attempt_redirect(__dv_first_workspace_slug);
        }
        if (!slug) {
            // ط­ط§ظˆظ„ ط¬ظ„ط¨ ط£ظˆظ„ ظˆظˆط±ظƒط³ط¨ظٹط³ ظ…طھط§ط­ط© ظ…ظ† ط§ظ„ط³ظٹط±ظپط± ط«ظ… ط£ط¹ط¯ ط§ظ„ظ…ط­ط§ظˆظ„ط©
            fetch_first_workspace_slug(function (s) {
                if (s) {
                    setTimeout(enforce_default_workspace_route, 50);
                }
            });
            return;
        }
        const currentRoute = (frappe && frappe.get_route) ? frappe.get_route() : [];
        const route = Array.isArray(currentRoute) ? currentRoute : [];
        const first = (route[0] || '').toString().toLowerCase();
        const second = (route[1] || '').toString().toLowerCase();

        const alreadyOnDefault =
            (first === 'workspace' && second === slug) ||
            (first === slug && route.length === 1);

        // ط¥ط°ط§ ظ„ظ… ظٹظƒظ† ط§ظ„ظ…ظƒطھط¨ ط¬ط§ظ‡ط²ط§ظ‹ ط£ظˆ ط§ظ„ط±ط§ظˆطھ ط؛ظٹط± ظ…طھط§ط­طŒ ط£ط¹ط¯ ط§ظ„ظ…ط­ط§ظˆظ„ط© ظ„ط§ط­ظ‚ط§ظ‹
        if (!route.length || !frappe.route_history) {
            window.__dv_default_ws_forced = false;
            setTimeout(enforce_default_workspace_route, 250);
            return;
        }

        if (alreadyOnDefault) {
            window.__dv_default_ws_forced = true;
            return;
        }

        window.__dv_default_ws_forced = true;
        // ظ„ط§ طھظ‚ظ… ط¨ط§ظ„طھظˆط¬ظٹظ‡ ط¥ط°ط§ ظƒط§ظ† ط§ظ„ظ†ط¸ط§ظ… ظپظٹ ظˆط¶ط¹ ط§ظ„ط¶ظٹظپ/ط¨ط¯ظˆظ† ط¬ظ„ط³ط©
        if (!frappe || !frappe.session || !frappe.session.user || frappe.session.user === 'Guest') {
            return;
        }

        // ظ„ط§ طھظ‚ظ… ط¨ط§ظ„طھظˆط¬ظٹظ‡ ط¥ط°ط§ ظ„ظ… ظٹطھظ… طھط­ظ…ظٹظ„ ط§ظ„ظ…ظƒطھط¨/ط§ظ„ظ€desk ط¨ط§ظ„ظƒط§ظ…ظ„
        if (!frappe.boot || !frappe.boot.desk_page) {
            window.__dv_default_ws_forced = false;
            setTimeout(enforce_default_workspace_route, 250);
            return;
        }

        // ظ‚ظ… ط¨ط§ظ„طھظˆط¬ظٹظ‡ ط¨ط£ظ…ط§ظ†
        try {
            attempt_redirect(slug);
        } catch (e) {
            // ط¥ط°ط§ ظپط´ظ„ ط§ظ„طھظˆط¬ظٹظ‡ (ظ…ط«ظ„ط§ظ‹ route null) ط£ط¹ط¯ ط§ظ„ظ…ط­ط§ظˆظ„ط© ط¨ط¹ط¯ ظ‚ظ„ظٹظ„
            window.__dv_default_ws_forced = false;
            setTimeout(enforce_default_workspace_route, 250);
        }
    }

    function goto_workspace_page(wsName) {
        if (!wsName) return;
        if (window.__dv_page_route_pending) {
            return;
        }
        window.__dv_page_route_pending = true;
        if (frappe && frappe.set_route) frappe.set_route(wsName);
        else window.location.href = `/app/${wsName}`;
        setTimeout(() => {
            window.__dv_page_route_pending = false;
        }, 500);
    }

    function attempt_redirect(slug) {
        if (!slug) return;
        if (frappe && frappe.set_route) frappe.set_route(slug);
        else window.location.href = `/app/${slug}`;
        setTimeout(enforce_blank_page_mode, 120);
    }

    const PAGE_SUFFIX = '';

    function show_page_mode_landing($content) {
        ensure_landing_layer($content);
        const $main = $content.find('.layout-main').first();
        $main.addClass('dv-menu-opening-page');
        $content.addClass('dv-menu-opening-page');
        $('#dv-menu-opening-landing').show();
        $('body, html')
            .removeClass('dv-prehide dv-allow-main')
            .addClass('dv-prehide-workspace dv-pagem-auto-hide dv-logo-hard-hide');
        window.__dv_page_mode_active = true;
        $('#app-footer').hide();
        clear_prehide_visibility();
    }

    setup_page_mode_visibility_guard();
    setup_page_mode_watchdog();

    function setup_workspace_save_sync() {
        if (window.__dv_workspace_sync_hooked) {
            return;
        }
        window.__dv_workspace_sync_hooked = true;

        $(document).ajaxComplete(function (event, xhr, settings) {
            if (!settings || !settings.url || settings.url.indexOf('frappe.desk.doctype.workspace.workspace.save_page') === -1) {
                return;
            }

            const payload = get_ajax_payload(settings.data);
            const args = parse_workspace_request_args(payload);

            if (!args || !args.blocks) {
                return;
            }

            let blocks;
            try {
                blocks = JSON.parse(args.blocks);
            } catch (error) {
                return;
            }

            const card_order = (blocks || [])
                .filter(block => block.type === 'card' && block.data && block.data.card_name)
                .map(block => block.data.card_name);

            if (!card_order.length) {
                return;
            }

            frappe.call({
                method: 'medworld_theme.api.sync_workspace_cards',
                args: {
                    title: args.title || '',
                    is_public: (function (val) {
                        const str = (val === undefined || val === null) ? '' : String(val).trim().toLowerCase();
                        return (str === '1' || str === 'true') ? 1 : 0;
                    })(args.public),
                    card_order: card_order
                }
            });
        });
    }

    function get_ajax_payload(data) {
        if (!data) {
            return null;
        }

        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch (error) {
                try {
                    const parsed = {};
                    const params = new URLSearchParams(data);
                    params.forEach(function (value, key) {
                        parsed[key] = value;
                    });
                    return parsed;
                } catch (e) {
                    return null;
                }
            }
        }

        return data;
    }

    function parse_workspace_request_args(payload) {
        if (!payload) {
            return null;
        }

        if (payload.args) {
            try {
                return JSON.parse(payload.args);
            } catch (e) {
                /* ignore */
            }
        }

        if (payload.kwargs) {
            try {
                return JSON.parse(payload.kwargs);
            } catch (error) {
                /* ignore */
            }
        }

        return payload;
    }

    // Patch QZ Tray encoding to CP864 for Arabic raw printing.
    (function patch_qz_encoding() {
        const encoding = { from: "UTF-8", to: "CP864" };
        const applyPatch = () => {
            if (!window.qz || !qz.configs || qz.configs._mw_encoding_patched) return;
            const original = qz.configs.create;
            qz.configs.create = function (printer, opts) {
                const merged = Object.assign({ encoding }, opts || {});
                return original.call(this, printer, merged);
            };
            qz.configs._mw_encoding_patched = true;
        };

        if (frappe && frappe.ui && frappe.ui.form && frappe.ui.form.qz_init) {
            const originalInit = frappe.ui.form.qz_init;
            frappe.ui.form.qz_init = function () {
                return originalInit().then(() => {
                    applyPatch();
                });
            };
        } else {
            setTimeout(applyPatch, 500);
            setTimeout(applyPatch, 1500);
        }
    })();

    // Enable direct QZ printing for raw (plain) and non-raw (PDF) when a printer mapping exists.
    (function patch_qz_printing() {
        const toBase64 = (arrayBuffer) => {
            let binary = "";
            const bytes = new Uint8Array(arrayBuffer);
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
            }
            return window.btoa(binary);
        };

        const buildPdfUrl = (me) => {
            const print_format = me.get_print_format();
            const params = new URLSearchParams({
                doctype: me.frm.doc.doctype,
                name: me.frm.doc.name,
                format: me.selected_format(),
                no_letterhead: me.with_letterhead() ? "0" : "1",
                letterhead: me.get_letterhead(),
                settings: JSON.stringify(me.additional_settings || {}),
            });
            if (me.lang_code) {
                params.append("_lang", me.lang_code);
            }
            const is_builder = print_format && print_format.print_format_builder_beta;
            const endpoint = is_builder
                ? "/api/method/frappe.utils.weasyprint.download_pdf"
                : "/api/method/frappe.utils.print_format.download_pdf";
            return frappe.urllib.get_full_url(`${endpoint}?${params.toString()}`);
        };

        const qzPrintPdf = (me, printer) => {
            const url = buildPdfUrl(me);
            return fetch(url, { credentials: "include" })
                .then((res) => res.arrayBuffer())
                .then((buf) => {
                    const data = [{ type: "pdf", format: "base64", data: toBase64(buf) }];
                    const config = qz.configs.create(printer);
                    return qz.print(config, data);
                });
        };

        const ensurePatch = () => {
            if (!frappe || !frappe.ui || !frappe.ui.PrintView) return;
            if (frappe.ui.PrintView._mw_qz_pdf_patched) return;

            const original = frappe.ui.PrintView.prototype.printit;
            frappe.ui.PrintView.prototype.printit = function () {
                const me = this;
                if (me.get_mapped_printer && me.get_mapped_printer().length === 1) {
                    const printer_map = me.get_mapped_printer()[0];
                    if (me.is_raw_printing && me.is_raw_printing()) {
                        if (!me.get_raw_commands) {
                            return original.call(me);
                        }
                        return frappe.ui.form
                            .qz_connect()
                            .then(
                                () =>
                                    new Promise((resolve) => {
                                        me.get_raw_commands((out) => resolve(out));
                                    })
                            )
                            .then((out) => {
                                const raw_hex = out && out.raw_hex;
                                const raw = (out && out.raw_commands) || "";
                                const data = raw_hex
                                    ? [{ type: "raw", format: "command", flavor: "hex", data: raw_hex }]
                                    : [{ type: "raw", format: "command", flavor: "plain", data: raw }];
                                const config = qz.configs.create(printer_map.printer);
                                return qz.print(config, data);
                            })
                            .then(frappe.ui.form.qz_success)
                            .catch((err) => frappe.ui.form.qz_fail(err));
                    }

                    return me.get_raw_commands
                        ? frappe.ui.form
                              .qz_connect()
                              .then(() => qzPrintPdf(me, printer_map.printer))
                              .then(frappe.ui.form.qz_success)
                              .catch((err) => frappe.ui.form.qz_fail(err))
                        : original.call(me);
                }
                return original.call(me);
            };

            frappe.ui.PrintView._mw_qz_pdf_patched = true;
        };

        $(document).on("app-loaded", ensurePatch);
        setTimeout(ensurePatch, 1000);
    })();

    // Ensure POS uses server-rendered raw commands with QZ when a raw print format is mapped.
    (function patch_utils_print_raw() {
        const get_print_format_printer_map = () => {
            try {
                return JSON.parse(localStorage.print_format_printer_map || "{}");
            } catch (e) {
                return {};
            }
        };

        const get_mapped_printer = (doctype, print_format) => {
            const map = get_print_format_printer_map();
            const list = (map && map[doctype]) || [];
            return list.filter((row) => row.print_format === print_format);
        };

        const is_raw_print_format = (print_format) =>
            new Promise((resolve) => {
                frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Print Format",
                        filters: { name: print_format },
                        fieldname: ["raw_printing"],
                    },
                    callback: (r) => resolve(!!(r.message && cint(r.message.raw_printing))),
                    error: () => resolve(false),
                });
            });

        const fetch_raw_commands = (doctype, docname, print_format) =>
            new Promise((resolve) => {
                const args = {
                    doc: doctype,
                    name: docname,
                    print_format: print_format,
                };

                const fallback = () =>
                    frappe.call({
                        method: "frappe.www.printview.get_rendered_raw_commands",
                        args: args,
                        callback: (r) => resolve(r),
                    });

                frappe.call({
                    method: "medworld_theme.api.get_raw_commands_hex",
                    args: args,
                    callback: (r) => {
                        if (!r.exc && r.message && r.message.raw_hex) {
                            resolve(r);
                        } else {
                            fallback();
                        }
                    },
                    error: fallback,
                });
            });

        const ensurePatch = () => {
            if (!frappe || !frappe.utils || !frappe.utils.print) return;
            if (frappe.utils.print._mw_raw_patched) return;

            const original = frappe.utils.print;
            frappe.utils.print = (doctype, docname, print_format, letterhead, lang_code) => {
                const fallback = () => original(doctype, docname, print_format, letterhead, lang_code);

                if (
                    !print_format ||
                    !frappe.boot ||
                    !frappe.boot.print_settings ||
                    !cint(frappe.boot.print_settings.enable_raw_printing)
                ) {
                    return fallback();
                }

                return is_raw_print_format(print_format)
                    .then((is_raw) => {
                        if (!is_raw) return fallback();

                        const mapped = get_mapped_printer(doctype, print_format);
                        if (!mapped || mapped.length !== 1) return fallback();

                        return frappe.ui.form
                            .qz_connect()
                            .then(() => fetch_raw_commands(doctype, docname, print_format))
                            .then((res) => {
                                const raw_hex = res.message && res.message.raw_hex;
                                const raw = (res.message && res.message.raw_commands) || "";
                                const data = raw_hex
                                    ? [{ type: "raw", format: "command", flavor: "hex", data: raw_hex }]
                                    : [{ type: "raw", format: "command", flavor: "plain", data: raw }];
                                const config = qz.configs.create(mapped[0].printer);
                                return qz.print(config, data);
                            })
                            .then(frappe.ui.form.qz_success)
                            .catch((err) => frappe.ui.form.qz_fail(err));
                    })
                    .catch(() => fallback());
            };

            frappe.utils.print._mw_raw_patched = true;
        };

        $(document).on("app-loaded", ensurePatch);
        setTimeout(ensurePatch, 1000);
    })();

    // View Website should open main site root (medworldyemen.com) instead of /index
    const apply_view_website_root = () => {
        if (frappe?.ui?.toolbar) {
            frappe.ui.toolbar.view_website = () => {
                const win = window.open();
                if (!win) return;
                win.opener = null;
                win.location = "https://medworldyemen.com/";
            };
        }
        // Update fallback href in navbar button if present
        $('a[onclick*="view_website"]').attr("href", "https://medworldyemen.com/");
    };
    $(document).on("toolbar_setup app-loaded page-change", apply_view_website_root);
    setTimeout(apply_view_website_root, 500);

    // Hide Apps and Toggle Full Width icons from navbar (Medworld and default navbars)
    const hide_navbar_quick_actions = () => {
        const $nav = $(".dv-navbar");
        if ($nav.length) {
            $nav.find(".dv-quick-action[title='Apps']").remove();
            $nav.find(".dv-quick-action[title='Toggle Full Width']").remove();
            // Keep the modules button visible
            $nav.find("i.fa-th, i.fa-th-large, i.fa-th-list").closest("li.nav-item").remove();
            $nav.find("i.fa-expand-arrows-alt, i.fa-expand, i.fa-compress").closest("li.nav-item").remove();
            $nav.find(".full-screen-icon").closest("li.nav-item").remove();
            $nav.find("[title='Apps'],[aria-label='Apps'],[title='Toggle Full Width'],[aria-label='Toggle Full Width']").closest("li.nav-item").remove();
        }
        // Also hide any full width toggles from default navbar if present
        $(".navbar-toggle-full-width").remove();
        // Keep the modules button visible
        $("i.fa-th, i.fa-th-large, i.fa-th-list").closest("li.nav-item").remove();
        $("i.fa-expand-arrows-alt, i.fa-expand, i.fa-compress").closest("li.nav-item").remove();
        $(".full-screen-icon").closest("li.nav-item").remove();
        $("[title='Apps'],[aria-label='Apps'],[title='Toggle Full Width'],[aria-label='Toggle Full Width']").closest("li.nav-item").remove();
    };
    $(document).on("toolbar_setup app-loaded page-change", hide_navbar_quick_actions);
    setTimeout(hide_navbar_quick_actions, 800);

})(jQuery);
