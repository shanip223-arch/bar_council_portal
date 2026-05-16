const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const backupDir = path.join(__dirname, '..', 'backups');

function stamp() {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, '-');
}

async function backupTable(table) {
  const [rows] = await pool.query(`SELECT * FROM ${table}`);
  const filePath = path.join(backupDir, `${table}_${stamp()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
  return filePath;
}

async function createBackup(type = 'full') {
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  if (type === 'objection') return backupTable('objections');
  if (type === 'upload') return backupTable('uploads');

  const targets = ['applications', 'objections', 'uploads', 'download_logs', 'payments', 'duplicate_requests'];
  const files = [];
  for (const t of targets) {
    files.push(await backupTable(t));
  }
  return files;
}

async function restoreFromBackup(filePath, tableName) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('Invalid backup format');

  await pool.query(`DELETE FROM ${tableName}`);
  for (const row of data) {
    const cols = Object.keys(row);
    if (!cols.length) continue;
    const placeholders = cols.map(() => '?').join(',');
    const sql = `INSERT INTO ${tableName} (${cols.join(',')}) VALUES (${placeholders})`;
    await pool.query(sql, cols.map((c) => row[c]));
  }
  return true;
}

module.exports = { createBackup, restoreFromBackup };
