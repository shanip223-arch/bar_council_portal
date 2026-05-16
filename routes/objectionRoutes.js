const express = require('express');
const { addObjection, listObjections } = require('../controllers/objectionController');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');

const router = express.Router();

router.post('/', authMiddleware, allowRoles('admin', 'staff'), addObjection);
router.get('/', authMiddleware, listObjections);

module.exports = router;
