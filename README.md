# Bar Council Certificate Portal

## Setup Steps
1. Install Node.js 18+ and MySQL 8+.
2. Create database:
   ```sql
   CREATE DATABASE bar_council_portal;
   ```
3. Configure `.env`.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start:
   ```bash
   node server.js
   ```

Default users:
- admin / admin123
- staff / staff123

## Database SQL (Core)
Tables are auto-created by `config/db.js` on startup.
Main entities:
- users
- applications
- objections
- uploads
- certificates
- otp_codes
- duplicate_requests
- backup_logs
- action_logs

## Run Commands
```bash
npm install
node server.js
```

## Folder Explanation
- `config/` DB pool + schema init.
- `controllers/` business logic modules.
- `routes/` API route modules.
- `services/` OTP, payment, backup, file logic.
- `middleware/` auth, role, OTP rate limiter.
- `utils/` logger + validators.
- `uploads/temp` temporary files.
- `uploads/verified` verified objection files.
- `uploads/certificates` final certificate files.
- `backups/` JSON backup artifacts.
- `public/` HTML UI pages.
- `assets/` global CSS + JS.

## API Overview
- Auth: `/api/auth/login`, `/api/auth/verify-otp`
- Admin: `/api/admin/excel-upload`, `/api/admin/override-upload`, `/api/admin/backup`, `/api/admin/restore`, `/api/admin/approve-duplicate`
- Objection: `/api/objection`, `/api/objection/:application_no`, `/api/objection/resolve`
- Uploads: `/api/upload/objection-doc`, `/api/upload/verify`
- Certificate: `/api/certificate/upload`, `/api/certificate/request-download-otp`, `/api/certificate/download`, `/api/certificate/pay`, `/api/certificate/status`, `/api/certificate/duplicate-request`

## Notes
- Candidate “Forget Application” recovery is offline/manual by office verification.
- OTP expiry: 5 minutes.
- Session (JWT) expiry: 15 minutes.
- OTP request limit: 3/minute.
- Download policy: 2 free downloads, then mock payment unlock for 24h.
