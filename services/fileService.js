const fs = require('fs');
const path = require('path');
const { sanitizeForFile } = require('../utils/validator');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function buildFileName(applicationNo, section, type, ext) {
  const safeApp = sanitizeForFile(applicationNo);
  return `${safeApp}_${section}_${type}${ext}`;
}

function moveFile(from, to) {
  ensureDir(path.dirname(to));
  fs.renameSync(from, to);
}

module.exports = { ensureDir, buildFileName, moveFile };
