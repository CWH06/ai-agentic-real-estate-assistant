import "dotenv/config";
import { createWhatsAppWebhookServer } from "../src/server/whatsappWebhook";

const port = Number(process.env.PORT ?? 3000);
const server = createWhatsAppWebhookServer();

// Legacy local adapter has no provider signature validation. Never expose publicly.
server.listen(port, "127.0.0.1", () => {
  console.log(`Local-only legacy WhatsApp webhook listening on 127.0.0.1:${port}`);
});
