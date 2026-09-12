-- Run this to initialize fine storage in a new database.
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
