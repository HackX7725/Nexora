import assert from 'node:assert/strict';
import test from 'node:test';
import { hasErrors, validateLogin, validateLoginCode, validateRegister } from './auth-rules.ts';

test('login accepts a username and a mixed password', () => {
  assert.equal(hasErrors(validateLogin('mira', 'secret12')), false);
});

test('login rejects a short password', () => {
  assert.equal(Boolean(validateLogin('mira', 'secret').password), true);
});

test('register requires a username and an email address', () => {
  const errors = validateRegister('Mira Chen', '', '', 'secret12', 'secret12');
  assert.equal(Boolean(errors.username), true);
  assert.equal(Boolean(errors.email), true);
});

test('register accepts a lowercase username and email', () => {
  assert.equal(hasErrors(validateRegister('mira_chen', 'mira@example.com', '', 'secret12', 'secret12')), false);
});

test('the login code is six digits', () => {
  assert.equal(validateLoginCode('123456'), undefined);
  assert.equal(Boolean(validateLoginCode('12345')), true);
});
