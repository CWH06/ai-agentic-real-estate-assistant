import "dotenv/config";

import {
  createMetaWhatsAppProcessor,
  DEFAULT_META_GRAPH_API_VERSION,
} from "../src/channels/metaWhatsApp";
import { createMetaWhatsAppWebhookServer } from "../src/server/metaWhatsAppWebhook";

const port = parsePort(process.env.META_WHATSAPP_PORT ?? "3001");
const apiConfig = {
  accessToken: requireEnvironmentVariable("META_WHATSAPP_ACCESS_TOKEN"),
  phoneNumberId: requireEnvironmentVariable("META_WHATSAPP_PHONE_NUMBER_ID"),
  graphApiVersion: process.env.META_GRAPH_API_VERSION
    ?? DEFAULT_META_GRAPH_API_VERSION,
};
const processPayload = createMetaWhatsAppProcessor(apiConfig);
const server = createMetaWhatsAppWebhookServer({
  appSecret: requireEnvironmentVariable("META_WHATSAPP_APP_SECRET"),
  processPayload,
  verifyToken: requireEnvironmentVariable("META_WHATSAPP_VERIFY_TOKEN"),
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Meta WhatsApp webhook listening on http://127.0.0.1:${port}`);
});

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePort(value: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error("META_WHATSAPP_PORT must be an integer between 1 and 65535.");
  }

  return parsed;
}
