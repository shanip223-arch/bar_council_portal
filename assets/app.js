const api = '/api';
const APP_NO_RE = /^UP\d{5}\/\d{2}$/;
const OTP_RE = /^\d{6}$/;

function setToken(token) { localStorage.setItem('token', token); }
function getToken() { return localStorage.getItem('token'); }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

function setMsg(id, text, type = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `msg ${type}`.trim();
  el.textContent = text;
}

function setButtonLoading(id, loading, label = 'Loading...') {
  const btn = document.getElementById(id);
  if (!btn) return;
  if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
  btn.disabled = loading;
  btn.textContent = loading ? label : btn.dataset.originalText;
}

async function parseResponse(r) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.success === false) {
    throw new Error(data.message || data.error || 'Request failed');
  }
  return data;
}

async function loginUser() {
  const username = (document.getElementById('user')?.value || '').trim();
  const password = (document.getElementById('pass')?.value || '').trim();
  if (!username || !password) return setMsg('userLoginMsg', 'Username and password are required.', 'error');

  try {
    setMsg('userLoginMsg', '');
    setButtonLoading('userLoginBtn', true);
    const r = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const d = await parseResponse(r);
    setToken(d.data.token);
    setMsg('userLoginMsg', d.message || 'Login successful.', 'success');
    window.location.href = '/admin';
  } catch (e) {
    setMsg('userLoginMsg', e.message, 'error');
  } finally { setButtonLoading('userLoginBtn', false); }
}

async function requestCandidateOtp() {
  const application_no = (document.getElementById('candApp')?.value || '').trim();
  if (!APP_NO_RE.test(application_no)) return setMsg('candOtpMsg', 'Application number must be UP12345/25.', 'error');

  try {
    setMsg('candOtpMsg', '');
    setButtonLoading('reqOtpBtn', true);
    const r = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application_no }) });
    const d = await parseResponse(r);
    setMsg('candOtpMsg', d.message || 'OTP sent.', 'success');
  } catch (e) {
    setMsg('candOtpMsg', e.message, 'error');
  } finally { setButtonLoading('reqOtpBtn', false); }
}

