CREATE TABLE IF NOT EXISTS user_recordings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  label VARCHAR(32) NULL,
  file_url VARCHAR(255) NOT NULL,
  mime_type VARCHAR(64) NOT NULL,
  file_size INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_recordings_user_id (user_id)
);
