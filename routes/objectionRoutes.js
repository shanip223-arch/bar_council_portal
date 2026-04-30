const express = require('express');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { addObjection, listObjections, resolveObjection } = require('../controllers/objectionController');

const router = express.Router();
router.post('/', auth, role('admin', 'staff'), addObjection);
router.get('/:application_no', auth, role('admin', 'staff', 'candidate'), listObjections);
router.post('/resolve', auth, role('admin', 'staff'), resolveObjection);

module.exports = router;
