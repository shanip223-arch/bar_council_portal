/* ═══════════════════════════════════════════════════════════
   main.js — Centralized Auth + API Helper
   UP Bar Council Certificate Portal
   ═══════════════════════════════════════════════════════════ */

// ── Token management ────────────────────────────────────────
function getToken()       { return localStorage.getItem('token'); }
function getAdminToken()  { return localStorage.getItem('adminToken'); }
function getStaffToken()  { return localStorage.getItem('staffToken'); }
function setToken(t)      { localStorage.setItem('token', t); }
function setAdminToken(t) { localStorage.setItem('adminToken', t); }
function setStaffToken(t) { localStorage.setItem('staffToken', t); }
function clearTokens()    {
  localStorage.removeItem('token');
  localStorage.removeItem('adminToken');
  localStorage.removeItem('staffToken');
}
function getStoredRole()  { return localStorage.getItem('portalRole') || ''; }
function setStoredRole(r) { localStorage.setItem('portalRole', r); }

/* Best available privileged token (admin > staff) */
function getPrivToken() { return getAdminToken() || getStaffToken() || ''; }

function authHeaders(admin) {
  const t = admin ? getToken() : getToken();
  return { Authorization: 'Bearer ' + t };
}
function adminHeaders() {
  return { Authorization: 'Bearer ' + getPrivToken() };
}
function staffHeaders() {
  return { Authorization: 'Bearer ' + getPrivToken() };
}

// ── Response parser ─────────────────────────────────────────
async function parseResponse(r) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.success === false) throw new Error(data.message || data.error || 'Request failed');
  return data;
}

// ── Message helper ──────────────────────────────────────────
function setMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'msg' + (type ? ' ' + type : '');
  el.textContent = text;
}

function showFlash(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'flash flash-' + (type || 'success');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ── Route protection ────────────────────────────────────────
(function routeGuard() {
  const path = window.location.pathname;
  const adminToken = getAdminToken();
  const staffToken = getStaffToken();
  const token      = getToken();
  const hasPriv    = !!(adminToken || staffToken);

  /* /admin login page — redirect away if already authenticated */
  if (path === '/admin') {
    if (adminToken) { window.location.href = '/admin-dashboard'; return; }
    if (staffToken) { window.location.href = '/admin-dashboard'; return; }
  }

  /* Admin dashboard — accessible by adminToken OR staffToken */
  if (path === '/admin-dashboard') {
    if (!adminToken && !staffToken) { window.location.href = '/admin'; return; }
  }

  /* Candidate dashboard — requires candidate token */
  if (path === '/dashboard') {
    if (!token) { window.location.href = '/'; return; }
  }

  /* Staff sub-pages — require staffToken OR adminToken */
  if (['/staff-dashboard', '/staff-objections', '/staff-uploads', '/staff-panel'].includes(path)) {
    if (!hasPriv) { window.location.href = '/admin'; return; }
  }

  /* Homepage — if admin/staff lands here, they are NOT redirected (it's the public page) */
})();

// ── API wrappers (candidate portal) ────────────────────────
const API = {
  async post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return parseResponse(r);
  },
  async postAuth(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return parseResponse(r);
  },
  async getAuth(url) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + getToken() } });
    return parseResponse(r);
  },
  async postForm(url, formData) {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + getToken() }, body: formData });
    return parseResponse(r);
  }
};

// ── Admin API wrappers ──────────────────────────────────────
const AdminAPI = {
  async get(url) {
    const r = await fetch(url, { headers: adminHeaders() });
    return parseResponse(r);
  },
  async post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return parseResponse(r);
  },
  async put(url, body) {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return parseResponse(r);
  },
  async patch(url, body) {
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return parseResponse(r);
  },
  async postForm(url, formData) {
    const r = await fetch(url, { method: 'POST', headers: adminHeaders(), body: formData });
    return parseResponse(r);
  }
};

