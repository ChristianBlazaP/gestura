const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");
const demoVideoUpload = require("../middleware/demoVideoUpload");

router.get("/stats", auth, adminOnly, async (req, res) => {
  try {
    const [totalRows] = await db.queryAsync("SELECT COUNT(*) AS total FROM users");
    const [adminRows] = await db.queryAsync(
      "SELECT COUNT(*) AS admins FROM users WHERE role = 'admin'"
    );
    const [activeRows] = await db.queryAsync(
      "SELECT COUNT(*) AS active FROM users WHERE is_active = 1 AND last_seen >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)"
    );
    const [disabledRows] = await db.queryAsync(
      "SELECT COUNT(*) AS disabled FROM users WHERE is_active = 0"
    );

    return res.json({
      totalUsers: totalRows[0]?.total || 0,
      adminUsers: adminRows[0]?.admins || 0,
      activeUsers: activeRows[0]?.active || 0,
      disabledUsers: disabledRows[0]?.disabled || 0,
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/users", auth, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.queryAsync(
      `SELECT id, firstname, lastname, username, email, role, email_verified, is_active, last_login, last_seen, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 500`
    );
    return res.json({ users: rows || [] });
  } catch (err) {
    console.error("Admin users list error:", err);
    return res.status(500).json({ error: "Failed to load users" });
  }
});

router.get("/active-users", auth, adminOnly, async (req, res) => {
  try {
    const minutesRaw = Number(req.query.minutes || 5);
    const minutes = Number.isFinite(minutesRaw)
      ? Math.min(Math.max(Math.floor(minutesRaw), 1), 120)
      : 5;
    const since = new Date(Date.now() - minutes * 60 * 1000);

    const [rows] = await db.queryAsync(
      `SELECT id, firstname, lastname, username, email, role, last_seen
       FROM users
       WHERE is_active = 1 AND last_seen IS NOT NULL AND last_seen >= ?
       ORDER BY last_seen DESC
       LIMIT 200`,
      [since]
    );
    return res.json({ minutes, users: rows || [] });
  } catch (err) {
    console.error("Active users list error:", err);
    return res.status(500).json({ error: "Failed to load active users" });
  }
});

router.put("/users/:id/role", auth, adminOnly, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const { role = "" } = req.body || {};
    if (!Number.isInteger(targetId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const cleanRole = role.trim().toLowerCase();
    if (!["user", "admin"].includes(cleanRole)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (req.user?.id === targetId && cleanRole !== "admin") {
      return res.status(400).json({ error: "You cannot remove your own admin role" });
    }

    const [existing] = await db.queryAsync(
      "SELECT id FROM users WHERE id = ? LIMIT 1",
      [targetId]
    );
    if (!existing.length) {
      return res.status(404).json({ error: "User not found" });
    }

    await db.queryAsync("UPDATE users SET role = ? WHERE id = ?", [
      cleanRole,
      targetId,
    ]);

    return res.json({ id: targetId, role: cleanRole });
  } catch (err) {
    console.error("Admin update role error:", err);
    return res.status(500).json({ error: "Failed to update role" });
  }
});

router.put("/users/:id/status", auth, adminOnly, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const { is_active } = req.body || {};
    if (!Number.isInteger(targetId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const nextActive =
      typeof is_active === "boolean"
        ? is_active
        : String(is_active).toLowerCase() === "true" ||
          String(is_active).toLowerCase() === "1";

    if (req.user?.id === targetId && !nextActive) {
      return res.status(400).json({ error: "You cannot disable your own account" });
    }

    const [existing] = await db.queryAsync(
      "SELECT id FROM users WHERE id = ? LIMIT 1",
      [targetId]
    );
    if (!existing.length) {
      return res.status(404).json({ error: "User not found" });
    }

    await db.queryAsync("UPDATE users SET is_active = ? WHERE id = ?", [
      nextActive ? 1 : 0,
      targetId,
    ]);

    return res.json({ id: targetId, is_active: nextActive ? 1 : 0 });
  } catch (err) {
    console.error("Admin update status error:", err);
    return res.status(500).json({ error: "Failed to update user status" });
  }
});

router.get("/learning-stats", auth, adminOnly, async (req, res) => {
  try {
    const [totalsRows] = await db.queryAsync(
      `SELECT
        COUNT(*) AS attempts,
        AVG(score) AS avg_score,
        COUNT(DISTINCT user_id) AS learners,
        COUNT(DISTINCT module_id) AS modules_touched
      FROM module_scores`
    );

    const totals = totalsRows?.[0] || {};

    const [perUserRows] = await db.queryAsync(
      `SELECT
        u.id AS user_id,
        u.firstname,
        u.lastname,
        u.username,
        u.email,
        COUNT(ms.user_id) AS attempts,
        AVG(ms.score) AS avg_score
      FROM users u
      LEFT JOIN module_scores ms ON ms.user_id = u.id
      GROUP BY u.id, u.firstname, u.lastname, u.username, u.email
      ORDER BY attempts DESC, u.created_at DESC
      LIMIT 500`
    );

    const [perModuleRows] = await db.queryAsync(
      `SELECT
        module_id,
        COUNT(*) AS attempts,
        COUNT(DISTINCT user_id) AS learners,
        AVG(score) AS avg_score
      FROM module_scores
      GROUP BY module_id
      ORDER BY attempts DESC`
    );

    return res.json({
      totals: {
        attempts: Number(totals.attempts || 0),
        avgScore: totals.avg_score === null ? null : Number(totals.avg_score),
        learners: Number(totals.learners || 0),
        modulesTouched: Number(totals.modules_touched || 0),
      },
      perUser: perUserRows || [],
      perModule: perModuleRows || [],
    });
  } catch (err) {
    console.error("Admin learning stats error:", err);
    return res.status(500).json({ error: "Failed to load learning stats" });
  }
});

router.get("/assessment-stats", auth, adminOnly, async (req, res) => {
  try {
    const [totalsRows] = await db.queryAsync(
      `SELECT
        COUNT(*) AS attempts,
        AVG(score) AS avg_score,
        COUNT(DISTINCT user_id) AS learners
      FROM learning_assessments`
    );
    const totals = totalsRows?.[0] || {};

    const [typeRows] = await db.queryAsync(
      `SELECT
        assessment_type,
        COUNT(*) AS attempts,
        AVG(score) AS avg_score
      FROM learning_assessments
      GROUP BY assessment_type`
    );

    const [difficultyRows] = await db.queryAsync(
      `SELECT
        assessment_type,
        difficulty,
        COUNT(*) AS attempts,
        AVG(score) AS avg_score
      FROM learning_assessments
      GROUP BY assessment_type, difficulty`
    );

    const byType = {};
    (typeRows || []).forEach((row) => {
      const key = row.assessment_type || "unknown";
      byType[key] = {
        attempts: Number(row.attempts || 0),
        avgScore: row.avg_score === null ? null : Number(row.avg_score),
        byDifficulty: {},
      };
    });

    (difficultyRows || []).forEach((row) => {
      const typeKey = row.assessment_type || "unknown";
      if (!byType[typeKey]) {
        byType[typeKey] = {
          attempts: 0,
          avgScore: null,
          byDifficulty: {},
        };
      }
      byType[typeKey].byDifficulty[row.difficulty || "unknown"] = {
        attempts: Number(row.attempts || 0),
        avgScore: row.avg_score === null ? null : Number(row.avg_score),
      };
    });

    return res.json({
      totals: {
        attempts: Number(totals.attempts || 0),
        avgScore: totals.avg_score === null ? null : Number(totals.avg_score),
        learners: Number(totals.learners || 0),
      },
      byType,
    });
  } catch (err) {
    console.error("Admin assessment stats error:", err);
    return res.status(500).json({ error: "Failed to load assessment stats" });
  }
});

router.get("/gesture-records", auth, adminOnly, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 100);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.floor(limitRaw), 1), 500)
      : 100;

    const [rows] = await db.queryAsync(
      `SELECT
        d.id,
        d.user_id,
        d.label,
        d.landmarks_json,
        d.created_at,
        u.firstname,
        u.lastname,
        u.username,
        u.email
      FROM dataset d
      JOIN users u ON u.id = d.user_id
      ORDER BY d.created_at DESC
      LIMIT ?`,
      [limit]
    );

    return res.json({ records: rows || [] });
  } catch (err) {
    console.error("Admin gesture records error:", err);
    return res.status(500).json({ error: "Failed to load gesture records" });
  }
});

