const express = require('express');
const multer = require('multer');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { uploadExcelApplications, overrideUpload, runManualBackup, restoreManualBackup, approveDuplicate } = require('../controllers/adminController');

const upload = multer({ dest: 'uploads/temp' });
const router = express.Router();

router.post('/excel-upload', auth, role('admin'), upload.single('file'), uploadExcelApplications);
router.post('/upload-excel', auth, role('admin'), upload.single('file'), uploadExcelApplications);
router.post('/override-upload', auth, role('admin'), overrideUpload);
router.post('/backup', auth, role('admin'), runManualBackup);
router.post('/restore', auth, role('admin'), restoreManualBackup);
router.post('/approve-duplicate', auth, role('admin'), approveDuplicate);

module.exports = router;
