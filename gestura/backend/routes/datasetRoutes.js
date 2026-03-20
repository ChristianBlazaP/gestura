// backend/routes/datasetRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware"); // same middleware you use for friends/profile
const db = require("../db");

// Promisified helper around db.query
function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// =======================================
// GET /api/dataset/stats
// Returns total samples recorded by this user
// =======================================
router.get("/stats", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const rows = await queryAsync(
      "SELECT COUNT(*) AS total FROM dataset WHERE user_id = ?",
      [userId]
    );

    const total = rows[0]?.total || 0;
    return res.json({ total });
  } catch (err) {
    console.error("DATASET STATS ERROR:", err);
    return res.status(500).json({ error: "Failed to load dataset stats" });
  }
});

// =======================================
// POST /api/dataset/record-sample
// Saves one gesture sample
// =======================================
router.post("/record-sample", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { gesture_label, landmarks, metadata } = req.body;

    if (!gesture_label || !landmarks || !Array.isArray(landmarks)) {
      return res.status(400).json({ error: "Missing or invalid data" });
    }

    await queryAsync(
      "INSERT INTO dataset (user_id, label, landmarks_json) VALUES (?, ?, ?)",
      [userId, gesture_label, JSON.stringify({ landmarks, metadata })]
    );

    return res.json({ message: "Sample saved" });
  } catch (err) {
    console.error("DATASET SAVE ERROR:", err);
    return res.status(500).json({ error: "Failed to save gesture sample" });
  }
});

module.exports = router;