const mapAssessmentType = (type) => {
  const normalized = String(type || "").toLowerCase().trim();
  if (normalized === "pre") return 0;
  if (normalized === "post") return 1;
  return null;
};

router.get("/assessment-users", auth, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.queryAsync(
      `SELECT
        u.id AS user_id,
        u.firstname,
        u.lastname,
        u.username,
        u.email,
        COUNT(la.id) AS attempts,
        AVG(la.score) AS avg_score
       FROM users u
       LEFT JOIN learning_assessments la ON la.user_id = u.id
       GROUP BY u.id, u.firstname, u.lastname, u.username, u.email
       ORDER BY attempts DESC, u.created_at DESC
       LIMIT 500`
    );
    return res.json({ users: rows || [] });
  } catch (err) {
    console.error("Admin assessment users error:", err);
    return res.status(500).json({ error: "Failed to load assessment users" });
  }
});

router.get("/assessment-questions", auth, adminOnly, async (req, res) => {
  try {
    const moduleId = mapAssessmentType(req.query.type);
    if (moduleId === null) {
      return res.status(400).json({ error: "Invalid assessment type" });
    }
    const [rows] = await db.queryAsync(
      "SELECT * FROM quizzes WHERE module_id = ? ORDER BY id ASC",
      [moduleId]
    );
    return res.json({ type: req.query.type, questions: rows || [] });
  } catch (err) {
    console.error("Admin assessment questions error:", err);
    return res.status(500).json({ error: "Failed to load assessment questions" });
  }
});

