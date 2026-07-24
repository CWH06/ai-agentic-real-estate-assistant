import { onWhatsAppMessage } from "../src/channels/whatsappHandler";
import { closePool } from "../src/db/mysql";
import { clearSession } from "../src/skills/property-search/session";

const userId = "demo-whatsapp-user";
const messages = [
  "Find homes in Irvine",
  "under 2000000",
  "3 bedrooms",
];

async function main() {
  clearSession(userId);

  for (const text of messages) {
    console.log(`User: ${text}`);
    const reply = await onWhatsAppMessage({ userId, text });
    console.log(`Agent: ${reply.text}`);
    console.log("---");
  }

  await closePool();
}

main().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
