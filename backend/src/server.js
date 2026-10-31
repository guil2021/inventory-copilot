// The app's entry point: wires up middleware and mounts each route file
// under its URL prefix, then starts listening.
const express = require('express');
const cors = require('cors');
require('dotenv').config(); // loads .env into process.env before anything below reads it

const productsRouter = require('./routes/products');
const alertsRouter = require('./routes/alerts');
const agentRouter = require('./routes/agent');

const app = express();
app.use(cors()); // lets the frontend (a different origin) call this API
app.use(express.json()); // parses JSON request bodies into req.body

// Simple route with no router file of its own - just confirms the server
// is up, used by Docker Compose and by us to sanity-check things quickly.
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Every request to /api/products/* is handled by products.js, and so on -
// this is what "mounting a router" means.
app.use('/api/products', productsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/agent', agentRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Inventory Copilot backend listening on port ${PORT}`));
