const express = require("express");
const router = express.Router();
const db = require("../db");   // your MySQL connection

// NOTE: Table friends should have columns: id, user_id, friend_id, status ENUM('pending','accepted') DEFAULT 'pending', created_at TIMESTAMP.
// If status column is missing, run:
// ALTER TABLE friends ADD COLUMN status ENUM('pending','accepted') NOT NULL DEFAULT 'pending';

// ➤ Get friend list (accepted only)
router.get("/list/:userId", (req, res) => {
  const userId = req.params.userId;

  const sql = `
    SELECT u.id, u.firstname, u.lastname, u.email
    FROM friends f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ? AND f.status = 'accepted'
  `;

  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json(result);
  });
});

// ➤ Add friend (creates pending request)
router.post("/add", (req, res) => {
  const { user_id, friend_id, friend_email } = req.body;
  const requester = user_id;
  const targetId = friend_id;

  const insertPending = (fid) => {
    const checkSQL = "SELECT id, status FROM friends WHERE user_id = ? AND friend_id = ?";
    db.query(checkSQL, [requester, fid], (err, rows) => {
      if (err) return res.status(500).json({ error: err });
      if (rows.length > 0) {
        return res.json({ message: "Request already exists", status: rows[0].status });
      }
      const insertSQL =
        "INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'pending')";
      db.query(insertSQL, [requester, fid], (err2) => {
        if (err2) return res.status(500).json({ error: err2 });
        res.json({ message: "Request sent", status: "pending" });
      });
    });
  };

  if (targetId) {
    return insertPending(targetId);
  }

  if (friend_email) {
    const findUser = "SELECT id FROM users WHERE email = ?";
    db.query(findUser, [friend_email], (err, users) => {
      if (err) return res.status(500).json({ error: err });
      if (users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      insertPending(users[0].id);
    });
    return;
  }

  return res.status(400).json({ message: "friend_id or friend_email required" });
});

// ➤ Remove friend (both directions)
router.post("/remove", (req, res) => {
  const { user_id, friend_id } = req.body;
  if (!user_id || !friend_id) {
    return res.status(400).json({ message: "user_id and friend_id required" });
  }
  const sql = "DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)";
  db.query(sql, [user_id, friend_id, friend_id, user_id], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Friend removed" });
  });
});

// ➤ Pending requests for a user (incoming)
router.get("/requests/:userId", (req, res) => {
  const userId = req.params.userId;
  const sql = `
    SELECT f.id, f.user_id AS requester_id, u.firstname, u.lastname, u.username, u.email
    FROM friends f
    JOIN users u ON u.id = f.user_id
    WHERE f.friend_id = ? AND f.status = 'pending'
  `;
  db.query(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ requests: rows });
  });
});

// ➤ Outgoing pending requests for a user
router.get("/pending/:userId", (req, res) => {
  const userId = req.params.userId;
  const sql = `
    SELECT f.id, f.friend_id AS target_id, u.firstname, u.lastname, u.username, u.email, f.status
    FROM friends f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ? AND f.status = 'pending'
  `;
  db.query(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ outgoing: rows });
  });
});

// ➤ Accept request
router.post("/accept", (req, res) => {
  const { user_id, requester_id } = req.body; // user_id = current user, requester_id = who sent
  if (!user_id || !requester_id) {
    return res.status(400).json({ message: "user_id and requester_id required" });
  }
  const acceptSQL =
    "UPDATE friends SET status='accepted' WHERE user_id = ? AND friend_id = ? AND status='pending'";
  db.query(acceptSQL, [requester_id, user_id], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Request not found" });
    }
    // ensure reciprocal row
    const insertBack =
      "INSERT IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')";
    db.query(insertBack, [user_id, requester_id], (err2) => {
      if (err2) return res.status(500).json({ error: err2 });
      res.json({ message: "Friend request accepted" });
    });
  });
});

module.exports = router;
