const pool = require('../config/db');

const USE_REAL_SMS = false;

function createOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function canSendOtp(applicationNo) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM otp_logs
     WHERE application_no = ? AND created_at >= (NOW() - INTERVAL 1 MINUTE)`,
    [applicationNo]
  );
  return rows[0].c < 3;
}

async function sendOtp(applicationNo, mobile) {
  const allowed = await canSendOtp(applicationNo);
  if (!allowed) throw new Error('OTP limit exceeded. Try after 1 minute.');

  const otp = createOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await pool.query(
    'INSERT INTO otp_logs (application_no, otp, expires_at) VALUES (?, ?, ?)',
    [applicationNo, otp, expiresAt]
  );

  if (USE_REAL_SMS) {
    // ADD SMS API HERE
  } else {
    console.log('[MOCK SMS] OTP: ' + otp);
  }

  return true;
}

async function verifyOtp(applicationNo, otp) {
  const [rows] = await pool.query(
    `SELECT id FROM otp_logs
     WHERE application_no = ? AND otp = ? AND used = 0 AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [applicationNo, otp]
  );
  if (!rows.length) return false;
  await pool.query('UPDATE otp_logs SET used = 1 WHERE id = ?', [rows[0].id]);
  return true;
}

module.exports = { sendOtp, verifyOtp };
