const XLSX = require('xlsx');
const { pool } = require('../config/db');
const { validateApplicationNo, validateMobile } = require('../utils/validator');
const { runBackup, restoreBackup } = require('../services/backupService');
const { logAction } = require('../utils/logger');

/* ── Legacy direct-upload (kept for backward compat) ── */
async function uploadExcelApplications(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel file required', data: null });
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
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
      const dup = await pool.query('SELECT id FROM applications WHERE application_no=?', [application_no]);
      if (dup.rows.length) { errors.push({ row: i + 2, error: 'duplicate application_no' }); continue; }
      await pool.query('INSERT INTO applications(application_no,name,father_name,mobile,district) VALUES(?,?,?,?,?)', [application_no, name, father_name, mobile, district]);
      inserted++;
    }
    await logAction(req.user.username, 'admin', 'excel_upload', `inserted=${inserted}, errors=${errors.length}`);
    res.json({ success: true, message: `Inserted ${inserted} records`, data: { inserted, errors } });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

/* ── Smart value cleaning for application numbers ── */
function cleanAppNo(raw) {
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u2060]/g, '')
    .replace(/\s+/g, '')
    .replace(/['"]/g, '');
}

function columnMatchRate(rows, col, re) {
  const vals = rows.map(r => cleanAppNo(String(r[col] || ''))).filter(v => v.length > 0);
  if (!vals.length) return 0;
  return vals.filter(v => re.test(v)).length / vals.length;
}

const APP_NO_RE = /^UP\d{5}\/\d{2}$/;
const MOBILE_RE = /^\d{10}$/;

const FIELD_ALIASES = {
  application_no: [
    'APPLICATION NO', 'APPLICATION NO.', 'APP NO', 'APP NO.', 'APPNO',
    'APPLICATION NUMBER', 'ENROLLMENT NO', 'ENROLLMENT NO.', 'ENROLL NO',
    'ENROLLMENT NUMBER', 'ENROLMENT NO', 'APPLICATION_NO', 'REG NO',
    'REGISTRATION NO', 'REGISTRATION NUMBER', 'ROLL NO', 'ROLL NUMBER',
  ],
  name: [
    'NAME', 'CANDIDATE NAME', 'CANDIDATE_NAME', 'STUDENT NAME',
    'FULL NAME', 'APPLICANT NAME', 'CAND NAME', 'CAND. NAME',
  ],
  father_name: [
    "FATHER NAME", "FATHER'S NAME", 'FATHERS NAME', 'FATHER_NAME',
    'F NAME', 'F. NAME', 'GUARDIAN NAME', 'PARENT NAME',
  ],
  mobile: [
    'MOBILE', 'MOBILE NO', 'MOBILE NO.', 'MOBILE NUMBER',
    'PHONE', 'PHONE NO', 'PHONE NUMBER', 'CONTACT NO',
    'CONTACT NUMBER', 'MOB NO', 'MOB', 'MOBILE_NO',
  ],
  district: [
    'DISTRICT', 'DIST', 'DIST.', 'DISTRICT NAME',
    'ZILA', 'ZILLA', 'DISTRICT_NAME', 'DIST NAME',
  ],
};

function normaliseHeader(s) {
  return String(s).trim().toUpperCase().replace(/[\s\-_\.]+/g, ' ').replace(/\s+/g, ' ');
}

function detectColumnMapping(columns, rows) {
  const mapping  = {};
  const usedCols = new Set();

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    let found = columns.find(c => aliases.includes(normaliseHeader(c)));
    if (!found) {
      found = columns.find(c => {
        const n = normaliseHeader(c);
        return aliases.some(a => n.includes(a) || a.includes(n));
      });
    }
    if (found && !usedCols.has(found)) {
      mapping[field] = found;
      usedCols.add(found);
    }
  }

  if (!mapping.application_no) {
    const col = columns.find(c => !usedCols.has(c) && columnMatchRate(rows, c, APP_NO_RE) >= 0.5);
    if (col) { mapping.application_no = col; usedCols.add(col); }
  }
  if (!mapping.mobile) {
    const col = columns.find(c => !usedCols.has(c) && columnMatchRate(rows, c, MOBILE_RE) >= 0.5);
    if (col) { mapping.mobile = col; usedCols.add(col); }
  }

  return mapping;
}

