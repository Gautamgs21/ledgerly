// ============================================================
//  DEMO BACKEND (in-memory sample data)
//  Used only when APP_CONFIG.API_BASE_URL is empty.
//  Mirrors the behaviour of the old Code.gs so the UI can be tried
//  and developed without any server. Data resets on page reload.
//  Demo PINs:  Ananthan 1995 | Deepak 8854 | Gautam 2104 (admin)
// ============================================================
(function () {
    'use strict';

    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const hm = (d) => {
        const h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM';
        return pad(((h + 11) % 12) + 1) + ':' + pad(d.getMinutes()) + ' ' + ap;
    };

    let members = [
        { name: 'Ananthan', userId: 'ANA_01', pin: '1995', privilege: 'user' },
        { name: 'Deepak',   userId: 'DEE_02', pin: '8854', privilege: 'user' },
        { name: 'Gautam',   userId: 'GAU_03', pin: '2104', privilege: 'admin' }
    ];

    // Seed ~100 days of sample transactions
    let tx = [];
    (function seed() {
        const now = new Date();
        const cats = ['Tea', 'Tea', 'Tea', 'Snacks', 'Food', 'Travel'];
        for (let i = 100; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 16, 30);
            if (d.getDay() === 0) continue;
            members.forEach((m, idx) => {
                tx.push({
                    time: hm(d), date: ymd(d), person: m.name, type: 'Debit',
                    category: cats[(i + idx) % cats.length], amount: 20 + ((i * 7 + idx * 13) % 45),
                    notes: '', registrar: 'Gautam (GAU_03)'
                });
            });
            if (i % 20 === 0) {
                members.forEach(m => tx.push({
                    time: hm(d), date: ymd(d), person: m.name, type: 'Credit',
                    category: 'Top Up', amount: 500, notes: '', registrar: 'Gautam (GAU_03)'
                }));
            }
        }
    })();

    const ok = (message, extra) => Object.assign({ success: true, message: message }, extra || {});
    const fail = (message) => ({ success: false, message: message });
    const lc = (s) => String(s || '').trim().toLowerCase();

    const handlers = {
        getMembers() { return members.map(m => m.name); },

        addMember(name) {
            const t = String(name || '').trim();
            if (!t) return fail('Name cannot be empty.');
            if (members.some(m => lc(m.name) === lc(t))) return fail(`"${t}" already exists.`);
            members.push({ name: t, userId: t.slice(0, 3).toUpperCase() + '_' + pad(members.length + 1), pin: '0000', privilege: 'user' });
            return ok(`"${t}" added successfully!`);
        },

        deleteMember(name) {
            const i = members.findIndex(m => lc(m.name) === lc(name));
            if (i === -1) return fail(`"${name}" not found.`);
            members.splice(i, 1);
            return ok(`"${name}" removed.`);
        },

        addTransaction(d) {
            const amount = parseFloat(d.amount) || 0;
            if (!d.person || amount <= 0) return fail('Invalid transaction data.');
            const now = new Date();
            tx.push({
                time: hm(now), date: d.date || ymd(now), person: d.person, type: d.type || 'Debit',
                category: d.category || 'General', amount: amount, notes: d.notes || '', registrar: d.registrar || 'System'
            });
            return ok('Transaction added successfully!');
        },

        addBulkTransactions(payload) {
            const list = Array.isArray(payload) ? payload : payload.transactions;
            const reg = payload.registrar || 'System';
            if (!list || !list.length) return fail('No transactions provided.');
            const now = new Date();
            let n = 0;
            list.forEach(d => {
                const amount = parseFloat(d.amount) || 0;
                if (!d.person || amount <= 0) return;
                tx.push({
                    time: hm(now), date: d.date || ymd(now), person: d.person, type: d.type || 'Debit',
                    category: d.category || 'Tea', amount: amount, notes: d.notes || '', registrar: d.registrar || reg
                });
                n++;
            });
            if (!n) return fail('No valid transactions to record.');
            return ok(`Added ${n} transactions successfully!`);
        },

        getDashboardData() {
            const names = members.map(m => m.name);
            const balances = {}; names.forEach(n => balances[n] = 0);
            const categoryTotals = {};
            const now = new Date();
            const monthsList = [];
            const monthly = { ALL: {} };
            names.forEach(n => monthly[n] = {});
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = d.getFullYear() + '-' + pad(d.getMonth() + 1);
                monthsList.push({ key: key, label: d.toLocaleString('en', { month: 'short' }) });
                monthly.ALL[key] = 0;
                names.forEach(n => monthly[n][key] = 0);
            }
            tx.forEach(t => {
                const key = String(t.date).substring(0, 7);
                if (balances.hasOwnProperty(t.person)) {
                    if (t.type === 'Debit') {
                        balances[t.person] -= t.amount;
                        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
                    } else if (t.type === 'Credit') {
                        balances[t.person] += t.amount;
                    }
                }
                if (t.type === 'Debit' && monthly.ALL.hasOwnProperty(key)) {
                    monthly.ALL[key] += t.amount;
                    if (monthly.hasOwnProperty(t.person)) monthly[t.person][key] += t.amount;
                }
            });
            let totalDebit = 0, totalCredit = 0;
            names.forEach(n => { if (balances[n] < 0) totalDebit += -balances[n]; else totalCredit += balances[n]; });
            return {
                members: names.map(n => ({ name: n, balance: balances[n] })),
                categories: Object.keys(categoryTotals).map(c => ({ category: c, amount: categoryTotals[c] })).sort((a, b) => b.amount - a.amount),
                summary: { totalDebit: totalDebit, totalCredit: totalCredit, netBalance: totalCredit - totalDebit },
                monthly: { monthsList: monthsList, data: monthly }
            };
        },

        getTransactionHistory(filters) {
            filters = filters || {};
            const p = lc(filters.person), dt = filters.date ? String(filters.date).trim() : '';
            return tx
                .map((t, i) => Object.assign({ row: i + 2 }, t))     // row number like a sheet row
                .filter(t => (!p || lc(t.person) === p) && (!dt || t.date === dt))
                .sort((a, b) => b.row - a.row)
                .slice(0, 30);
        },

        deleteTransaction(row) {
            if (row < 2 || row > tx.length + 1) return fail('Transaction not found.');
            tx.splice(row - 2, 1);
            return ok('Transaction deleted successfully!');
        },

        deleteBulkTransactions(rows) {
            if (!rows || !rows.length) return fail('No transactions selected.');
            const sorted = rows.map(Number).sort((a, b) => b - a);
            let count = 0;
            sorted.forEach(r => { if (r >= 2 && r <= tx.length + 1) { tx.splice(r - 2, 1); count++; } });
            return ok(`Successfully deleted ${count} transaction(s)!`);
        },

        verifyPin(name, pin) {
            if (!name || !pin) return fail('Please enter both name and PIN.');
            const m = members.find(x => lc(x.name) === lc(name));
            if (!m) return fail('User not found.');
            if (m.pin !== String(pin).trim()) return fail('Incorrect PIN.');
            return { success: true, user: { name: m.name, userId: m.userId, privilege: m.privilege } };
        },

        updateMember(p) {
            const newName = String(p.newName || '').trim();
            if (!newName) return fail('Name cannot be empty.');
            if (!p.currentPin) return fail('Current PIN is required.');
            const requester = members.find(m => lc(m.name) === lc(p.requesterName));
            const isSelf = lc(p.requesterName) === lc(p.oldName);
            const isAdmin = requester && requester.privilege === 'admin';
            if (!isSelf && !isAdmin) return fail('Only Admin users can edit other members.');
            const target = members.find(m => lc(m.name) === lc(p.oldName));
            if (!target) return fail('Member not found.');
            if (target.pin !== String(p.currentPin).trim()) return fail('Current PIN is incorrect.');
            const oldName = target.name;
            target.name = newName;
            if (p.newPin) target.pin = String(p.newPin).trim();
            if (lc(oldName) !== lc(newName)) tx.forEach(t => { if (lc(t.person) === lc(oldName)) t.person = newName; });
            return ok('Member details updated successfully!');
        }
    };

    window.MockAPI = {
        call(fn, args) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (!handlers[fn]) return reject(new Error('Unknown function: ' + fn));
                    try { resolve(JSON.parse(JSON.stringify(handlers[fn].apply(null, args)))); }
                    catch (e) { reject(e); }
                }, 120);
            });
        }
    };
})();
