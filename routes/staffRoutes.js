const express = require('express');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  getStaffDashboard, getStaffObjections, updateObjection,
  getStaffUploads, updateUpload,
  getStaffDuplicates, manageDuplicate
} = require('../controllers/staffController');

const router = express.Router();

router.get('/dashboard',          auth, role('admin','staff'), getStaffDashboard);
router.get('/objections',         auth, role('admin','staff'), getStaffObjections);
router.patch('/objection/:id',    auth, role('admin','staff'), updateObjection);
router.get('/uploads',            auth, role('admin','staff'), getStaffUploads);
router.patch('/upload/:id',       auth, role('admin','staff'), updateUpload);
router.get('/duplicates',         auth, role('admin','staff'), getStaffDuplicates);
router.patch('/duplicate/:id',    auth, role('admin','staff'), manageDuplicate);

module.exports = router;
