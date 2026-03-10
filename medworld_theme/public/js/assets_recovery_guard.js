/*
 * Recover once when critical Desk assets fail to load.
 * This prevents occasional blank/unstyled screens after refresh/login.
 */
(function () {
    "use strict";

    if (window.__mw_asset_recovery_guard_installed) {
        return;
    }
    window.__mw_asset_recovery_guard_installed = true;

    if (!window.location.pathname.startsWith("/app")) {
        return;
    }

    const STORAGE_KEY = "__mw_asset_recovery_state";
    const WINDOW_MS = 120000;
    const MAX_RECOVERIES = 1;
    let recoveryScheduled = false;

    function readState() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return { ts: 0, count: 0 };
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") return { ts: 0, count: 0 };
            return {
                ts: Number(parsed.ts) || 0,
                count: Number(parsed.count) || 0
            };
        } catch (e) {
            return { ts: 0, count: 0 };
        }
    }

    function writeState(state) {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            // ignore storage errors
        }
    }

    function canRecoverNow() {
        const now = Date.now();
        const state = readState();
        if (!state.ts || now - state.ts > WINDOW_MS) {
            writeState({ ts: now, count: 0 });
            return true;
        }
        return state.count < MAX_RECOVERIES;
    }

    function markRecovery() {
        const now = Date.now();
        const state = readState();
        if (!state.ts || now - state.ts > WINDOW_MS) {
            writeState({ ts: now, count: 1 });
            return;
        }
        writeState({ ts: state.ts, count: state.count + 1 });
    }

    function scheduleRecovery(reason) {
        if (recoveryScheduled) return;
        if (!navigator.onLine) return;
        if (!canRecoverNow()) return;
        recoveryScheduled = true;
        markRecovery();

        try {
            if (window.frappe && frappe.assets && frappe.assets.clear_local_storage) {
                frappe.assets.clear_local_storage();
            }
        } catch (e) {
            // ignore
        }

        const url = new URL(window.location.href);
        url.searchParams.set("_asset_recover", Date.now().toString());
        if (reason) {
            url.searchParams.set("_asset_reason", reason);
        }
        window.location.replace(url.toString());
    }

    function isDeskAsset(url) {
        if (!url || typeof url !== "string") return false;
        if (!url.includes("/assets/")) return false;
        return /\.(css|js)(\?|$)/i.test(url);
    }

    window.addEventListener(
        "error",
        function (event) {
            const target = event && event.target;
            if (!target) return;
            const tag = (target.tagName || "").toUpperCase();
            if (tag !== "LINK" && tag !== "SCRIPT") return;

            const failingUrl = target.href || target.src || "";
            if (!isDeskAsset(failingUrl)) return;
            scheduleRecovery("asset-load-failed");
        },
        true
    );
})();
