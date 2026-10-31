// Tracks LLM token usage across however many calls happen inside one
// agent invocation (a tool-calling agent can call the model more than once
// per question - once to decide which tool to use, again to write the
// final answer). Built as a LangChain callback handler so it plugs
// straight into any agent via { callbacks: [tracker] } on .invoke().
const { BaseCallbackHandler } = require('@langchain/core/callbacks/base');

// A LangChain callback handler. LangChain calls handleLLMEnd() on this
// automatically every time any LLM call it's attached to finishes - we
// never call it ourselves.
class UsageTrackerHandler extends BaseCallbackHandler {
  name = 'usage-tracker';

  // Start every counter at zero for a fresh question.
  constructor() {
    super();
    this.promptTokens = 0;
    this.completionTokens = 0;
    this.totalTokens = 0;
    this.llmCalls = 0;
  }

  // Fired by LangChain after each LLM call. Adds that call's token counts
  // onto the running totals (?. and || 0 guard against a response that
  // doesn't include usage data, so this never crashes).
  async handleLLMEnd(output) {
    const usage = output?.llmOutput?.tokenUsage;
    if (usage) {
      this.promptTokens += usage.promptTokens || 0;
      this.completionTokens += usage.completionTokens || 0;
      this.totalTokens += usage.totalTokens || 0;
    }
    this.llmCalls += 1;
  }

  // Reads out the running totals once the whole question is answered.
  getUsage() {
    return {
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens: this.totalTokens,
      llmCalls: this.llmCalls,
    };
  }
}

// Factory function: gives agent.js a brand-new tracker (all zeros) for
// every single question, so one question's usage never bleeds into another's.
function createUsageTracker() {
  return new UsageTrackerHandler();
}

module.exports = { createUsageTracker, UsageTrackerHandler };
