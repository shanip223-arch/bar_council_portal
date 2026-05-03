const { pool } = require('../config/db');

const USE_REAL_SMS = false;

async function sendOtp(applicationNo) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await pool.query(
    'INSERT INTO otp_codes(application_no, otp, expires_at) VALUES(?,?,?)',
    [applicationNo, otp, expiresAt]
  );

  if (USE_REAL_SMS) {
    // ADD SMS API HERE
  } else {
    console.log('[MOCK SMS] OTP: ' + otp);
  }
  return otp;
}

async function verifyOtp(applicationNo, otp) {
  const result = await pool.query(
    `SELECT * FROM otp_codes
     WHERE application_no=? AND otp=? AND used=0 AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [applicationNo, otp]
  );
  if (!result.rows.length) return false;

  await pool.query('UPDATE otp_codes SET used=1 WHERE id=?', [result.rows[0].id]);
  return true;
}

module.exports = { sendOtp, verifyOtp, USE_REAL_SMS };
