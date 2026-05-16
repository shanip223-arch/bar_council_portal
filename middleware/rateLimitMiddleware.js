const rateLimit = require('express-rate-limit');

const otpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'OTP limit exceeded. Try after 1 minute.' }
});

module.exports = { otpRateLimiter };
