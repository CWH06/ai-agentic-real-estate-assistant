# AI Real Estate Assistant

Internship project for building an OpenClaw based real estate assistant.

Current repo status:

- OpenClaw is installed as the runtime dependency
- local setup notes are in `docs/setup-notes.md`
- Week 1 architecture notes are in `docs/architecture.md`
- secrets go in `.env`, using `.env.example` as the template

The MLS SQL dumps and `.env` file are intentionally not committed.

Week 2 parser work lives in `src/skills/property-search`.

Run checks:

```bash
npm test
npm run typecheck
```

Week 3 database integration adds MySQL query helpers in `src/db`.

The local Docker database has `rets.rets_property` and `rets.california_sold` for active listings and sold comps.

Database checks:

```bash
npm test
npm run typecheck
RUN_DB_TESTS=1 npm test
```

`RUN_DB_TESTS=1` expects the Docker MySQL container to be reachable on `localhost:3306` with the `.env` settings.

Week 6 semantic search adds OpenAI embedding indexing and vector-style cosine search over active listings.

Semantic search setup:

```bash
npm run embeddings:index
npm run demo:semantic -- "charming craftsman with mountain views and character"
```

`npm run embeddings:index` expects either `VOYAGE_API_KEY` or `OPENAI_API_KEY` in `.env`. It writes listing vectors to the local MySQL `listing_embeddings` table.

Indexing sends listing text, including addresses and remarks, to the configured embedding provider.

Week 7 recommendations reuse the Week 6 embeddings to recommend similar active listings and validate each recommendation against recent sold comps.

Recommendation demo:

```bash
npm run demo:recommendations -- 1118422731
```

Interactive local chat demo:

```bash
npm run demo:chat
```

The same chat router is used by the WhatsApp adapter, so the CLI and WhatsApp route property search, market stats, semantic search, and recommendations consistently.

