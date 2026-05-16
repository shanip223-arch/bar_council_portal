const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { status, requestDownloadOtp, downloadCertificate, payForUnlock } = require('../controllers/certificateController');

const router = express.Router();

router.get('/status', authMiddleware, status);
router.post('/request-download-otp', requestDownloadOtp);
router.post('/download', downloadCertificate);
router.post('/pay-unlock', payForUnlock);

module.exports = router;
