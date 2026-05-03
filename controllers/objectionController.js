const { pool } = require('../config/db');
const { logAction } = require('../utils/logger');

async function addObjection(req, res) {
  const { application_no, type, remark } = req.body;
  try {
    const apps = await pool.query('SELECT * FROM applications WHERE application_no=$1', [application_no]);
    if (!apps.rows.length) return res.status(404).json({ error: 'Application not found' });

    const app = apps.rows[0];
    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO objections(application_id,type,remark,deadline,created_by) VALUES($1,$2,$3,$4,$5)',
      [app.id, type, remark, deadline, req.user.id]
    );
    await pool.query('UPDATE applications SET status=$1 WHERE id=$2', ['objection', app.id]);
    await logAction(req.user.username, req.user.role, 'add_objection', `${application_no}:${type}`);
    res.json({ message: 'Objection created', deadline });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function listObjections(req, res) {
  const { application_no } = req.params;
  try {
    const result = await pool.query(
      `SELECT o.* FROM objections o
       JOIN applications a ON a.id=o.application_id
       WHERE a.application_no=$1 ORDER BY o.id DESC`,
      [application_no]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function resolveObjection(req, res) {
  const { objection_id } = req.body;
  try {
    await pool.query('UPDATE objections SET resolved=1 WHERE id=$1', [objection_id]);
    await logAction(req.user.username, req.user.role, 'resolve_objection', `id=${objection_id}`);
    res.json({ message: 'Marked resolved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function listAllObjections(req, res) {
  const { search = '', status = '', page = 1, limit = 30 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const vals = [];
    const where = [];
    let i = 1;
    if (search) {
      where.push(`(a.application_no ILIKE $${i} OR a.name ILIKE $${i})`);
      vals.push('%' + search + '%');
      i++;
    }
    if (status === 'resolved')   where.push('o.resolved = true');
    if (status === 'unresolved') where.push('(o.resolved = false OR o.resolved IS NULL)');
    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM objections o JOIN applications a ON a.id=o.application_id ${whereStr}`,
      vals
    );
    const rows = await pool.query(
      `SELECT o.id, o.type, o.remark, o.deadline, o.resolved, o.created_at,
              a.application_no, a.name, a.mobile
       FROM objections o
       JOIN applications a ON a.id=o.application_id
       ${whereStr}
       ORDER BY o.id DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, parseInt(limit), offset]
    );
    res.json({
      success: true, message: 'OK',
      data: { objections: rows.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, data: null });
  }
}

module.exports = { addObjection, listObjections, resolveObjection, listAllObjections };
