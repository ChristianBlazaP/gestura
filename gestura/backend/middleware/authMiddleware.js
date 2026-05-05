const jwt = require("jsonwebtoken");
const db = require("../db");

module.exports = async function authMiddleware(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ error: "No token provided" });

  const token = header.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Malformed token" });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecret");
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const [rows] = await db.queryAsync(
      "SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1",
      [decoded.id]
    );
    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: "Invalid user" });
    }
    const user = rows[0];
    if (Number(user.is_active) === 0) {
      return res.status(403).json({ error: "Account disabled. Contact your admin." });
    }
    req.user = { ...decoded, id: user.id, role: user.role, is_active: user.is_active };
    return next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};
