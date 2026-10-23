const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

const db = new Database(path.join(__dirname, 'clinic.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  notes TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  speciality TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Scheduled'
);
CREATE UNIQUE INDEX IF NOT EXISTS one_slot
  ON appointments(doctor_id, date, time) WHERE status != 'Cancelled';
`);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));
app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
    next();
});
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------
const STATUSES = ['Scheduled', 'Completed', 'Cancelled'];
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const pad = n => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

function getCookie(req, name) {
    for (const part of (req.headers.cookie || '').split(';')) {
        const [k, ...v] = part.trim().split('=');
        if (k === name) return decodeURIComponent(v.join('='));
    }
    return null;
}
function currentUser(req) {
    const t = getCookie(req, 'sid');
    if (!t) return null;
    const s = db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?').get(t, Date.now());
    return s ? s.user_id : null;
}
function auth(req, res, next) {
    const id = currentUser(req);
    if (!id) return res.status(401).json({ error: 'Please log in.' });
    req.userId = id;
    next();
}
function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const ttl = 7 * 24 * 3600 * 1000;
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, Date.now() + ttl);
    res.append('Set-Cookie', 'sid=' + token + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + ttl / 1000 +
        (process.env.NODE_ENV === 'production' ? '; Secure' : ''));
}
function dbError(res, e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'This doctor already has an appointment at that date and time.' });
    if (e.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(400).json({ error: 'Patient or doctor not found.' });
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
}

// simple login rate limit
const attempts = new Map();
const recent = ip => { const now = Date.now(); const a = (attempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000); attempts.set(ip, a); return a; };
const DUMMY = bcrypt.hashSync('dummy-password', 10);

// ---------- account ----------
app.get('/api/status', (req, res) => {
    res.json({ hasUsers: db.prepare('SELECT COUNT(*) AS c FROM users').get().c > 0, loggedIn: !!currentUser(req) });
});

app.post('/api/setup', (req, res) => {
    if (db.prepare('SELECT COUNT(*) AS c FROM users').get().c > 0) return res.status(403).json({ error: 'Setup is already done.' });
    const email = clean(req.body.email, 120).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const info = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, bcrypt.hashSync(password, 10));
    startSession(res, info.lastInsertRowid);
    res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
    const a = recent(req.ip);
    if (a.length >= 10) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    const email = clean(req.body.email, 120).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const u = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
    const ok = bcrypt.compareSync(password, u ? u.password_hash : DUMMY) && !!u;
    if (!ok) { a.push(Date.now()); return res.status(401).json({ error: 'Wrong email or password.' }); }
    startSession(res, u.id);
    res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
    const t = getCookie(req, 'sid');
    if (t) db.prepare('DELETE FROM sessions WHERE token = ?').run(t);
    res.append('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.json({ ok: true });
});

// ---------- dashboard ----------
app.get('/api/stats', auth, (req, res) => {
    res.json(db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM patients) AS patients,
      (SELECT COUNT(*) FROM appointments WHERE date = ? AND status != 'Cancelled') AS today,
      (SELECT COUNT(*) FROM appointments WHERE status = 'Scheduled') AS scheduled,
      (SELECT COUNT(*) FROM appointments WHERE status = 'Completed') AS completed
  `).get(todayStr()));
});

// ---------- patients ----------
function patientData(b) {
    const name = clean(b.name, 80), phone = clean(b.phone, 30);
    if (!name || !phone) return null;
    let age = parseInt(b.age, 10);
    if (!(age >= 0 && age <= 130)) age = null;
    const gender = ['Male', 'Female', 'Other'].includes(b.gender) ? b.gender : null;
    return { name, phone, age, gender, notes: clean(b.notes, 500) };
}
app.get('/api/patients', auth, (req, res) => {
    const q = '%' + clean(req.query.q, 60) + '%';
    res.json(db.prepare('SELECT * FROM patients WHERE name LIKE ? OR phone LIKE ? ORDER BY name').all(q, q));
});
app.post('/api/patients', auth, (req, res) => {
    const p = patientData(req.body);
    if (!p) return res.status(400).json({ error: 'Name and phone are required.' });
    db.prepare('INSERT INTO patients (name, phone, age, gender, notes) VALUES (?, ?, ?, ?, ?)').run(p.name, p.phone, p.age, p.gender, p.notes);
    res.json({ ok: true });
});
app.put('/api/patients/:id', auth, (req, res) => {
    const p = patientData(req.body);
    if (!p) return res.status(400).json({ error: 'Name and phone are required.' });
    db.prepare('UPDATE patients SET name = ?, phone = ?, age = ?, gender = ?, notes = ? WHERE id = ?')
        .run(p.name, p.phone, p.age, p.gender, p.notes, req.params.id);
    res.json({ ok: true });
});
app.delete('/api/patients/:id', auth, (req, res) => {
    db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

// ---------- doctors ----------
app.get('/api/doctors', auth, (req, res) => {
    res.json(db.prepare('SELECT * FROM doctors ORDER BY name').all());
});
app.post('/api/doctors', auth, (req, res) => {
    const name = clean(req.body.name, 80), speciality = clean(req.body.speciality, 60);
    if (!name || !speciality) return res.status(400).json({ error: 'Name and speciality are required.' });
    db.prepare('INSERT INTO doctors (name, speciality) VALUES (?, ?)').run(name, speciality);
    res.json({ ok: true });
});
app.delete('/api/doctors/:id', auth, (req, res) => {
    db.prepare('DELETE FROM doctors WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

// ---------- appointments ----------
app.get('/api/appointments', auth, (req, res) => {
    const q = '%' + clean(req.query.q, 60) + '%';
    const status = STATUSES.includes(req.query.status) ? req.query.status : '';
    const date = isDate(req.query.date || '') ? req.query.date : '';
    res.json(db.prepare(`
    SELECT a.id, a.date, a.time, a.reason, a.status,
           p.name AS patient, p.phone, d.name AS doctor, d.speciality
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors  d ON d.id = a.doctor_id
    WHERE (? = '' OR a.status = ?)
      AND (? = '' OR a.date = ?)
      AND (p.name LIKE ? OR p.phone LIKE ? OR d.name LIKE ?)
    ORDER BY a.date, a.time
  `).all(status, status, date, date, q, q, q));
});
app.post('/api/appointments', auth, (req, res) => {
    const b = req.body;
    const patient_id = parseInt(b.patient_id, 10), doctor_id = parseInt(b.doctor_id, 10);
    if (!patient_id || !doctor_id || !isDate(b.date || '') || !isTime(b.time || ''))
        return res.status(400).json({ error: 'Choose patient, doctor, date and time.' });
    try {
        db.prepare('INSERT INTO appointments (patient_id, doctor_id, date, time, reason) VALUES (?, ?, ?, ?, ?)')
            .run(patient_id, doctor_id, b.date, b.time, clean(b.reason, 200));
        res.json({ ok: true });
    } catch (e) { dbError(res, e); }
});
app.put('/api/appointments/:id', auth, (req, res) => {
    if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status.' });
    try {
        db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
        res.json({ ok: true });
    } catch (e) { dbError(res, e); }
});
app.delete('/api/appointments/:id', auth, (req, res) => {
    db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => console.log('AAH Clinic running at http://localhost:' + PORT));