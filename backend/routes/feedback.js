const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const ctrl = require("../controllers/feedbackController");

// Submit feedback (authenticated user)
router.post("/", auth, ctrl.submitFeedback);

// Admin-only list feedback
router.get("/", auth, ctrl.listFeedbackAdmin);

module.exports = router;
