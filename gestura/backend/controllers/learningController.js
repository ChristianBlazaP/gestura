// backend/controllers/learningController.js
const db = require("../db");

// ===============================
// GET ALL MODULES
// ===============================
exports.getAllModules = async (req, res) => {
  try {
    const [rows] = await db.queryAsync("SELECT * FROM learning_modules ORDER BY id ASC");
    res.json(rows);
  } catch (err) {
    console.error("GET MODULES ERROR:", err);
    res.status(500).json({ error: "Failed to load learning modules" });
  }
};

// ===============================
// GET SINGLE MODULE + QUIZZES
// ===============================
exports.getModuleById = async (req, res) => {
  try {
    const moduleId = req.params.id;

    const [[moduleData]] = await db.queryAsync(
      "SELECT * FROM learning_modules WHERE id = ?",
      [moduleId]
    );

    if (!moduleData) {
      return res.status(404).json({ error: "Module not found" });
    }

    const [quizRows] = await db.queryAsync(
      "SELECT * FROM quizzes WHERE module_id = ? ORDER BY id ASC",
      [moduleId]
    );

    res.json({
      module: moduleData,
      quizzes: quizRows,
    });
  } catch (err) {
    console.error("GET MODULE BY ID ERROR:", err);
    res.status(500).json({ error: "Failed to load module" });
  }
};

// ===============================
// SAVE USER QUIZ SCORE
// ===============================
exports.saveUserScore = async (req, res) => {
  try {
    const userId = req.user.id;
    const { module_id, score } = req.body;

    if (!module_id || score === undefined) {
      return res.status(400).json({ error: "Missing data" });
    }

    await db.queryAsync(
      "INSERT INTO module_scores (user_id, module_id, score) VALUES (?, ?, ?)",
      [userId, module_id, score]
    );

    res.json({ message: "Score saved" });
  } catch (err) {
    console.error("SAVE SCORE ERROR:", err);
    res.status(500).json({ error: "Failed to save score" });
  }
};

// ===============================
// SAVE PRE/POST ASSESSMENT
// ===============================
exports.saveAssessment = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      assessment_type,
      difficulty,
      score,
      total_questions,
      time_left,
      duration_sec,
    } = req.body || {};

    const type = String(assessment_type || "").toLowerCase().trim();
    const level = String(difficulty || "").toLowerCase().trim();

    if (!["pre", "post"].includes(type)) {
      return res.status(400).json({ error: "Invalid assessment type" });
    }
    if (!["easy", "medium", "hard"].includes(level)) {
      return res.status(400).json({ error: "Invalid difficulty" });
    }
    if (!Number.isFinite(Number(score)) || !Number.isFinite(Number(total_questions))) {
      return res.status(400).json({ error: "Invalid score payload" });
    }

    await db.queryAsync(
      `INSERT INTO learning_assessments
        (user_id, assessment_type, difficulty, score, total_questions, time_left, duration_sec)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        type,
        level,
        Number(score),
        Number(total_questions),
        time_left === undefined ? null : Number(time_left),
        duration_sec === undefined ? null : Number(duration_sec),
      ]
    );

    return res.status(201).json({ message: "Assessment saved" });
  } catch (err) {
    console.error("SAVE ASSESSMENT ERROR:", err);
    return res.status(500).json({ error: "Failed to save assessment" });
  }
};

const mapAssessmentType = (type) => {
  const normalized = String(type || "").toLowerCase().trim();
  if (normalized === "pre") return 0;
  if (normalized === "post") return 1;
  return null;
};

// ===============================
// GET ASSESSMENT QUESTIONS
// ===============================
exports.getAssessmentQuestions = async (req, res) => {
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
    console.error("GET ASSESSMENT QUESTIONS ERROR:", err);
    return res.status(500).json({ error: "Failed to load assessment questions" });
  }
};

// ===============================
// GET DEMO VIDEOS
// ===============================
exports.getDemoVideos = async (req, res) => {
  try {
    const [rows] = await db.queryAsync(
      "SELECT id, letter, youtube_url FROM teacher_videos ORDER BY id ASC"
    );
    return res.json({ videos: rows || [] });
  } catch (err) {
    console.error("GET DEMO VIDEOS ERROR:", err);
    return res.status(500).json({ error: "Failed to load demo videos" });
  }
};
