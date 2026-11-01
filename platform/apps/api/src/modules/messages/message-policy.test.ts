import assert from 'node:assert/strict';
import { test } from 'node:test';
import { directKey, isReplay } from './message-policy.ts';

test('a direct chat has one key no matter who starts it', () => {
  assert.equal(directKey('b', 'a'), directKey('a', 'b'));
});

test('a person cannot open a direct chat with themselves', () => {
  assert.throws(() => directKey('a', 'a'));
});

test('an existing client message id is a replay', () => {
  assert.equal(isReplay('message-1'), true);
  assert.equal(isReplay(null), false);
});
