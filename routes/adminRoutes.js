const express = require('express');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const {
  importApplications,
  uploadCertificate,
  verifyUpload,
  adminOverride,
  applyUploadLimitRules,
  createManualBackup,
  restoreBackup,
  duplicateRequest,
  approveDuplicate
} = require('../controllers/adminController');

const upload = multer({ dest: path.join(__dirname, '..', 'uploads', 'temp') });
const router = express.Router();

router.post('/import-excel', authMiddleware, allowRoles('admin'), upload.single('file'), importApplications);
router.post('/upload-certificate', authMiddleware, allowRoles('admin'), upload.single('file'), uploadCertificate);
router.post('/verify-upload', authMiddleware, allowRoles('admin', 'staff'), verifyUpload);
router.post('/override', authMiddleware, allowRoles('admin'), adminOverride);
router.post('/apply-upload-rule', authMiddleware, allowRoles('admin', 'staff'), applyUploadLimitRules);
router.post('/backup', authMiddleware, allowRoles('admin'), createManualBackup);
router.post('/restore', authMiddleware, allowRoles('admin'), restoreBackup);

router.post('/duplicate/request', upload.single('photo'), duplicateRequest);
router.post('/duplicate/approve', authMiddleware, allowRoles('admin'), approveDuplicate);

module.exports = router;
