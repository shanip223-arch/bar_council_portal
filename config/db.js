const dotenv = require('dotenv');
dotenv.config();

/* ── Driver selection ──────────────────────────────────────────────────
   Priority:
   1. If DATABASE_URL is a PostgreSQL URL → always use PostgreSQL (pg)
   2. If DATABASE_URL starts with mysql:// → use MySQL (mysql2)
   3. If DB_HOST is set (local .env) and no Postgres DATABASE_URL → MySQL
   This ensures Replit's built-in PostgreSQL is always preferred over
   any local .env MySQL credentials when running in the Replit environment. */
const DATABASE_URL = process.env.DATABASE_URL || '';
const isPgUrl   = DATABASE_URL.startsWith('postgres');
const isMysqlUrl = DATABASE_URL.startsWith('mysql');
const useMySQL = !isPgUrl && (isMysqlUrl || !!process.env.DB_HOST);

/* ── Convert MySQL SQL → PostgreSQL SQL ────────────────────────────────
   Handles:  ? → $N placeholders
             CURDATE()                    → CURRENT_DATE
             DATE_ADD(x, INTERVAL N DAY)  → (x + INTERVAL 'N days')      */
function toPgSql(sql) {
  let result = sql;
  /* MySQL date functions → PostgreSQL equivalents */
  result = result.replace(/\bCURDATE\s*\(\s*\)/gi, 'CURRENT_DATE');
  result = result.replace(
    /DATE_ADD\s*\(\s*(NOW\s*\(\s*\))\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi,
    (_, _fn, n) => `(NOW() + INTERVAL '${n} days')`
  );
  /* ? → $N */
  let i = 0;
  result = result.replace(/\?/g, () => `$${++i}`);
  return result;
}

/* ── Build the unified pool wrapper ── */
let _mysqlPool, _pgPool;

function getMysqlPool() {
  if (!_mysqlPool) {
    const mysql = require('mysql2/promise');
    _mysqlPool = mysql.createPool({
      host:     process.env.DB_HOST     || 'localhost',
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME     || 'bar_council_portal',
      port:     process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return _mysqlPool;
}

function getPgPool() {
  if (!_pgPool) {
    const { Pool } = require('pg');
    _pgPool = new Pool({ connectionString: DATABASE_URL });
  }
  return _pgPool;
}

/* ── pg-compatible wrapper: always returns { rows } ───────────────────
   - SELECT  → rows is the result array
   - DML     → rows is []
   - COUNT(*) without alias is normalised → .count                       */
const pool = {
  async query(sql, params) {
    if (useMySQL) {
      const mp = getMysqlPool();
      const args = (params && params.length) ? [sql, params] : [sql];
      const [result] = await mp.query(...args);
      const rows = Array.isArray(result) ? result : [];
      rows.forEach(r => {
        if (r && 'COUNT(*)' in r && !('count' in r)) r.count = r['COUNT(*)'];
      });
      return { rows };
    } else {
      const pgSql = toPgSql(sql);
      const pp = getPgPool();
      const result = await pp.query(pgSql, params || []);
      return { rows: result.rows };
    }
  }
};

async function initDb() {
  const driver = useMySQL ? 'MySQL' : 'PostgreSQL';
  console.log(`[DB] Using ${driver} driver`);

  try {
    if (useMySQL) {
      await pool.query(`CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        application_no VARCHAR(20) NULL,
        active SMALLINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_no VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        father_name VARCHAR(150) NOT NULL,
        mobile VARCHAR(10) NOT NULL,
        district VARCHAR(80) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        upload_enabled SMALLINT DEFAULT 1,
        final_chance_used SMALLINT DEFAULT 0,
        reopen_count INT DEFAULT 0,
        download_count INT DEFAULT 0,
        paid_unlock_until TIMESTAMP NULL,
        dob VARCHAR(30) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS objections (
        id INT AUTO_INCREMENT PRIMARY KEY,
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
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        objection_id INT NULL,
        section_code VARCHAR(10) NOT NULL,
        doc_type VARCHAR(80) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        verified SMALLINT DEFAULT 0,
        review_status VARCHAR(20) DEFAULT 'pending',
        staff_remark TEXT DEFAULT '',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS certificates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        uploaded_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS otp_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_no VARCHAR(20) NOT NULL,
        otp VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used SMALLINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS duplicate_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_no VARCHAR(20) NOT NULL,
        reason TEXT NOT NULL,
        photo_path VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        issue_code VARCHAR(10) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS backup_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        backup_type VARCHAR(20) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS action_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        actor VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        action VARCHAR(255) NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    } else {
      /* ── PostgreSQL DDL ── */
      await pool.query(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
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
        status VARCHAR(20) DEFAULT 'pending',
        upload_enabled SMALLINT DEFAULT 1,
        final_chance_used SMALLINT DEFAULT 0,
        reopen_count INT DEFAULT 0,
        download_count INT DEFAULT 0,
        paid_unlock_until TIMESTAMP NULL,
        dob VARCHAR(30) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS objections (
        id SERIAL PRIMARY KEY,
        application_id INT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        remark TEXT NOT NULL,
        staff_remark TEXT DEFAULT '',
        deadline TIMESTAMP NOT NULL,
        resolved SMALLINT DEFAULT 0,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS uploads (
        id SERIAL PRIMARY KEY,
        application_id INT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        objection_id INT NULL,
        section_code VARCHAR(10) NOT NULL,
        doc_type VARCHAR(80) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        verified SMALLINT DEFAULT 0,
        review_status VARCHAR(20) DEFAULT 'pending',
        staff_remark TEXT DEFAULT '',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS certificates (
        id SERIAL PRIMARY KEY,
        application_id INT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        uploaded_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        status VARCHAR(20) DEFAULT 'pending',
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
    }

    /* ── Seed default users (works for both drivers) ── */
    const admins = await pool.query("SELECT id FROM users WHERE username='admin'");
    if (!admins.rows.length) {
      await pool.query(
        "INSERT INTO users(username,password,role,active) VALUES(?,?,?,1),(?,?,?,1)",
        ['admin', 'admin123', 'admin', 'staff', 'staff123', 'staff']
      );
    }

    /* ── Safe column additions ── */
    if (useMySQL) {
      const safeCols = [
        "ALTER TABLE users        ADD COLUMN IF NOT EXISTS active SMALLINT DEFAULT 1",
        "ALTER TABLE objections   ADD COLUMN IF NOT EXISTS staff_remark TEXT DEFAULT ''",
        "ALTER TABLE uploads      ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'pending'",
        "ALTER TABLE uploads      ADD COLUMN IF NOT EXISTS staff_remark TEXT DEFAULT ''",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS dob VARCHAR(30) DEFAULT NULL"
      ];
      for (const sql of safeCols) {
        try { await pool.query(sql); } catch (_) {}
      }
    } else {
      const safeCols = [
        "ALTER TABLE users        ADD COLUMN IF NOT EXISTS active SMALLINT DEFAULT 1",
        "ALTER TABLE objections   ADD COLUMN IF NOT EXISTS staff_remark TEXT DEFAULT ''",
        "ALTER TABLE uploads      ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'pending'",
        "ALTER TABLE uploads      ADD COLUMN IF NOT EXISTS staff_remark TEXT DEFAULT ''",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS dob VARCHAR(30) DEFAULT NULL"
      ];
      for (const sql of safeCols) {
        try { await pool.query(sql); } catch (_) {}
      }
    }

    console.log('[DB] Database initialization complete');
  } catch (error) {
    console.error('[DB] Initialization failed:', error.message);
    throw error;
  }
}

module.exports = { pool, initDb };
