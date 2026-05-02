const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');
const { buildFileName, moveFile } = require('../services/fileService');
const { logAction } = require('../utils/logger');

async function uploadObjectionDoc(req, res) {
  const { objection_id, doc_type } = req.body;
  const application_no = req.user.application_no;
  try {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    const apps = await pool.query('SELECT * FROM applications WHERE application_no=$1', [application_no]);
    if (!apps.rows.length) return res.status(404).json({ error: 'Application not found' });
    const app = apps.rows[0];

    if (!app.upload_enabled) return res.status(403).json({ error: 'Visit office or pay for reopening' });

    const objs = await pool.query('SELECT * FROM objections WHERE application_id=$1', [app.id]);
    const uploaded = await pool.query('SELECT DISTINCT objection_id FROM uploads WHERE application_id=$1 AND section_code=$2', [app.id, 'obj']);
    const unresolved = objs.rows.filter(o => !o.resolved);

    if (unresolved.length > uploaded.rows.length && app.final_chance_used === 1) {
      await pool.query('UPDATE applications SET upload_enabled=0 WHERE id=$1', [app.id]);
      return res.status(403).json({ error: 'Visit office or pay for reopening' });
    }

    const ext = path.extname(req.file.originalname) || '.pdf';
    const fileName = buildFileName(application_no, 'obj', doc_type || 'reply', ext);
    const destPath = path.join('uploads', 'temp', fileName);
    moveFile(req.file.path, destPath);

    const exists = await pool.query('SELECT id,file_path FROM uploads WHERE application_id=$1 AND objection_id=$2 AND section_code=$3', [app.id, objection_id, 'obj']);
    if (exists.rows.length) {
      if (fs.existsSync(exists.rows[0].file_path)) fs.unlinkSync(exists.rows[0].file_path);
      await pool.query('UPDATE uploads SET original_name=$1,file_name=$2,file_path=$3,uploaded_at=NOW() WHERE id=$4', [req.file.originalname, fileName, destPath, exists.rows[0].id]);
    } else {
      await pool.query(
        'INSERT INTO uploads(application_id,objection_id,section_code,doc_type,original_name,file_name,file_path) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [app.id, objection_id, 'obj', doc_type || 'reply', req.file.originalname, fileName, destPath]
      );
    }

    if (unresolved.length === uploaded.rows.length + 1 && app.final_chance_used === 0) {
      await pool.query('UPDATE applications SET final_chance_used=1,status=$1 WHERE id=$2', ['under_review', app.id]);
    }

    await logAction(application_no, 'candidate', 'upload_objection_doc', fileName);
    res.json({ message: 'Uploaded', fileName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function verifyUpload(req, res) {
  const { upload_id } = req.body;
  try {
    const rows = await pool.query('SELECT * FROM uploads WHERE id=$1', [upload_id]);
    if (!rows.rows.length) return res.status(404).json({ error: 'Upload not found' });

    const u = rows.rows[0];
    const destPath = path.join('uploads', 'verified', u.file_name);
    if (fs.existsSync(u.file_path)) moveFile(u.file_path, destPath);

    await pool.query('UPDATE uploads SET verified=1,file_path=$1 WHERE id=$2', [destPath, upload_id]);
    await logAction(req.user.username, req.user.role, 'verify_upload', `upload=${upload_id}`);
    res.json({ message: 'Upload verified' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { uploadObjectionDoc, verifyUpload };
