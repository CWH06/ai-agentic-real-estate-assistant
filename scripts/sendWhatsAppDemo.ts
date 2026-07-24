import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { onWhatsAppMessage } from "../src/channels/whatsappHandler";
import { closePool } from "../src/db/mysql";
import { clearSession } from "../src/skills/property-search/session";

const execFileAsync = promisify(execFile);
const target = process.env.WHATSAPP_TARGET;
const account = process.env.OPENCLAW_ACCOUNT;
const userId = target ? `whatsapp:${target}` : "whatsapp-send-demo";

const messages = ["Find homes in Irvine", "under 2000000", "3 bedrooms"];

if (!target) {
  console.error("Missing WHATSAPP_TARGET in .env. Example: WHATSAPP_TARGET=+15551234567");
  process.exit(1);
}

async function sendWhatsApp(text: string): Promise<void> {
  const args = ["openclaw", "message", "send", "--channel", "whatsapp", "--target", target!, "--message", text];

  if (account) {
    args.push("--account", account);
  }

  await execFileAsync("npx", args, { maxBuffer: 1024 * 1024 * 5 });
}

async function main(): Promise<void> {
  clearSession(userId);

  for (const text of messages) {
    console.log(`User: ${text}`);
    const reply = await onWhatsAppMessage({ userId, text });
    console.log(`Sending: ${reply.text}`);
    await sendWhatsApp(reply.text);
    console.log("---");
  }

  await closePool();
}

main().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
