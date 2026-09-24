# Architecture

## Entry points and routing

`scripts/demoAssistant.ts` and `src/channels/whatsappHandler.ts` call the shared
`src/orchestrator/index.ts`. The orchestrator classifies English text using
rules and delegates to separate capabilities; it is not an LLM planner.
Mixed property-search/market questions execute both skills concurrently.
`semantic search:` explicitly selects descriptive search; `help` lists examples.
The older `src/chat/router.ts` is retained for legacy integration compatibility.

`src/demo/sampleAgents.ts` injects fictional data and deterministic providers
into the same orchestrator, search conversation and email approval workflow.
Sample vectors are hand-built property features, not learned embeddings. Sample
knowledge answers are verbatim Markdown excerpts selected lexically, not LLM
output. The UI labels these substitutions. No network calls are needed.

## Data paths

- Structured property search parses filters, asks for missing fields, retains
  per-user context and executes parameterized, status-filtered MySQL queries.
- Market statistics aggregate `california_sold`. The median uses SQL window
  functions rather than a truncated sale list. Individual result sets are bounded.
- Semantic search embeds a description, loads a bounded candidate set from
  `listing_embeddings` and ranks by cosine similarity in Node.js.
- Recommendations combine a 60-point structured score with a 40-point vector
  score, then compare candidate prices with recent sold comparables. This is
  an explainable heuristic, not an appraisal or a trained recommendation model.

## Knowledge retrieval

Markdown in `knowledge/` is split by section into approximately 600-character
chunks with 100-character overlap. Hashes skip unchanged content on reindexing.
The embedding model is part of the `rag_chunks` primary key; retrieval uses the
configured model, cosine scores and a lexical boost for field identifiers.
The default result count is four chunks. If no context qualifies, no LLM call
is made and the skill returns insufficient-context / not-indexed feedback.

The answer provider is DeepSeek Chat or OpenAI Responses. The prompt treats
documents as reference data and asks for context-only answers and inline source
citations; source titles are also appended by code. This reduces unsupported
answers but is not a formal factuality or prompt-injection guarantee.

## Email side effects

One recipient + city → market report → escaped HTML/text preview → pending draft
→ exact same-user approval → lock → SMTP → sent/failed.

Drafts expire after 30 minutes; a new draft cancels the previous pending draft
for that user. Repeated/concurrent approval cannot reuse a locked draft. Failure
does not automatically retry. Address checks enforce a single syntactically
acceptable recipient, not mailbox existence or ownership. The model cannot add
attachments or approve delivery. The sample and live demo CLI intercept sending;
the dedicated email CLI and WhatsApp use actual SMTP after approval.

## WhatsApp transport and operational limits

Nginx terminates HTTPS and proxies `/meta-whatsapp` to a localhost-only Node
server. GET validates Meta's verification challenge; POST validates
`X-Hub-Signature-256` against the raw body using HMAC-SHA256 and timing-safe
comparison. Valid JSON is acknowledged immediately and processed asynchronously.
The channel extracts text messages, deduplicates recent IDs in memory and splits
long replies before outbound Meta API calls. Non-text messages are ignored.

systemd restarts the process, not in-flight work. There is no durable queue,
shared session store, persistent approval audit or exactly-once delivery across
restarts. The demo is single-process; horizontal scaling would require these
components. Public operation also needs rate limits, operational monitoring and
an appropriate recipient/access policy. Credentials never belong in git.
