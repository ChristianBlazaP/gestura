// controllers/telemetryControllers.js
const db = require('../db');

// Log a prediction for evaluation
exports.LogPrediction = (req, res) => {
  try {
    const { user_id, predicted_label, confidence, latency_ms, ground_truth, feedback_consent } = req.body;

    if (!predicted_label) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = `
      INSERT INTO telemetry_logs (user_id, predicted_label, confidence, latency_ms, ground_truth, feedback_consent, logged_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    db.query(
      query,
      [user_id || null, predicted_label, confidence || null, latency_ms || null, ground_truth || null, feedback_consent ? 1 : 0],
      (err) => {
        if (err) {
          console.error('Telemetry log error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        return res.status(201).json({ message: 'Prediction logged successfully' });
      }
    );
  } catch (error) {
    console.error('LogPrediction error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get telemetry stats for evaluation
exports.GetStats = (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_predictions,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(confidence) as avg_confidence,
        AVG(latency_ms) as avg_latency_ms,
        COUNT(ground_truth) as labeled_predictions,
        DATE(logged_at) as log_date
      FROM telemetry_logs
      GROUP BY DATE(logged_at)
      ORDER BY log_date DESC
      LIMIT 30
    `;

    db.query(query, (err, results) => {
      if (err) {
        console.error('Stats query error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      return res.json({ stats: results });
    });
  } catch (error) {
    console.error('GetStats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get prediction accuracy by label
exports.GetAccuracy = (req, res) => {
  try {
    const query = `
      SELECT 
        predicted_label,
        COUNT(*) as total,
        SUM(CASE WHEN predicted_label = ground_truth THEN 1 ELSE 0 END) as correct,
        ROUND(100.0 * SUM(CASE WHEN predicted_label = ground_truth THEN 1 ELSE 0 END) / COUNT(*), 2) as accuracy_percent
      FROM telemetry_logs
      WHERE ground_truth IS NOT NULL
      GROUP BY predicted_label
      ORDER BY accuracy_percent DESC
    `;

    db.query(query, (err, results) => {
      if (err) {
        console.error('Accuracy query error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      return res.json({ accuracy_by_label: results });
    });
  } catch (error) {
    console.error('GetAccuracy error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Submit feedback on a prediction
exports.SubmitFeedback = (req, res) => {
  try {
    const { telemetry_id, user_id, feedback_text, rating } = req.body;

    if (!telemetry_id || !feedback_text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = `
      INSERT INTO feedback_logs (telemetry_id, user_id, feedback_text, rating, submitted_at)
      VALUES (?, ?, ?, ?, NOW())
    `;

    db.query(query, [telemetry_id, user_id || null, feedback_text, rating || null], (err) => {
      if (err) {
        console.error('Feedback error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      return res.status(201).json({ message: 'Feedback submitted successfully' });
    });
  } catch (error) {
    console.error('SubmitFeedback error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
