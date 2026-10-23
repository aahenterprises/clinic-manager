const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const pretty = t => { const h = +t.slice(0, 2); return ((h + 11) % 12 + 1) + ':' + t.slice(3) + (h >= 12 ? ' PM' : ' AM'); };

const TIMES = [];
for (let h = 9; h < 18; h++) ['00', '30'].forEach(m => TIMES.push(pad(h) + ':' + m));

let setupMode = false, patients = [], allPatients = [], doctors = [], editPatientId = null;

window.addEventListener('load', () => setTimeout(() => $('loader').classList.add('hide'), 1800));

async function api(path, method, body) {
    const r = await fetch('/api' + path, {
        method: method || 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await r.json(); } catch (e) {}
    if (r.status === 401 && path !== '/login') showAuth(true);
    if (!r.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
}

// ---------- login / setup ----------
function showAuth(hasUsers) {
    setupMode = !hasUsers;
    $('appView').classList.add('hidden');
    $('logoutBtn').classList.add('hidden');
    $('authView').classList.remove('hidden');
    $('authTitle').textContent = setupMode ? 'Create admin account' : 'Log in';
    $('authSub').textContent = setupMode
        ? 'First time here. Create the account you will use to log in (password: at least 8 characters).'
        : 'Log in to manage patients and appointments.';
    $('authBtn').textContent = setupMode ? 'Create account' : 'Log in';
}

async function doAuth() {
    $('authError').textContent = '';
    try {
        await api(setupMode ? '/setup' : '/login', 'POST', { email: $('email').value, password: $('password').value });
        $('password').value = '';
        init();
    } catch (e) { $('authError').textContent = e.message; }
}
$('authBtn').addEventListener('click', doAuth);
$('password').addEventListener('keydown', e => { if (e.key === 'Enter') doAuth(); });
$('logoutBtn').addEventListener('click', async () => { await api('/logout', 'POST', {}); showAuth(true); });

async function init() {
    const s = await api('/status');
    if (!s.loggedIn) return showAuth(s.hasUsers);
    $('authView').classList.add('hidden');
    $('appView').classList.remove('hidden');
    $('logoutBtn').classList.remove('hidden');
    await Promise.all([loadPatients(), loadDoctors()]);
    loadAppts(); loadDash();
}

// ---------- tabs ----------
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
    ['dash', 'patients', 'appts', 'doctors'].forEach(t => $('tab-' + t).classList.toggle('hidden', t !== b.dataset.tab));
    if (b.dataset.tab === 'dash') loadDash();
    if (b.dataset.tab === 'appts') loadAppts();
}));

// ---------- dashboard ----------
async function loadDash() {
    try {
        const s = await api('/stats');
        $('kPatients').textContent = s.patients; $('kToday').textContent = s.today;
        $('kScheduled').textContent = s.scheduled; $('kCompleted').textContent = s.completed;
        const list = await api('/appointments?date=' + today());
        draw($('todayList'), list.filter(a => a.status !== 'Cancelled'), 'No appointments today.');
    } catch (e) {}
}

// ---------- patients ----------
async function loadPatients() {
    [patients, allPatients] = await Promise.all([
        api('/patients?q=' + encodeURIComponent($('pSearch').value.trim())),
        api('/patients')
    ]);
    renderPatients(); fillSelects();
}
$('pSearch').addEventListener('input', () => loadPatients().catch(() => {}));

