const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const { asyncHandler, httpError } = require('../lib/http');

const COOKIE = 'token';
const WEEK = 7 * 24 * 60 * 60 * 1000;

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function setAuthCookie(res, userId) {
  res.cookie(COOKIE, signToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: WEEK,
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

function readCookie(header, name) {
  if (!header) return '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE] || readCookie(req.headers.cookie, COOKIE);
  if (!token) throw httpError(401, 'Sign in to continue.');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw httpError(401, 'Sign in to continue.');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw httpError(401, 'Sign in to continue.');
  req.user = user;
  next();
});

module.exports = {
  COOKIE,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  readCookie,
  requireAuth,
};
