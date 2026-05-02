# Bar Council Certificate Portal

## Overview
A Node.js/Express web portal for managing bar council certificate applications. Candidates can log in via OTP, view objections, and download certificates. Admins/staff can upload applications (via Excel), manage objections, verify documents, and upload certificates.

## Architecture
- **Backend**: Node.js + Express (server.js) on port 5000
- **Database**: Replit PostgreSQL (migrated from MySQL)
- **Frontend**: Static HTML pages in `public/` served by Express
- **Assets**: CSS and JS in `assets/`

## Project Structure
- `server.js` — Main Express server entry point
- `config/db.js` — PostgreSQL pool and schema initialization (auto-creates tables on startup)
- `controllers/` — Business logic (auth, admin, objection, upload, certificate)
- `routes/` — API route definitions
- `middleware/` — JWT auth, role-based access, OTP rate limiting
- `services/` — OTP (mock SMS), payment (mock), backup/restore, file utilities
- `utils/` — Logger, validators
- `public/` — Static HTML pages (index, dashboard, admin, duplicate)
- `assets/` — Global CSS (style.css) and JS (app.js)
- `uploads/` — File storage (temp, verified, certificates) — created at startup
- `backups/` — JSON backup artifacts

## Key Features
- Candidate login via OTP (mock SMS, OTP logged to console)
- Admin/staff login via username/password (JWT, 15min expiry)
- Excel upload for bulk application import
- Objection management with 7-day deadlines
- Document upload with final-chance logic
- Certificate upload and OTP-gated download (2 free, then mock payment)
- Duplicate certificate requests
- Manual and scheduled (2am daily) backup/restore

## Default Users
- `admin` / `admin123` (role: admin)
- `staff` / `staff123` (role: staff)

## API Routes
- Auth: `POST /api/auth/login`, `POST /api/auth/verify-otp`
- Admin: `POST /api/admin/upload-excel`, `POST /api/admin/override-upload`, `POST /api/admin/backup`, `POST /api/admin/restore`, `POST /api/admin/approve-duplicate`
- Objection: `POST /api/objection`, `GET /api/objection/:application_no`, `POST /api/objection/resolve`
- Upload: `POST /api/upload/objection-doc`, `POST /api/upload/verify`
- Certificate: `POST /api/certificate/upload`, `POST /api/certificate/request-download-otp`, `POST /api/certificate/download`, `POST /api/certificate/pay`, `GET /api/certificate/status`, `POST /api/certificate/duplicate-request`

## Environment Variables
- `PORT` — Server port (5000)
- `JWT_SECRET` — JWT signing secret
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)

## Database Migration Notes
- Originally used MySQL (`mysql2`); migrated to Replit PostgreSQL (`pg`)
- All `?` placeholders replaced with `$1, $2...`
- All `pool.query()` calls updated to use `.rows` on results
- MySQL-specific syntax (TINYINT, SHOW TABLES, IF()) replaced with PostgreSQL equivalents
- Schema auto-initializes on startup via `initDb()` in `config/db.js`

## Run Command
```bash
node server.js
```
