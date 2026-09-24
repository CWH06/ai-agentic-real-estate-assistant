# AI Agentic Real Estate Assistant

A TypeScript assistant that connects conversational property search, market
analytics, semantic discovery, comparable-listing recommendations, source-cited
knowledge answers, and approval-gated email reports. Run it in a terminal or
through the Meta WhatsApp Cloud API.

The live database snapshot used in development contains **53K+ listing records
and 87K+ sold transactions**. These are imported records, not a real-time MLS
feed; active search additionally filters listing status. Private datasets and
credentials are not distributed with this repository.

## Try the demo — no credentials needed

Requires **Node.js 24+** and npm. From a fresh clone:

```bash
npm ci
npm run demo:script   # reproducible walkthrough, then exit
npm run demo          # interactive sample conversation
```

Sample mode uses fictional listings and market statistics, illustrative feature
vectors, excerpts from `knowledge/`, and simulated email delivery. It exercises
the shared router, search conversation, ranking/formatting and approval workflow;
it does **not** demonstrate real embedding/LLM quality or external delivery.
No MySQL, `.env`, API keys, WhatsApp account or email account is needed.

Try these prompts:

```text
Find 3 bedroom houses in Irvine under $2m
Market stats for Irvine over 6 months
Semantic search: a home with a pool and mountain views
Similar to 900001
What does DOM mean?
Find 3 bedroom houses in Pasadena under $2m and show market trends
Draft a weekly market report for Irvine to demo@example.com
CONFIRM EMAIL
```

`900001` is a sample ID. In live mode, use an ID returned by your own search.
Type `help`, `reset`, or `exit` in the CLI.

## Live mode

1. Create a private `.env` using [.env.example](.env.example) as a template.
   Do not overwrite an existing configuration or commit credentials.
2. Connect an authorized MySQL database with `rets_property` and
   `california_sold`; the repository does not include the proprietary SQL dump.
3. Configure Voyage or OpenAI embeddings and DeepSeek or OpenAI answer generation.
   Index with the same embedding model you query. Indexing writes to MySQL and
   calls the embedding provider, potentially incurring charges:

   ```bash
   npm run embeddings:index
   npm run rag:index
   ```

4. Check dependencies, then start the live conversation:

   ```bash
   npm run demo:check
   npm run demo:live
   ```

Live mode uses real data and provider APIs; **email remains dry-run in this CLI**.
For real, explicitly approved email delivery use `npm run demo:email` or WhatsApp
after configuring SMTP. Neither creates a scheduled email job. Gmail requires an
app password, not your normal account password.

For HTTPS, Meta webhook verification/subscriptions, systemd and service checks,
see [Deployment](docs/deployment.md). The direct Meta path does not need Twilio
or the legacy OpenClaw bridge to be running.

## How it fits together

```text
CLI / Meta WhatsApp HTTPS webhook
                 │
          shared orchestrator
                 ├─ property search → filters + per-user follow-ups → MySQL
                 ├─ market analytics → sold aggregates + monthly trends
                 ├─ semantic search → embeddings + cosine ranking
                 ├─ recommendations → structured + vector scores + sold comps
                 ├─ knowledge → retrieval + context-grounded answer + sources
                 └─ email → preview → same-user approval → SMTP
```

Routing is rule-based, with parallel property/market execution for mixed queries.
LLMs generate knowledge answers; they do not autonomously issue SQL or approve
emails. The sample and live CLI use the same orchestrator as WhatsApp.

## Validation and demo guide

```bash
npm run check         # TypeScript + automated tests
npm run demo:script   # safe sample smoke test
```

GitHub Actions runs these checks on `main`, `demo-ready` and pull requests.
Default tests use mocks/local HTTP servers; database integration tests are
opt-in (`RUN_DB_TESTS=1`) and require a separate test database. Some integration
tests write isolated test index entries. Passing unit tests is not a claim of
live delivery, retrieval accuracy or production uptime.

- [Demo walkthrough and troubleshooting](docs/demo.md)
- [Architecture and limitations](docs/architecture.md)
- [Deployment runbook](docs/deployment.md)

## Boundaries

- English text queries are the supported demo path; audio is not transcribed.
- Search sessions, email approvals and webhook deduplication are in memory;
  restart clears them. The webhook acknowledges before processing, without a
  durable queue or cross-restart retry guarantee.
- Semantic retrieval ranks a bounded candidate pool in application memory;
  it is not a dedicated approximate-nearest-neighbor vector database.
- A source citation does not establish answer accuracy. Real estate material is
  educational, not an appraisal or legal/financial advice.
- Legacy OpenClaw/Twilio-style scripts remain for earlier integrations. The
  unsigned legacy webhook is local-only and must not be exposed publicly.

This consolidated version retains the earlier weekly branch history. New demo
work belongs on `main`; older branches are historical checkpoints.
