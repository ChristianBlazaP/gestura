// routes/auth.js
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authControllers');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/register', AuthController.Register);
router.post('/login', AuthController.Login);
router.post('/password-reset/request', AuthController.RequestPasswordReset);
router.post('/password-reset/confirm', AuthController.ConfirmPasswordReset);
router.get('/verify-email', AuthController.VerifyEmail);
router.post('/resend-verification', AuthController.ResendVerification);
router.post('/recovery-email/request', authMiddleware, AuthController.RequestRecoveryEmail);
router.post('/recovery-email/remove', authMiddleware, AuthController.RemoveRecoveryEmail);
router.get('/verify-recovery-email', AuthController.VerifyRecoveryEmail);

module.exports = router;
