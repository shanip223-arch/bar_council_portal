const express = require('express');
const { login, verifyCandidateOtp } = require('../controllers/authController');
const { otpRateLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();
router.post('/login', otpRateLimiter, login);
router.post('/verify-otp', otpRateLimiter, verifyCandidateOtp);

module.exports = router;
