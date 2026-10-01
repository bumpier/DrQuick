import { test, expect } from 'vitest';
import { readToken, signToken } from '@/lib/signed-token';

const KEY = 'k'.repeat(40);

test('a signed token reads back as its payload', () => {
  const token = signToken({ gp: 'abc', exp: 5000 }, KEY);
  expect(readToken(token, KEY, 1000)).toEqual({ gp: 'abc', exp: 5000 });
});

test('a tampered payload, a tampered signature and garbage are all refused', () => {
  const token = signToken({ gp: 'abc', exp: 5000 }, KEY);
  const [payload, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ gp: 'someone-else', exp: 5000 })).toString('base64url');
  expect(readToken(`${forged}.${sig}`, KEY, 1000)).toBeNull();
  expect(readToken(`${payload}.${sig.slice(0, -2)}xx`, KEY, 1000)).toBeNull();
  expect(readToken('garbage', KEY, 1000)).toBeNull();
  expect(readToken(undefined, KEY, 1000)).toBeNull();
});

test('a token signed with another key is refused', () => {
  expect(readToken(signToken({ exp: 5000 }, KEY), 'j'.repeat(40), 1000)).toBeNull();
});

test('a token is refused at and after its expiry, and when it has none', () => {
  const token = signToken({ exp: 5000 }, KEY);
  expect(readToken(token, KEY, 4999)).not.toBeNull();
  expect(readToken(token, KEY, 5000)).toBeNull();
  expect(readToken(signToken({ gp: 'abc' }, KEY), KEY, 1000)).toBeNull();
});