router.post("/assessment-questions", auth, adminOnly, async (req, res) => {
  try {
    const moduleId = mapAssessmentType(req.body?.type);
    if (moduleId === null) {
      return res.status(400).json({ error: "Invalid assessment type" });
    }
    const question = String(req.body?.question || "").trim();
    const choices = Array.isArray(req.body?.choices)
      ? req.body.choices.map((item) => String(item || "").trim())
      : [
          req.body?.choice_a,
          req.body?.choice_b,
          req.body?.choice_c,
          req.body?.choice_d,
        ].map((item) => String(item || "").trim());
    const [choiceA, choiceB, choiceC, choiceD] = choices;
    if (!question || !choiceA || !choiceB || !choiceC || !choiceD) {
      return res.status(400).json({ error: "Question and 4 choices required" });
    }
    const correct = String(req.body?.correct_answer || "").trim();
    if (!correct || !choices.includes(correct)) {
      return res.status(400).json({ error: "Correct answer must match a choice" });
    }
    const [result] = await db.queryAsync(
      `INSERT INTO quizzes
        (module_id, question, choice_a, choice_b, choice_c, choice_d, correct_answer)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [moduleId, question, choiceA, choiceB, choiceC, choiceD, correct]
    );
    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error("Admin create assessment question error:", err);
    return res.status(500).json({ error: "Failed to create assessment question" });
  }
});

router.put("/assessment-questions/:id", auth, adminOnly, async (req, res) => {
  try {
    const questionId = Number(req.params.id);
    if (!Number.isInteger(questionId)) {
      return res.status(400).json({ error: "Invalid question id" });
    }
    const question = String(req.body?.question || "").trim();
    const choices = Array.isArray(req.body?.choices)
      ? req.body.choices.map((item) => String(item || "").trim())
      : [
          req.body?.choice_a,
          req.body?.choice_b,
          req.body?.choice_c,
          req.body?.choice_d,
        ].map((item) => String(item || "").trim());
    const [choiceA, choiceB, choiceC, choiceD] = choices;
    if (!question || !choiceA || !choiceB || !choiceC || !choiceD) {
      return res.status(400).json({ error: "Question and 4 choices required" });
    }
    const correct = String(req.body?.correct_answer || "").trim();
    if (!correct || !choices.includes(correct)) {
      return res.status(400).json({ error: "Correct answer must match a choice" });
    }
    await db.queryAsync(
      `UPDATE quizzes
       SET question = ?, choice_a = ?, choice_b = ?, choice_c = ?, choice_d = ?, correct_answer = ?
       WHERE id = ?`,
      [question, choiceA, choiceB, choiceC, choiceD, correct, questionId]
    );
    return res.json({ id: questionId });
  } catch (err) {
    console.error("Admin update assessment question error:", err);
    return res.status(500).json({ error: "Failed to update assessment question" });
  }
});

router.delete("/assessment-questions/:id", auth, adminOnly, async (req, res) => {
  try {
    const questionId = Number(req.params.id);
    if (!Number.isInteger(questionId)) {
      return res.status(400).json({ error: "Invalid question id" });
    }
    await db.queryAsync("DELETE FROM quizzes WHERE id = ?", [questionId]);
    return res.json({ id: questionId });
  } catch (err) {
    console.error("Admin delete assessment question error:", err);
    return res.status(500).json({ error: "Failed to delete assessment question" });
  }
});

router.get("/demo-videos", auth, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.queryAsync(
      "SELECT id, letter, youtube_url FROM teacher_videos ORDER BY id DESC"
    );
    return res.json({ videos: rows || [] });
  } catch (err) {
    console.error("Admin demo videos error:", err);
    return res.status(500).json({ error: "Failed to load demo videos" });
  }
});

router.post("/demo-videos", auth, adminOnly, async (req, res) => {
  try {
    const letter = String(req.body?.letter || "").trim();
    const youtubeUrl = String(req.body?.youtube_url || "").trim();
    if (!letter || !youtubeUrl) {
      return res.status(400).json({ error: "Label and URL required" });
    }
    const [result] = await db.queryAsync(
      "INSERT INTO teacher_videos (letter, youtube_url) VALUES (?, ?)",
      [letter, youtubeUrl]
    );
    return res.status(201).json({
      id: result.insertId,
      letter,
      youtube_url: youtubeUrl,
    });
  } catch (err) {
    console.error("Admin create demo video error:", err);
    return res.status(500).json({ error: "Failed to create demo video" });
  }
});

router.post(
  "/demo-videos/upload",
  auth,
  adminOnly,
  demoVideoUpload.single("video"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No video file uploaded" });
      }
      const label = String(req.body?.label || "").trim();
      if (!label) {
        return res.status(400).json({ error: "Label is required" });
      }
      const fileUrl = `/uploads/demos/${req.file.filename}`;
      const [result] = await db.queryAsync(
        "INSERT INTO teacher_videos (letter, youtube_url) VALUES (?, ?)",
        [label, fileUrl]
      );
      return res.status(201).json({
        id: result.insertId,
        letter: label,
        youtube_url: fileUrl,
      });
    } catch (err) {
      console.error("Admin upload demo video error:", err);
      return res.status(500).json({ error: "Failed to upload demo video" });
    }
  }
);

router.delete("/demo-videos/:id", auth, adminOnly, async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId)) {
      return res.status(400).json({ error: "Invalid video id" });
    }
    const [rows] = await db.queryAsync(
      "SELECT youtube_url FROM teacher_videos WHERE id = ?",
      [videoId]
    );
    await db.queryAsync("DELETE FROM teacher_videos WHERE id = ?", [videoId]);
    const url = rows?.[0]?.youtube_url || "";
    if (url.startsWith("/uploads/demos/")) {
      const path = require("path");
      const fs = require("fs");
      const filePath = path.join(__dirname, "..", url.replace(/^\/uploads\//, "uploads/"));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    return res.json({ id: videoId });
  } catch (err) {
    console.error("Admin delete demo video error:", err);
    return res.status(500).json({ error: "Failed to delete demo video" });
  }
});

module.exports = router;
