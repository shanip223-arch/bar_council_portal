const express = require('express');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const { uploadReply } = require('../controllers/uploadController');

const upload = multer({ dest: path.join(__dirname, '..', 'uploads', 'temp') });
const router = express.Router();

router.post('/', authMiddleware, allowRoles('candidate'), upload.single('file'), uploadReply);

module.exports = router;
