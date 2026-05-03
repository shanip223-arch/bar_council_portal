const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK(role IN ('admin','staff','candidate')),
    application_no VARCHAR(20) NULL,
    active SMALLINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    application_no VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    father_name VARCHAR(150) NOT NULL,
    mobile VARCHAR(10) NOT NULL,
    district VARCHAR(80) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending','objection','under_review','approved','rejected')),
    upload_enabled SMALLINT DEFAULT 1,
    final_chance_used SMALLINT DEFAULT 0,
    reopen_count INT DEFAULT 0,
    download_count INT DEFAULT 0,
    paid_unlock_until TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS objections (
    id SERIAL PRIMARY KEY,
    application_id INT NOT NULL,
    type VARCHAR(100) NOT NULL,
    remark TEXT NOT NULL,
    staff_remark TEXT DEFAULT '',
    deadline TIMESTAMP NOT NULL,
    resolved SMALLINT DEFAULT 0,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    application_id INT NOT NULL,
    objection_id INT NULL,
    section_code VARCHAR(10) NOT NULL,
    doc_type VARCHAR(80) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    verified SMALLINT DEFAULT 0,
    review_status VARCHAR(20) DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
    staff_remark TEXT DEFAULT '',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS certificates (
    id SERIAL PRIMARY KEY,
    application_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    uploaded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS otp_codes (
    id SERIAL PRIMARY KEY,
    application_no VARCHAR(20) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS duplicate_requests (
    id SERIAL PRIMARY KEY,
    application_no VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    photo_path VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    issue_code VARCHAR(10) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS backup_logs (
    id SERIAL PRIMARY KEY,
    backup_type VARCHAR(20) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS action_logs (
    id SERIAL PRIMARY KEY,
    actor VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  /* ── Seed default users ─────────────────────────── */
  const admins = await pool.query("SELECT id FROM users WHERE username='admin'");
  if (!admins.rows.length) {
    await pool.query(
      "INSERT INTO users(username,password,role,active) VALUES('admin','admin123','admin',1),('staff','staff123','staff',1)"
    );
  }

  /* ── Safe column additions for existing DBs ─────── */
  const safeCols = [
    "ALTER TABLE users       ADD COLUMN IF NOT EXISTS active SMALLINT DEFAULT 1",
    "ALTER TABLE objections  ADD COLUMN IF NOT EXISTS staff_remark TEXT DEFAULT ''",
    "ALTER TABLE uploads     ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'pending'",
    "ALTER TABLE uploads     ADD COLUMN IF NOT EXISTS staff_remark TEXT DEFAULT ''"
  ];
  for (const sql of safeCols) {
    try { await pool.query(sql); } catch (_) {}
  }
}

module.exports = { pool, initDb };
