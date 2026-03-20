// routes/telemetryRoutes.js
const express = require('express');
const router = express.Router();
const TelemetryController = require('../controllers/telemetryControllers');

// Log a prediction
router.post('/log-prediction', TelemetryController.LogPrediction);

// Get evaluation statistics
router.get('/stats', TelemetryController.GetStats);

// Get accuracy metrics by label
router.get('/accuracy', TelemetryController.GetAccuracy);

// Submit feedback on a prediction
router.post('/feedback', TelemetryController.SubmitFeedback);

module.exports = router;
