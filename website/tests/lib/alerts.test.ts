import { test } from 'vitest';
import assert from 'node:assert/strict';
import { credentialAlerts, alertSentence, gateFor, CREDENTIAL_LABELS } from '@/lib/alerts';
import type { CredentialRecord } from '@/lib/fixtures';

const credentials = (overrides: Partial<CredentialRecord>): Partial<CredentialRecord> => ({
  gmc: { status: 'valid', daysRemaining: 250 },
  dbs: { status: 'valid', daysRemaining: 200 },
  indemnity: { status: 'valid', daysRemaining: 180 },
  ...overrides,
});

test('a fully valid record raises no alert', () => {
  assert.deepEqual(credentialAlerts(credentials({})), []);
});

// Indemnity is the only one whose lapse is unlawful to work through, so an
// expiring indemnity must outrank an expiring anything else.
test('expiring indemnity blocks while another expiring credential only nags', () => {
  const alerts = credentialAlerts(credentials({
    indemnity: { status: 'expiring', daysRemaining: 9 },
    dbs: { status: 'expiring', daysRemaining: 12 },
  }));
  assert.deepEqual(alerts.map((a) => [a.key, a.tone]), [['indemnity', 'blocking'], ['dbs', 'act']]);
});

test('an expired credential of any kind blocks', () => {
  const [alert] = credentialAlerts(credentials({ dbs: { status: 'expired', daysRemaining: 0 } }));
  assert.equal(alert.tone, 'blocking');
});

test('a valid credential inside the warning window is still worth saying', () => {
  const [alert] = credentialAlerts(credentials({ gmc: { status: 'valid', daysRemaining: 20 } }));
  assert.equal(alert.tone, 'watch');
  assert.equal(alert.key, 'gmc');
});

test('a credential with no expiry never warns on days', () => {
  assert.deepEqual(credentialAlerts({ cct: { status: 'valid', daysRemaining: null } }), []);
});

test('alerts of equal weight sort by how soon they bite', () => {
  const alerts = credentialAlerts(credentials({
    gmc: { status: 'valid', daysRemaining: 25 },
    dbs: { status: 'valid', daysRemaining: 5 },
  }));
  assert.deepEqual(alerts.map((a) => a.key), ['dbs', 'gmc']);
});

test('alert sentences read as English, and singular days stay singular', () => {
  assert.equal(alertSentence({ label: 'DBS check', status: 'expiring', daysRemaining: 1 }),
    'DBS check expires in 1 day.');
  assert.equal(alertSentence({ label: 'Indemnity cover', status: 'expired' }),
    'Indemnity cover has expired.');
  assert.equal(alertSentence({ label: 'DBS check', status: 'pending' }),
    'DBS check is still being verified.');
});

test('a rejected credential blocks and says so', () => {
  const [alert] = credentialAlerts(credentials({ dbs: { status: 'rejected', daysRemaining: null } }));
  assert.equal(alert.tone, 'blocking');
  assert.equal(alertSentence(alert), 'DBS check could not be verified.');
});

import { GATE_RECORDS, MY_RECORD, GPS } from '@/lib/fixtures';

test('the shipped record raises no gate — its indemnity is expiring, not expired', () => {
  assert.equal(gateFor(MY_RECORD), null);
  assert.equal(gateFor(GPS[0].credentials), null);
});

test('each gate record derives its own gate, in priority order', () => {
  assert.equal(gateFor(GATE_RECORDS['indemnity-expired']), 'indemnity-expired');
  assert.equal(gateFor(GATE_RECORDS['verification-rejected']), 'verification-rejected');
  assert.equal(gateFor(GATE_RECORDS['verification-pending']), 'verification-pending');
  assert.equal(gateFor(GATE_RECORDS['revalidation-due']), 'revalidation-due');
});

test('expired indemnity outranks a pending check on the same record', () => {
  const record = { ...GATE_RECORDS['verification-pending'], indemnity: { status: 'expired' as const, daysRemaining: 0 } };
  assert.equal(gateFor(record), 'indemnity-expired');
});

test('every credential key has a label', () => {
  assert.deepEqual(Object.keys(CREDENTIAL_LABELS), ['gmc', 'licence', 'cct', 'dbs', 'rightToWork', 'indemnity', 'revalidation']);
});
