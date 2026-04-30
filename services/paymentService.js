const { pool } = require('../config/db');

async function mockPaymentAndUnlock(applicationId) {
  const unlockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await pool.query('UPDATE applications SET paid_unlock_until=? WHERE id=?', [unlockUntil, applicationId]);
  return unlockUntil;
}

module.exports = { mockPaymentAndUnlock };
