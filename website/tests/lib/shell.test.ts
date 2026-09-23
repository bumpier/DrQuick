import { test } from 'vitest';
import assert from 'node:assert/strict';
import { activeNav, areaOf } from '@/lib/shell';

test('a sub-screen keeps its parent nav item lit', () => {
  assert.equal(activeNav('consultation-detail', { 'consultation-detail': 'consultations' }), 'consultations');
  assert.equal(activeNav('account', {}), 'account');
});

test('a screen outside the dashboard set is a flow, and hides the product nav', () => {
  const dash = ['home', 'account'];
  assert.equal(areaOf('home', dash), 'dash');
  assert.equal(areaOf('symptoms', dash), 'flow');
});
