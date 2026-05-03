const express = require('express');
const multer = require('multer');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  uploadExcelApplications, overrideUpload, runManualBackup, restoreManualBackup, approveDuplicate,
  getStats, getApplications, getApplicationById, updateApplicationStatus,
  getStaff, addStaff, toggleStaff, getLogs, getAlerts, adminLogin
} = require('../controllers/adminController');

const upload = multer({ dest: 'uploads/temp' });
const router = express.Router();

router.post('/login', adminLogin);

router.get('/stats', auth, role('admin', 'staff'), getStats);
router.get('/applications', auth, role('admin', 'staff'), getApplications);
router.get('/applications/:id', auth, role('admin', 'staff'), getApplicationById);
router.put('/applications/:id/status', auth, role('admin', 'staff'), updateApplicationStatus);

router.get('/staff', auth, role('admin'), getStaff);
router.post('/staff', auth, role('admin'), addStaff);
router.patch('/staff/:id/toggle', auth, role('admin'), toggleStaff);

router.get('/logs', auth, role('admin', 'staff'), getLogs);
router.get('/alerts', auth, role('admin', 'staff'), getAlerts);

router.post('/excel-upload', auth, role('admin'), upload.single('file'), uploadExcelApplications);
router.post('/upload-excel', auth, role('admin'), upload.single('file'), uploadExcelApplications);
router.post('/override-upload', auth, role('admin'), overrideUpload);
router.post('/backup', auth, role('admin'), runManualBackup);
router.post('/restore', auth, role('admin'), restoreManualBackup);
router.post('/approve-duplicate', auth, role('admin'), approveDuplicate);

module.exports = router;
