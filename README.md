# AI Real Estate Assistant

OpenClaw-based real estate assistant for MLS property search, market analytics,
semantic search, recommendations, and RAG knowledge Q&A.

## Current Status

- Property search with multi-turn follow-up questions.
- Market statistics from `california_sold`.
- Semantic listing search over active `rets_property` listings.
- Similar-listing recommendations with comp price checks.
- Week 8 RAG knowledge assistant over Markdown files in `knowledge/`.

## Setup

1. Copy `.env.example` to `.env` and fill in local secrets.
2. Start the local MySQL container:

```bash
docker start rets-mysql
```

3. Install dependencies if needed:

```bash
npm install
```

Secrets, SQL dumps, and `.env` are not committed.

## Indexing

Semantic listing search needs listing embeddings:

```bash
npm run embeddings:index
```

Week 8 RAG needs knowledge chunks indexed:

```bash
npm run rag:index
```

Both commands send local text to the configured embedding provider, such as
Voyage or OpenAI.

## Demos

```bash
npm run demo:chat
npm run demo:market -- "market stats for Irvine over 12 months"
npm run demo:semantic -- "charming craftsman with mountain views"
npm run demo:recommendations -- 1118398412
npm run demo:rag -- "What does DOM mean?"
```

Useful Week 8 RAG questions:

- `What does DOM mean?`
- `What columns are in california_sold?`
- `What is a list-to-close ratio?`

## Checks

```bash
npm run typecheck
npm test
```

Database integration tests require MySQL on `localhost:3306`:

```bash
RUN_DB_TESTS=1 npm test
```

## Next

Week 9 will add a single orchestrator that routes mixed user requests across
the specialized agents.
