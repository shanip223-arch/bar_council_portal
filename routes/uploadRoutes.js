const express = require('express');
const multer = require('multer');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { uploadObjectionDoc, verifyUpload } = require('../controllers/uploadController');

const upload = multer({ dest: 'uploads/temp' });
const router = express.Router();

router.post('/objection-doc', auth, role('candidate'), upload.single('file'), uploadObjectionDoc);
router.post('/verify', auth, role('admin', 'staff'), verifyUpload);

module.exports = router;
