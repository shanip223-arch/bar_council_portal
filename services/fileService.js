const fs = require('fs');
const path = require('path');
const { generateFileName } = require('../utils/validator');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function moveFile(oldPath, newPath) {
  ensureDir(path.dirname(newPath));
  fs.renameSync(oldPath, newPath);
}

function copyFile(oldPath, newPath) {
  ensureDir(path.dirname(newPath));
  fs.copyFileSync(oldPath, newPath);
}

function buildName(appNo, section, type, originalname) {
  const ext = path.extname(originalname).replace('.', '') || 'bin';
  return generateFileName(appNo, section, type, ext);
}

module.exports = {
  ensureDir,
  moveFile,
  copyFile,
  buildName
};
