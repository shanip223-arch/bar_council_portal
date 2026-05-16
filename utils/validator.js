function isValidAppNo(appNo) {
  return /^UP\d{5}\/\d{2}$/.test(appNo || '');
}

function isValidMobile(mobile) {
  return /^\d{10}$/.test(String(mobile || '').trim());
}

function normalizeForFilename(appNo) {
  return String(appNo).replace('/', '_');
}

function generateFileName(appNo, section, type, ext) {
  const safeApp = normalizeForFilename(appNo);
  return `${safeApp}_${section}_${type}.${ext}`;
}

module.exports = {
  isValidAppNo,
  isValidMobile,
  normalizeForFilename,
  generateFileName
};
