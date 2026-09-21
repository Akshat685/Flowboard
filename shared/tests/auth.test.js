import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credentials } from '../schemas/auth.js';
test('shared password validation preserves Node UTF-8 byte limits in browser-safe code', () => {
  for (const password of [
    'a'.repeat(7),
    'a'.repeat(8),
    'a'.repeat(72),
    'a'.repeat(73),
    '🧩'.repeat(18),
    '🧩'.repeat(19),
    'é'.repeat(36),
    'é'.repeat(37),
    'abcde\ud800'.repeat(9),
    'abcde\ud800'.repeat(10),
  ]) {
    const expected =
      password.length >= 8 && password.length <= 72 && Buffer.byteLength(password, 'utf8') <= 72;
    assert.equal(
      credentials.safeParse({ email: 'person@example.com', password }).success,
      expected,
    );
  }
});