// ── Staff API wrappers ──────────────────────────────────────
const StaffAPI = {
  async get(url) {
    const r = await fetch(url, { headers: staffHeaders() });
    return parseResponse(r);
  },
  async patch(url, body) {
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { ...staffHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return parseResponse(r);
  },
  async post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { ...staffHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return parseResponse(r);
  }
};

// ── Admin login (dedicated admin card on index.html) ────────
async function doAdminLogin() {
  const username = (document.getElementById('adminUser')?.value || '').trim();
  const password = (document.getElementById('adminPass')?.value || '').trim();
  const btn = document.getElementById('adminLoginBtn');
  if (!username || !password) return setMsg('adminLoginMsg', '❌ Username and password required', 'error');
  if (btn) { btn.disabled = true; btn.textContent = 'Logging in…'; }
  try {
    setMsg('adminLoginMsg', '');
    const d = await API.post('/api/admin/login', { username, password });
    const { token, role } = d.data;
    if (role !== 'admin') {
      setMsg('adminLoginMsg', '❌ Admin credentials required for this login.', 'error');
      return;
    }
    setAdminToken(token); setStoredRole(role);
    setMsg('adminLoginMsg', '✅ Login successful. Redirecting…', 'success');
    setTimeout(() => { window.location.href = '/admin-dashboard'; }, 600);
  } catch(e) {
    setMsg('adminLoginMsg', '❌ ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔑 Admin Login'; }
  }
}

// ── Staff login (dedicated staff card on index.html) ─────────
async function staffLogin() {
  const username = (document.getElementById('staffUser')?.value || '').trim();
  const password = (document.getElementById('staffPass')?.value || '').trim();
  const btn = document.getElementById('staffLoginBtn');
  if (!username || !password) return setMsg('staffLoginMsg', '❌ Username and password required', 'error');
  if (btn) { btn.disabled = true; btn.textContent = 'Logging in…'; }
  try {
    setMsg('staffLoginMsg', '');
    const d = await API.post('/api/admin/login', { username, password });
    const { token, role } = d.data;
    if (role === 'admin') {
      setAdminToken(token); setStoredRole(role);
    } else {
      setStaffToken(token); setStoredRole(role);
    }
    setMsg('staffLoginMsg', '✅ Login successful. Redirecting…', 'success');
    setTimeout(() => { window.location.href = '/admin-dashboard'; }, 600);
  } catch(e) {
    setMsg('staffLoginMsg', '❌ ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔑 Staff Login'; }
  }
}

// ── Login (differentiates admin vs staff by role) ───────────
async function loginUser() {
  const username = (document.getElementById('user')?.value || '').trim();
  const password = (document.getElementById('pass')?.value || '').trim();
  if (!username || !password) return setMsg('userLoginMsg', 'उपयोगकर्ता नाम और पासवर्ड आवश्यक है', 'error');
  const btn = document.getElementById('userLoginBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'लॉगिन हो रहा है…'; }
  try {
    setMsg('userLoginMsg', '');
    const d = await API.post('/api/admin/login', { username, password });
    const { token, role, username: uname } = d.data;
    setStoredRole(role);
    if (role === 'admin') {
      setAdminToken(token);
      setMsg('userLoginMsg', '✅ ' + d.message, 'success');
      setTimeout(() => { window.location.href = '/admin-dashboard'; }, 600);
    } else {
      setStaffToken(token);
      setMsg('userLoginMsg', '✅ ' + d.message, 'success');
      setTimeout(() => { window.location.href = '/staff-dashboard'; }, 600);
    }
  } catch (e) {
    setMsg('userLoginMsg', '❌ ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔑 लॉगिन करें | Login'; }
  }
}

// ── Logout helpers ──────────────────────────────────────────
function logoutAdmin() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('staffToken');
  localStorage.removeItem('portalRole');
  window.location.href = '/admin';
}
function logoutStaff() {
  localStorage.removeItem('staffToken');
  localStorage.removeItem('portalRole');
  window.location.href = '/admin';
}
function logoutAll() { clearTokens(); localStorage.removeItem('portalRole'); window.location.href = '/'; }

// ── Candidate portal functions ──────────────────────────────
const APP_NO_RE = /^UP\d{5}\/\d{2}$/;

async function requestCandidateOtp() {
  const application_no = (document.getElementById('candApp')?.value || '').trim();
  if (!APP_NO_RE.test(application_no)) return setMsg('candOtpMsg', 'आवेदन संख्या अमान्य है। प्रारूप: UP12345/25', 'error');
  const btn = document.getElementById('reqOtpBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'भेजा जा रहा है…'; }
  try {
    setMsg('candOtpMsg', '');
    const d = await API.post('/api/auth/login', { application_no });
    setMsg('candOtpMsg', '✅ ' + (d.message || 'OTP भेजा गया'), 'success');
  } catch (e) {
    setMsg('candOtpMsg', '❌ ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📤 OTP प्राप्त करें | Request OTP'; }
  }
}

async function verifyCandidateOtp() {
  const application_no = (document.getElementById('candApp')?.value || '').trim();
  const otp = (document.getElementById('candOtp')?.value || '').trim();
  if (!APP_NO_RE.test(application_no)) return setMsg('candVerifyMsg', 'आवेदन संख्या अमान्य', 'error');
  if (!/^\d{6}$/.test(otp)) return setMsg('candVerifyMsg', 'OTP 6 अंकों का होना चाहिए', 'error');
  const btn = document.getElementById('verifyOtpBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'सत्यापित हो रहा है…'; }
  try {
    setMsg('candVerifyMsg', '');
    const d = await API.post('/api/auth/verify-otp', { application_no, otp });
    setToken(d.data.token);
    setMsg('candVerifyMsg', '✅ ' + (d.message || 'Login successful'), 'success');
    setTimeout(() => { window.location.href = '/dashboard'; }, 600);
  } catch (e) {
    setMsg('candVerifyMsg', '❌ ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✅ OTP सत्यापित करें | Verify OTP & Login'; }
  }
}

async function requestDownloadOtp() {
  const application_no = (document.getElementById('dlAppNo')?.value || '').trim();
  try {
    const d = await API.post('/api/certificate/request-download-otp', { application_no });
    setMsg('dlMsg', '✅ ' + (d.message || 'OTP sent'), 'success');
  } catch (e) { setMsg('dlMsg', '❌ ' + e.message, 'error'); }
}

async function downloadCertificate() {
  const application_no = (document.getElementById('dlAppNo')?.value || '').trim();
  const otp = (document.getElementById('dlOtp')?.value || '').trim();
  try {
    const r = await fetch('/api/certificate/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_no, otp })
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Download failed'); }
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'certificate.pdf'; a.click();
  } catch (e) { setMsg('dlMsg', '❌ ' + e.message, 'error'); }
}

async function payUnlock() {
  const application_no = (document.getElementById('dlAppNo')?.value || '').trim();
  try {
    const d = await API.post('/api/certificate/pay', { application_no });
    setMsg('dlMsg', '✅ ' + (d.message || 'Payment successful'), 'success');
  } catch (e) { setMsg('dlMsg', '❌ ' + e.message, 'error'); }
}

// ── Shared helpers ──────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function isOverdue(deadline) { return deadline && new Date(deadline) < new Date(); }

// ══════════════════════════════════════════════════════════════
// STAFF PANEL — shared API functions (used by staff-panel.html)
// ══════════════════════════════════════════════════════════════

async function updateObjectionStatus(id, action, staff_remark) {
  return StaffAPI.patch(`/api/staff/objection/${id}`, { action, staff_remark: staff_remark || '' });
}

async function updateUploadStatus(id, action, staff_remark) {
  return StaffAPI.patch(`/api/staff/upload/${id}`, { action, staff_remark: staff_remark || '' });
}

// ── Admin dashboard section navigation ──────────────────────
function adminNavInit() {
  document.querySelectorAll('[data-section]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof showSection === 'function') showSection(this.dataset.section);
    });
  });
}
