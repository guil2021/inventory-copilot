# Inventory Copilot

A full-stack retail inventory app with an AI agent on top. Built as a
portfolio/demo project that touches every layer of a modern agentic stack:
React, Node/Express, MySQL, Kafka, Docker, and a LangChain + OpenAI
tool-calling agent.

## What it does

- A product dashboard (React) lists inventory and highlights anything at or
  below its reorder threshold.
- Updating a product's quantity (simulating a sale or restock) hits the
  Express REST API, which updates MySQL.
- If the new quantity drops to/below the reorder threshold, the backend
  publishes a `low-stock-alerts` event to Kafka.
- A separate Kafka **consumer service** picks that event up and writes a row
  into the `alerts` table — independent of the API request/response cycle.
- A chat panel lets you ask natural-language questions. The work is **split
  across two specialized LangChain agents** behind a router, backed by
  OpenAI (`gpt-4o-mini`), and every answer is instrumented with **response
  time and token usage**, shown right in the UI.

## Why tool-calling instead of RAG

Our inventory lives in a few small, structured SQL tables — there's no
unstructured text to search. So each agent is given tools that run a real
SQL query, and the LLM decides which one to call and how to phrase the
answer. Classic embedding-based RAG would be the right choice if we were
answering questions over product manuals or support tickets, but for
structured data, function/tool calling is simpler, cheaper, and always
accurate.

## Multi-agent architecture

Instead of one do-everything agent, the work is split across two
specialized agents, with a lightweight router deciding who handles what —
the kind of separation real retail inventory/commerce/pricing systems use:

- **Inventory Agent** (`backend/src/agents/inventoryAgent.js`) — reports
  real numbers: low-stock products, a specific product's stock, overall
  inventory value. Tools: `get_low_stock_products`, `get_product_by_name`,
  `get_inventory_summary`.
- **Pricing Agent** (`backend/src/agents/pricingAgent.js`) — reasons about
  what to *do* about stock levels from a commerce angle: suggests markdowns
  on overstocked items, ranks low-stock items by reorder urgency. Tools:
  `suggest_markdown`, `suggest_reorder_priority`.
- **Router** (`backend/src/agents/router.js`) — classifies each question as
  `inventory`, `pricing`, or `both`. It tries a deterministic keyword match
  first (free, instant, and unit-tested — see Testing below); only
  ambiguous questions fall through to an LLM classifier with a constrained
  (enum) output, so it can never return anything outside those three
  routes.
- **Orchestrator** (`backend/src/agent.js`) — the entry point. Runs the
  router, dispatches to one or both agents (in parallel if both are
  needed), and wraps the whole call with the instrumentation below.

## Instrumentation: response time + token usage

Every `/api/agent/ask` call returns, alongside the answer:

```json
{
  "answer": "...",
  "agentsUsed": ["inventory"],
  "latencyMs": 842,
  "tokenUsage": { "promptTokens": 312, "completionTokens": 96, "totalTokens": 408, "llmCalls": 2 }
}
```

- **Latency** is just wall-clock time around the whole agent call
  (`Date.now()` before/after in `agent.js`).
- **Token usage** is captured by a small LangChain callback handler
  (`backend/src/agents/usageTracker.js`) that hooks `handleLLMEnd` on every
  underlying LLM call — a tool-calling agent can call the model more than
  once per question (once to pick a tool, again to write the final answer),
  so this sums across all of them, not just the last one.

The frontend chat panel shows this under each answer: which agent(s)
handled it, the latency, and the token breakdown — so it's visible live in
the demo, not buried in a log file.

## Testing

```bash
cd backend
npm install
npm test
```

This runs a `node:test` suite (`backend/test/`) covering the two pieces of
agent logic that are pure functions — no DB, no OpenAI key, no Docker
needed, so it runs instantly even offline:

- `router.test.js` — the keyword classifier correctly routes
  inventory/pricing/mixed questions, and correctly defers to the LLM
  (returns `null`) on anything it's not confident about.
- `usageTracker.test.js` — the token-usage accumulator sums correctly
  across multiple LLM calls, and doesn't blow up on a call with no usage
  data.

(The REST API itself was tested manually against a real MySQL instance
while building this — every route, status code, and validation path — see
the note under "Running it without Docker" below for exactly what that
covered.)

## Architecture

