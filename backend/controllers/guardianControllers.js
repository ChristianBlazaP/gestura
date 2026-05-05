// controllers/guardianControllers.js
const db = require('../db');

// Add a guardian for a dependent user
exports.AddGuardian = (req, res) => {
  try {
    const { dependent_id, guardian_email } = req.body;
    const user_id = req.user?.id; // From JWT middleware (to be added)

    if (!dependent_id || !guardian_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if guardian email exists
    const guardianCheck = 'SELECT id FROM users WHERE email = ?';
    db.query(guardianCheck, [guardian_email], (err, results) => {
      if (err) {
        console.error('Guardian check error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Guardian user not found' });
      }

      const guardian_id = results[0].id;

      // Insert guardian assignment
      const query = `
        INSERT INTO guardian_assignments (dependent_id, guardian_id, assigned_at)
        VALUES (?, ?, NOW())
      `;
      db.query(query, [dependent_id, guardian_id], (err) => {
        if (err) {
          console.error('Insert error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        return res.status(201).json({ message: 'Guardian assigned successfully' });
      });
    });
  } catch (error) {
    console.error('AddGuardian error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get guardians for a dependent user
exports.GetGuardians = (req, res) => {
  try {
    const { dependent_id } = req.params;

    const query = `
      SELECT u.id, u.firstname, u.lastname, u.email, ga.assigned_at
      FROM guardian_assignments ga
      JOIN users u ON ga.guardian_id = u.id
      WHERE ga.dependent_id = ?
    `;
    db.query(query, [dependent_id], (err, results) => {
      if (err) {
        console.error('Query error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      return res.json({ guardians: results });
    });
  } catch (error) {
    console.error('GetGuardians error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Remove a guardian from a dependent user
exports.RemoveGuardian = (req, res) => {
  try {
    const { dependent_id, guardian_id } = req.body;

    const query = 'DELETE FROM guardian_assignments WHERE dependent_id = ? AND guardian_id = ?';
    db.query(query, [dependent_id, guardian_id], (err) => {
      if (err) {
        console.error('Delete error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      return res.json({ message: 'Guardian removed successfully' });
    });
  } catch (error) {
    console.error('RemoveGuardian error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get dependents for a guardian
exports.GetDependents = (req, res) => {
  try {
    const guardian_id = req.user?.id; // From JWT middleware

    const query = `
      SELECT u.id, u.firstname, u.lastname, u.email, u.created_at
      FROM guardian_assignments ga
      JOIN users u ON ga.dependent_id = u.id
      WHERE ga.guardian_id = ?
    `;
    db.query(query, [guardian_id], (err, results) => {
      if (err) {
        console.error('Query error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      return res.json({ dependents: results });
    });
  } catch (error) {
    console.error('GetDependents error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
