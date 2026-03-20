CREATE TABLE IF NOT EXISTS learning_assessments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  assessment_type ENUM('pre','post') NOT NULL,
  difficulty ENUM('easy','medium','hard') NOT NULL,
  score INT NOT NULL,
  total_questions INT NOT NULL,
  time_left INT NULL,
  duration_sec INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_learning_assessments_user (user_id),
  INDEX idx_learning_assessments_type (assessment_type),
  INDEX idx_learning_assessments_difficulty (difficulty)
);
