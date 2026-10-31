// Pricing Agent: the second specialized agent. Where the Inventory Agent
// reports numbers, this one reasons about what to DO about them from a
// commerce angle - markdowns to move slow stock, or how urgently to
// reorder.
const { ChatOpenAI } = require('@langchain/openai');
const { tool } = require('@langchain/core/tools');
const { AgentExecutor, createToolCallingAgent } = require('langchain/agents');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { z } = require('zod');
const pool = require('../db');

// Tool #1: takes a product name, decides if it's overstocked, and
// recommends a markdown or not. This is reasoning layered on top of a
// query, not just reporting a number back.
const suggestMarkdown = tool(
  async ({ name }) => {
    const [rows] = await pool.query('SELECT * FROM products WHERE name LIKE ?', [`%${name}%`]);
    if (rows.length === 0) return `No product found matching "${name}"`;

    const p = rows[0];
    // Simple overstock heuristic: more than 3x the reorder threshold sitting
    // in stock suggests it isn't moving and is worth discounting.
    const overstocked = p.qty > p.reorder_threshold * 3;
    const suggestion = overstocked
      ? `Overstocked (${p.qty} units vs. a reorder point of ${p.reorder_threshold}). Suggest a 15% markdown to move inventory.`
      : `Stock level is healthy (${p.qty} units vs. a reorder point of ${p.reorder_threshold}). No markdown needed.`;
    return JSON.stringify({ product: p.name, qty: p.qty, price: p.price, suggestion });
  },
  {
    name: 'suggest_markdown',
    description:
      'Suggests whether a product should be discounted, based on how overstocked it is relative to its reorder threshold.',
    schema: z.object({ name: z.string().describe('product name or partial name') }),
  }
);

// Tool #2: no input needed - pulls every low-stock product and ranks them
// by urgency (how far below threshold), most urgent first.
const suggestReorderPriority = tool(
  async () => {
    const [rows] = await pool.query(
      'SELECT name, qty, reorder_threshold FROM products WHERE qty <= reorder_threshold'
    );
    // Rank by how far below threshold they are - most urgent first.
    const ranked = rows
      .map((p) => ({ ...p, urgency: p.reorder_threshold - p.qty }))
      .sort((a, b) => b.urgency - a.urgency);
    return JSON.stringify(ranked);
  },
  {
    name: 'suggest_reorder_priority',
    description: 'Returns low-stock products ranked by how urgently they need reordering.',
    schema: z.object({}),
  }
);

// Same build-and-run shape as runInventoryAgent - only the tools and the
// system instruction change between the two agents.
async function runPricingAgent(question, callbacks = []) {
  const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
  const tools = [suggestMarkdown, suggestReorderPriority];

  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'You are the Pricing Agent. You can report a product\'s current price (your suggest_markdown tool returns it) as well as give commerce-minded recommendations (markdowns, reorder priority) using your tools. If asked a plain price question, just state the price plainly. Be concise.',
    ],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  const agent = createToolCallingAgent({ llm, tools, prompt });
  const executor = new AgentExecutor({ agent, tools });
  const result = await executor.invoke({ input: question }, { callbacks });
  return result.output;
}

module.exports = { runPricingAgent };