```
                         +------------------+
 React (Vite)  --------> |   Express API    | --------> MySQL (products, alerts)
                         +------------------+
                           |      |
                           |      +--> Kafka topic: low-stock-alerts
                           |                |
                           |                v
                           |        Kafka consumer service ---> MySQL (alerts)
                           v
                    Orchestrator (agent.js)
                           |
                      Router (keyword -> LLM fallback)
                       /                      \
            Inventory Agent              Pricing Agent
          (LangChain + tools)          (LangChain + tools)
                       \                      /
                        OpenAI (gpt-4o-mini)
                 [instrumented: latency + token usage]
```

## Project structure

```
inventory-copilot/
  db/init.sql           MySQL schema + seed data
  backend/               Express REST API + LangChain agent
  consumer/               Standalone Kafka consumer service
  frontend/               React (Vite) dashboard + chat UI
  docker-compose.yml       One-command local orchestration
```

## Running it locally with Docker Compose (recommended for the demo)

Requires Docker Desktop (or Docker Engine + Compose) running on your machine.

```bash
cd inventory-copilot
export OPENAI_API_KEY=sk-your-real-key
docker compose up --build
```

Then open:
- Frontend: http://localhost:5173
- Backend health check: http://localhost:4000/api/health

To trigger the full Kafka flow live: lower a product's qty below its reorder
threshold in the dashboard, then watch the alert show up in the Alerts panel
a few seconds later (that round trip is: API → Kafka → consumer → MySQL →
frontend poll).

## What's been verified end-to-end

This was built in a sandbox with no Docker daemon and no outbound network
access, so it was developed in two stages: first, as much as possible was
verified there directly (listed below); then the full stack was verified
for real with Docker Compose and a real OpenAI key, on the machine it'll
actually be demoed from. Both stages passed:

1. **MySQL + REST API**: in the sandbox, installed MariaDB, loaded
   `db/init.sql`, ran the Express server against it directly, and exercised
   every route (GET all, GET one, POST create, PUT update, DELETE, 404s,
   validation errors) with real `curl` requests — all passed with the
   correct data and status codes.
2. **Frontend**: in the sandbox, ran `npm run build` (clean Vite production
   build) and ran the dev server with its API proxy pointed at the live
   backend — confirmed the dashboard loads real product data through the
   proxy.
3. **Kafka producer/consumer, end-to-end**: confirmed for real with
   `docker compose up --build` — all five containers (mysql, kafka, backend,
   consumer, frontend) came up healthy, lowering a product's quantity on the
   dashboard published an event that the separate consumer container picked
   up, and the resulting alert appeared in the Low-Stock Alerts panel within
   a few seconds. (One real issue surfaced and was fixed here: the consumer
   can lose a startup race against Kafka finishing topic creation on first
   boot — `restart: on-failure` on the `backend`/`consumer` services in
   `docker-compose.yml` handles that automatically.)
4. **Router + agents + instrumentation**: `npm test` run for real — all 6
   tests pass (router keyword classification, token-usage accumulator
   math). The full agent → OpenAI path was also exercised live with a real
   `OPENAI_API_KEY` and a question aimed at each agent (and one mixed
   question that hit both at once) — confirmed real answers come back and
   the stats line (agent(s) used, latency, token counts) renders correctly
   for each case.


To run backend/frontend without Docker at all (e.g. no Docker on your
interview machine):

```bash
# Terminal 1 - MySQL (install locally, or keep using Docker just for this one)
mysql -u root -p < db/init.sql

# Terminal 2 - backend
cd backend
cp .env.example .env   # fill in DB + OpenAI values
npm install
npm start

# Terminal 3 - Kafka consumer (needs a real Kafka broker running)
cd consumer
cp ../backend/.env.example .env
npm install
npm start

# Terminal 4 - frontend
cd frontend
npm install
npm run dev
```

## Deploying to AWS (fastest realistic path for a demo environment)

The simplest path that still "counts" as AWS experience for the interview:

1. Launch one EC2 instance (Amazon Linux 2023, t3.medium is plenty), open
   inbound ports 5173 and 4000 in its security group.
2. Install Docker + Compose on it:
   ```bash
   sudo yum install -y docker
   sudo systemctl enable --now docker
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```
3. Copy the project to the instance (`scp` or `git clone` if you push it to
   a repo), set `OPENAI_API_KEY`, and run `docker compose up -d --build`.
4. Point your browser at `http://<ec2-public-ip>:5173`.

A more production-shaped version would put MySQL on RDS, Kafka
on MSK, the backend/frontend containers on ECS Fargate behind an ALB, and
secrets in Secrets Manager instead of a `.env` file.


