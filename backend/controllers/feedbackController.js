const db = require("../db");

const query = (sql, params = []) => db.queryAsync(sql, params);

exports.submitFeedback = async (req, res) => {
  try {
    const userId = req.user?.id;
    const message = (req.body?.message || "").trim();
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!message) return res.status(400).json({ error: "Feedback message is required" });
    if (message.length > 2000) {
      return res.status(400).json({ error: "Feedback too long (max 2000 characters)" });
    }

    await query("INSERT INTO feedback (user_id, message) VALUES (?, ?)", [userId, message]);
    return res.json({ ok: true, message: "Feedback submitted" });
  } catch (err) {
    console.error("Feedback submit error:", err);
    return res.status(500).json({ error: "Database error" });
  }
};

exports.listFeedbackAdmin = async (req, res) => {
  try {
    const role = req.user?.role;
    if (role !== "admin") return res.status(403).json({ error: "Admin only" });

    const [rows] = await query(
      `SELECT f.id, f.message, f.created_at, u.id AS user_id, u.firstname, u.lastname, u.email
       FROM feedback f
       JOIN users u ON u.id = f.user_id
       ORDER BY f.created_at DESC
       LIMIT 200`
    );
    return res.json({ feedback: rows || [] });
  } catch (err) {
    console.error("Feedback list error:", err);
    return res.status(500).json({ error: "Database error" });
  }
};
