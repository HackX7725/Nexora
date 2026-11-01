const bcrypt = require('bcryptjs');
const express = require('express');
const { User, nextAgoraUid } = require('../models/User');
const { Otp } = require('../models/Otp');
const { asyncHandler, httpError } = require('../lib/http');
const { normalizeEmail, validateEmail, validatePassword, validateName } = require('../lib/validators');
const { issueOtp, checkOtp, otpError } = require('../services/otp');
const { sendLoginCode, sendResetCode } = require('../services/mail');
const { requireAuth, setAuthCookie, clearAuthCookie } = require('../middleware/auth');

const router = express.Router();
const DUMMY_HASH = bcrypt.hashSync('nexora-dummy-password', 12);
const FORGOT_MESSAGE = 'If an account exists for that email, we sent a code.';

function fieldError(errors) {
  return httpError(400, 'Check the form and try again.', { errors });
}

router.post('/register', asyncHandler(async (req, res) => {
  const nameResult = validateName(req.body.name);
  const emailResult = validateEmail(req.body.email);
  const passwordResult = validatePassword(req.body.password);
  const errors = {};
  if (nameResult.error) errors.name = nameResult.error;
  if (emailResult.error) errors.email = emailResult.error;
  if (passwordResult.error) errors.password = passwordResult.error;
  if (Object.keys(errors).length) throw fieldError(errors);

  const existing = await User.findOne({ email: emailResult.email });
  if (existing) {
    throw fieldError({ email: 'An account with that email already exists.' });
  }

  const user = await User.create({
    name: nameResult.name,
    email: emailResult.email,
    passwordHash: await bcrypt.hash(passwordResult.password, 12),
    agoraUid: await nextAgoraUid(),
  });
  res.status(201).json({ user: user.toPublic() });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const user = await User.findOne({ email });
  const matches = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !matches) {
    throw httpError(401, 'Invalid email or password.');
  }

  const issued = await issueOtp({ email, purpose: 'login' });
  if (!issued.sent) {
    res.json({
      requiresVerification: true,
      email,
      resendAvailableIn: issued.retryAfter,
    });
    return;
  }

  try {
    await sendLoginCode(email, issued.code);
  } catch (error) {
    await Otp.deleteOne({ email, purpose: 'login' });
    throw error;
  }

  res.json({ requiresVerification: true, email, resendAvailableIn: 60 });
}));

router.post('/verify-login', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  const user = await User.findOne({ email });
  if (!user) throw httpError(400, otpError('missing'));

  const result = await checkOtp({ email, purpose: 'login', code });
  if (!result.ok) throw httpError(400, otpError(result.reason));

  setAuthCookie(res, user.id);
  res.json({ user: user.toPublic() });
}));

router.post('/resend-login-code', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const existing = await Otp.findOne({ email, purpose: 'login' });
  if (!existing) throw httpError(400, 'Request a new code from the login page.');

  const issued = await issueOtp({ email, purpose: 'login' });
  if (!issued.sent) {
    throw httpError(429, `Wait ${issued.retryAfter} seconds before resending.`, {
      retryAfter: issued.retryAfter,
    });
  }

  try {
    await sendLoginCode(email, issued.code);
  } catch (error) {
    await Otp.deleteOne({ email, purpose: 'login' });
    throw error;
  }

  res.json({ message: 'A new code is on its way.', resendAvailableIn: 60 });
}));

router.post('/forgot-password', asyncHandler(async (req, res) => {
  const emailResult = validateEmail(req.body.email);
  if (emailResult.error) throw fieldError({ email: emailResult.error });

  const user = await User.findOne({ email: emailResult.email });
  if (user) {
    const issued = await issueOtp({ email: emailResult.email, purpose: 'reset' });
    if (issued.sent) {
      try {
        await sendResetCode(emailResult.email, issued.code);
      } catch (error) {
        console.error(error);
      }
    }
  }

  res.json({ message: FORGOT_MESSAGE });
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  const passwordResult = validatePassword(req.body.password);
  if (passwordResult.error) throw fieldError({ password: passwordResult.error });

  const user = await User.findOne({ email });
  const result = user
    ? await checkOtp({ email, purpose: 'reset', code })
    : { ok: false, reason: 'mismatch' };
  if (!result.ok) throw httpError(400, otpError(result.reason));

  user.passwordHash = await bcrypt.hash(passwordResult.password, 12);
  await user.save();
  res.json({ message: 'Password updated. Log in with the new password.' });
}));

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

module.exports = router;
