const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

// GET /api/users/active - return list of users (id, firstname, lastname, username, avatar_url)
router.get("/active", authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.queryAsync(
      "SELECT id, firstname, lastname, username, avatar_url FROM users ORDER BY firstname ASC"
    );
    res.json({ users: rows || [] });
  } catch (err) {
    console.error("Active users query failed:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// POST /api/users/ping - update last_seen for active session
router.post("/ping", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    await db.queryAsync("UPDATE users SET last_seen = NOW() WHERE id = ?", [userId]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("User ping failed:", err);
    return res.status(500).json({ error: "Failed to update activity" });
  }
});

// Fallback list all users (same shape) at /api/users
router.get("/", authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.queryAsync(
      "SELECT id, firstname, lastname, username, avatar_url FROM users ORDER BY firstname ASC"
    );
    res.json({ users: rows || [] });
  } catch (err) {
    console.error("Users query failed:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

module.exports = router;
