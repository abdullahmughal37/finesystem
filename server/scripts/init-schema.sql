-- Run this to set up new tables for Library Management System
-- Admin table for JWT auth with bcrypt
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT 'Administrator',
  failed_attempts INT DEFAULT 0,
  locked_until DATETIME NULL,
  twofa_enabled TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table (key-value for app config)
CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add sentToAccounts to fines if not exists
ALTER TABLE fines ADD COLUMN sentToAccounts TINYINT(1) DEFAULT 0;

-- Insert default settings
INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
  ('universityName', 'COMSATS University Islamabad'),
  ('campus', 'Sahiwal Campus'),
  ('address', 'Off G.T. Road, Sahiwal, Punjab, Pakistan'),
  ('logoUrl', ''),
  ('maxBooks', '3'),
  ('issueDays', '15'),
  ('finePerDay', '10'),
  ('reminderDays', '2'),
  ('enable2FA', '0');

-- Create default admin (password: admin12345) - run after bcrypt hash generated
-- INSERT INTO admins (email, password_hash, name) VALUES ('admin@cuisahiwal.edu.pk', '$2a$10$...', 'Administrator');
