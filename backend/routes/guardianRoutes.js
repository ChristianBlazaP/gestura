
const express = require('express');
const router = express.Router();
const GuardianController = require('../controllers/guardianControllers');
const auth = require('../middleware/authMiddleware');

// Assign a guardian to a dependent (guardian must be logged in)
router.post('/assign', auth, GuardianController.AddGuardian);

// Get guardians for a dependent (dependent must be logged in)
router.get('/dependent/:dependent_id', auth, GuardianController.GetGuardians);

// Remove a guardian from a dependent
router.post('/remove', auth, GuardianController.RemoveGuardian);

// Get dependents for a guardian (guardian must be logged in)
router.get('/dependents', auth, GuardianController.GetDependents);

module.exports = router;