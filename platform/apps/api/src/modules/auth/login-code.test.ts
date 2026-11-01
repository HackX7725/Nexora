import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LOGIN_CODE_MAX_ATTEMPTS,
  LOGIN_CODE_TTL_MS,
  assessLoginCode,
  hashLoginCode,
  loginCodesMatch,
  resendWaitSeconds,
} from './login-code.ts';

const now = Date.parse('2026-11-01T00:00:00.000Z');

test('the stored hash is not the code', () => {
  const hash = hashLoginCode('123456');
  assert.notEqual(hash, '123456');
  assert.equal(loginCodesMatch(hash, '123456'), true);
  assert.equal(loginCodesMatch(hash, '000000'), false);
});

test('an expired code is rejected', () => {
  const verdict = assessLoginCode({
    storedHash: hashLoginCode('123456'),
    attempts: 0,
    expiresAt: now - 1,
    now,
    code: '123456',
  });
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.reason, 'expired');
});

test('the fifth wrong code locks the challenge', () => {
  const verdict = assessLoginCode({
    storedHash: hashLoginCode('123456'),
    attempts: LOGIN_CODE_MAX_ATTEMPTS - 1,
    expiresAt: now + LOGIN_CODE_TTL_MS,
    now,
    code: '000000',
  });
  assert.equal(verdict.ok, false);
  if (!verdict.ok) {
    assert.equal(verdict.reason, 'attempts');
    assert.equal(verdict.scramble, true);
    assert.equal(verdict.attempts, LOGIN_CODE_MAX_ATTEMPTS);
  }
});

test('a resend waits out the remaining cooldown', () => {
  assert.equal(resendWaitSeconds(now - 15_000, now), 45);
  assert.equal(resendWaitSeconds(now - 60_000, now), 0);
});
