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

module.exports = { addObjection, listObjections, resolveObjection };