function renderPatients() {
    const box = $('patientList'); box.innerHTML = '';
    if (!patients.length) { box.appendChild(el('p', 'note', 'No patients found.')); return; }
    patients.forEach(p => {
        const row = el('div', 'row');
        const info = el('div');
        info.append(el('b', '', p.name),
            el('span', '', [p.phone, p.age != null ? p.age + ' yrs' : '', p.gender || ''].filter(Boolean).join(' \u2022 ')));
        if (p.notes) info.appendChild(el('small', '', p.notes));
        const side = el('div', 'side');
        const edit = el('button', 'ghost small', 'Edit'); edit.type = 'button';
        edit.addEventListener('click', () => {
            editPatientId = p.id;
            $('pName').value = p.name; $('pPhone').value = p.phone; $('pAge').value = p.age != null ? p.age : '';
            $('pGender').value = p.gender || ''; $('pNotes').value = p.notes || '';
            $('pFormTitle').textContent = 'Edit patient'; $('pSave').textContent = 'Save changes';
            $('pCancel').classList.remove('hidden'); $('pName').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        const del = el('button', 'danger small', 'Delete'); del.type = 'button';
        del.addEventListener('click', async () => {
            if (!confirm('Delete ' + p.name + ' and all their appointments?')) return;
            try { await api('/patients/' + p.id, 'DELETE'); await loadPatients(); loadAppts(); } catch (e) { alert(e.message); }
        });
        side.append(edit, del); row.append(info, side); box.appendChild(row);
    });
}

function resetPatientForm() {
    editPatientId = null;
    ['pName', 'pPhone', 'pAge', 'pNotes'].forEach(i => $(i).value = ''); $('pGender').value = '';
    $('pFormTitle').textContent = 'Add a patient'; $('pSave').textContent = 'Add patient';
    $('pCancel').classList.add('hidden');
}
$('pCancel').addEventListener('click', resetPatientForm);
$('pSave').addEventListener('click', async () => {
    $('pMsg').textContent = '';
    const body = { name: $('pName').value, phone: $('pPhone').value, age: $('pAge').value, gender: $('pGender').value, notes: $('pNotes').value };
    try {
        if (editPatientId) await api('/patients/' + editPatientId, 'PUT', body);
        else await api('/patients', 'POST', body);
        resetPatientForm(); await loadPatients(); loadAppts();
    } catch (e) { $('pMsg').textContent = e.message; }
});

// ---------- doctors ----------
async function loadDoctors() { doctors = await api('/doctors'); renderDoctors(); fillSelects(); }
function renderDoctors() {
    const box = $('doctorList'); box.innerHTML = '';
    if (!doctors.length) { box.appendChild(el('p', 'note', 'No doctors yet. Add one above before booking appointments.')); return; }
    doctors.forEach(d => {
        const row = el('div', 'row');
        const info = el('div'); info.append(el('b', '', d.name), el('span', '', d.speciality));
        const del = el('button', 'danger small', 'Delete'); del.type = 'button';
        del.addEventListener('click', async () => {
            if (!confirm('Delete ' + d.name + ' and their appointments?')) return;
            try { await api('/doctors/' + d.id, 'DELETE'); await loadDoctors(); loadAppts(); } catch (e) { alert(e.message); }
        });
        row.append(info, del); box.appendChild(row);
    });
}
$('dSave').addEventListener('click', async () => {
    $('dMsg').textContent = '';
    try {
        await api('/doctors', 'POST', { name: $('dName').value, speciality: $('dSpec').value });
        $('dName').value = ''; $('dSpec').value = ''; await loadDoctors();
    } catch (e) { $('dMsg').textContent = e.message; }
});

// ---------- appointments ----------
function fillSelects() {
    const fill = (sel, items, label) => {
        const keep = sel.value; sel.innerHTML = '';
        if (!items.length) { const o = el('option', '', label); o.value = ''; sel.appendChild(o); return; }
        items.forEach(i => { const o = el('option', '', i.text); o.value = i.value; sel.appendChild(o); });
        if (keep) sel.value = keep;
    };
    fill($('aPatient'), allPatients.map(p => ({ value: p.id, text: p.name })), 'Add a patient first');
    fill($('aDoctor'), doctors.map(d => ({ value: d.id, text: d.name + ' (' + d.speciality + ')' })), 'Add a doctor first');
    fill($('aTime'), TIMES.map(t => ({ value: t, text: pretty(t) })), '');
}
$('aDate').value = today(); $('aDate').min = today();

$('aSave').addEventListener('click', async () => {
    $('aMsg').className = 'error'; $('aMsg').textContent = '';
    try {
        await api('/appointments', 'POST', {
            patient_id: $('aPatient').value, doctor_id: $('aDoctor').value,
            date: $('aDate').value, time: $('aTime').value, reason: $('aReason').value
        });
        $('aReason').value = '';
        $('aMsg').className = 'ok'; $('aMsg').textContent = 'Appointment booked.';
        loadAppts();
    } catch (e) { $('aMsg').textContent = e.message; }
});

['aSearch', 'aStatus', 'aFilterDate'].forEach(id => {
    $(id).addEventListener('input', () => loadAppts());
    $(id).addEventListener('change', () => loadAppts());
});

async function loadAppts() {
    const qs = '?q=' + encodeURIComponent($('aSearch').value.trim()) +
        '&status=' + encodeURIComponent($('aStatus').value) + '&date=' + encodeURIComponent($('aFilterDate').value);
    try { draw($('apptList'), await api('/appointments' + qs), 'No appointments found.'); } catch (e) {}
}

function draw(box, list, emptyText) {
    box.innerHTML = '';
    if (!list.length) { box.appendChild(el('p', 'note', emptyText)); return; }
    list.forEach(a => {
        const row = el('div', 'row');
        const info = el('div');
        info.append(el('b', '', a.date + ' \u2022 ' + pretty(a.time)),
            el('span', '', a.patient + ' with ' + a.doctor + ' (' + a.speciality + ')'),
            el('small', '', [a.phone, a.reason].filter(Boolean).join(' \u2022 ')));
        const side = el('div', 'side');
        side.appendChild(el('span', 'badge ' + a.status.toLowerCase(), a.status));
        const act = (label, cls, fn) => { const b = el('button', cls + ' small', label); b.type = 'button'; b.addEventListener('click', fn); side.appendChild(b); };
        const setStatus = async s => {
            try { await api('/appointments/' + a.id, 'PUT', { status: s }); loadAppts(); loadDash(); } catch (e) { alert(e.message); }
        };
        if (a.status === 'Scheduled') act('Complete', '', () => setStatus('Completed'));
        if (a.status === 'Scheduled') act('Cancel', 'ghost', () => setStatus('Cancelled'));
        act('Delete', 'danger', async () => {
            if (!confirm('Delete this appointment?')) return;
            try { await api('/appointments/' + a.id, 'DELETE'); loadAppts(); loadDash(); } catch (e) { alert(e.message); }
        });
        row.append(info, side); box.appendChild(row);
    });
}

init();