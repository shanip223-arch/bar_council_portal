const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { sendOtp, verifyOtp } = require('../services/otpService');
const { logAction } = require('../utils/logger');
const { validateApplicationNo } = require('../utils/validator');

async function login(req, res, next) {
  try {
    const { username, password, application_no } = req.body;

    if (application_no) {
      if (!validateApplicationNo(application_no)) return res.status(400).json({ success: false, message: 'Invalid application number format', data: null });
      const apps = await pool.query('SELECT * FROM applications WHERE application_no=$1', [application_no]);
      if (!apps.rows.length) return res.status(404).json({ success: false, message: 'Application not found', data: null });
      await sendOtp(application_no);
      await logAction(application_no, 'candidate', 'otp_requested');
      return res.json({ success: true, message: 'OTP sent', data: { application_no } });
    }

    if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password required', data: null });
    const users = await pool.query('SELECT * FROM users WHERE username=$1 AND password=$2', [username, password]);
    if (!users.rows.length) return res.status(401).json({ success: false, message: 'Invalid credentials', data: null });

    const user = users.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, process.env.JWT_SECRET, { expiresIn: '15m' });
    await logAction(user.username, user.role, 'login');
    return res.json({ success: true, message: 'Login successful', data: { token, role: user.role } });
  } catch (error) { next(error); }
}

async function verifyCandidateOtp(req, res, next) {
  try {
    const { application_no, otp } = req.body;
    if (!validateApplicationNo(application_no)) return res.status(400).json({ success: false, message: 'Invalid application number format', data: null });
    if (!/^\d{6}$/.test(String(otp || ''))) return res.status(400).json({ success: false, message: 'Invalid OTP format', data: null });
    const valid = await verifyOtp(application_no, otp);
    if (!valid) return res.status(400).json({ success: false, message: 'Invalid/expired OTP', data: null });

    const token = jwt.sign({ role: 'candidate', application_no }, process.env.JWT_SECRET, { expiresIn: '15m' });
    await logAction(application_no, 'candidate', 'candidate_login');
    return res.json({ success: true, message: 'OTP verified', data: { token, role: 'candidate' } });
  } catch (error) { next(error); }
}

module.exports = { login, verifyCandidateOtp };
