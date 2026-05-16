const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cron = require('node-cron');
const pool = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const objectionRoutes = require('./routes/objectionRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { createBackup } = require('./services/backupService');

dotenv.config();
const app = express();

app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/', express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/objections', objectionRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    role ENUM('admin','staff') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_no VARCHAR(20) UNIQUE,
    name VARCHAR(150),
    father_name VARCHAR(150),
    mobile VARCHAR(10),
    district VARCHAR(100),
    status ENUM('pending','objection','under_review','approved') DEFAULT 'pending',
    upload_enabled TINYINT DEFAULT 1,
    upload_cycle INT DEFAULT 1,
    final_chance_used TINYINT DEFAULT 0,
    certificate_path TEXT NULL,
    download_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS objections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_no VARCHAR(20),
    type VARCHAR(100),
    remark TEXT,
    deadline DATETIME,
    status ENUM('open','resolved') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_no VARCHAR(20),
    objection_id INT,
    file_type VARCHAR(100),
    file_path TEXT,
    status ENUM('pending_verification','verified','rejected') DEFAULT 'pending_verification',
    cycle INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS otp_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_no VARCHAR(20),
    otp VARCHAR(6),
    used TINYINT DEFAULT 0,
    expires_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS download_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_no VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_no VARCHAR(20),
    tx_id VARCHAR(100),
    amount DECIMAL(10,2),
    status VARCHAR(20),
    unlock_until DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS duplicate_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_no VARCHAR(20),
    photo_path TEXT,
    issue_no VARCHAR(10),
    status ENUM('pending','approved','rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`INSERT IGNORE INTO users (username, password, role) VALUES
  ('admin', 'admin123', 'admin'),
  ('staff', 'staff123', 'staff')`);
}

cron.schedule('0 * * * *', async () => {
  try {
    await createBackup('full');
  } catch (e) {
    console.error('Backup job failed', e.message);
  }
});

initDb().then(() => {
  app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
  });
}).catch((e) => {
  console.error('DB init failed', e);
  process.exit(1);
});
