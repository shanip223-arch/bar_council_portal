const path = require('path');
const { pool } = require('../config/db');
const { buildFileName, moveFile } = require('../services/fileService');
const { mockPaymentAndUnlock } = require('../services/paymentService');
const { logAction } = require('../utils/logger');

async function uploadCertificate(req, res) {
  const { application_no } = req.body;
  try {
    if (!req.file) return res.status(400).json({ error: 'certificate file required' });
    const apps = await pool.query('SELECT * FROM applications WHERE application_no=?', [application_no]);
    if (!apps.rows.length) return res.status(404).json({ error: 'Application not found' });
    const app = apps.rows[0];

    const ext = path.extname(req.file.originalname) || '.pdf';
    const fileName = buildFileName(application_no, 'cert', 'certificate', ext);
    const destPath = path.join('uploads', 'certificates', fileName);
    moveFile(req.file.path, destPath);

    await pool.query('DELETE FROM certificates WHERE application_id=?', [app.id]);
    await pool.query('INSERT INTO certificates(application_id,file_name,file_path,uploaded_by) VALUES(?,?,?,?)', [app.id, fileName, destPath, req.user.id]);
    await pool.query('UPDATE applications SET status=? WHERE id=?', ['approved', app.id]);

    await logAction(req.user.username, req.user.role, 'upload_certificate', application_no);
    res.json({ message: 'Certificate uploaded and approved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function requestDownloadOtp(req, res) {
  const { application_no } = req.body;
  const { sendOtp } = require('../services/otpService');

  try {
    const apps = await pool.query('SELECT * FROM applications WHERE application_no=?', [application_no]);
    if (!apps.rows.length || apps.rows[0].status !== 'approved') return res.status(400).json({ error: 'Certificate not available' });

    await sendOtp(application_no);
    res.json({ message: 'OTP sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function downloadCertificate(req, res) {
  const { application_no, otp } = req.body;
  const { verifyOtp } = require('../services/otpService');

  try {
    const ok = await verifyOtp(application_no, otp);
    if (!ok) return res.status(400).json({ error: 'Invalid OTP' });

    const apps = await pool.query('SELECT * FROM applications WHERE application_no=?', [application_no]);
    if (!apps.rows.length) return res.status(404).json({ error: 'Application not found' });
    const app = apps.rows[0];

    const freeAllowed = app.download_count < 2;
    const paidAllowed = app.paid_unlock_until && new Date(app.paid_unlock_until) > new Date();
    if (!freeAllowed && !paidAllowed) {
      return res.status(402).json({ error: 'Payment required after 2 downloads' });
    }

    const certs = await pool.query(
      `SELECT c.* FROM certificates c
       JOIN applications a ON a.id=c.application_id
       WHERE a.application_no=? LIMIT 1`,
      [application_no]
    );
    if (!certs.rows.length) return res.status(404).json({ error: 'Certificate missing' });

    await pool.query('UPDATE applications SET download_count=download_count+1 WHERE id=?', [app.id]);
    await logAction(application_no, 'candidate', 'download_certificate', certs.rows[0].file_name);
    res.download(certs.rows[0].file_path, certs.rows[0].file_name);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function payForDownload(req, res) {
  const { application_no } = req.body;
  try {
    const apps = await pool.query('SELECT * FROM applications WHERE application_no=?', [application_no]);
    if (!apps.rows.length) return res.status(404).json({ error: 'Application not found' });

    const unlockUntil = await mockPaymentAndUnlock(apps.rows[0].id);
    res.json({ message: 'Payment successful (mock)', unlock_until: unlockUntil });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getCandidateStatus(req, res) {
  const application_no = req.user.application_no;
  try {
    const apps = await pool.query('SELECT * FROM applications WHERE application_no=?', [application_no]);
    if (!apps.rows.length) return res.status(404).json({ error: 'Not found' });
    const app = apps.rows[0];

    const objections = await pool.query('SELECT id,type,remark,deadline,resolved FROM objections WHERE application_id=? ORDER BY id DESC', [app.id]);
    const certs = await pool.query('SELECT id,file_name,created_at FROM certificates WHERE application_id=?', [app.id]);

    res.json({
      application_no: app.application_no,
      name: app.name,
      status: app.status,
      upload_enabled: !!app.upload_enabled,
      objections: objections.rows,
      certificate_available: certs.rows.length > 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function requestDuplicate(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Passport photo required' });
    const { application_no, reason } = req.body;
    const ext = path.extname(req.file.originalname) || '.jpg';
    const fileName = buildFileName(application_no, 'dup', 'photo', ext);
    const destPath = path.join('uploads', 'temp', fileName);
    moveFile(req.file.path, destPath);

    await pool.query('INSERT INTO duplicate_requests(application_no,reason,photo_path) VALUES(?,?,?)', [application_no, reason, destPath]);
    await logAction(application_no, 'public', 'duplicate_request', reason || '');
    res.json({ message: 'Duplicate request submitted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { uploadCertificate, requestDownloadOtp, downloadCertificate, payForDownload, getCandidateStatus, requestDuplicate };
