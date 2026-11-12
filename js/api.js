// ============================================================
//  API LAYER  -  the ONLY file that talks to the backend
// ============================================================
//  Usage from any page:
//      const result = await App.api('addMember', 'Ravi');
//      const result = await App.api('verifyPin', name, pin);
//
//  Function names and arguments match the old Code.gs functions, so the
//  backend only has to expose one endpoint:
//      POST  {API_BASE_URL}/rpc      body: { "fn": "addMember", "args": ["Ravi"] }
//      reply: the JSON the old function returned
//
//  When APP_CONFIG.API_BASE_URL is empty, an in-memory demo backend
//  (js/mock-api.js) is used instead.
// ============================================================
(function () {
    'use strict';

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Could not load ' + src));
            document.head.appendChild(s);
        });
    }

    let demoNoticeShown = false;

    async function transport(fn, args) {
        const base = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL || '').replace(/\/+$/, '');

        // Demo mode
        if (!base) {
            if (!window.MockAPI) await loadScript('js/mock-api.js');
            if (!demoNoticeShown) {
                demoNoticeShown = true;
                App.toast('Demo mode: sample data (no API configured)', 'info', 3500);
            }
            return window.MockAPI.call(fn, args);
        }

        // Real backend
        const res = await fetch(base + '/rpc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fn: fn, args: args })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    }

    // Resolves with the backend result. On failure shows a toast and rejects.
    App.api = async function (fn /*, ...args */) {
        const args = Array.prototype.slice.call(arguments, 1)
            .filter((a, i, all) => !(a === undefined && i === all.length - 1));
        try {
            return await transport(fn, args);
        } catch (err) {
            console.error(fn + ' error:', err);
            App.toast('Something went wrong. Please try again.', 'error');
            throw err;
        }
    };
})();
