const path = require('path');
const ExcelJS = require('exceljs');
const pool = require('../config/db');
const { isValidAppNo, isValidMobile } = require('../utils/validator');
const { moveFile, buildName } = require('../services/fileService');
const { createBackup, restoreFromBackup } = require('../services/backupService');
const { logAction } = require('../utils/logger');

async function importApplications(req, res) {
  if (!req.file) return res.status(400).json({ message: 'Excel file missing' });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(req.file.path);
  const sheet = workbook.worksheets[0];

  const report = { inserted: 0, errors: [] };
  const seen = new Set();

  for (let i = 2; i <= sheet.rowCount; i++) {
    const r = sheet.getRow(i);
    const application_no = String(r.getCell(1).text || '').trim();
    const name = String(r.getCell(2).text || '').trim();
    const father_name = String(r.getCell(3).text || '').trim();
    const mobile = String(r.getCell(4).text || '').trim();
    const district = String(r.getCell(5).text || '').trim();

    if (!application_no && !name && !father_name && !mobile && !district) continue;

    if (!isValidAppNo(application_no)) {
      report.errors.push({ row: i, reason: 'Invalid application_no format' });
      continue;
    }
    if (!isValidMobile(mobile)) {
      report.errors.push({ row: i, reason: 'Invalid mobile' });
      continue;
    }
    if (seen.has(application_no)) {
      report.errors.push({ row: i, reason: 'Duplicate row in Excel' });
      continue;
    }

    seen.add(application_no);
    const [exists] = await pool.query('SELECT id FROM applications WHERE application_no = ?', [application_no]);
    if (exists.length) {
      report.errors.push({ row: i, reason: 'Duplicate in DB' });
      continue;
    }

    await pool.query(
      `INSERT INTO applications
      (application_no, name, father_name, mobile, district, status, upload_enabled, upload_cycle, final_chance_used)
      VALUES (?, ?, ?, ?, ?, 'pending', 1, 1, 0)`,
      [application_no, name, father_name, mobile, district]
    );
    report.inserted++;
  }

  logAction(req.user.role, req.user.id, 'IMPORT_EXCEL', report);
  res.json(report);
}

async function uploadCertificate(req, res) {
  const { application_no } = req.body;
  if (!req.file || !application_no) return res.status(400).json({ message: 'Missing data' });

  const [rows] = await pool.query('SELECT id FROM applications WHERE application_no = ?', [application_no]);
  if (!rows.length) return res.status(404).json({ message: 'Application not found' });

  const fileName = buildName(application_no, 'cert', 'certificate', req.file.originalname);
  const finalPath = path.join(__dirname, '..', 'uploads', 'certificates', fileName);
  moveFile(req.file.path, finalPath);

  await pool.query('UPDATE applications SET certificate_path = ?, status = ? WHERE application_no = ?', [finalPath, 'approved', application_no]);

  logAction(req.user.role, req.user.id, 'UPLOAD_CERTIFICATE', { application_no, fileName });
  res.json({ message: 'Certificate uploaded' });
}

async function verifyUpload(req, res) {
  const { upload_id, approve } = req.body;
  const [up] = await pool.query('SELECT * FROM uploads WHERE id = ?', [upload_id]);
  if (!up.length) return res.status(404).json({ message: 'Upload not found' });

  const status = approve ? 'verified' : 'rejected';
  await pool.query('UPDATE uploads SET status = ? WHERE id = ?', [status, upload_id]);

  if (approve) {
    await pool.query('UPDATE objections SET status = ? WHERE id = ?', ['resolved', up[0].objection_id]);
    const [open] = await pool.query('SELECT COUNT(*) c FROM objections WHERE application_no = ? AND status = "open"', [up[0].application_no]);
    if (open[0].c === 0) {
      await pool.query('UPDATE applications SET status = ? WHERE application_no = ?', ['under_review', up[0].application_no]);
    }
  }

  logAction(req.user.role, req.user.id, 'VERIFY_UPLOAD', { upload_id, status });
  res.json({ message: 'Upload status updated', status });
}

