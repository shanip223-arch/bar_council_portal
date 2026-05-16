const pool = require('../config/db');
const { logAction } = require('../utils/logger');

async function addObjection(req, res) {
  const { application_no, type, remark } = req.body;
  if (!application_no || !type || !remark) return res.status(400).json({ message: 'Missing fields' });

  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO objections (application_no, type, remark, deadline, status) VALUES (?, ?, ?, ?, ?)',
    [application_no, type, remark, deadline, 'open']
  );
  await pool.query('UPDATE applications SET status = ? WHERE application_no = ?', ['objection', application_no]);

  logAction(req.user.role, req.user.id, 'ADD_OBJECTION', { application_no, type });
  res.json({ message: 'Objection added', deadline });
}

async function listObjections(req, res) {
  const appNo = req.user.role === 'candidate' ? req.user.application_no : req.query.application_no;
  const [rows] = await pool.query('SELECT * FROM objections WHERE application_no = ? ORDER BY id DESC', [appNo]);
  res.json(rows);
}

module.exports = { addObjection, listObjections };
