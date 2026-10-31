// Orchestrator: splits the work across two specialized agents instead of
// one do-everything agent. A question is classified (router.js) and sent
// to the Inventory Agent, the Pricing Agent, or both in parallel; the
// whole call is instrumented for latency and token usage so the demo UI
// can show real numbers, not just an answer.
const { classifyQuestion } = require('./agents/router');
const { runInventoryAgent } = require('./agents/inventoryAgent');
const { runPricingAgent } = require('./agents/pricingAgent');
const { createUsageTracker } = require('./agents/usageTracker');

// The single entry point the /api/agent/ask route calls. Does four things,
// in order: start the clock, ask the router which agent(s) to use, run
// them, then package the answer together with the instrumentation.
async function askAgent(question) {
  // Start the latency clock and set up one usage tracker shared by whichever
  // agent(s) run below, so token counts add up across all of them.
  const started = Date.now();
  const usage = createUsageTracker();
  const callbacks = [usage];

  // Ask the router which agent(s) should handle this question.
  const route = await classifyQuestion(question);

  let answer;
  let agentsUsed;

  // Dispatch to the right agent(s). "both" runs them at the same time
  // (Promise.all) instead of one after another, so it isn't twice as slow.
  if (route === 'both') {
    const [invAnswer, priceAnswer] = await Promise.all([
      runInventoryAgent(question, callbacks),
      runPricingAgent(question, callbacks),
    ]);
    answer = `${invAnswer}\n\n${priceAnswer}`;
    agentsUsed = ['inventory', 'pricing'];
  } else if (route === 'pricing') {
    answer = await runPricingAgent(question, callbacks);
    agentsUsed = ['pricing'];
  } else {
    answer = await runInventoryAgent(question, callbacks);
    agentsUsed = ['inventory'];
  }

  // Package the answer with the instrumentation the demo needs to show.
  return {
    answer,
    agentsUsed,
    latencyMs: Date.now() - started,
    tokenUsage: usage.getUsage(),
  };
}

module.exports = { askAgent };
