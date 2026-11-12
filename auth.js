// ============================================================
//  AUTH: PIN login (global modal, sits above every page)
// ============================================================
(function () {
    'use strict';

    const USER_KEY = 'chaya_patt_user';
    const DATE_KEY = 'chaya_patt_login_date';
    const { escapeHtml, getTodayStr } = App.util;

    const modal = document.getElementById('pinModal');
    const nameSelect = document.getElementById('loginNameSelect');
    const pinInput = document.getElementById('loginPinInput');
    const submitBtn = document.getElementById('loginSubmitBtn');
    const SUBMIT_HTML = '<i class="fas fa-key"></i> Unlock &amp; Register';

    function populateNames() {
        const current = nameSelect.value;
        let html = '<option value="">Select your name...</option>';
        App.state.members.forEach(m => {
            html += `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`;
        });
        nameSelect.innerHTML = html;
        if (current && App.state.members.includes(current)) nameSelect.value = current;
    }

    function saveUser() {
        try {
            localStorage.setItem(USER_KEY, JSON.stringify(App.state.user));
            localStorage.setItem(DATE_KEY, getTodayStr());
        } catch (e) {}
    }

    function showLogin() {
        modal.style.display = 'flex';
        populateNames();
    }

    // Logged in today? Keep going. New day (past 12 AM) or new device? Ask for PIN.
    function init() {
        let storedUser = null, storedDate = null;
        try {
            storedUser = JSON.parse(localStorage.getItem(USER_KEY));
            storedDate = localStorage.getItem(DATE_KEY);
        } catch (e) {}

        if (storedUser && storedDate === getTodayStr()) {
            App.state.user = storedUser;
            modal.style.display = 'none';
            App.toast(`Welcome back, ${storedUser.name}!`, 'info', 1500);
            App.emit('auth', storedUser);
        } else {
            try {
                localStorage.removeItem(USER_KEY);
                localStorage.removeItem(DATE_KEY);
            } catch (e) {}
            App.state.user = null;
            showLogin();
        }
    }

    async function submit() {
        const name = nameSelect.value;
        const pin = pinInput.value.trim();
        if (!name || !pin) {
            App.toast('Please select your name and enter PIN.', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        try {
            const res = await App.api('verifyPin', name, pin);
            if (res.success) {
                App.state.user = res.user;
                saveUser();
                modal.style.display = 'none';
                pinInput.value = '';
                App.toast(`Welcome, ${res.user.name}!`, 'success');
                App.emit('auth', res.user);
            } else {
                App.toast(res.message, 'error');
            }
        } catch (e) {
            // api.js already showed the error toast
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = SUBMIT_HTML;
        }
    }

    submitBtn.addEventListener('click', submit);
    pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    App.on('members', populateNames);

    App.auth = { init: init, showLogin: showLogin, saveUser: saveUser };
})();
