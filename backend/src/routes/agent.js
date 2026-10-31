// POST /api/agent/ask - natural-language inventory questions, answered by
// the LangChain + OpenAI tool-calling agent in agent.js.
const express = require('express');
const router = express.Router();
const { askAgent } = require('../agent');

// The only route in this file. Validates the input, hands the real work
// off to askAgent() in agent.js, and turns a thrown error into a 500
// instead of crashing the server.
router.post('/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'question is required' });

  try {
    const result = await askAgent(question);
    res.json(result);
  } catch (err) {
    console.error('Agent error:', err.message);
    res.status(500).json({ error: 'Agent failed to answer: ' + err.message });
  }
});

module.exports = router;
