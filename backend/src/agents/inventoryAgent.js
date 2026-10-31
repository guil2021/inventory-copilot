// Inventory Agent: one of two specialized agents the router can dispatch
// to. Answers stock-level questions using real SQL-backed tools - no
// guessing, no embeddings, just calling a function that runs a query.
// See pricingAgent.js for the other agent, and agent.js for how a question
// gets routed to one or both of them.
const { ChatOpenAI } = require('@langchain/openai');
const { tool } = require('@langchain/core/tools');
const { AgentExecutor, createToolCallingAgent } = require('langchain/agents');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { z } = require('zod');
const pool = require('../db');

// Tool #1: no input needed - just returns every product at/below its
// reorder threshold. The agent calls this when asked what's running low.
const getLowStockProducts = tool(
  async () => {
    const [rows] = await pool.query(
      'SELECT name, qty, reorder_threshold, category FROM products WHERE qty <= reorder_threshold'
    );
    return JSON.stringify(rows);
  },
  {
    name: 'get_low_stock_products',
    description: 'Returns every product whose quantity is at or below its reorder threshold.',
    schema: z.object({}),
  }
);

// Tool #2: takes a product name and looks it up with a LIKE match, so
// "chair" still finds "Office Chair". The agent calls this for
// questions about one specific product.
const getProductByName = tool(
  async ({ name }) => {
    const [rows] = await pool.query('SELECT * FROM products WHERE name LIKE ?', [`%${name}%`]);
    return rows.length ? JSON.stringify(rows) : `No product found matching "${name}"`;
  },
  {
    name: 'get_product_by_name',
    description: 'Look up one or more products by a (partial) name match.',
    schema: z.object({ name: z.string().describe('product name or partial name to search for') }),
  }
);

// Tool #3: no input needed - rolls up the whole products table into three
// numbers. The agent calls this for "overall" questions like total value.
const getInventorySummary = tool(
  async () => {
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS totalProducts, SUM(qty) AS totalUnits, SUM(qty * price) AS totalValue FROM products'
    );
    return JSON.stringify(rows[0]);
  },
  {
    name: 'get_inventory_summary',
    description: 'Returns overall inventory stats: total products, total units in stock, and total dollar value.',
    schema: z.object({}),
  }
);

// Builds and runs the Inventory Agent fresh on every call (cheap - it's
// just wiring, not a network call). Called by the orchestrator in agent.js.
async function runInventoryAgent(question, callbacks = []) {
  // The model that does the "thinking": which tool to call, and how to
  // phrase the final answer from what the tool returns.
  const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
  const tools = [getLowStockProducts, getProductByName, getInventorySummary];

  // The prompt template: a fixed system instruction, the user's question,
  // and a placeholder LangChain fills in with the tool-calling steps.
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'You are the Inventory Agent. Answer stock-level questions using real data from your tools. Be concise.',
    ],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  // createToolCallingAgent wires the llm+tools+prompt together; AgentExecutor
  // is what actually runs the loop (call LLM -> maybe call a tool -> repeat).
  const agent = createToolCallingAgent({ llm, tools, prompt });
  const executor = new AgentExecutor({ agent, tools });
  // callbacks here is how the usage tracker (agent.js) hears about every
  // LLM call this executor makes, even if it calls the model more than once.
  const result = await executor.invoke({ input: question }, { callbacks });
  return result.output;
}

module.exports = { runInventoryAgent };
