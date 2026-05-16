const pool = require('../config/db');

async function createMockPayment(applicationNo, amount = 100) {
  const txId = `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const unlockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO payments (application_no, tx_id, amount, status, unlock_until)
     VALUES (?, ?, ?, 'success', ?)`,
    [applicationNo, txId, amount, unlockUntil]
  );
  return { txId, unlockUntil };
}

async function hasPaidAccess(applicationNo) {
  const [rows] = await pool.query(
    `SELECT id FROM payments
     WHERE application_no = ? AND status = 'success' AND unlock_until > NOW()
     ORDER BY id DESC LIMIT 1`,
    [applicationNo]
  );
  return rows.length > 0;
}

module.exports = { createMockPayment, hasPaidAccess };
