// Unit tests for the deterministic part of the router - no network, no
// DB, no OpenAI key needed, so these run instantly as part of the live
// demo (npm test) even if the internet or an API key isn't available.
const test = require('node:test');
const assert = require('node:assert');
const { classifyByKeywords } = require('../src/agents/router');

test('classifies a stock question as inventory', () => {
  assert.strictEqual(classifyByKeywords('What products are low on stock?'), 'inventory');
});

test('classifies a discount question as pricing', () => {
  assert.strictEqual(classifyByKeywords('Should we run a discount on office chairs?'), 'pricing');
});

test('classifies a mixed question as both', () => {
  assert.strictEqual(
    classifyByKeywords('Our inventory is overstocked, should we run a promotion?'),
    'both'
  );
});

test('returns null when neither keyword set matches, so the LLM decides', () => {
  assert.strictEqual(classifyByKeywords('How is the weather today?'), null);
});
