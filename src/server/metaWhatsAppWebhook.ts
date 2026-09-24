import { createHmac, timingSafeEqual } from "node:crypto";
import http, { type IncomingMessage, type ServerResponse } from "node:http";

import type { MetaWhatsAppProcessor } from "../channels/metaWhatsApp";

const DEFAULT_WEBHOOK_PATH = "/meta-whatsapp";
const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

interface WebhookLogger {
  error(message: string, error?: unknown): void;
}

export interface MetaWhatsAppWebhookServerOptions {
  appSecret: string;
  processPayload: MetaWhatsAppProcessor;
  verifyToken: string;
  logger?: WebhookLogger;
  webhookPath?: string;
}

export function createMetaWhatsAppWebhookServer(
  options: MetaWhatsAppWebhookServerOptions,
) {
  const logger = options.logger ?? console;
  const webhookPath = options.webhookPath ?? DEFAULT_WEBHOOK_PATH;

  return http.createServer((req, res) => {
    void handleRequest(req, res, {
      ...options,
      logger,
      webhookPath,
    }).catch((error) => {
      logger.error("Meta WhatsApp webhook request failed.", error);

      if (!res.headersSent) {
        writeTextResponse(res, 500, "internal server error");
      } else if (!res.writableEnded) {
        res.end();
      }
    });
  });
}

export function verifyMetaWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=") || !appSecret) {
    return false;
  }

  const suppliedHex = signatureHeader.slice("sha256=".length);

  if (!/^[a-f\d]{64}$/i.test(suppliedHex)) {
    return false;
  }

  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const supplied = Buffer.from(suppliedHex, "hex");

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: Required<
    Pick<MetaWhatsAppWebhookServerOptions, "appSecret" | "processPayload" | "verifyToken" | "webhookPath">
  > & { logger: WebhookLogger },
): Promise<void> {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    writeTextResponse(res, 200, "ok");
    return;
  }

  if (requestUrl.pathname !== options.webhookPath) {
    writeTextResponse(res, 404, "not found");
    return;
  }

  if (req.method === "GET") {
    handleVerificationRequest(requestUrl, res, options.verifyToken);
    return;
  }

  if (req.method !== "POST") {
    writeTextResponse(res, 405, "method not allowed");
    return;
  }

  const rawBody = await readRequestBody(req);
  const signatureHeader = getSingleHeader(req, "x-hub-signature-256");

  if (!verifyMetaWebhookSignature(rawBody, signatureHeader, options.appSecret)) {
    writeTextResponse(res, 401, "invalid signature");
    return;
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    writeTextResponse(res, 400, "invalid json");
    return;
  }

  writeTextResponse(res, 200, "EVENT_RECEIVED");

  setImmediate(() => {
    void options.processPayload(payload).catch((error) => {
      options.logger.error("Meta WhatsApp message processing failed.", error);
    });
  });
}

function handleVerificationRequest(
  requestUrl: URL,
  res: ServerResponse,
  verifyToken: string,
): void {
  const mode = requestUrl.searchParams.get("hub.mode");
  const suppliedToken = requestUrl.searchParams.get("hub.verify_token");
  const challenge = requestUrl.searchParams.get("hub.challenge");

  if (
    mode === "subscribe"
    && suppliedToken !== null
    && challenge !== null
    && safeEqual(suppliedToken, verifyToken)
  ) {
    writeTextResponse(res, 200, challenge);
    return;
  }

  writeTextResponse(res, 403, "verification failed");
}

async function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > MAX_WEBHOOK_BODY_BYTES) {
      throw new Error("Meta WhatsApp webhook body exceeds the size limit.");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function getSingleHeader(
  req: IncomingMessage,
  headerName: string,
): string | undefined {
  const value = req.headers[headerName];
  return Array.isArray(value) ? value[0] : value;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer);
}

function writeTextResponse(
  res: ServerResponse,
  statusCode: number,
  body: string,
): void {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end(body);
}
