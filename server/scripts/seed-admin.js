const bcrypt = require("bcryptjs");
const db = require("../db");

const email = "admin@cuisahiwal.edu.pk";
const password = "admin12345";

const createTable = `CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT 'Administrator',
  failed_attempts INT DEFAULT 0,
  locked_until DATETIME NULL,
  twofa_enabled TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;

db.query(createTable, (e1) => {
  if (e1) {
    console.error("Create table error:", e1);
    process.exit(1);
  }
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      console.error("Hash error:", err);
      process.exit(1);
    }
    db.query(
      "INSERT INTO admins (email, password_hash, name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)",
      [email, hash, "Administrator"],
      (e) => {
        if (e) {
          console.error("Seed error:", e);
          process.exit(1);
        }
        console.log("Admin seeded: admin@cuisahiwal.edu.pk / admin12345");
        process.exit(0);
      }
    );
  });
});
