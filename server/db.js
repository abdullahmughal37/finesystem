const mysql = require('mysql2');
const config = require('./config');
const schema = require('./schema');
const db = mysql.createPool({ ...config.db, waitForConnections: true, connectionLimit: 10, queueLimit: 100, dateStrings: true, decimalNumbers: true });
async function initialize() {
  for (const sql of schema) await db.promise().query(sql);
  const [email] = await db.promise().query("SHOW COLUMNS FROM students LIKE 'email'");
  if (!email.length) await db.promise().query("ALTER TABLE students ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT '' AFTER contact_no");
  for (const kind of ['students','books']) {
    const [columns] = await db.promise().query(`SHOW COLUMNS FROM ${kind} LIKE 'custom_data'`);
    if (!columns.length) await db.promise().query(`ALTER TABLE ${kind} ADD COLUMN custom_data JSON NULL`);
  }
  await db.promise().query('CREATE TABLE IF NOT EXISTS catalog_layouts (kind VARCHAR(16) PRIMARY KEY, revision INT NOT NULL DEFAULT 1, fields LONGTEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)');
  const { defaults: defaultLayout } = require('./lib/fieldSchema');
  for (const kind of ['students','books']) await db.promise().query('INSERT IGNORE INTO catalog_layouts(kind,fields) VALUES (?,?)',[kind,JSON.stringify(defaultLayout(kind))]);
  const [sent] = await db.promise().query("SHOW COLUMNS FROM fines LIKE 'sentToAccounts'");
  const [version] = await db.promise().query("SHOW COLUMNS FROM admins LIKE 'password_version'");
  if (!version.length) await db.promise().query('ALTER TABLE admins ADD COLUMN password_version INT NOT NULL DEFAULT 0');
  if (!sent.length) await db.promise().query('ALTER TABLE fines ADD COLUMN sentToAccounts TINYINT(1) DEFAULT 0');
  const [fineType] = await db.promise().query("SHOW COLUMNS FROM fines LIKE 'fine_type'");
  if (!fineType.length) await db.promise().query("ALTER TABLE fines ADD COLUMN fine_type ENUM('auto','manual') NOT NULL DEFAULT 'auto' AFTER fine_amount");
  const [fineReason] = await db.promise().query("SHOW COLUMNS FROM fines LIKE 'reason'");
  if (!fineReason.length) await db.promise().query("ALTER TABLE fines ADD COLUMN reason VARCHAR(500) NOT NULL DEFAULT '' AFTER fine_type");
  const fineResolutionColumns = [
    ['resolution_status', "VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER sentToAccounts"],
    ['resolved_at', 'DATETIME NULL AFTER resolution_status'],
    ['resolved_by', 'INT NULL AFTER resolved_at'],
    ['resolution_reason', "VARCHAR(500) NOT NULL DEFAULT '' AFTER resolved_by"],
  ];
  for (const [column, definition] of fineResolutionColumns) {
    const [existing] = await db.promise().query(`SHOW COLUMNS FROM fines LIKE ?`, [column]);
    if (!existing.length) await db.promise().query(`ALTER TABLE fines ADD COLUMN ${column} ${definition}`);
  }
  const trashColumns = [
    ['days_late', "INT NOT NULL DEFAULT 0 AFTER fine_amount"],
    ['original_status', "VARCHAR(20) NOT NULL DEFAULT 'unsent' AFTER reason"],
    ['sent_to_accounts', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER original_status'],
    ['resolution_status', "VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER sent_to_accounts"],
    ['resolved_at', 'DATETIME NULL AFTER resolution_status'],
    ['resolved_by', 'INT NULL AFTER resolved_at'],
    ['resolution_reason', "VARCHAR(500) NOT NULL DEFAULT '' AFTER resolved_by"],
    ['original_created_at', 'DATETIME NULL AFTER sent_to_accounts'],
    ['student_registration_no', "VARCHAR(100) NOT NULL DEFAULT '' AFTER original_created_at"],
    ['student_name', "VARCHAR(255) NOT NULL DEFAULT '' AFTER student_registration_no"],
    ['book_accession_no', "VARCHAR(100) NOT NULL DEFAULT '' AFTER student_name"],
    ['book_title', "VARCHAR(255) NOT NULL DEFAULT '' AFTER book_accession_no"],
    ['deleted_by_name', "VARCHAR(100) NOT NULL DEFAULT '' AFTER deleted_by"],
    ['deleted_by_email', "VARCHAR(255) NOT NULL DEFAULT '' AFTER deleted_by_name"],
    ['expires_at', 'DATETIME NULL AFTER deleted_at'],
  ];
  for (const [column, definition] of trashColumns) {
    const [existing] = await db.promise().query(`SHOW COLUMNS FROM fine_deletions LIKE ?`, [column]);
    if (!existing.length) await db.promise().query(`ALTER TABLE fine_deletions ADD COLUMN ${column} ${definition}`);
  }
  await db.promise().query('UPDATE fine_deletions SET expires_at=DATE_ADD(deleted_at, INTERVAL 90 DAY) WHERE expires_at IS NULL');
  const [expiryIndex] = await db.promise().query("SHOW INDEX FROM fine_deletions WHERE Key_name='idx_fine_deletions_expires_at'");
  if (!expiryIndex.length) await db.promise().query('ALTER TABLE fine_deletions ADD INDEX idx_fine_deletions_expires_at (expires_at)');
  await require('./lib/fineTrash').purgeExpiredFines(db.promise());
  const defaults = [['universityName','COMSATS University Islamabad'],['campus','Sahiwal Campus'],['address','Off G.T. Road, Sahiwal, Punjab, Pakistan'],['logoUrl',''],['maxBooks','3'],['issueDays','15'],['finePerDay','10'],['reminderDays','2'],['enable2FA','0']];
  await db.promise().query('INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ?', [defaults]);
}
// Tests and one-off tooling can explicitly disable automatic initialization.
db.ready = process.env.SKIP_DB_INIT === '1' ? Promise.resolve() : initialize();
db.ready.catch(error => console.error('Database initialization failed:', error.code || error.message));
module.exports = db;
