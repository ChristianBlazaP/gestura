const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const RESET_TOKEN_EXPIRY = '1h';

const isValidEmail = (email) =>
  typeof email === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());

let mailTransporter = null;
const getMailTransporter = () => {
  if (mailTransporter) return mailTransporter;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER || 'your-email@example.com';
  const pass = process.env.SMTP_PASS || 'your-app-password';
  const usePool = process.env.SMTP_POOL === 'true';

  mailTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    pool: usePool,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return mailTransporter;
};

const getMailFrom = () => {
  const user = process.env.SMTP_USER || 'no-reply@gestura.ai';
  return process.env.RESET_EMAIL_FROM || `Gestura <${user}>`;
};

const sendResetEmail = async (to, token) => {
  const transporter = getMailTransporter();

  const resetBase =
    process.env.FRONTEND_RESET_URL || 'http://localhost:5173/reset-password';
  const resetLink = `${resetBase}${resetBase.includes('?') ? '&' : '?'}token=${token}`;

  const mailOptions = {
    from: getMailFrom(),
    to,
    subject: 'Gestura password reset',
    text: `You requested a password reset. Use the link to set a new password:\n${resetLink}\n\nIf you did not request this, you can ignore the email.`,
    html: `<p>You requested a password reset.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, you can ignore the email.</p>`,
  };

  await transporter.sendMail(mailOptions);
};

const sendVerificationEmail = async (to, token) => {
  const transporter = getMailTransporter();

  const verifyBase =
    process.env.FRONTEND_VERIFY_URL || 'http://localhost:5173/verify-email';
  const verifyLink = `${verifyBase}${verifyBase.includes('?') ? '&' : '?'}token=${token}`;

  const mailOptions = {
    from: getMailFrom(),
    to,
    subject: 'Verify your email for Gestura',
    text: `Welcome! Please verify your email by clicking this link:\n${verifyLink}\nThis link expires in 24 hours.`,
    html: `<p>Welcome! Please verify your email:</p><p><a href="${verifyLink}">${verifyLink}</a></p><p>This link expires in 24 hours.</p>`,
  };

  await transporter.sendMail(mailOptions);
};

const sendRecoveryVerificationEmail = async (to, token) => {
  const transporter = getMailTransporter();

  const verifyBase =
    process.env.FRONTEND_RECOVERY_VERIFY_URL ||
    'http://localhost:5173/auth/verify-recovery-email';
  const verifyLink = `${verifyBase}${verifyBase.includes('?') ? '&' : '?'}token=${token}`;

  const mailOptions = {
    from: getMailFrom(),
    to,
    subject: 'Verify your recovery email for Gestura',
    text: `Please verify your recovery email by clicking this link:\n${verifyLink}\nThis link expires in 24 hours.`,
    html: `<p>Please verify your recovery email:</p><p><a href="${verifyLink}">${verifyLink}</a></p><p>This link expires in 24 hours.</p>`,
  };

  await transporter.sendMail(mailOptions);
};

const safeUser = (user) => ({
  id: user.id,
  firstname: user.firstname,
  middlename: user.middlename,
  lastname: user.lastname,
  suffix: user.suffix,
  username: user.username,
  email: user.email,
  role: user.role,
});

