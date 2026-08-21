# Week 1 Architecture Notes

Basic flow:

```text
User message
  -> WhatsApp channel
  -> OpenClaw gateway/runtime
  -> skill selection
  -> tool call
  -> session memory update
  -> response back to WhatsApp
```

Main pieces:

- Channel: WhatsApp is the first chat interface.
- Runtime: OpenClaw receives messages and routes work.
- Skills: separate capabilities such as property search or market stats.
- Tools: functions the skills call, like parsing a query or running SQL.
- Memory/session: stores the user's current search context.
- Database layer: later weeks will query `rets_property` and `california_sold`.

For the real estate assistant, the first useful skill will be property search. It should turn a message like "3 bedroom condo in Irvine under 1.5M" into filters, then later pass those filters to a MySQL query.

# Week 8 RAG Architecture

The knowledge-question path is separate from listing search and market-statistics SQL:

```text
knowledge/*.md
    -> 600-character chunks with 100-character overlap
    -> configured embedding provider
    -> MySQL rag_chunks

user question
    -> knowledge intent
    -> query embedding
    -> cosine similarity, top 4 chunks
    -> configured DeepSeek Chat or OpenAI Responses provider
       with retrieved context only
    -> grounded answer plus source titles
```

The index stores the embedding model in its primary key so vectors produced by different models are never compared accidentally. Each chunk also stores a SHA-256 text hash; rerunning the index skips unchanged content and updates only changed chunks.

Retrieval applies a configurable minimum similarity. If no indexed chunk clears that threshold, the LLM is not called and the assistant reports insufficient context. The answer prompt treats retrieved documents as reference text rather than executable instructions and requires inline source citations.
