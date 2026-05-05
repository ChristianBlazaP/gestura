const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/videoUpload");
const db = require("../db");

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// POST /api/recordings
// Save a user-recorded sign language video
router.post("/", auth, upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    const userId = req.user.id;
    const label = req.body.label || null;
    const fileUrl = `/uploads/recordings/${req.file.filename}`;

    await queryAsync(
      "INSERT INTO user_recordings (user_id, label, file_url, mime_type, file_size) VALUES (?, ?, ?, ?, ?)",
      [userId, label, fileUrl, req.file.mimetype, req.file.size]
    );

    return res.json({
      message: "Recording saved",
      file_url: fileUrl,
    });
  } catch (err) {
    console.error("RECORDING UPLOAD ERROR:", err);
    return res.status(500).json({ error: "Failed to save recording" });
  }
});

// GET /api/recordings/mine
// List recordings for the current user
router.get("/mine", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = await queryAsync(
      "SELECT id, label, file_url, created_at FROM user_recordings WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    return res.json({ recordings: rows });
  } catch (err) {
    console.error("RECORDING LIST ERROR:", err);
    return res.status(500).json({ error: "Failed to load recordings" });
  }
});

module.exports = router;
