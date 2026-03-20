const db = require("../db");

// helper to promisify
function query(sql, params = []) {
  return db.queryAsync(sql, params);
}

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const [userRows] = await query(
      `SELECT id, firstname, lastname, email, bio, cover_url, avatar_url, created_at, role
       FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    if (!userRows || userRows.length === 0) return res.status(404).json({ message: "User not found" });
    const user = userRows[0];

    const [friends] = await query(
      `SELECT u.id, u.firstname, u.lastname, u.email
       FROM friends f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = ?`,
      [userId]
    );

    return res.json({ user, friends: friends || [] });
  } catch (err) {
    console.error("PROFILE get error:", err);
    return res.status(500).json({ error: "Database error" });
  }
};

exports.updateBio = async (req, res) => {
  const userId = req.user.id;
  const { bio = "" } = req.body || {};
  const trimmed = bio.trim();
  if (trimmed.length > 500) return res.status(400).json({ error: "Bio must be 500 characters or less" });
  try {
    await query(`UPDATE users SET bio = ? WHERE id = ?`, [trimmed, userId]);
    return res.json({ message: "Bio updated", bio: trimmed });
  } catch (err) {
    console.error("PROFILE bio update error:", err);
    return res.status(500).json({ error: "Database error (bio)" });
  }
};

exports.updateAvatar = async (req, res) => {
  const userId = req.user.id;
  const { url = "" } = req.body || {};
  if (!url.trim()) return res.status(400).json({ error: "Avatar URL required" });
  try {
    await query(`UPDATE users SET avatar_url = ? WHERE id = ?`, [url.trim(), userId]);
    return res.json({ url: url.trim() });
  } catch (err) {
    console.error("PROFILE avatar update error:", err);
    return res.status(500).json({ error: "Database error (avatar)" });
  }
};

exports.updateCover = async (req, res) => {
  const userId = req.user.id;
  const { url = "" } = req.body || {};
  if (!url.trim()) return res.status(400).json({ error: "Cover URL required" });
  try {
    await query(`UPDATE users SET cover_url = ? WHERE id = ?`, [url.trim(), userId]);
    return res.json({ url: url.trim() });
  } catch (err) {
    console.error("PROFILE cover update error:", err);
    return res.status(500).json({ error: "Database error (cover)" });
  }
};

exports.listPhotos = async (req, res) => {
  const userId = req.user.id;
  try {
    const [photos] = await query(
      `SELECT id, url, caption, likes, created_at FROM photos WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [userId]
    );
    const [likedRows] = await query(
      `SELECT photo_id FROM photo_likes WHERE user_id = ?`,
      [userId]
    );
    return res.json({ photos: photos || [], liked: likedRows.map((r) => r.photo_id) });
  } catch (err) {
    console.error("PROFILE list photos error:", err);
    return res.status(500).json({ error: "Database error (photos)" });
  }
};

exports.addPhoto = async (req, res) => {
  const userId = req.user.id;
  const { url = "", caption = "" } = req.body || {};
  if (!url.trim()) return res.status(400).json({ error: "Photo URL required" });
  try {
    await query(`INSERT INTO photos (user_id, url, caption) VALUES (?, ?, ?)`, [userId, url.trim(), caption.trim()]);
    return res.json({ message: "Photo added" });
  } catch (err) {
    console.error("PROFILE add photo error:", err);
    return res.status(500).json({ error: "Database error (photo add)" });
  }
};

exports.toggleLike = async (req, res) => {
  const userId = req.user.id;
  const photoId = req.params.id;
  try {
    const [exists] = await query(`SELECT id FROM photo_likes WHERE photo_id = ? AND user_id = ?`, [photoId, userId]);
    if (exists.length) {
      await query(`DELETE FROM photo_likes WHERE id = ?`, [exists[0].id]);
      await query(`UPDATE photos SET likes = GREATEST(likes - 1, 0) WHERE id = ?`, [photoId]);
    } else {
      await query(`INSERT INTO photo_likes (photo_id, user_id) VALUES (?, ?)`, [photoId, userId]);
      await query(`UPDATE photos SET likes = likes + 1 WHERE id = ?`, [photoId]);
    }
    const [count] = await query(`SELECT likes FROM photos WHERE id = ?`, [photoId]);
    const likes = count[0]?.likes || 0;
    return res.json({ likes, liked: !exists.length });
  } catch (err) {
    console.error("PROFILE like toggle error:", err);
    return res.status(500).json({ error: "Database error (like)" });
  }
};
