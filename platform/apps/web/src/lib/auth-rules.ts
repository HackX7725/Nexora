const usernamePattern = /^[a-z0-9_]{3,32}$/;
const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LoginErrors {
  identifier?: string;
  password?: string;
}

export interface RegisterErrors {
  username?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirm?: string;
}

export function validateLogin(identifier: string, password: string): LoginErrors {
  const errors: LoginErrors = {};
  if (identifier.trim().length < 3 || identifier.trim().length > 254) {
    errors.identifier = 'Enter your username, email, or phone.';
  }
  if (!passwordPattern.test(password)) errors.password = 'Use at least 8 characters with a letter and a number.';
  return errors;
}

export function validateLoginCode(code: string) {
  return /^\d{6}$/.test(code) ? undefined : 'Enter the 6-digit code from your email.';
}

export function validateRegister(username: string, email: string, phone: string, password: string, confirm: string): RegisterErrors {
  const errors: RegisterErrors = {};
  const name = username.trim().toLowerCase();
  const address = email.trim();
  if (!usernamePattern.test(name)) errors.username = 'Use 3–32 letters, numbers, or underscores.';
  if (address.length > 254 || !emailPattern.test(address.toLowerCase())) errors.email = 'Enter a valid email address.';
  const rawPhone = phone.trim();
  if (rawPhone) {
    const digits = rawPhone.replace(/\D/g, '');
    const normalized = rawPhone.startsWith('+') ? `+${digits}` : digits;
    if (digits.length < 8 || normalized.length > 20) errors.phone = 'Enter a valid phone number.';
  }
  if (!passwordPattern.test(password)) errors.password = 'Use at least 8 characters with a letter and a number.';
  if (password !== confirm) errors.confirm = 'Those passwords do not match.';
  return errors;
}

export function hasErrors(errors: object) {
  return Object.values(errors).some(Boolean);
}
