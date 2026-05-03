const { pool } = require('../config/db');
const { logAction } = require('../utils/logger');

async function getStaffDashboard(req, res) {
  try {
    const pending_obj   = await pool.query("SELECT COUNT(*) FROM objections WHERE resolved=0");
    const overdue_obj   = await pool.query("SELECT COUNT(*) FROM objections WHERE resolved=0 AND deadline < NOW()");
    const pending_upl   = await pool.query("SELECT COUNT(*) FROM uploads WHERE review_status='pending'");
    const approved_upl  = await pool.query("SELECT COUNT(*) FROM uploads WHERE review_status='approved'");
    const rejected_upl  = await pool.query("SELECT COUNT(*) FROM uploads WHERE review_status='rejected'");
    const today_actions = await pool.query("SELECT COUNT(*) FROM action_logs WHERE actor=? AND created_at >= CURDATE()", [req.user.username]);
    const recent_logs = await pool.query("SELECT action, details, created_at FROM action_logs WHERE actor=? ORDER BY created_at DESC LIMIT 8", [req.user.username]);
    const recent_obj = await pool.query(`SELECT o.id, o.type, o.deadline, o.resolved, a.application_no, a.name FROM objections o JOIN applications a ON a.id=o.application_id ORDER BY o.created_at DESC LIMIT 5`);
    const recent_upl = await pool.query(`SELECT u.id, u.doc_type, u.review_status, u.uploaded_at, a.application_no, a.name FROM uploads u JOIN applications a ON a.id=u.application_id ORDER BY u.uploaded_at DESC LIMIT 5`);

    res.json({ success: true, data: {
      stats: {
        pending_objections: parseInt(pending_obj.rows[0].count),
        overdue_objections: parseInt(overdue_obj.rows[0].count),
        pending_uploads: parseInt(pending_upl.rows[0].count),
        approved_uploads: parseInt(approved_upl.rows[0].count),
        rejected_uploads: parseInt(rejected_upl.rows[0].count),
        completed_today: parseInt(today_actions.rows[0].count)
      },
      recent_logs: recent_logs.rows,
      recent_objections: recent_obj.rows,
      recent_uploads: recent_upl.rows
    }});
  } catch (e) { res.status(500).json({ success: false, message: e.message, data: null }); }
}

