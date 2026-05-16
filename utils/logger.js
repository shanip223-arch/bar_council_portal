const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', 'backups', 'action.log');

function ensureLogPath() {
  const dir = path.dirname(logFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, '', 'utf-8');
}

function logAction(actorRole, actorId, action, details = {}) {
  ensureLogPath();
  const entry = {
    timestamp: new Date().toISOString(),
    actorRole,
    actorId,
    action,
    details
  };
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf-8');
  console.log('[ACTION]', entry);
}

module.exports = { logAction };
