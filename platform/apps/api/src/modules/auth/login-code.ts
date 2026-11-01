import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';

export const LOGIN_CODE_TTL_MS = 10 * 60 * 1000;
export const LOGIN_CODE_RESEND_MS = 60 * 1000;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;

export type LoginCodeReason = 'missing' | 'expired' | 'attempts' | 'mismatch';

export function generateLoginCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashLoginCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

export function loginCodesMatch(storedHash: string, code: string) {
  const left = Buffer.from(storedHash, 'hex');
  const right = Buffer.from(hashLoginCode(code), 'hex');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  return `${(name || '').slice(0, 1)}***@${domain || ''}`;
}

export function resendWaitSeconds(lastSentAt: number, now: number) {
  const wait = LOGIN_CODE_RESEND_MS - (now - lastSentAt);
  return wait > 0 ? Math.ceil(wait / 1000) : 0;
}

export function assessLoginCode(input: {
  storedHash: string;
  attempts: number;
  expiresAt: number;
  now: number;
  code: string;
}) {
  if (input.expiresAt <= input.now) {
    return { ok: false as const, reason: 'expired' as const, attempts: input.attempts, scramble: false };
  }
  if (input.attempts >= LOGIN_CODE_MAX_ATTEMPTS) {
    return { ok: false as const, reason: 'attempts' as const, attempts: input.attempts, scramble: false };
  }
  if (!loginCodesMatch(input.storedHash, input.code)) {
    const attempts = input.attempts + 1;
    const locked = attempts >= LOGIN_CODE_MAX_ATTEMPTS;
    return {
      ok: false as const,
      reason: locked ? 'attempts' as const : 'mismatch' as const,
      attempts,
      scramble: locked,
    };
  }
  return { ok: true as const };
}

export function loginCodeError(reason: LoginCodeReason) {
  if (reason === 'expired') return 'That code has expired. Resend a new code.';
  if (reason === 'attempts') return 'Too many attempts. Resend a new code.';
  if (reason === 'missing') return 'Request a new code from the login page.';
  return "That code doesn't match. Try again.";
}

export function scrambledCodeHash() {
  return hashLoginCode(randomBytes(32).toString('hex'));
}
