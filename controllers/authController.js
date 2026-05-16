const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendOtp, verifyOtp } = require('../services/otpService');
const { isValidAppNo } = require('../utils/validator');
const { logAction } = require('../utils/logger');

async function loginAdmin(req, res) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Missing credentials' });

  const [rows] = await pool.query('SELECT id, username, role FROM users WHERE username = ? AND password = ?', [username, password]);
  if (!rows.length) return res.status(401).json({ message: 'Invalid credentials' });

  const user = rows[0];
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
  logAction(user.role, user.id, 'LOGIN', { username });
  res.json({ token, role: user.role });
}

async function requestCandidateOtp(req, res) {
  const { application_no } = req.body;
  if (!isValidAppNo(application_no)) return res.status(400).json({ message: 'Invalid application number format' });

  const [rows] = await pool.query('SELECT id, mobile FROM applications WHERE application_no = ?', [application_no]);
  if (!rows.length) return res.status(404).json({ message: 'Application not found' });

  await sendOtp(application_no, rows[0].mobile);
  logAction('candidate', application_no, 'OTP_REQUESTED', {});
  res.json({ message: 'OTP sent' });
}

async function verifyCandidateOtp(req, res) {
  const { application_no, otp } = req.body;
  if (!isValidAppNo(application_no) || !otp) return res.status(400).json({ message: 'Invalid request' });

  const valid = await verifyOtp(application_no, otp);
  if (!valid) return res.status(401).json({ message: 'Invalid or expired OTP' });

  const [rows] = await pool.query('SELECT id FROM applications WHERE application_no = ?', [application_no]);
  const token = jwt.sign({ id: rows[0].id, application_no, role: 'candidate' }, process.env.JWT_SECRET, { expiresIn: '15m' });
  logAction('candidate', application_no, 'LOGIN', {});
  res.json({ token, role: 'candidate' });
}

module.exports = { loginAdmin, requestCandidateOtp, verifyCandidateOtp };