async function verifyCandidateOtp() {
  const application_no = (document.getElementById('candApp')?.value || '').trim();
  const otp = (document.getElementById('candOtp')?.value || '').trim();
  if (!APP_NO_RE.test(application_no)) return setMsg('candVerifyMsg', 'Application number must be UP12345/25.', 'error');
  if (!OTP_RE.test(otp)) return setMsg('candVerifyMsg', 'OTP must be 6 digits.', 'error');

  try {
    setMsg('candVerifyMsg', '');
    setButtonLoading('verifyOtpBtn', true);
    const r = await fetch(`${api}/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application_no, otp }) });
    const d = await parseResponse(r);
    setToken(d.data.token);
    setMsg('candVerifyMsg', d.message || 'Login successful.', 'success');
    window.location.href = '/dashboard';
  } catch (e) {
    setMsg('candVerifyMsg', e.message, 'error');
  } finally { setButtonLoading('verifyOtpBtn', false); }
}

async function loadStatus() { try { const r = await fetch(`${api}/certificate/status`, { headers: authHeaders() }); document.getElementById('statusBox').textContent = JSON.stringify(await parseResponse(r), null, 2); } catch (e) { alert(e.message); } }
async function uploadObjectionDoc() { try { const form = new FormData(); form.append('objection_id', document.getElementById('objId').value); form.append('doc_type', document.getElementById('docType').value); if (!document.getElementById('objFile').files[0]) throw new Error('File required'); form.append('file', document.getElementById('objFile').files[0]); const r = await fetch(`${api}/upload/objection-doc`, { method: 'POST', headers: authHeaders(), body: form }); alert((await parseResponse(r)).message); } catch (e) { alert(e.message); } }
async function requestDownloadOtp() { try { const application_no = document.getElementById('dlAppNo').value; const r = await fetch(`${api}/certificate/request-download-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application_no }) }); alert((await parseResponse(r)).message); } catch (e) { alert(e.message); } }
async function downloadCertificate() { try { const application_no = document.getElementById('dlAppNo').value; const otp = document.getElementById('dlOtp').value; const r = await fetch(`${api}/certificate/download`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application_no, otp }) }); if (!r.ok) throw new Error((await r.json()).message || 'Download failed'); const blob = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'certificate.pdf'; a.click(); } catch (e) { alert(e.message); } }
async function payUnlock() { try { const application_no = document.getElementById('dlAppNo').value; const r = await fetch(`${api}/certificate/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application_no }) }); alert((await parseResponse(r)).message); } catch (e) { alert(e.message); } }
async function uploadExcel() { try { const f = document.getElementById('excelFile').files[0]; if (!f) throw new Error('Excel file required'); const form = new FormData(); form.append('file', f); const r = await fetch(`${api}/admin/upload-excel`, { method: 'POST', headers: authHeaders(), body: form }); document.getElementById('adminOut').textContent = JSON.stringify(await parseResponse(r), null, 2); } catch (e) { adminOut.textContent = e.message; } }
async function addObjection() { try { const body = { application_no: obApp.value, type: obType.value, remark: obRemark.value }; const r = await fetch(`${api}/objection`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); adminOut.textContent = JSON.stringify(await parseResponse(r), null, 2); } catch (e) { adminOut.textContent = e.message; } }
async function verifyUpload() { try { const r = await fetch(`${api}/upload/verify`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ upload_id: verifyUploadId.value }) }); adminOut.textContent = JSON.stringify(await parseResponse(r), null, 2); } catch (e) { adminOut.textContent = e.message; } }
async function uploadCertificate() { try { const form = new FormData(); if (!certFile.files[0]) throw new Error('Certificate file required'); form.append('application_no', certAppNo.value); form.append('file', certFile.files[0]); const r = await fetch(`${api}/certificate/upload`, { method: 'POST', headers: authHeaders(), body: form }); adminOut.textContent = JSON.stringify(await parseResponse(r), null, 2); } catch (e) { adminOut.textContent = e.message; } }
async function overrideUpload() { try { const body = { application_no: ovAppNo.value, upload_enabled: ovEnabled.value === '1', grant_final_chance: ovChance.value === '1' }; const r = await fetch(`${api}/admin/override-upload`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); adminOut.textContent = JSON.stringify(await parseResponse(r), null, 2); } catch (e) { adminOut.textContent = e.message; } }
async function runBackup() { try { const r = await fetch(`${api}/admin/backup`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ type: backupType.value }) }); adminOut.textContent = JSON.stringify(await parseResponse(r), null, 2); } catch (e) { adminOut.textContent = e.message; } }
async function restoreBackup() { try { const r = await fetch(`${api}/admin/restore`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ file_path: restorePath.value }) }); adminOut.textContent = JSON.stringify(await parseResponse(r), null, 2); } catch (e) { adminOut.textContent = e.message; } }
async function approveDuplicate() { try { const r = await fetch(`${api}/admin/approve-duplicate`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: Number(dupId.value), issue_code: dupCode.value }) }); adminOut.textContent = JSON.stringify(await parseResponse(r), null, 2); } catch (e) { adminOut.textContent = e.message; } }
async function submitDuplicate() { try { const form = new FormData(); if (!dupPhoto.files[0]) throw new Error('Passport photo is required'); form.append('application_no', dupAppNo.value); form.append('reason', dupReason.value); form.append('photo', dupPhoto.files[0]); const r = await fetch(`${api}/certificate/duplicate-request`, { method: 'POST', body: form }); dupOut.textContent = JSON.stringify(await parseResponse(r), null, 2); } catch (e) { dupOut.textContent = e.message; } }
