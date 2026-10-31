// Unit tests for the token-usage accumulator used to instrument every
// agent call. Calls handleLLMEnd directly with mock LangChain output
// objects, so it doesn't need a real LLM call to verify the math.
const test = require('node:test');
const assert = require('node:assert');
const { createUsageTracker } = require('../src/agents/usageTracker');

test('sums token usage across multiple LLM calls', async () => {
  const tracker = createUsageTracker();
  await tracker.handleLLMEnd({
    llmOutput: { tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } },
  });
  await tracker.handleLLMEnd({
    llmOutput: { tokenUsage: { promptTokens: 80, completionTokens: 40, totalTokens: 120 } },
  });

  const usage = tracker.getUsage();
  assert.strictEqual(usage.promptTokens, 180);
  assert.strictEqual(usage.completionTokens, 90);
  assert.strictEqual(usage.totalTokens, 270);
  assert.strictEqual(usage.llmCalls, 2);
});

test('handles a call with no usage info gracefully', async () => {
  const tracker = createUsageTracker();
  await tracker.handleLLMEnd({ llmOutput: {} });
  const usage = tracker.getUsage();
  assert.strictEqual(usage.totalTokens, 0);
  assert.strictEqual(usage.llmCalls, 1);
});
