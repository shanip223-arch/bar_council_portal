const express = require('express');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  getStaffDashboard, getStaffObjections, updateObjection,
  getStaffUploads, updateUpload
} = require('../controllers/staffController');

const router = express.Router();

router.get('/dashboard',          auth, role('admin','staff'), getStaffDashboard);
router.get('/objections',         auth, role('admin','staff'), getStaffObjections);
router.patch('/objection/:id',    auth, role('admin','staff'), updateObjection);
router.get('/uploads',            auth, role('admin','staff'), getStaffUploads);
router.patch('/upload/:id',       auth, role('admin','staff'), updateUpload);

module.exports = router;
