const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const ALLOWED_TABLES = ['users', 'applications', 'objections', 'uploads', 'certificates', 'otp_codes', 'duplicate_requests', 'backup_logs', 'action_logs'];

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function runBackup(type) {
  const data = {};

  for (const tableName of ALLOWED_TABLES) {
    if (type === 'objection' && !['objections', 'applications', 'action_logs'].includes(tableName)) continue;
    if (type === 'upload' && !['uploads', 'applications', 'action_logs'].includes(tableName)) continue;

    const result = await pool.query(`SELECT * FROM ${tableName}`);
    data[tableName] = result.rows;
  }

  const filePath = path.join('backups', `${type}_${ts()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  await pool.query('INSERT INTO backup_logs(backup_type,file_path) VALUES(?,?)', [type, filePath]);
  return filePath;
}

async function restoreBackup(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  for (const [table, rows] of Object.entries(data)) {
    if (!ALLOWED_TABLES.includes(table)) continue;
    await pool.query(`DELETE FROM ${table}`);
    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = Object.values(row);
      const placeholders = cols.map(() => '?').join(',');
      await pool.query(
        `INSERT INTO ${table}(${cols.join(',')}) VALUES(${placeholders})`,
        vals
      );
    }
  }
}

module.exports = { runBackup, restoreBackup };
