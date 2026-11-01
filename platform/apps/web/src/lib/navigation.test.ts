import assert from 'node:assert/strict';
import test from 'node:test';
import { navigation } from './navigation.ts';

test('every destination has its own address', () => {
  const hrefs = navigation.map((item) => item.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.equal(hrefs[0], '/chats');
});
