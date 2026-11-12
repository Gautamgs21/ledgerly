// ============================================================
//  CORE: shared state, events, toast, utilities and the page router
// ============================================================
(function () {
    'use strict';

    // The four pages. Each one is a self-contained file in /pages.
    const PAGES = {
        'dashboard': 'pages/dashboard.html',
        'new-entry': 'pages/new-entry.html',
        'history':   'pages/history.html',
        'settings':  'pages/settings.html'
    };
    const DEFAULT_PAGE = 'dashboard';

    const App = window.App = {
        // Shared data, read by any page
        state: {
            members: [],          // ['Ananthan', 'Deepak', ...]
            dashboardData: null,  // result of getDashboardData
            user: null            // logged-in user { name, userId, privilege }
        },
        pages: {},      // controllers returned by each loaded page
        current: null,  // name of the page currently shown
        util: {}
    };

    // ------------------------------------------------------------
    //  Tiny event bus  (pages talk to each other through this)
    //    'members'     members list changed
    //    'dashboard'   dashboard data changed
    //    'auth'        user logged in
    //    'tx-changed'  a transaction was added or deleted
    // ------------------------------------------------------------
    const listeners = {};
    App.on = function (event, fn) { (listeners[event] = listeners[event] || []).push(fn); };
    App.emit = function (event, data) {
        (listeners[event] || []).forEach(fn => {
            try { fn(data); } catch (e) { console.error('[' + event + ']', e); }
        });
    };

    // ------------------------------------------------------------
    //  Utilities
    // ------------------------------------------------------------
    App.util.getTodayStr = function () {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };

    App.util.escapeHtml = function (str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    };

    App.util.getColorForName = function (name) {
        const colors = ['#4F46E5', '#7C3AED', '#EC4899', '#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#14B8A6', '#8B5CF6', '#F97316'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    // ------------------------------------------------------------
    //  Toast
    // ------------------------------------------------------------
    App.toast = function (message, type, duration) {
        type = type || 'info';
        duration = duration || 2800;
        const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
        const el = document.createElement('div');
        el.className = 'toast ' + type;
        const icon = document.createElement('i');
        icon.className = 'fas ' + (icons[type] || icons.info);
        const text = document.createElement('span');
        text.textContent = message;
        el.append(icon, text);
        document.getElementById('toastContainer').appendChild(el);
        setTimeout(() => {
            el.classList.add('removing');
            setTimeout(() => el.remove(), 300);
        }, duration);
    };

    // ------------------------------------------------------------
    //  Shared data loaders (used by several pages)
    // ------------------------------------------------------------
    App.loadDashboard = async function () {
        const data = await App.api('getDashboardData');
        App.state.dashboardData = data;
        App.state.members = data.members.map(m => m.name);
        App.emit('dashboard', data);
        App.emit('members', App.state.members);
        return data;
    };

    App.loadMembers = async function () {
        const data = await App.api('getMembers');
        App.state.members = data;
        App.emit('members', data);
        return data;
    };

    // ------------------------------------------------------------
    //  Page loader: fetch pages/x.html once, mount it into #pageHost
    // ------------------------------------------------------------
    // A page file contains markup, an optional <style>, and ONE <script>.
    // The script body runs inside a function that receives `root`
    // (the page's own <section>) and should `return` a controller:
    //     return { onShow() {...}, onHide() {...} };
    // so pages never leak variables into each other.
    const loading = {};

    function mountPage(name, html) {
        const host = document.getElementById('pageHost');
        const tpl = document.createElement('template');
        tpl.innerHTML = html;

        const scripts = Array.from(tpl.content.querySelectorAll('script'));
        const codes = scripts.map(s => s.textContent);
        scripts.forEach(s => s.remove());

        const root = document.createElement('section');
        root.className = 'page';
        root.id = 'page-' + name;
        root.appendChild(tpl.content);
        host.appendChild(root);

        codes.forEach(code => {
            const s = document.createElement('script');
            s.textContent =
                'App.pages[' + JSON.stringify(name) + '] = (function (root) {\n"use strict";\n' +
                code +
                '\n})(document.getElementById(' + JSON.stringify('page-' + name) + '));\n' +
                '//# sourceURL=pages/' + name + '.js';
            document.body.appendChild(s);
            s.remove();
        });

        App.pages[name] = App.pages[name] || {};
        return App.pages[name];
    }

    App.loadPage = function (name) {
        if (!loading[name]) {
            loading[name] = fetch(PAGES[name], { cache: 'no-cache' })
                .then(res => {
                    if (!res.ok) throw new Error('HTTP ' + res.status + ' loading ' + PAGES[name]);
                    return res.text();
                })
                .then(html => mountPage(name, html))
                .catch(err => { delete loading[name]; throw err; });
        }
        return loading[name];
    };

    // ------------------------------------------------------------
    //  Router
    // ------------------------------------------------------------
    function setStatus(html) {
        const el = document.getElementById('pageStatus');
        if (!html) { el.hidden = true; el.innerHTML = ''; return; }
        el.innerHTML = html;
        el.hidden = false;
    }

    function showRoot(name) {
        document.querySelectorAll('#pageHost > .page').forEach(p => {
            p.classList.toggle('active', p.id === 'page-' + name);
        });
    }

    App.go = async function (name) {
        if (!PAGES[name] || App.current === name) return;

        // Leave the old page
        const leaving = App.pages[App.current];
        if (leaving && leaving.onHide) leaving.onHide();

        App.current = name;
        document.querySelectorAll('.nav-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.page === name);
        });
        showRoot(null);

        // Load (first time only) the new page
        let page;
        if (!App.pages[name]) {
            setStatus('<i class="fas fa-spinner fa-spin"></i><span>Loading...</span>');
        }
        try {
            page = await App.loadPage(name);
        } catch (err) {
            console.error(err);
            if (App.current === name) {
                setStatus(
                    '<i class="fas fa-triangle-exclamation"></i>' +
                    '<span>Could not load this page.</span>' +
                    '<button class="btn btn-outline btn-sm" id="retryPageBtn"><i class="fas fa-rotate-right"></i> Retry</button>'
                );
                document.getElementById('retryPageBtn').onclick = () => { App.current = null; App.go(name); };
            }
            return;
        }
        if (App.current !== name) return;   // user already moved on

        setStatus('');
        showRoot(name);
        if (page.onShow) {
            try { await page.onShow(); } catch (e) { console.error(e); }
        }
    };

    // ------------------------------------------------------------
    //  Start
    // ------------------------------------------------------------
    App.start = async function () {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => App.go(btn.dataset.page));
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            App.loadDashboard().catch(() => {});
            App.toast('Refreshed', 'info', 1200);
        });

        // Prevent double-tap zoom on iOS
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) e.preventDefault();
            lastTouchEnd = now;
        }, { passive: false });

        try {
            await App.go(DEFAULT_PAGE);
        } finally {
            const splash = document.getElementById('splashScreen');
            if (splash) splash.style.display = 'none';
            App.auth.init();   // after members are loaded, so the login list is filled
        }

        // Quietly fetch the other pages so tab switches feel instant
        setTimeout(() => {
            Object.keys(PAGES).forEach(n => App.loadPage(n).catch(() => {}));
        }, 500);

        console.log('💰 LEDGERLY initialized');
    };
})();