async function adminOverride(req, res) {
  const { application_no, action } = req.body;
  if (action === 'extra_chance') {
    await pool.query('UPDATE applications SET upload_enabled = 1, upload_cycle = upload_cycle + 1, final_chance_used = 0 WHERE application_no = ?', [application_no]);
  } else if (action === 'disable_upload') {
    await pool.query('UPDATE applications SET upload_enabled = 0 WHERE application_no = ?', [application_no]);
  } else if (action === 'enable_upload') {
    await pool.query('UPDATE applications SET upload_enabled = 1 WHERE application_no = ?', [application_no]);
  } else if (action === 'reopen_case') {
    await pool.query('UPDATE applications SET status = ?, upload_enabled = 1, upload_cycle = upload_cycle + 1 WHERE application_no = ?', ['objection', application_no]);
  }

  logAction(req.user.role, req.user.id, 'ADMIN_OVERRIDE', { application_no, action });
  res.json({ message: 'Override applied' });
}

async function applyUploadLimitRules(req, res) {
  const { application_no } = req.body;
  const [open] = await pool.query('SELECT COUNT(*) c FROM objections WHERE application_no = ? AND status = "open"', [application_no]);
  const [app] = await pool.query('SELECT final_chance_used FROM applications WHERE application_no = ?', [application_no]);

  if (open[0].c > 0 && app.length) {
    if (app[0].final_chance_used === 0) {
      await pool.query('UPDATE applications SET final_chance_used = 1, upload_enabled = 1 WHERE application_no = ?', [application_no]);
      return res.json({ message: 'Final chance granted automatically' });
    }
    await pool.query('UPDATE applications SET upload_enabled = 0 WHERE application_no = ?', [application_no]);
    return res.json({ message: 'Visit office or pay for reopening' });
  }
  res.json({ message: 'No pending objections' });
}

async function createManualBackup(req, res) {
  const { type } = req.body;
  const result = await createBackup(type || 'full');
  logAction(req.user.role, req.user.id, 'BACKUP_CREATE', { type, result });
  res.json({ message: 'Backup created', result });
}

async function restoreBackup(req, res) {
  const { file_path, table_name } = req.body;
  await restoreFromBackup(file_path, table_name);
  logAction(req.user.role, req.user.id, 'BACKUP_RESTORE', { file_path, table_name });
  res.json({ message: 'Backup restored' });
}

async function duplicateRequest(req, res) {
  const { application_no } = req.body;
  if (!req.file || !application_no) return res.status(400).json({ message: 'Missing data' });

  const [countRows] = await pool.query('SELECT COUNT(*) c FROM duplicate_requests WHERE application_no = ?', [application_no]);
  const issue_no = countRows[0].c === 0 ? 'D1' : 'D2';

  const fileName = buildName(application_no, 'dup', issue_no, req.file.originalname);
  const finalPath = path.join(__dirname, '..', 'uploads', 'temp', fileName);
  moveFile(req.file.path, finalPath);

  await pool.query(
    'INSERT INTO duplicate_requests (application_no, photo_path, issue_no, status) VALUES (?, ?, ?, ?)',
    [application_no, finalPath, issue_no, 'pending']
  );

  res.json({ message: 'Duplicate request submitted', issue_no });
}

async function approveDuplicate(req, res) {
  const { request_id } = req.body;
  await pool.query('UPDATE duplicate_requests SET status = ? WHERE id = ?', ['approved', request_id]);
  logAction(req.user.role, req.user.id, 'APPROVE_DUPLICATE', { request_id });
  res.json({ message: 'Duplicate approved' });
}

module.exports = {
  importApplications,
  uploadCertificate,
  verifyUpload,
  adminOverride,
  applyUploadLimitRules,
  createManualBackup,
  restoreBackup,
  duplicateRequest,
  approveDuplicate
};
