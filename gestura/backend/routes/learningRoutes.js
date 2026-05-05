// backend/routes/learningRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const {
  getAllModules,
  getModuleById,
  getAssessmentQuestions,
  getDemoVideos,
  saveUserScore,
  saveAssessment,
} = require("../controllers/learningController");

router.get("/", auth, getAllModules);          // list all modules
router.get("/demo-videos", auth, getDemoVideos);
router.get("/assessment-questions", auth, getAssessmentQuestions);
router.get("/:id", auth, getModuleById);       // module + quizzes
router.post("/score", auth, saveUserScore);    // save score
router.post("/assessment", auth, saveAssessment); // save pre/post assessment

module.exports = router;
