# Quick Start Guide - Gestura

## Prerequisites
- Node.js v18+
- MySQL server running
- Git (optional)

## Installation & Setup

### 1. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Create .env file (already created, update as needed)
cat .env
# Update DB credentials if different from: host=localhost, user=root, password=, database=gestura
# Optional: set ADMIN_REGISTRATION_CODE to allow admin account creation

# Start server
npm start
# Should print: "Server running on port 3000" + "Database connected."
```
.
### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
# Should print: "VITE v7.x.x ready in XXX ms"
```

### 3. Access Application
- Frontend: http://localhost:5173 (or http://localhost:3000 if configured)
- Backend API: http://localhost:3000

### Environment tips
- If your backend runs on a different host/port, create `frontend/.env.local` (see `frontend/.env.local.example`) and set `VITE_API_ORIGIN=http://localhost:3000`.
- If your Python virtualenv is in a different path, create `backend/.env` (see `backend/.env.example`) and set `PREDICT_PYTHON_PATH` so `/api/predict` can call `predict_cli.py`.

---

## Key Features to Test

### 1. User Registration (Photo Upload)
1. Go to "Register" page
2. Fill in: First Name, Last Name, Email, Password
3. **Upload identity photo** (new feature)
4. Click "Create account"
5. Check `backend/uploads/` folder for photo file
6. Optional: check "Register as school admin" and enter the admin access code if configured

### 2. Real-time Gesture Interpreter
1. Login and go to "Interpreter" page
2. Allow webcam access
3. Perform hand gestures
4. See predictions + hear synthesized speech (new feature)

### 3. Data Collection for FSL Model
1. Go to "Learnings" page (completely redesigned)
2. Accept consent checkbox
3. Select a gesture from the list (e.g., "hello", "thank_you")
4. Click "Start Recording" and perform gesture
5. System auto-saves after ~1 second
6. View collection statistics

### 4. Guardian Management
1. Login → Profile page
2. Scroll to "Guardian Access" section
3. Add a guardian by email
4. Remove guardians

### 5. Telemetry & Feedback
1. On any page with gesture interpretation
2. Toggle "Allow data collection" consent
3. Optional: Submit feedback via feedback form

---

## API Endpoints

### Authentication
- `POST /auth/register` - Register with optional photo
- `POST /auth/login` - Login
- `POST /auth/recovery-email/request` - Add/update recovery email (auth required)
- `POST /auth/recovery-email/remove` - Remove recovery email (auth required)
- `GET /auth/verify-recovery-email` - Verify recovery email token

### Prediction
- `POST /api/predict` - Send landmarks, get gesture label + confidence

### Guardian Management
- `POST /api/guardian/assign` - Assign guardian
- `GET /api/guardian/dependent/:id` - List guardians
- `POST /api/guardian/remove` - Remove guardian

### Telemetry
- `POST /api/telemetry/log-prediction` - Log prediction for evaluation
- `GET /api/telemetry/stats` - Get evaluation stats
- `GET /api/telemetry/accuracy` - Get per-gesture accuracy
- `POST /api/telemetry/feedback` - Submit user feedback

### Dataset Collection
- `POST /api/dataset/record-sample` - Record gesture sample
- `GET /api/dataset/stats` - Get collection progress
- `GET /api/dataset/export` - Export for model training

---

## Database Setup (Required)

Run these SQL commands in your MySQL client:

```sql
-- Extend users table
ALTER TABLE users ADD COLUMN photo_path VARCHAR(255) AFTER role;
ALTER TABLE users
  ADD COLUMN recovery_email VARCHAR(255) NULL AFTER email,
  ADD COLUMN recovery_email_verified TINYINT(1) DEFAULT 0 AFTER recovery_email,
  ADD COLUMN recovery_email_token VARCHAR(64) NULL AFTER recovery_email_verified,
  ADD COLUMN recovery_email_expires DATETIME NULL AFTER recovery_email_token;
ALTER TABLE users
  ADD COLUMN is_active TINYINT(1) DEFAULT 1,
  ADD COLUMN last_login DATETIME NULL,
  ADD COLUMN last_seen DATETIME NULL;

-- Guardian relationships
CREATE TABLE IF NOT EXISTS guardian_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dependent_id INT NOT NULL,
  guardian_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dependent_id) REFERENCES users(id),
  FOREIGN KEY (guardian_id) REFERENCES users(id),
  UNIQUE KEY (dependent_id, guardian_id)
);

-- Telemetry logs
CREATE TABLE IF NOT EXISTS telemetry_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  predicted_label VARCHAR(100) NOT NULL,
  confidence FLOAT,
  latency_ms INT,
  ground_truth VARCHAR(100),
  feedback_consent BOOLEAN DEFAULT FALSE,
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Feedback logs
CREATE TABLE IF NOT EXISTS feedback_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  telemetry_id INT,
  user_id INT,
  feedback_text TEXT,
  rating INT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telemetry_id) REFERENCES telemetry_logs(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Dataset samples (for FSL model training)
CREATE TABLE IF NOT EXISTS dataset_samples (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  gesture_label VARCHAR(100) NOT NULL,
  landmarks LONGTEXT NOT NULL,
  metadata JSON,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX (gesture_label)
);
```

---

## Troubleshooting

### Backend won't start
- Check port 3000 is free: `netstat -ano | grep 3000`
- Verify MySQL is running: `mysql -u root -p -e "SELECT 1;"`
- Check `.env` file has correct credentials

### Frontend won't build
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node version: `node --version` (should be v18+)

### Photos not uploading
- Check `backend/uploads/` folder exists and is writable
- Verify file is JPEG/PNG/GIF and < 5MB
- Check browser console for errors

### Gestures not recognized
- Model not yet loaded (framework ready, awaiting training)
- Use heuristic fallback (extended finger count detection)
- See `FSL_DATASET_GUIDE.md` for model training steps

---

## Next Steps

1. **Populate database tables** (see Database Setup above)
2. **Test all features** (see Key Features to Test)
3. **Collect FSL dataset** using the Learnings page
4. **Train gesture model** following `FSL_DATASET_GUIDE.md`
5. **Deploy to production** (Heroku, AWS, Vercel, etc.)

---

## Documentation

- `IMPLEMENTATION_SUMMARY.md` - Detailed status of all 8 gaps
- `FSL_DATASET_GUIDE.md` - How to create & train Filipino Sign Language model
- Backend route files - Endpoint specifications
- Frontend component files - UI integration examples

---

## Support

For questions or issues:
1. Check IMPLEMENTATION_SUMMARY.md for architecture overview
2. Review backend controller files for endpoint details
3. Check frontend component files for UI examples
4. See FSL_DATASET_GUIDE.md for ML/training questions
