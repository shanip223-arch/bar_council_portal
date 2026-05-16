const API = '/api';

function setMsg(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2);
}

function token() { return localStorage.getItem('token'); }
function appNo() { return localStorage.getItem('application_no'); }

async function requestOtp() {
  const application_no = document.getElementById('appNo').value;
  const r = await fetch(`${API}/auth/candidate/request-otp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application_no })
  });
  setMsg('candidateMsg', await r.text());
}

async function verifyOtp() {
  const application_no = document.getElementById('appNo').value;
  const otp = document.getElementById('otp').value;
  const r = await fetch(`${API}/auth/candidate/verify-otp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application_no, otp })
  });
  const data = await r.json();
  if (r.ok) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('application_no', application_no);
    location.href = '/public/dashboard.html';
  }
  setMsg('candidateMsg', data);
}

async function adminLogin() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const r = await fetch(`${API}/auth/admin-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
  });
  const data = await r.json();
  if (r.ok) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.role);
    location.href = '/public/admin.html';
  }
  setMsg('adminMsg', data.message || JSON.stringify(data));
}

async function loadStatus() {
  const r = await fetch(`${API}/certificates/status`, { headers: { Authorization: `Bearer ${token()}` } });
  const data = await r.json();
  setMsg('statusBox', data);
}

async function uploadReply() {
  const fd = new FormData();
  fd.append('objection_id', document.getElementById('objectionId').value);
  fd.append('type', document.getElementById('objectionType').value || 'reply');
  fd.append('file', document.getElementById('uploadFile').files[0]);

  const r = await fetch(`${API}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd });
  setMsg('dashMsg', await r.text());
}

async function requestDownloadOtp() {
  const r = await fetch(`${API}/certificates/request-download-otp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application_no: appNo() })
  });
  setMsg('dashMsg', await r.text());
}

async function downloadCertificate() {
  const otp = document.getElementById('downloadOtp').value;
  const r = await fetch(`${API}/certificates/download`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application_no: appNo(), otp })
  });
  if (!r.ok) {
    setMsg('dashMsg', await r.text());
    return;
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${appNo().replace('/', '_')}_cert.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

async function payUnlock() {
  const r = await fetch(`${API}/certificates/pay-unlock`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application_no: appNo() })
  });
  setMsg('dashMsg', await r.text());
}

async function importExcel() {
  const fd = new FormData();
  fd.append('file', document.getElementById('excelFile').files[0]);
  const r = await fetch(`${API}/admin/import-excel`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd });
  setMsg('adminPanelMsg', await r.text());
}

async function addObjection() {
  const payload = {
    application_no: document.getElementById('objAppNo').value,
    type: document.getElementById('objType').value,
    remark: document.getElementById('objRemark').value
  };
  const r = await fetch(`${API}/objections`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(payload)
  });
  setMsg('adminPanelMsg', await r.text());
}

async function verifyUpload(approve) {
  const upload_id = Number(document.getElementById('uploadId').value);
  const r = await fetch(`${API}/admin/verify-upload`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ upload_id, approve })
  });
  setMsg('adminPanelMsg', await r.text());
}

async function uploadCertificate() {
  const fd = new FormData();
  fd.append('application_no', document.getElementById('certAppNo').value);
  fd.append('file', document.getElementById('certFile').files[0]);
  const r = await fetch(`${API}/admin/upload-certificate`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd });
  setMsg('adminPanelMsg', await r.text());
}

async function overrideCase() {
  const payload = { application_no: document.getElementById('ovAppNo').value, action: document.getElementById('ovAction').value };
  const r = await fetch(`${API}/admin/override`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(payload)
  });
  setMsg('adminPanelMsg', await r.text());
}

async function submitDuplicate() {
  const fd = new FormData();
  fd.append('application_no', document.getElementById('dupAppNo').value);
  fd.append('photo', document.getElementById('dupPhoto').files[0]);
  const r = await fetch(`${API}/admin/duplicate/request`, { method: 'POST', body: fd });
  setMsg('dupMsg', await r.text());
}
