const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cron = require('node-cron');
const path = require('path');
const dotenv = require('dotenv');
const { initDb } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const staffRoutes = require('./routes/staffRoutes');
const objectionRoutes = require('./routes/objectionRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const { runBackup } = require('./services/backupService');
const { ensureDir } = require('./services/fileService');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

ensureDir(path.join(__dirname, 'uploads', 'temp'));
ensureDir(path.join(__dirname, 'uploads', 'verified'));
ensureDir(path.join(__dirname, 'uploads', 'certificates'));
ensureDir(path.join(__dirname, 'uploads', 'objections'));
ensureDir(path.join(__dirname, 'backups'));

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/public',  express.static(path.join(__dirname, 'public')));

app.use('/api/auth',        authRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/staff',       staffRoutes);
app.use('/api/objection',   objectionRoutes);
app.use('/api/upload',      uploadRoutes);
app.use('/api/certificate', certificateRoutes);

/* ── Page routes (explicit — no static override) ─── */
app.get('/',                (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/dashboard',       (req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));
app.get('/admin',           (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public/admin-dashboard.html')));
app.get('/duplicate',       (req, res) => res.sendFile(path.join(__dirname, 'public/duplicate.html')));
app.get('/staff-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public/staff-dashboard.html')));
app.get('/staff-objections',(req, res) => res.sendFile(path.join(__dirname, 'public/staff-objections.html')));
app.get('/staff-uploads',   (req, res) => res.sendFile(path.join(__dirname, 'public/staff-uploads.html')));
app.get('/staff-panel',     (req, res) => res.sendFile(path.join(__dirname, 'public/staff-panel.html')));
app.get('/main',            (req, res) => res.redirect('/'));

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found', data: null }));
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error', data: null });
});

cron.schedule('0 2 * * *', async () => { await runBackup('full'); });

const PORT = process.env.PORT || 5000;
initDb().then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Server running at http://0.0.0.0:${PORT}`)));
