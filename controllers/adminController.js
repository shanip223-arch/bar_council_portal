const XLSX = require('xlsx');
const { pool } = require('../config/db');
const { validateApplicationNo, validateMobile } = require('../utils/validator');
const { runBackup, restoreBackup } = require('../services/backupService');
const { logAction } = require('../utils/logger');

async function uploadExcelApplications(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Excel file required' });
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    let inserted = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const application_no = String(r.application_no || '').trim();
      const name = String(r.name || '').trim();
      const father_name = String(r.father_name || '').trim();
      const mobile = String(r.mobile || '').trim();
      const district = String(r.district || '').trim();

      if (!application_no && !name && !father_name && !mobile && !district) continue;
      if (!validateApplicationNo(application_no)) { errors.push({ row: i + 2, error: 'invalid application_no' }); continue; }
      if (!validateMobile(mobile)) { errors.push({ row: i + 2, error: 'invalid mobile' }); continue; }
      if (!name || !father_name || !district) { errors.push({ row: i + 2, error: 'missing fields' }); continue; }

      const dup = await pool.query('SELECT id FROM applications WHERE application_no=$1', [application_no]);
      if (dup.rows.length) { errors.push({ row: i + 2, error: 'duplicate application_no' }); continue; }

      await pool.query(
        'INSERT INTO applications(application_no,name,father_name,mobile,district) VALUES($1,$2,$3,$4,$5)',
        [application_no, name, father_name, mobile, district]
      );
      inserted += 1;
    }

    await logAction(req.user.username, 'admin', 'excel_upload', `inserted=${inserted}, errors=${errors.length}`);
    res.json({ inserted, errors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function overrideUpload(req, res) {
  const { application_no, upload_enabled, grant_final_chance } = req.body;
  try {
    if (grant_final_chance) {
      await pool.query(
        'UPDATE applications SET upload_enabled=$1, final_chance_used=0, reopen_count=reopen_count+1 WHERE application_no=$2',
        [upload_enabled ? 1 : 0, application_no]
      );
    } else {
      await pool.query(
        'UPDATE applications SET upload_enabled=$1, reopen_count=reopen_count+1 WHERE application_no=$2',
        [upload_enabled ? 1 : 0, application_no]
      );
    }
    await logAction(req.user.username, 'admin', 'override_upload', JSON.stringify(req.body));
    res.json({ success: true, message: 'Override updated', data: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function runManualBackup(req, res) {
  try {
    const { type } = req.body;
    if (!['objection', 'upload', 'full'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
    const filePath = await runBackup(type);
    await logAction(req.user.username, 'admin', 'manual_backup', type);
    res.json({ filePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function restoreManualBackup(req, res) {
  try {
    const { file_path } = req.body;
    await restoreBackup(file_path);
    await logAction(req.user.username, 'admin', 'restore_backup', file_path);
    res.json({ message: 'Restore completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function approveDuplicate(req, res) {
  try {
    const { id, issue_code } = req.body;
    if (!['D1', 'D2'].includes(issue_code)) return res.status(400).json({ error: 'Invalid issue code' });
    await pool.query('UPDATE duplicate_requests SET status=$1, issue_code=$2 WHERE id=$3', ['approved', issue_code, id]);
    await logAction(req.user.username, 'admin', 'approve_duplicate', `id=${id},${issue_code}`);
    res.json({ message: 'Duplicate approved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { uploadExcelApplications, overrideUpload, runManualBackup, restoreManualBackup, approveDuplicate };
