import test from 'node:test';
import assert from 'node:assert/strict';
import { explorePolicies, buildPolicies, SAMPLE_TREES } from '../src/catalan/policy-explorer.js';

function deterministicPolicies() {
  const policies = buildPolicies();
  return policies.filter(p => ['heavier', 'lighter', 'left'].includes(p.name));
}

test('policy explorer produces entries for every sample/policy pair', () => {
  const policies = deterministicPolicies();
  const rows = explorePolicies(SAMPLE_TREES, policies);
  const expectedRows = Object.keys(SAMPLE_TREES).length * policies.length;
  assert.equal(rows.length, expectedRows);
  rows.forEach(row => {
    assert.ok(row.sample in SAMPLE_TREES);
    assert.ok(['heavier', 'lighter', 'left'].includes(row.policy));
    assert.ok(typeof row.input === 'string');
    assert.ok(typeof row.output === 'string');
  });
});