// REGISTER CONTROLLER
exports.Register = async (req, res) => {
  try {
    const {
      firstname = '',
      middlename = '',
      lastname = '',
      suffix = '',
      username = '',
      email = '',
      password = '',
      role = 'user',
      admin_code = '',
    } = req.body || {};

    if (!firstname.trim() || !lastname.trim() || !username.trim() || !password) {
      return res.status(400).json({ error: 'Required fields are missing' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    const [existing] = await db.queryAsync(
      'SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1',
      [cleanEmail, cleanUsername]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email or username already registered' });
    }

    const wantsAdmin = role === 'admin';
    let finalRole = 'user';
    if (wantsAdmin) {
      const expectedAdminCode = (process.env.ADMIN_REGISTRATION_CODE || '').trim();
      const providedAdminCode = admin_code.trim();
      if (!expectedAdminCode) {
        return res.status(403).json({ error: 'Admin registration is disabled' });
      }
      if (!providedAdminCode || providedAdminCode !== expectedAdminCode) {
        return res.status(403).json({ error: 'Invalid admin access code' });
      }
      finalRole = 'admin';
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const [result] = await db.queryAsync(
      `
        INSERT INTO users (firstname, middlename, lastname, suffix, username, email, password, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        firstname.trim(),
        middlename.trim(),
        lastname.trim(),
        suffix.trim(),
        cleanUsername,
        cleanEmail,
        hashedPassword,
        finalRole,
      ]
    );

    // store verification token + expiry (24h)
    await db.queryAsync(
      `UPDATE users SET verification_token = ?, verification_expires = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?`,
      [verificationToken, result.insertId]
    );

    try {
      await sendVerificationEmail(cleanEmail, verificationToken);
    } catch (mailErr) {
      console.error('Verification email send failed:', mailErr);
    }

    return res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};


// LOGIN CONTROLLER
exports.Login = async (req, res) => {
  try {
    const { username = '', email = '', password = '' } = req.body || {};
    const loginId = (username || email || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({ error: 'Username/email and password required' });
    }

    const [rows] = await db.queryAsync(
      'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
      [loginId, loginId]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (Number(user.is_active) === 0) {
      return res.status(403).json({ error: 'Account disabled. Contact your admin.' });
    }

    if (!user.email_verified) {
      return res
        .status(403)
        .json({ error: 'Please verify your email first. Check your inbox or resend verification.' });
    }

    try {
      await db.queryAsync(
        "UPDATE users SET last_login = NOW(), last_seen = NOW() WHERE id = ?",
        [user.id]
      );
    } catch (updateErr) {
      console.error("Login activity update failed:", updateErr);
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      undefined
    );

    return res.json({
      message: 'Login successful',
      token,
      user: safeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// REQUEST RESET CONTROLLER
exports.RequestPasswordReset = async (req, res) => {
  try {
    const { email = '' } = req.body || {};
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email' });
    }

    const [rows] = await db.queryAsync(
      'SELECT id, firstname, email, recovery_email, recovery_email_verified FROM users WHERE email = ? OR recovery_email = ? LIMIT 1',
      [cleanEmail, cleanEmail]
    );

    if (!rows || rows.length === 0) {
      return res.json({
        message: 'If an account exists, a reset link has been sent.',
      });
    }

    const user = rows[0];
    let targetEmail = '';
    if (user.email && user.email.toLowerCase() === cleanEmail) {
      targetEmail = user.email;
    } else if (
      user.recovery_email_verified &&
      user.recovery_email &&
      user.recovery_email.toLowerCase() === cleanEmail
    ) {
      targetEmail = user.recovery_email;
    }

    if (!targetEmail) {
      return res.json({
        message: 'If an account exists, a reset link has been sent.',
      });
    }
    const resetToken = jwt.sign(
      { id: user.id, email: targetEmail, type: 'reset' },
      JWT_SECRET,
      { expiresIn: RESET_TOKEN_EXPIRY }
    );

    try {
      await sendResetEmail(targetEmail, resetToken);
    } catch (mailErr) {
      console.error('Email send failed:', mailErr);
    }

    return res.json({
      message: 'Reset link generated. Check your email.',
      token: resetToken,
    });
  } catch (error) {
    console.error('Request reset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// CONFIRM RESET CONTROLLER
exports.ConfirmPasswordReset = async (req, res) => {
  try {
    const { token, newPassword = '' } = req.body || {};

    if (!token || !newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: 'Token and a new password (min 6 chars) are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    if (decoded.type !== 'reset') {
      return res.status(400).json({ error: 'Invalid token type' });
    }

    const [rows] = await db.queryAsync('SELECT id FROM users WHERE id = ? LIMIT 1', [
      decoded.id,
    ]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.queryAsync('UPDATE users SET password = ? WHERE id = ?', [
      hashedPassword,
      decoded.id,
    ]);

    return res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Confirm reset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// VERIFY EMAIL
exports.VerifyEmail = async (req, res) => {
  try {
    const token = (req.query.token || req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const [rows] = await db.queryAsync(
      `SELECT id, verification_expires FROM users WHERE verification_token = ? LIMIT 1`,
      [token]
    );
    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    const user = rows[0];
    if (user.verification_expires && new Date(user.verification_expires) < new Date()) {
      return res.status(400).json({ error: 'Verification token expired' });
    }

    await db.queryAsync(
      `UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?`,
      [user.id]
    );

    return res.json({ message: 'Email verified' });
  } catch (err) {
    console.error('Verify email error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// RESEND VERIFICATION
exports.ResendVerification = async (req, res) => {
  try {
    const { email = '' } = req.body || {};
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const [rows] = await db.queryAsync(
      `SELECT id, email_verified FROM users WHERE email = ? LIMIT 1`,
      [cleanEmail]
    );
    if (!rows || rows.length === 0) {
      return res.json({ message: 'If an account exists, a verification email was sent.' });
    }
    const user = rows[0];
    if (user.email_verified) {
      return res.json({ message: 'Email already verified.' });
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    await db.queryAsync(
      `UPDATE users SET verification_token = ?, verification_expires = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?`,
      [newToken, user.id]
    );
    try {
      await sendVerificationEmail(cleanEmail, newToken);
    } catch (mailErr) {
      console.error('Resend verification email failed:', mailErr);
    }

    return res.json({ message: 'If an account exists, a verification email was sent.' });
  } catch (err) {
    console.error('Resend verify error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// REQUEST RECOVERY EMAIL (authenticated)
exports.RequestRecoveryEmail = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { recovery_email = '' } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const cleanEmail = recovery_email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid recovery email' });
    }

    const [rows] = await db.queryAsync(
      'SELECT email FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const primaryEmail = (rows[0].email || '').toLowerCase();
    if (primaryEmail && primaryEmail === cleanEmail) {
      return res.status(400).json({ error: 'Recovery email must be different from your login email' });
    }

    const [dupRows] = await db.queryAsync(
      'SELECT id FROM users WHERE (email = ? OR recovery_email = ?) AND id <> ? LIMIT 1',
      [cleanEmail, cleanEmail, userId]
    );
    if (dupRows.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const recoveryToken = crypto.randomBytes(32).toString('hex');
    await db.queryAsync(
      `UPDATE users
       SET recovery_email = ?, recovery_email_verified = 0,
           recovery_email_token = ?, recovery_email_expires = DATE_ADD(NOW(), INTERVAL 24 HOUR)
       WHERE id = ?`,
      [cleanEmail, recoveryToken, userId]
    );

    try {
      await sendRecoveryVerificationEmail(cleanEmail, recoveryToken);
    } catch (mailErr) {
      console.error('Recovery verification email send failed:', mailErr);
    }

    return res.json({ message: 'Recovery email verification sent.' });
  } catch (err) {
    console.error('Recovery email request error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// VERIFY RECOVERY EMAIL
exports.VerifyRecoveryEmail = async (req, res) => {
  try {
    const token = (req.query.token || req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const [rows] = await db.queryAsync(
      `SELECT id, recovery_email_expires FROM users WHERE recovery_email_token = ? LIMIT 1`,
      [token]
    );
    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    const user = rows[0];
    if (user.recovery_email_expires && new Date(user.recovery_email_expires) < new Date()) {
      return res.status(400).json({ error: 'Recovery token expired' });
    }

    await db.queryAsync(
      `UPDATE users
       SET recovery_email_verified = 1, recovery_email_token = NULL, recovery_email_expires = NULL
       WHERE id = ?`,
      [user.id]
    );

    return res.json({ message: 'Recovery email verified' });
  } catch (err) {
    console.error('Verify recovery email error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// REMOVE RECOVERY EMAIL (authenticated)
exports.RemoveRecoveryEmail = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await db.queryAsync(
      `UPDATE users
       SET recovery_email = NULL, recovery_email_verified = 0,
           recovery_email_token = NULL, recovery_email_expires = NULL
       WHERE id = ?`,
      [userId]
    );

    return res.json({ message: 'Recovery email removed' });
  } catch (err) {
    console.error('Remove recovery email error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
