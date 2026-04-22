-- Run this to create fines table in library_db
CREATE TABLE IF NOT EXISTS fines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rollNo VARCHAR(50) NOT NULL,
  serialNo VARCHAR(50) NOT NULL,
  days_late INT NOT NULL DEFAULT 0,
  fine_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('unsent','sent') NOT NULL DEFAULT 'unsent',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
