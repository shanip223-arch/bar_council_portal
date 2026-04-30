const rateLimit = require('express-rate-limit');

const otpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'OTP limit exceeded. Try later.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { otpRateLimiter };
