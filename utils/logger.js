const { pool } = require('../config/db');

async function logAction(actor, role, action, details = '') {
  try {
    await pool.query(
      'INSERT INTO action_logs(actor, role, action, details) VALUES(?,?,?,?)',
      [actor || 'system', role || 'system', action, details]
    );
  } catch (error) {
    console.error('logAction failed', error.message);
  }
}

module.exports = { logAction };
