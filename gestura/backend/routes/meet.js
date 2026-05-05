const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const db = require("../db");
const auth = require("../middleware/authMiddleware");

// Create meeting room
router.post("/create", auth, (req, res) => {
  const userId = req.user?.id || req.body.user_id;

  const roomCode = "ROOM-" + crypto.randomBytes(3).toString("hex").toUpperCase();

  const sql = "INSERT INTO meeting_rooms (room_code, host_id) VALUES (?, ?)";
  db.query(sql, [roomCode, userId || null], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ room: roomCode });
  });
});

// Join meeting (validate room exists)
router.get("/join/:code", auth, (req, res) => {
  const code = req.params.code;

  const sql = "SELECT * FROM meeting_rooms WHERE room_code = ?";
  db.query(sql, [code], (err, rows) => {
    if (err) return res.status(500).json({ error: err });

    if (rows.length === 0) {
      return res.status(404).json({ message: "Room not found" });
    }

    res.json({ valid: true });
  });
});

module.exports = router;
