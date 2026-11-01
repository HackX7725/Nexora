const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validateEmail(value) {
  const email = normalizeEmail(value);
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' };
  return { email };
}

function validatePassword(value) {
  const password = String(value || '');
  if (!PASSWORD_RE.test(password)) {
    return { error: 'Use at least 8 characters with one letter and one number.' };
  }
  return { password };
}

function validateName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 60) return { error: 'Enter your name.' };
  return { name };
}

function validateTitle(value) {
  const title = String(value || '').trim().replace(/\s+/g, ' ');
  if (title.length < 2 || title.length > 80) {
    return { error: 'Give the room a title between 2 and 80 characters.' };
  }
  return { title };
}

function validateMode(value) {
  const mode = value === 'voice' ? 'voice' : value === 'video' ? 'video' : '';
  if (!mode) return { error: 'Choose video or voice.' };
  return { mode };
}

module.exports = {
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateName,
  validateTitle,
  validateMode,
};
