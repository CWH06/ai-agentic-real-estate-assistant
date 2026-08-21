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

## Week 8: Retrieval-Augmented Generation (RAG)

Week 8 adds grounded knowledge questions over the Markdown files in `knowledge/`.
The pipeline:

1. reads the local knowledge documents;
2. splits them into approximately 600-character chunks with 100-character overlap;
3. embeds and stores changed chunks in the MySQL `rag_chunks` table;
4. embeds a question and retrieves the top four chunks by cosine similarity;
5. sends only those chunks to the configured DeepSeek or OpenAI answer provider;
6. returns a concise answer with source titles, or says the indexed context is insufficient.

First configure `.env`. The embedding index can use Voyage or OpenAI through the existing `EMBEDDING_PROVIDER` setting. Answer generation is independent: set `LLM_PROVIDER=deepseek` with `DEEPSEEK_API_KEY`, or set `LLM_PROVIDER=openai` with `OPENAI_API_KEY`.

For Voyage embeddings with DeepSeek answers:

```env
EMBEDDING_PROVIDER=voyage
VOYAGE_API_KEY=your-voyage-key
VOYAGE_EMBEDDING_MODEL=voyage-4-lite

LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

Create or refresh the knowledge index:

```bash
npm run rag:index
```

Run one required handbook question:

```bash
npm run demo:rag -- "What does DOM mean?"
```

Or start the interactive RAG demo:

```bash
npm run demo:rag
```

Required Week 8 demonstration questions:

- `What does DOM mean?`
- `What columns are in california_sold?`
- `What is a list-to-close ratio?`

The main chat demo also recognizes these as `knowledge` intent questions:

```bash
npm run demo:chat
```

If the Markdown files change, run `npm run rag:index` again. Unchanged chunks are skipped; changed chunks are re-embedded and stale chunk positions are removed.