/* ── Fully-automatic single-step Excel import ── */
async function autoImportExcel(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel file required', data: null });

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet     = workbook.Sheets[sheetName];
    const rows      = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

    if (!rows.length) return res.status(400).json({ success: false, message: 'Excel file is empty or has no data rows', data: null });

    const columns = Object.keys(rows[0]);

    console.log('\n[AutoImport] ──────────────────────────────────');
    console.log('[AutoImport] Sheet:', sheetName, '| Rows:', rows.length);
    console.log('[AutoImport] Columns:', columns);
    console.log('[AutoImport] Sample row:', JSON.stringify(rows[0]));

    const mapping = detectColumnMapping(columns, rows);
    console.log('[AutoImport] Detected mapping:', mapping);

    const REQUIRED = ['application_no', 'name', 'father_name', 'mobile', 'district'];
    const missing  = REQUIRED.filter(f => !mapping[f]);
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Could not auto-detect columns for: ${missing.join(', ')}. Available headers: ${columns.join(', ')}.`,
        data: { total: rows.length, inserted: 0, skipped: 0, errors: [], detectedColumns: mapping, missingFields: missing, availableColumns: columns }
      });
    }

    let inserted = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const application_no = cleanAppNo(String(r[mapping.application_no] || ''));
      const name           = String(r[mapping.name]        || '').trim();
      const father_name    = String(r[mapping.father_name] || '').trim();
      const mobile         = String(r[mapping.mobile]      || '').trim().replace(/\D/g, '');
      const district       = String(r[mapping.district]    || '').trim();

      if (!application_no && !name && !father_name && !mobile && !district) { skipped++; continue; }

      if (!validateApplicationNo(application_no)) {
        errors.push({ row: i + 2, field: 'application_no', raw: String(r[mapping.application_no] || ''), cleaned: application_no, error: 'Invalid format — expected UP#####/YY (e.g. UP00001/25)' });
        continue;
      }
      if (!validateMobile(mobile)) {
        errors.push({ row: i + 2, field: 'mobile', raw: String(r[mapping.mobile] || ''), cleaned: mobile, error: 'Must be exactly 10 digits' });
        continue;
      }
      if (!name)        { errors.push({ row: i + 2, field: 'name',        raw: '', cleaned: '', error: 'Field is empty' }); continue; }
      if (!father_name) { errors.push({ row: i + 2, field: 'father_name', raw: '', cleaned: '', error: 'Field is empty' }); continue; }
      if (!district)    { errors.push({ row: i + 2, field: 'district',    raw: '', cleaned: '', error: 'Field is empty' }); continue; }

      const dup = await pool.query('SELECT id FROM applications WHERE application_no=?', [application_no]);
      if (dup.rows.length) {
        errors.push({ row: i + 2, field: 'application_no', raw: application_no, cleaned: application_no, error: 'Already exists in database' });
        continue;
      }

      await pool.query(
        'INSERT INTO applications(application_no,name,father_name,mobile,district) VALUES(?,?,?,?,?)',
        [application_no, name, father_name, mobile, district]
      );
      inserted++;
    }

    console.log(`[AutoImport] Done: inserted=${inserted}, skipped=${skipped}, errors=${errors.length}`);
    await logAction(req.user.username, 'admin', 'excel_auto_import',
      `inserted=${inserted}, skipped=${skipped}, errors=${errors.length}`);

    res.json({
      success: true,
      message: `Import complete — ${inserted} inserted, ${skipped} skipped, ${errors.length} errors`,
      data: { total: rows.length, inserted, skipped, errors, detectedColumns: mapping, sheetName }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

/* ── Phase 1: Upload & Preview ── */
async function previewExcel(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel file required', data: null });
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    if (!rows.length) return res.status(400).json({ success: false, message: 'Excel file is empty or has no data rows', data: null });

    const columns = Object.keys(rows[0]);
    const preview = rows.slice(0, 5);

    console.log('\n[Excel Debug] ─────────────────────────────────');
    console.log('[Excel Debug] Sheet:', sheetName, '| Total rows:', rows.length);
    console.log('[Excel Debug] Columns:', columns);

    const suggestedFields = {};
    for (const col of columns) {
      const appRate    = columnMatchRate(rows, col, APP_NO_RE);
      const mobileRate = columnMatchRate(rows, col, MOBILE_RE);
      if      (appRate    >= 0.5) suggestedFields[col] = 'application_no';
      else if (mobileRate >= 0.5) suggestedFields[col] = 'mobile';
    }

    res.json({
      success: true,
      message: `Parsed ${rows.length} rows from sheet "${sheetName}"`,
      data: { columns, preview, totalRows: rows.length, filePath: req.file.path, sheetName, suggestedFields }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

/* ── Phase 2: Import with column mapping ── */
async function importExcel(req, res) {
  try {
    const { filePath, mapping } = req.body;
    if (!filePath || !mapping)
      return res.status(400).json({ success: false, message: 'filePath and mapping are required', data: null });
    if (!mapping.application_no)
      return res.status(400).json({ success: false, message: 'application_no field mapping is required', data: null });

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

    console.log('\n[Excel Import] ─────────────────────────────────');
    console.log('[Excel Import] Mapping:', JSON.stringify(mapping));

    const nonEmptyRows = rows.filter(r => cleanAppNo(String(r[mapping.application_no] || '')) !== '');
    if (nonEmptyRows.length > 0) {
      const validCount = nonEmptyRows.filter(r => APP_NO_RE.test(cleanAppNo(String(r[mapping.application_no] || '')))).length;
      const validPct   = validCount / nonEmptyRows.length;

      if (validPct < 0.10) {
        const sampleVals = nonEmptyRows.slice(0, 5).map(r => r[mapping.application_no]);
        return res.status(400).json({
          success: false,
          message: `Invalid mapping — only ${Math.round(validPct * 100)}% of rows in column "${mapping.application_no}" match the UP#####/YY format.`,
          data: {
            inserted: 0, skipped: 0,
            errors: [{ row: '—', field: 'application_no', value: String(sampleVals[0] ?? ''), error: `Column "${mapping.application_no}" has no valid application numbers.` }],
            debug: { column: mapping.application_no, sampleRaw: sampleVals }
          }
        });
      }
    }

    let inserted = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const application_no = cleanAppNo(String(r[mapping.application_no] || ''));
      const name           = String(r[mapping.name]        || '').trim();
      const father_name    = String(r[mapping.father_name] || '').trim();
      const mobile         = String(r[mapping.mobile]      || '').trim().replace(/\D/g, '');
      const district       = String(r[mapping.district]    || '').trim();
      const dob            = mapping.dob ? String(r[mapping.dob] || '').trim() : null;
      const status         = mapping.status ? String(r[mapping.status] || '').trim().toLowerCase() : null;

      if (!application_no && !name && !father_name && !mobile && !district) { skipped++; continue; }

      if (!validateApplicationNo(application_no)) {
        errors.push({ row: i + 2, field: 'application_no', value: application_no, error: 'Invalid format — expected UP#####/YY' }); continue;
      }
      if (!validateMobile(mobile)) {
        errors.push({ row: i + 2, field: 'mobile', value: mobile, error: 'Invalid mobile number (10 digits required)' }); continue;
      }
      if (!name)        { errors.push({ row: i + 2, field: 'name',        value: name,        error: 'Required field is empty' }); continue; }
      if (!father_name) { errors.push({ row: i + 2, field: 'father_name', value: father_name, error: 'Required field is empty' }); continue; }
      if (!district)    { errors.push({ row: i + 2, field: 'district',    value: district,    error: 'Required field is empty' }); continue; }

      const dup = await pool.query('SELECT id FROM applications WHERE application_no=?', [application_no]);
      if (dup.rows.length) {
        errors.push({ row: i + 2, field: 'application_no', value: application_no, error: 'Duplicate — already exists in database' }); continue;
      }

      const VALID_STATUSES = ['pending', 'objection', 'under_review', 'approved', 'rejected'];
      const finalStatus = (status && VALID_STATUSES.includes(status)) ? status : 'pending';

      if (dob !== null) {
        await pool.query(
          'INSERT INTO applications(application_no,name,father_name,mobile,district,dob,status) VALUES(?,?,?,?,?,?,?)',
          [application_no, name, father_name, mobile, district, dob || null, finalStatus]
        );
      } else {
        await pool.query(
          'INSERT INTO applications(application_no,name,father_name,mobile,district,status) VALUES(?,?,?,?,?,?)',
          [application_no, name, father_name, mobile, district, finalStatus]
        );
      }
      inserted++;
    }

    console.log(`[Excel Import] Done: inserted=${inserted}, skipped=${skipped}, errors=${errors.length}`);
    await logAction(req.user.username, 'admin', 'excel_import',
      `inserted=${inserted}, skipped=${skipped}, errors=${errors.length}`);
    res.json({
      success: true,
      message: `Import complete — ${inserted} inserted, ${skipped} skipped, ${errors.length} errors`,
      data: { inserted, skipped, errors }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function overrideUpload(req, res) {
  const { application_no, upload_enabled, grant_final_chance } = req.body;
  try {
    if (grant_final_chance) {
      await pool.query('UPDATE applications SET upload_enabled=?, final_chance_used=0, reopen_count=reopen_count+1 WHERE application_no=?', [upload_enabled ? 1 : 0, application_no]);
    } else {
      await pool.query('UPDATE applications SET upload_enabled=?, reopen_count=reopen_count+1 WHERE application_no=?', [upload_enabled ? 1 : 0, application_no]);
    }
    await logAction(req.user.username, 'admin', 'override_upload', JSON.stringify(req.body));
    res.json({ success: true, message: 'Override updated', data: null });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function runManualBackup(req, res) {
  try {
    const { type } = req.body;
    if (!['objection', 'upload', 'full'].includes(type)) return res.status(400).json({ success: false, message: 'Invalid type', data: null });
    const filePath = await runBackup(type);
    await logAction(req.user.username, 'admin', 'manual_backup', type);
    res.json({ success: true, message: 'Backup created', data: { filePath } });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function restoreManualBackup(req, res) {
  try {
    const { file_path } = req.body;
    await restoreBackup(file_path);
    await logAction(req.user.username, 'admin', 'restore_backup', file_path);
    res.json({ success: true, message: 'Restore completed', data: null });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function approveDuplicate(req, res) {
  try {
    const { id, issue_code } = req.body;
    if (!['D1', 'D2'].includes(issue_code)) return res.status(400).json({ success: false, message: 'Invalid issue code', data: null });
    await pool.query('UPDATE duplicate_requests SET status=?, issue_code=? WHERE id=?', ['approved', issue_code, id]);
    await logAction(req.user.username, 'admin', 'approve_duplicate', `id=${id},${issue_code}`);
    res.json({ success: true, message: 'Duplicate approved', data: null });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function createApplication(req, res) {
  try {
    const { application_no, name, father_name, mobile, district, status = 'pending' } = req.body;
    const allowed = ['pending', 'objection', 'under_review', 'approved', 'rejected'];
    const appNo = String(application_no || '').trim().toUpperCase();
    const cleanMobile = String(mobile || '').replace(/\D/g, '');
    if (!appNo || !name || !father_name || !mobile || !district)
      return res.status(400).json({ success: false, message: 'application_no, name, father_name, mobile, district are required', data: null });
    if (!validateApplicationNo(appNo))
      return res.status(400).json({ success: false, message: 'Invalid application number format', data: null });
    if (!validateMobile(cleanMobile))
      return res.status(400).json({ success: false, message: 'Invalid mobile number', data: null });
    if (!allowed.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status', data: null });
    const exists = await pool.query('SELECT id FROM applications WHERE application_no=?', [appNo]);
    if (exists.rows.length) return res.status(409).json({ success: false, message: 'Application already exists', data: null });
    await pool.query(
      'INSERT INTO applications(application_no,name,father_name,mobile,district,status) VALUES(?,?,?,?,?,?)',
      [appNo, String(name).trim(), String(father_name).trim(), cleanMobile, String(district).trim(), status]
    );
    await logAction(req.user.username, req.user.role, 'create_application', appNo);
    res.json({ success: true, message: 'Application created', data: null });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function getStats(req, res) {
  try {
    const total        = await pool.query('SELECT COUNT(*) FROM applications');
    const approved     = await pool.query("SELECT COUNT(*) FROM applications WHERE status='approved'");
    const pending      = await pool.query("SELECT COUNT(*) FROM applications WHERE status='pending'");
    const rejected     = await pool.query("SELECT COUNT(*) FROM applications WHERE status='rejected'");
    const objection    = await pool.query("SELECT COUNT(*) FROM applications WHERE status='objection'");
    const under_review = await pool.query("SELECT COUNT(*) FROM applications WHERE status='under_review'");
    const staff        = await pool.query("SELECT COUNT(*) FROM users WHERE role IN ('admin','staff') AND active=1");
    const today_logs   = await pool.query("SELECT COUNT(*) FROM action_logs WHERE created_at >= CURDATE()");
    const pending_dups = await pool.query("SELECT COUNT(*) FROM duplicate_requests WHERE status='pending'");

    const by_district = await pool.query('SELECT district, COUNT(*) as count FROM applications GROUP BY district ORDER BY count DESC LIMIT 8');
    const by_status   = await pool.query('SELECT status, COUNT(*) as count FROM applications GROUP BY status');
    const recent      = await pool.query('SELECT application_no, name, status, created_at FROM applications ORDER BY created_at DESC LIMIT 5');

    res.json({
      success: true,
      data: {
        total:             parseInt(total.rows[0].count),
        approved:          parseInt(approved.rows[0].count),
        pending:           parseInt(pending.rows[0].count),
        rejected:          parseInt(rejected.rows[0].count),
        objection:         parseInt(objection.rows[0].count),
        under_review:      parseInt(under_review.rows[0].count),
        active_staff:      parseInt(staff.rows[0].count),
        today_actions:     parseInt(today_logs.rows[0].count),
        pending_duplicates:parseInt(pending_dups.rows[0].count),
        by_district:       by_district.rows,
        by_status:         by_status.rows,
        recent_applications: recent.rows
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function getApplications(req, res) {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = [], params = [];

    if (status && status !== 'all') { where.push(`status=?`); params.push(status); }
    if (search) {
      where.push(`(application_no LIKE ? OR name LIKE ? OR mobile LIKE ?)`);
      params.push('%' + search + '%', '%' + search + '%', '%' + search + '%');
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countRes = await pool.query(`SELECT COUNT(*) FROM applications ${whereClause}`, params);
    const rows = await pool.query(
      `SELECT a.*,
       (SELECT COUNT(*) FROM objections o WHERE o.application_id=a.id) as objection_count,
       (SELECT COUNT(*) FROM certificates c WHERE c.application_id=a.id) as cert_count
       FROM applications a ${whereClause} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: { applications: rows.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function getApplicationById(req, res) {
  try {
    const { id } = req.params;
    const app = await pool.query('SELECT * FROM applications WHERE id=?', [id]);
    if (!app.rows.length) return res.status(404).json({ success: false, message: 'Not found', data: null });
    const objections = await pool.query('SELECT * FROM objections WHERE application_id=? ORDER BY id DESC', [id]);
    const uploads    = await pool.query('SELECT * FROM uploads WHERE application_id=? ORDER BY id DESC', [id]);
    const certs      = await pool.query('SELECT * FROM certificates WHERE application_id=?', [id]);
    res.json({ success: true, data: { application: app.rows[0], objections: objections.rows, uploads: uploads.rows, certificates: certs.rows } });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function updateApplicationStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['pending', 'objection', 'under_review', 'approved', 'rejected'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status', data: null });
    await pool.query('UPDATE applications SET status=? WHERE id=?', [status, id]);
    await logAction(req.user.username, req.user.role, 'update_status', `id=${id} → ${status}`);
    res.json({ success: true, message: `Status updated to ${status}`, data: null });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function getStaff(req, res) {
  try {
    const rows = await pool.query("SELECT id, username, role, active, created_at FROM users WHERE role IN ('admin','staff') ORDER BY created_at DESC");
    res.json({ success: true, data: rows.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function addStaff(req, res) {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !['admin', 'staff'].includes(role))
      return res.status(400).json({ success: false, message: 'username, password, role required', data: null });
    const existing = await pool.query('SELECT id FROM users WHERE username=?', [username]);
    if (existing.rows.length) return res.status(409).json({ success: false, message: 'Username already exists', data: null });
    await pool.query('INSERT INTO users(username,password,role,active) VALUES(?,?,?,1)', [username, password, role]);
    await logAction(req.user.username, 'admin', 'add_staff', `${username} (${role})`);
    res.json({ success: true, message: 'Staff member added', data: null });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function toggleStaff(req, res) {
  try {
    const { id } = req.params;
    const cur = await pool.query('SELECT active, username FROM users WHERE id=?', [id]);
    if (!cur.rows.length) return res.status(404).json({ success: false, message: 'User not found', data: null });
    const newActive = cur.rows[0].active ? 0 : 1;
    await pool.query('UPDATE users SET active=? WHERE id=?', [newActive, id]);
    await logAction(req.user.username, 'admin', newActive ? 'enable_staff' : 'disable_staff', cur.rows[0].username);
    res.json({ success: true, message: `Staff ${newActive ? 'enabled' : 'disabled'}`, data: { active: newActive } });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function getLogs(req, res) {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = [], params = [];

    if (search) {
      where.push(`(actor LIKE ? OR action LIKE ?)`);
      params.push('%' + search + '%', '%' + search + '%');
    }

    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = await pool.query(`SELECT COUNT(*) FROM action_logs ${wc}`, params);
    const rows  = await pool.query(`SELECT * FROM action_logs ${wc} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]);
    res.json({ success: true, data: { logs: rows.rows, total: parseInt(total.rows[0].count) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function getAlerts(req, res) {
  try {
    const pending_apps      = await pool.query("SELECT COUNT(*) FROM applications WHERE status='pending'");
    const pending_dups      = await pool.query("SELECT COUNT(*) FROM duplicate_requests WHERE status='pending'");
    const unresolved_obj    = await pool.query('SELECT COUNT(*) FROM objections WHERE resolved=0');
    const expired_otps      = await pool.query("SELECT COUNT(*) FROM otp_codes WHERE expires_at < NOW() AND used=0");
    const unverified_uploads= await pool.query('SELECT COUNT(*) FROM uploads WHERE verified=0');
    const overdue_obj       = await pool.query("SELECT a.application_no, a.name, o.type, o.deadline FROM objections o JOIN applications a ON a.id=o.application_id WHERE o.resolved=0 AND o.deadline < NOW() LIMIT 10");
    const recent_pending    = await pool.query("SELECT application_no, name, created_at FROM applications WHERE status='pending' ORDER BY created_at ASC LIMIT 5");
    res.json({
      success: true,
      data: {
        summary: {
          pending_applications:  parseInt(pending_apps.rows[0].count),
          pending_duplicates:    parseInt(pending_dups.rows[0].count),
          unresolved_objections: parseInt(unresolved_obj.rows[0].count),
          unverified_uploads:    parseInt(unverified_uploads.rows[0].count),
          expired_otps:          parseInt(expired_otps.rows[0].count)
        },
        overdue_objections: overdue_obj.rows,
        oldest_pending:     recent_pending.rows
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message, data: null }); }
}

async function adminLogin(req, res, next) {
  try {
    const jwt = require('jsonwebtoken');
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password required', data: null });
    const users = await pool.query(
      "SELECT * FROM users WHERE username=? AND password=? AND role IN ('admin','staff') AND active=1",
      [username, password]
    );
    if (!users.rows.length) return res.status(401).json({ success: false, message: 'Invalid credentials or account disabled', data: null });
    const user = users.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, process.env.JWT_SECRET, { expiresIn: '8h' });
    await logAction(user.username, user.role, 'admin_login');
    return res.json({ success: true, message: 'Login successful', data: { token, role: user.role, username: user.username } });
  } catch (error) { next(error); }
}

module.exports = {
  uploadExcelApplications, previewExcel, importExcel, autoImportExcel,
  overrideUpload, runManualBackup, restoreManualBackup, approveDuplicate,
  createApplication, getStats, getApplications, getApplicationById, updateApplicationStatus,
  getStaff, addStaff, toggleStaff, getLogs, getAlerts, adminLogin
};
