# Bar Council Certificate Portal

## Setup Steps
1. Install Node.js 18+ and MySQL 8+.
2. Create database:
   ```sql
   CREATE DATABASE bar_council_portal;
   ```
3. Update `.env` if needed.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start server:
   ```bash
   node server.js
   ```
6. Open:
   - `http://localhost:3000/` (login)
   - `http://localhost:3000/public/admin.html`
   - `http://localhost:3000/public/dashboard.html`
   - `http://localhost:3000/public/duplicate.html`

## Default Credentials
- Admin: `admin / admin123`
- Staff: `staff / staff123`

## Environment
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=bar_council_portal
JWT_SECRET=supersecretchangeit
USE_REAL_SMS=false
```

## Database SQL
All required tables are auto-created at startup in `server.js`.
Manual reference SQL:

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE,
  password VARCHAR(255),
  role ENUM('admin','staff') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE applications (
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
);

CREATE TABLE objections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_no VARCHAR(20),
  type VARCHAR(100),
  remark TEXT,
  deadline DATETIME,
  status ENUM('open','resolved') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE uploads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_no VARCHAR(20),
  objection_id INT,
  file_type VARCHAR(100),
  file_path TEXT,
  status ENUM('pending_verification','verified','rejected') DEFAULT 'pending_verification',
  cycle INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE otp_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_no VARCHAR(20),
  otp VARCHAR(6),
  used TINYINT DEFAULT 0,
  expires_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE download_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_no VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_no VARCHAR(20),
  tx_id VARCHAR(100),
  amount DECIMAL(10,2),
  status VARCHAR(20),
  unlock_until DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE duplicate_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_no VARCHAR(20),
  photo_path TEXT,
  issue_no VARCHAR(10),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Run Commands
```bash
npm install
node server.js
```

## Folder Explanation
- `config/`: DB config.
- `controllers/`: Business logic modules.
- `routes/`: API routes.
- `services/`: OTP, file handling, backup, payment services.
- `middleware/`: Auth, role, and rate-limit middleware.
- `utils/`: Logger and validators.
- `uploads/temp`: incoming files.
- `uploads/verified`: verified archive area.
- `uploads/certificates`: certificates.
- `backups/`: backup files and action logs.
- `public/`: HTML pages.
- `assets/`: CSS and JavaScript.
- `server.js`: startup, schema bootstrap, route wiring.
