const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { sendOtp, verifyOtp } = require('../services/otpService');
const { hasPaidAccess, createMockPayment } = require('../services/paymentService');
const { logAction } = require('../utils/logger');

async function status(req, res) {
  const appNo = req.user.role === 'candidate' ? req.user.application_no : req.query.application_no;
  const [rows] = await pool.query('SELECT application_no,name,status,download_count FROM applications WHERE application_no = ?', [appNo]);
  if (!rows.length) return res.status(404).json({ message: 'Not found' });
  const [obs] = await pool.query('SELECT id,type,remark,deadline,status FROM objections WHERE application_no = ?', [appNo]);
  res.json({ application: rows[0], objections: obs });
}

async function requestDownloadOtp(req, res) {
  const { application_no } = req.body;
  const [rows] = await pool.query('SELECT mobile,status FROM applications WHERE application_no = ?', [application_no]);
  if (!rows.length) return res.status(404).json({ message: 'Application not found' });
  if (rows[0].status !== 'approved') return res.status(400).json({ message: 'Certificate not approved yet' });
  await sendOtp(application_no, rows[0].mobile);
  res.json({ message: 'OTP sent for download' });
}

async function downloadCertificate(req, res) {
  const { application_no, otp } = req.body;
  const ok = await verifyOtp(application_no, otp);
  if (!ok) return res.status(400).json({ message: 'Invalid OTP' });

  const [rows] = await pool.query('SELECT certificate_path,download_count FROM applications WHERE application_no = ?', [application_no]);
  if (!rows.length || !rows[0].certificate_path) return res.status(404).json({ message: 'Certificate not found' });

  let allowed = rows[0].download_count < 2;
  if (!allowed) allowed = await hasPaidAccess(application_no);
  if (!allowed) return res.status(402).json({ message: 'Free limit exhausted. Make payment to unlock 24-hour access.' });

  await pool.query('UPDATE applications SET download_count = download_count + 1 WHERE application_no = ?', [application_no]);
  await pool.query('INSERT INTO download_logs (application_no) VALUES (?)', [application_no]);
  logAction('candidate', application_no, 'DOWNLOAD_CERTIFICATE', {});

  return res.download(path.resolve(rows[0].certificate_path));
}

async function payForUnlock(req, res) {
  const { application_no } = req.body;
  const result = await createMockPayment(application_no);
  logAction('candidate', application_no, 'PAY_UNLOCK', result);
  res.json({ message: 'Payment success (mock)', ...result });
}

module.exports = { status, requestDownloadOtp, downloadCertificate, payForUnlock };
