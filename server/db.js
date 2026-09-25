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
    const trashColumns = [
      ['deleted_at', 'DATETIME NULL'], ['deleted_by', 'INT NULL'],
      ['deletion_reason', "VARCHAR(500) NOT NULL DEFAULT ''"], ['purge_at', 'DATETIME NULL'], ['purged_at', 'DATETIME NULL'],
    ];
    for (const [column, definition] of trashColumns) {
      const [existing] = await db.promise().query(`SHOW COLUMNS FROM ${kind} LIKE ?`, [column]);
      if (!existing.length) await db.promise().query(`ALTER TABLE ${kind} ADD COLUMN ${column} ${definition}`);
    }
    for (const [index, column] of [[`idx_${kind}_deleted_at`,'deleted_at'],[`idx_${kind}_purge_at`,'purge_at']]) {
      const [existing] = await db.promise().query(`SHOW INDEX FROM ${kind} WHERE Key_name=?`, [index]);
      if (!existing.length) await db.promise().query(`ALTER TABLE ${kind} ADD INDEX ${index} (${column})`);
    }
  }
  const [bookCopies] = await db.promise().query("SHOW COLUMNS FROM books LIKE 'total_copies'");
  if (!bookCopies.length) await db.promise().query('ALTER TABLE books ADD COLUMN total_copies INT NOT NULL DEFAULT 1 AFTER title');
  const [bookIdentity] = await db.promise().query("SHOW COLUMNS FROM books LIKE 'catalog_identity'");
  if (!bookIdentity.length) await db.promise().query('ALTER TABLE books ADD COLUMN catalog_identity CHAR(64) NULL AFTER total_copies');
  const [bookIdentityIndex] = await db.promise().query("SHOW INDEX FROM books WHERE Key_name='uq_books_catalog_identity'");
  if (!bookIdentityIndex.length) await db.promise().query('ALTER TABLE books ADD UNIQUE INDEX uq_books_catalog_identity (catalog_identity)');
  await db.promise().query('CREATE TABLE IF NOT EXISTS catalog_layouts (kind VARCHAR(16) PRIMARY KEY, revision INT NOT NULL DEFAULT 1, fields LONGTEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)');
  const { defaults: defaultLayout } = require('./lib/fieldSchema');
  for (const kind of ['students','books']) {
    const defaults = defaultLayout(kind);
    await db.promise().query('INSERT IGNORE INTO catalog_layouts(kind,fields) VALUES (?,?)',[kind,JSON.stringify(defaults)]);
    const [rows] = await db.promise().query('SELECT fields FROM catalog_layouts WHERE kind=?',[kind]);
    const stored = JSON.parse(rows[0].fields); const present = new Set(stored.map(field=>field.key));
    const missing = defaults.filter(field=>!present.has(field.key));
    if (missing.length) await db.promise().query('UPDATE catalog_layouts SET fields=?,revision=revision+1 WHERE kind=?',[JSON.stringify([...stored,...missing]),kind]);
  }
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
  await require('./lib/catalogTrash').purgeExpiredCatalog(db.promise());
  await db.promise().query('DELETE FROM recovery_backups WHERE expires_at<=CURRENT_TIMESTAMP');
  const defaults = [['universityName','COMSATS University Islamabad'],['campus','Sahiwal Campus'],['address','Off G.T. Road, Sahiwal, Punjab, Pakistan'],['logoUrl',''],['maxBooks','3'],['issueDays','15'],['finePerDay','10'],['reminderDays','2'],['enable2FA','0']];
  await db.promise().query('INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ?', [defaults]);
}
// Tests and one-off tooling can explicitly disable automatic initialization.
db.ready = process.env.SKIP_DB_INIT === '1' ? Promise.resolve() : initialize();
db.ready.catch(error => console.error('Database initialization failed:', error.code || error.message));
module.exports = db;