async function getStaffObjections(req, res) {
  try {
    const { filter = 'all', search = '', page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = [], params = [];
    if (filter === 'pending') where.push(`o.resolved=0 AND o.deadline >= NOW()`);
    if (filter === 'resolved') where.push(`o.resolved=1`);
    if (filter === 'overdue') where.push(`o.resolved=0 AND o.deadline < NOW()`);
    if (search) { where.push(`(a.application_no LIKE ? OR a.name LIKE ?)`); params.push('%' + search + '%', '%' + search + '%'); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countRes = await pool.query(`SELECT COUNT(*) FROM objections o JOIN applications a ON a.id=o.application_id ${wc}`, params);
    const rows = await pool.query(`SELECT o.id, o.type, o.remark, o.deadline, o.resolved, o.staff_remark, o.created_at, a.id AS app_id, a.application_no, a.name, a.district, (SELECT COUNT(*) FROM uploads u WHERE u.objection_id=o.id) AS upload_count FROM objections o JOIN applications a ON a.id=o.application_id ${wc} ORDER BY o.resolved ASC, o.deadline ASC LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]);
    res.json({ success: true, data: { objections: rows.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) } });
  } catch (e) { res.status(500).json({ success: false, message: e.message, data: null }); }
}

async function updateObjection(req, res) {
  try {
    const { id } = req.params;
    const { action, staff_remark } = req.body;
    const obj = await pool.query('SELECT * FROM objections WHERE id=?', [id]);
    if (!obj.rows.length) return res.status(404).json({ success: false, message: 'Objection not found', data: null });
    if (action === 'resolve') {
      await pool.query('UPDATE objections SET resolved=1, staff_remark=? WHERE id=?', [staff_remark || '', id]);
      const remaining = await pool.query('SELECT COUNT(*) FROM objections WHERE application_id=? AND resolved=0', [obj.rows[0].application_id]);
      if (parseInt(remaining.rows[0].count) === 0) await pool.query("UPDATE applications SET status='under_review' WHERE id=?", [obj.rows[0].application_id]);
      await logAction(req.user.username, req.user.role, 'resolve_objection', `id=${id}`);
    } else if (action === 'reopen') {
      await pool.query('UPDATE objections SET resolved=0, deadline=DATE_ADD(NOW(), INTERVAL 7 DAY), staff_remark=? WHERE id=?', [staff_remark || '', id]);
      await pool.query("UPDATE applications SET status='objection' WHERE id=?", [obj.rows[0].application_id]);
      await logAction(req.user.username, req.user.role, 'reopen_objection', `id=${id}`);
    } else if (action === 'remark') {
      if (!staff_remark) return res.status(400).json({ success: false, message: 'Remark required', data: null });
      await pool.query('UPDATE objections SET staff_remark=? WHERE id=?', [staff_remark, id]);
      await logAction(req.user.username, req.user.role, 'add_remark_objection', `id=${id}`);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Use: resolve | reopen | remark', data: null });
    }
    res.json({ success: true, message: `Objection ${action} successful`, data: null });
  } catch (e) { res.status(500).json({ success: false, message: e.message, data: null }); }
}

async function getStaffUploads(req, res) {
  try {
    const { filter = 'all', search = '', page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = [], params = [];
    if (filter === 'pending') where.push(`u.review_status='pending'`);
    if (filter === 'approved') where.push(`u.review_status='approved'`);
    if (filter === 'rejected') where.push(`u.review_status='rejected'`);
    if (search) { where.push(`(a.application_no LIKE ? OR a.name LIKE ?)`); params.push('%' + search + '%', '%' + search + '%'); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countRes = await pool.query(`SELECT COUNT(*) FROM uploads u JOIN applications a ON a.id=u.application_id ${wc}`, params);
    const rows = await pool.query(`SELECT u.id, u.doc_type, u.original_name, u.file_name, u.file_path, u.section_code, u.review_status, u.staff_remark, u.verified, u.uploaded_at, a.id AS app_id, a.application_no, a.name, a.district, o.type AS objection_type FROM uploads u JOIN applications a ON a.id=u.application_id LEFT JOIN objections o ON o.id=u.objection_id ${wc} ORDER BY u.uploaded_at DESC LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]);
    res.json({ success: true, data: { uploads: rows.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) } });
  } catch (e) { res.status(500).json({ success: false, message: e.message, data: null }); }
}

async function updateUpload(req, res) {
  try {
    const { id } = req.params;
    const { action, staff_remark } = req.body;
    const upl = await pool.query('SELECT * FROM uploads WHERE id=?', [id]);
    if (!upl.rows.length) return res.status(404).json({ success: false, message: 'Upload not found', data: null });
    if (action === 'approve') {
      await pool.query("UPDATE uploads SET review_status='approved', staff_remark=?, verified=1 WHERE id=?", [staff_remark || '', id]);
      await logAction(req.user.username, req.user.role, 'approve_upload', `id=${id}`);
    } else if (action === 'reject') {
      if (!staff_remark) return res.status(400).json({ success: false, message: 'Rejection reason required', data: null });
      await pool.query("UPDATE uploads SET review_status='rejected', staff_remark=? WHERE id=?", [staff_remark, id]);
      await logAction(req.user.username, req.user.role, 'reject_upload', `id=${id}: ${staff_remark}`);
    } else if (action === 'remark') {
      await pool.query('UPDATE uploads SET staff_remark=? WHERE id=?', [staff_remark, id]);
      await logAction(req.user.username, req.user.role, 'remark_upload', `id=${id}`);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Use: approve | reject | remark', data: null });
    }
    res.json({ success: true, message: `Upload ${action} successful`, data: null });
  } catch (e) { res.status(500).json({ success: false, message: e.message, data: null }); }
}

async function getStaffDuplicates(req, res) { try { res.status(501).json({ success: false, message: 'Not implemented', data: null }); } catch (e) { res.status(500).json({ success: false, message: e.message, data: null }); } }
async function manageDuplicate(req, res) { try { res.status(501).json({ success: false, message: 'Not implemented', data: null }); } catch (e) { res.status(500).json({ success: false, message: e.message, data: null }); } }

module.exports = { getStaffDashboard, getStaffObjections, updateObjection, getStaffUploads, updateUpload, getStaffDuplicates, manageDuplicate };
