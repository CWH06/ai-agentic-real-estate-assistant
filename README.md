# AI Agentic Real Estate Assistant

AI Agentic Real Estate Assistant is an OpenClaw-based multi-agent assistant for
real estate search, market analysis, recommendations, and knowledge retrieval.
The project is built around real MLS-style datasets and is designed to show how
an agentic system can combine structured database queries, conversational memory,
vector search, recommendation logic, and retrieval-augmented generation in one
assistant experience.

The assistant can help users search active listings with natural language,
answer follow-up questions across a multi-turn conversation, summarize local
market trends from sold transaction data, find semantically similar properties,
recommend comparable active listings, and answer project or real-estate glossary
questions from an indexed knowledge base.

## Core Capabilities

- Natural language property search over active listings.
- Multi-turn conversation memory for missing search filters.
- Market statistics and trend summaries from sold comps.
- Semantic property search using listing description embeddings.
- Similar-listing recommendations with comp-based price checks.
- RAG knowledge assistant over MLS field definitions and real-estate notes.
- Shared chat routing for local CLI demos and WhatsApp-style message handling.

## Data Sources

The project uses two local MySQL tables:

- `rets_property` for active MLS listings, listing remarks, property facts,
  agent information, prices, locations, and photos.
- `california_sold` for sold transactions, comps, close prices, market timing,
  and historical pricing analysis.

Large SQL dumps, local database files, API keys, and `.env` secrets are not
committed to the repository.

## Tech Stack

- TypeScript and Node.js
- OpenClaw runtime
- MySQL with `mysql2`
- Vitest for tests
- Embeddings through Voyage or OpenAI
- RAG answer generation through DeepSeek or OpenAI

## Project Status

The project currently includes property search, database integration,
conversational follow-up handling, market statistics, semantic search,
recommendations, and Week 8 RAG knowledge retrieval. The next major step is a
single orchestrator that coordinates all specialized agents for mixed user
requests.
