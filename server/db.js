const mysql = require("mysql2");
const config = require("./config");

const db = mysql.createConnection(config.db);

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("MySQL Connected");
    db.query(`
      CREATE TABLE IF NOT EXISTS fines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rollNo VARCHAR(50) NOT NULL,
        serialNo VARCHAR(50) DEFAULT '',
        days_late INT NOT NULL DEFAULT 0,
        fine_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        status ENUM('unsent','sent') NOT NULL DEFAULT 'unsent',
        sentToAccounts TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (e) => { if (e) console.warn("Fines table:", e.message); });
    db.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL DEFAULT 'Administrator',
        failed_attempts INT DEFAULT 0,
        locked_until DATETIME NULL,
        twofa_enabled TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (e) => { if (e) console.warn("Admins table:", e.message); });
    db.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `, (e) => { if (e) console.warn("Settings table:", e.message); });
    db.query("ALTER TABLE fines ADD COLUMN sentToAccounts TINYINT(1) DEFAULT 0", () => {});
    const defaultSettings = [
      ["universityName", "COMSATS University Islamabad"],
      ["campus", "Sahiwal Campus"],
      ["address", "Off G.T. Road, Sahiwal, Punjab, Pakistan"],
      ["logoUrl", ""],
      ["maxBooks", "3"],
      ["issueDays", "15"],
      ["finePerDay", "10"],
      ["reminderDays", "2"],
      ["enable2FA", "0"],
    ];
    defaultSettings.forEach(([k, v]) => {
      db.query("INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)", [k, v], () => {});
    });
  }
});

module.exports = db;
