-- Initial schema for a new installation. Existing installations receive additive migrations at backend startup.
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  father_name VARCHAR(255) DEFAULT '',
  registration_no VARCHAR(100) UNIQUE NOT NULL,
  department VARCHAR(150) DEFAULT '',
  contact_no VARCHAR(100) DEFAULT '',
  email VARCHAR(255) NOT NULL DEFAULT '',
  semester VARCHAR(50) DEFAULT '',
  status VARCHAR(50) DEFAULT 'Active',
  remarks TEXT,
  custom_data JSON NULL
);

CREATE TABLE IF NOT EXISTS books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  accession_no VARCHAR(100) UNIQUE NOT NULL,
  author_name VARCHAR(255) DEFAULT '',
  title VARCHAR(255) NOT NULL,
  publisher VARCHAR(255) DEFAULT '',
  publish_year VARCHAR(20) DEFAULT '',
  pages INT DEFAULT 0,
  call_no VARCHAR(100) DEFAULT '',
  binding VARCHAR(100) DEFAULT '',
  source VARCHAR(100) DEFAULT '',
  cost DECIMAL(10,2) DEFAULT 0,
  isbn VARCHAR(100) DEFAULT '',
  remarks TEXT,
  custom_data JSON NULL
);

CREATE TABLE IF NOT EXISTS issues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  book_id INT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  returned TINYINT(1) NOT NULL DEFAULT 0,
  return_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  issue_id INT NULL,
  student_id INT NOT NULL,
  book_id INT NULL,
  days_late INT NOT NULL DEFAULT 0,
  fine_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  fine_type ENUM('auto','manual') NOT NULL DEFAULT 'auto',
  reason VARCHAR(500) NOT NULL DEFAULT '',
  status ENUM('unsent','sent') NOT NULL DEFAULT 'unsent',
  sentToAccounts TINYINT(1) DEFAULT 0,
  resolution_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  resolved_at DATETIME NULL,
  resolved_by INT NULL,
  resolution_reason VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE SET NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fine_deletions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fine_id INT NOT NULL,
  issue_id INT NULL,
  student_id INT NOT NULL,
  book_id INT NULL,
  fine_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  days_late INT NOT NULL DEFAULT 0,
  fine_type VARCHAR(20) NOT NULL,
  reason VARCHAR(500) NOT NULL DEFAULT '',
  original_status VARCHAR(20) NOT NULL DEFAULT 'unsent',
  sent_to_accounts TINYINT(1) NOT NULL DEFAULT 0,
  resolution_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  resolved_at DATETIME NULL,
  resolved_by INT NULL,
  resolution_reason VARCHAR(500) NOT NULL DEFAULT '',
  original_created_at DATETIME NULL,
  student_registration_no VARCHAR(100) NOT NULL DEFAULT '',
  student_name VARCHAR(255) NOT NULL DEFAULT '',
  book_accession_no VARCHAR(100) NOT NULL DEFAULT '',
  book_title VARCHAR(255) NOT NULL DEFAULT '',
  deleted_by INT NOT NULL,
  deleted_by_name VARCHAR(100) NOT NULL DEFAULT '',
  deleted_by_email VARCHAR(255) NOT NULL DEFAULT '',
  deletion_reason VARCHAR(500) NOT NULL,
  deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  INDEX idx_fine_deletions_fine_id (fine_id),
  INDEX idx_fine_deletions_expires_at (expires_at)
);

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT 'Administrator',
  failed_attempts INT DEFAULT 0,
  locked_until DATETIME NULL,
  twofa_enabled TINYINT(1) DEFAULT 0,
  password_version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table (key-value for app config)
CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clearance_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  version INT NOT NULL UNIQUE,
  config_json LONGTEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_clearance_template_active (is_active)
);

CREATE TABLE IF NOT EXISTS clearance_sequences (
  sequence_year VARCHAR(4) PRIMARY KEY,
  next_number INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS clearance_letters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference_no VARCHAR(80) UNIQUE NOT NULL,
  student_id INT NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  registration_no VARCHAR(100) NOT NULL,
  purpose VARCHAR(150) NOT NULL,
  status ENUM('issued','revoked') NOT NULL DEFAULT 'issued',
  student_snapshot LONGTEXT NOT NULL,
  clearance_snapshot LONGTEXT NOT NULL,
  template_snapshot LONGTEXT NOT NULL,
  template_version INT NOT NULL,
  generated_by INT NOT NULL,
  generated_by_name VARCHAR(100) NOT NULL DEFAULT '',
  generated_by_email VARCHAR(255) NOT NULL DEFAULT '',
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  revoked_by INT NULL,
  revocation_reason VARCHAR(500) NOT NULL DEFAULT '',
  pdf_data LONGBLOB NOT NULL,
  pdf_sha256 CHAR(64) NOT NULL,
  INDEX idx_clearance_student (student_id),
  INDEX idx_clearance_status (status),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT
);

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

-- Create the first administrator with server/scripts/seed-admin.js so no plaintext password is stored here.
