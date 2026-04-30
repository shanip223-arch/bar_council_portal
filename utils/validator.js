function validateApplicationNo(applicationNo) {
  return /^UP\d{5}\/\d{2}$/.test(applicationNo);
}

function sanitizeForFile(applicationNo) {
  return applicationNo.replace('/', '_');
}

function validateMobile(mobile) {
  return /^\d{10}$/.test(mobile);
}

function toAppNoWithYear(serial, yy) {
  return `UP${String(serial).padStart(5, '0')}/${yy}`;
}

module.exports = {
  validateApplicationNo,
  sanitizeForFile,
  validateMobile,
  toAppNoWithYear
};
