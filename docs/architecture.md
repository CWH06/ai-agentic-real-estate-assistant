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
