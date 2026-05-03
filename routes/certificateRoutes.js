const express = require('express');
const multer = require('multer');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { uploadCertificate, requestDownloadOtp, downloadCertificate, payForDownload, getCandidateStatus, requestDuplicate } = require('../controllers/certificateController');

const upload = multer({ dest: 'uploads/temp' });
const router = express.Router();

router.post('/upload', auth, role('admin','staff'), upload.single('file'), uploadCertificate);
router.post('/request-download-otp', requestDownloadOtp);
router.post('/download', downloadCertificate);
router.post('/pay', payForDownload);
router.get('/status', auth, role('candidate'), getCandidateStatus);
router.post('/duplicate-request', upload.single('photo'), requestDuplicate);

module.exports = router;
