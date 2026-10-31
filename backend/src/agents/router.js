// Decides which specialized agent(s) should handle an incoming question.
//
// Two layers, cheapest first: a deterministic keyword check (pure function,
// no network call, trivial to unit test) catches the obvious cases; an LLM
// classifier with a constrained (enum) output handles anything ambiguous.
const { ChatOpenAI } = require('@langchain/openai');
const { z } = require('zod');

const ROUTES = ['inventory', 'pricing', 'both'];

// Pure function - no I/O - so it's trivial to unit test (see test/router.test.js).
function classifyByKeywords(question) {
  const q = question.toLowerCase();
  const pricingWords = ['price', 'pricing', 'cost', 'discount', 'markdown', 'promo', 'promotion', 'sale'];
  const inventoryWords = ['stock', 'inventory', 'quantity', 'qty', 'reorder', 'units'];

  const hasPricing = pricingWords.some((w) => q.includes(w));
  const hasInventory = inventoryWords.some((w) => q.includes(w));

  if (hasPricing && hasInventory) return 'both';
  if (hasPricing) return 'pricing';
  if (hasInventory) return 'inventory';
  return null; // not confident - let the LLM decide
}

// The function agent.js actually calls. Tries the free keyword check
// first; only pays for an LLM call when the keywords couldn't decide.
async function classifyQuestion(question) {
  const keywordGuess = classifyByKeywords(question);
  if (keywordGuess) return keywordGuess;

  // withStructuredOutput forces the model's reply into our zod schema, so
  // result.route can only ever be one of the three strings in ROUTES -
  // it can't come back as some other word or a sentence.
  const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
  const structured = llm.withStructuredOutput(z.object({ route: z.enum(ROUTES) }), {
    name: 'classify_route',
  });
  const result = await structured.invoke(
    `Classify this inventory-system question as "inventory" (stock levels/counts), ` +
      `"pricing" (discounts/markdowns/promotions), or "both": "${question}"`
  );
  return result.route;
}

module.exports = { classifyQuestion, classifyByKeywords, ROUTES };
