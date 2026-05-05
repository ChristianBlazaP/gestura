// controllers/datasetControllers.js
const db = require('../db');
const fs = require('fs');
const path = require('path');

// Record a training sample (landmarks + label)
exports.RecordSample = (req, res) => {
  try {
    const { user_id, gesture_label, landmarks, metadata } = req.body;

    if (!gesture_label || !landmarks) {
      return res.status(400).json({ error: 'Missing gesture_label or landmarks' });
    }

    // Store landmarks as JSON
    const query = `
      INSERT INTO dataset_samples (user_id, gesture_label, landmarks, metadata, recorded_at)
      VALUES (?, ?, ?, ?, NOW())
    `;

    db.query(
      query,
      [user_id || null, gesture_label, JSON.stringify(landmarks), metadata ? JSON.stringify(metadata) : null],
      (err, result) => {
        if (err) {
          console.error('Sample record error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        return res.status(201).json({
          message: 'Sample recorded successfully',
          sample_id: result.insertId
        });
      }
    );
  } catch (error) {
    console.error('RecordSample error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get dataset statistics
exports.GetDatasetStats = (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_samples,
        COUNT(DISTINCT user_id) as unique_signers,
        COUNT(DISTINCT gesture_label) as unique_gestures,
        gesture_label,
        COUNT(*) as samples_per_gesture
      FROM dataset_samples
      GROUP BY gesture_label
      ORDER BY samples_per_gesture DESC
    `;

    db.query(query, (err, results) => {
      if (err) {
        console.error('Stats query error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      const totalStats = {
        total_samples: results.reduce((sum, r) => sum + r.samples_per_gesture, 0),
        unique_signers: results[0]?.unique_signers || 0,
        unique_gestures: results.length
      };

      return res.json({ stats: totalStats, breakdown: results });
    });
  } catch (error) {
    console.error('GetDatasetStats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Export dataset for training (with consent check)
exports.ExportDataset = (req, res) => {
  try {
    const query = `
      SELECT gesture_label, landmarks, metadata
      FROM dataset_samples
      WHERE user_id IS NOT NULL OR user_id IS NULL
      LIMIT 10000
    `;

    db.query(query, (err, results) => {
      if (err) {
        console.error('Export query error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Format as JSONL for training
      const jsonl = results
        .map(row => JSON.stringify({
          label: row.gesture_label,
          landmarks: JSON.parse(row.landmarks),
          metadata: row.metadata ? JSON.parse(row.metadata) : null
        }))
        .join('\n');

      return res.json({
        message: 'Dataset exported',
        count: results.length,
        data: jsonl
      });
    });
  } catch (error) {
    console.error('ExportDataset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get a specific gesture samples for labeling review
exports.GetGestureReview = (req, res) => {
  try {
    const { gesture_label } = req.params;

    const query = `
      SELECT id, user_id, landmarks, metadata, recorded_at
      FROM dataset_samples
      WHERE gesture_label = ?
      LIMIT 50
    `;

    db.query(query, [gesture_label], (err, results) => {
      if (err) {
        console.error('Review query error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      return res.json({ samples: results });
    });
  } catch (error) {
    console.error('GetGestureReview error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
  