const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY,username VARCHAR(100) NOT NULL UNIQUE,password VARCHAR(255) NOT NULL,role ENUM('admin','staff','candidate') NOT NULL,application_no VARCHAR(20) NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS applications (id INT AUTO_INCREMENT PRIMARY KEY,application_no VARCHAR(20) NOT NULL UNIQUE,name VARCHAR(150) NOT NULL,father_name VARCHAR(150) NOT NULL,mobile VARCHAR(10) NOT NULL,district VARCHAR(80) NOT NULL,status ENUM('pending','objection','under_review','approved') DEFAULT 'pending',upload_enabled TINYINT(1) DEFAULT 1,final_chance_used TINYINT(1) DEFAULT 0,reopen_count INT DEFAULT 0,download_count INT DEFAULT 0,paid_unlock_until DATETIME NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS objections (id INT AUTO_INCREMENT PRIMARY KEY,application_id INT NOT NULL,type VARCHAR(100) NOT NULL,remark TEXT NOT NULL,deadline DATETIME NOT NULL,resolved TINYINT(1) DEFAULT 0,created_by INT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS uploads (id INT AUTO_INCREMENT PRIMARY KEY,application_id INT NOT NULL,objection_id INT NULL,section_code VARCHAR(10) NOT NULL,doc_type VARCHAR(80) NOT NULL,original_name VARCHAR(255) NOT NULL,file_name VARCHAR(255) NOT NULL,file_path VARCHAR(255) NOT NULL,verified TINYINT(1) DEFAULT 0,uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS certificates (id INT AUTO_INCREMENT PRIMARY KEY,application_id INT NOT NULL,file_name VARCHAR(255) NOT NULL,file_path VARCHAR(255) NOT NULL,uploaded_by INT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS otp_codes (id INT AUTO_INCREMENT PRIMARY KEY,application_no VARCHAR(20) NOT NULL,otp VARCHAR(6) NOT NULL,expires_at DATETIME NOT NULL,used TINYINT(1) DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS duplicate_requests (id INT AUTO_INCREMENT PRIMARY KEY,application_no VARCHAR(20) NOT NULL,reason TEXT NOT NULL,photo_path VARCHAR(255) NOT NULL,status ENUM('pending','approved','rejected') DEFAULT 'pending',issue_code VARCHAR(10) NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS backup_logs (id INT AUTO_INCREMENT PRIMARY KEY,backup_type ENUM('objection','upload','full') NOT NULL,file_path VARCHAR(255) NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS action_logs (id INT AUTO_INCREMENT PRIMARY KEY,actor VARCHAR(100) NOT NULL,role VARCHAR(20) NOT NULL,action VARCHAR(255) NOT NULL,details TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

  const [admins] = await pool.query("SELECT id FROM users WHERE username='admin'");
  if (!admins.length) await pool.query("INSERT INTO users(username,password,role) VALUES('admin','admin123','admin'),('staff','staff123','staff')");
}

module.exports = { pool, initDb };
