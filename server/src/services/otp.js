const crypto = require('crypto');
const { Otp } = require('../models/Otp');

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function hashesMatch(stored, incoming) {
  const left = Buffer.from(stored, 'hex');
  const right = Buffer.from(incoming, 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function issueOtp({ email, purpose }) {
  const existing = await Otp.findOne({ email, purpose });
  if (existing && existing.expiresAt.getTime() > Date.now()) {
    const wait = RESEND_MS - (Date.now() - existing.lastSentAt.getTime());
    if (wait > 0) {
      return { sent: false, retryAfter: Math.ceil(wait / 1000) };
    }
  }

  const code = generateCode();
  const now = new Date();
  await Otp.findOneAndUpdate(
    { email, purpose },
    {
      email,
      purpose,
      codeHash: hashCode(code),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      attempts: 0,
      lastSentAt: now,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { sent: true, code, retryAfter: 60 };
}

async function checkOtp({ email, purpose, code }) {
  const otp = await Otp.findOne({ email, purpose });
  if (!otp) return { ok: false, reason: 'missing' };
  if (otp.expiresAt.getTime() <= Date.now()) {
    await otp.deleteOne();
    return { ok: false, reason: 'expired' };
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'attempts' };
  }
  if (!hashesMatch(otp.codeHash, hashCode(code))) {
    otp.attempts += 1;
    if (otp.attempts >= MAX_ATTEMPTS) {
      otp.codeHash = crypto.randomBytes(32).toString('hex');
    }
    await otp.save();
    return { ok: false, reason: otp.attempts >= MAX_ATTEMPTS ? 'attempts' : 'mismatch' };
  }
  await otp.deleteOne();
  return { ok: true };
}

function otpError(reason) {
  if (reason === 'expired') return 'That code has expired. Resend a new code.';
  if (reason === 'attempts') return 'Too many attempts. Resend a new code.';
  if (reason === 'missing') return 'Request a new code from the login page.';
  return "That code doesn't match. Try again.";
}

module.exports = { issueOtp, checkOtp, otpError };
