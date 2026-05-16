const express = require('express');
const { loginAdmin, requestCandidateOtp, verifyCandidateOtp } = require('../controllers/authController');
const { otpRateLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

router.post('/admin-login', loginAdmin);
router.post('/candidate/request-otp', otpRateLimiter, requestCandidateOtp);
router.post('/candidate/verify-otp', verifyCandidateOtp);

module.exports = router;
