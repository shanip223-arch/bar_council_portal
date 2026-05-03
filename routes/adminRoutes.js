const express = require('express');
const multer  = require('multer');
const path    = require('path');
const auth    = require('../middleware/authMiddleware');
const role    = require('../middleware/roleMiddleware');
const {
  uploadExcelApplications, previewExcel, importExcel, autoImportExcel,
  overrideUpload, runManualBackup, restoreManualBackup, approveDuplicate,
  getStats, getApplications, getApplicationById, updateApplicationStatus,
  createApplication, getStaff, addStaff, toggleStaff, getLogs, getAlerts, adminLogin
} = require('../controllers/adminController');

/* ── Multer: diskStorage preserves original extension ── */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/temp'),
  filename:    (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  }
});

const ALLOWED_EXTS  = ['.xlsx', '.xls'];
const ALLOWED_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',   // some browsers send this for .xls
];

const fileFilter = (req, file, cb) => {
  const ext  = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;
  if (ALLOWED_EXTS.includes(ext) && ALLOWED_MIMES.includes(mime)) return cb(null, true);
  if (ALLOWED_EXTS.includes(ext)) return cb(null, true);  // trust extension if mime ambiguous
  cb(new Error('Invalid file type. Only .xlsx and .xls files are accepted.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }   // 20 MB max
});

/* ── Multer error handler ── */
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const msg = err instanceof multer.MulterError
      ? 'Upload error: ' + err.message
      : err.message || 'File upload failed';
    return res.status(400).json({ success: false, message: msg, data: null });
  });
}

const router = express.Router();

router.post('/login', adminLogin);

router.get('/stats',              auth, role('admin', 'staff'), getStats);
router.get('/applications',       auth, role('admin', 'staff'), getApplications);
router.get('/applications/:id',   auth, role('admin', 'staff'), getApplicationById);
router.put('/applications/:id/status', auth, role('admin', 'staff'), updateApplicationStatus);
router.post('/applications',       auth, role('admin', 'staff'), createApplication);

router.get('/staff',              auth, role('admin'), getStaff);
router.post('/staff',             auth, role('admin'), addStaff);
router.patch('/staff/:id/toggle', auth, role('admin'), toggleStaff);

router.get('/logs',               auth, role('admin', 'staff'), getLogs);
router.get('/alerts',             auth, role('admin', 'staff'), getAlerts);

router.post('/upload-excel',      auth, role('admin'), handleUpload, uploadExcelApplications);
router.post('/excel-upload',      auth, role('admin'), handleUpload, uploadExcelApplications);
router.post('/excel-preview',      auth, role('admin','staff'), handleUpload, previewExcel);
router.post('/excel-import',       auth, role('admin','staff'), importExcel);
router.post('/excel-auto-import',  auth, role('admin','staff'), handleUpload, autoImportExcel);
router.post('/override-upload',   auth, role('admin'), overrideUpload);
router.post('/backup',            auth, role('admin'), runManualBackup);
router.post('/restore',           auth, role('admin'), restoreManualBackup);
router.post('/approve-duplicate', auth, role('admin'), approveDuplicate);

module.exports = router;
