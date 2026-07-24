console.error([
  "This OpenClaw WhatsApp provider does not support `message read`, so polling is not available.",
  "Use `npm run demo:whatsapp:send` to verify project replies can be sent to WhatsApp.",
  "For automatic inbound WhatsApp replies, wire an OpenClaw plugin to the WhatsApp message_received hook."
].join("\n"));

process.exit(1);
