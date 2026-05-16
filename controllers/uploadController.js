const path = require('path');
const pool = require('../config/db');
const { moveFile, buildName } = require('../services/fileService');
const { logAction } = require('../utils/logger');

async function uploadReply(req, res) {
  if (!req.file) return res.status(400).json({ message: 'File missing' });
  const application_no = req.user.application_no;
  const { objection_id, type = 'document' } = req.body;

  const [objRows] = await pool.query('SELECT * FROM objections WHERE id = ? AND application_no = ?', [objection_id, application_no]);
  if (!objRows.length) return res.status(404).json({ message: 'Objection not found' });

  const [openRows] = await pool.query('SELECT COUNT(*) c FROM objections WHERE application_no = ? AND status = "open"', [application_no]);
  const [uploadRows] = await pool.query('SELECT COUNT(*) c FROM uploads WHERE application_no = ? AND cycle = (SELECT upload_cycle FROM applications WHERE application_no = ?)', [application_no, application_no]);
  if (uploadRows[0].c >= openRows[0].c && openRows[0].c > 0) {
    return res.status(400).json({ message: 'Upload limit reached for current objections' });
  }

  const [appRows] = await pool.query('SELECT upload_enabled, upload_cycle FROM applications WHERE application_no = ?', [application_no]);
  if (!appRows.length || appRows[0].upload_enabled === 0) return res.status(403).json({ message: 'Visit office or pay for reopening' });

  const fileName = buildName(application_no, 'obj', type, req.file.originalname);
  const finalPath = path.join(__dirname, '..', 'uploads', 'temp', fileName);
  moveFile(req.file.path, finalPath);

  await pool.query(
    'INSERT INTO uploads (application_no, objection_id, file_type, file_path, status, cycle) VALUES (?, ?, ?, ?, ?, ?)',
    [application_no, objection_id, type, finalPath, 'pending_verification', appRows[0].upload_cycle]
  );

  logAction('candidate', application_no, 'UPLOAD_OBJECTION_FILE', { objection_id, fileName });
  res.json({ message: 'Uploaded', fileName });
}

module.exports = { uploadReply };
