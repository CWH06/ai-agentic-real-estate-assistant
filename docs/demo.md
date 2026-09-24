# Demo walkthrough

## Three-minute sample demo

Run `npm ci` on Node 24+, then `npm run demo:script`. It covers:

1. `Find properties in Irvine` → follow-ups for budget, type and beds.
2. `Market stats for Irvine over 6 months` → labeled synthetic summary.
3. `Semantic search: a home with a pool and mountain views` → illustrative ranking.
4. `Similar to 900001` → structured/vector scores; sold-comp validation is not simulated.
5. `What does DOM mean?` → a real repository document excerpt and source title.
6. A combined property/market query → two response sections.
7. A report to `demo@example.com` → preview, simulated approval, repeat rejection.
8. An unrelated flight question → supported-scope fallback.

The sample has five fictional houses in Irvine and Pasadena, all with three
bedrooms. Try `npm run demo` to interact. These are not performance or quality
benchmarks for the live models. The synthetic market snapshot ends August 2026.

## Live demo checklist

- Use an authorized database snapshot and correctly configured `.env`.
- Run `npm run demo:check`; it checks provider configuration, SQL counts and
  model-specific index presence without rebuilding anything.
- Run `npm run demo:live`; verify one property, market, semantic and RAG query.
  Model requests may be billed. A passing preflight does not verify model tokens.
- Choose a recommendation seed from a real search result; do not use `900001`.
- An old dataset can have no sales in the last six months. Request a longer
  explicit window (up to 60 months); never present imported data as a live feed.
- `npm run demo:live` and its `demo:chat` alias never send email. Actual SMTP
  demonstration is separate: `npm run demo:email`, preview to your own address,
  then explicitly `CONFIRM EMAIL`. `CANCEL EMAIL` cancels instead.
- For WhatsApp, additionally run `npm run demo:check -- --meta` and follow
  [Deployment](deployment.md). This reads Meta phone metadata; it sends nothing.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Search asks more questions | Supply city, budget, type and beds; `reset` clears old filters. |
| Semantic search goes to ordinary search | Use the explicit `Semantic search:` prefix. |
| No semantic matches / not indexed | Check active indexed listings and embedding model in `demo:check`; reindex deliberately if needed. |
| Knowledge answer says unavailable | Check embedding and answer-provider keys, model, network and `rag_chunks`; they are separate dependencies. |
| Email shows dry run | Expected in both unified CLI modes; use the dedicated email CLI for real approved delivery. |
| Confirm says no pending draft | Same user/session required; drafts expire, are one-time and disappear after restart. |
| WhatsApp is silent | Check service health, Meta token/permissions, `messages` subscription and service logs; local health alone does not prove delivery. |

## Reproducibility

`npm run check` validates types and the default test suite. The sample regression
test rejects unexpected SQL, SMTP or HTTP calls and checks every demo route.
`RUN_DB_TESTS=1` enables integration tests; point `.env` at an isolated test
database because some tests write and remove model-specific fixture embeddings.

Private MLS dumps, `.env` and the internal internship handbook are intentionally
excluded. No credentials are required by CI or the sample demo.
