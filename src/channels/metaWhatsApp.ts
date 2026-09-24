import { onWhatsAppMessage, type WhatsAppInboundMessage, type WhatsAppOutboundMessage } from "./whatsappHandler";

export const DEFAULT_META_GRAPH_API_VERSION = "v25.0";
export const META_WHATSAPP_TEXT_LIMIT = 4096;

export interface MetaWhatsAppApiConfig {
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion?: string;
}

export interface MetaWhatsAppInboundTextMessage {
  from: string;
  id: string;
  text: string;
}

export type MetaWhatsAppProcessor = (payload: unknown) => Promise<void>;

type WhatsAppHandler = (
  inbound: WhatsAppInboundMessage,
) => Promise<WhatsAppOutboundMessage>;

type MetaTextSender = (to: string, text: string) => Promise<void>;

export interface MetaWhatsAppProcessorDependencies {
  handleMessage?: WhatsAppHandler;
  sendText?: MetaTextSender;
}

export function extractMetaWhatsAppTextMessages(
  payload: unknown,
): MetaWhatsAppInboundTextMessage[] {
  if (!isRecord(payload) || payload.object !== "whatsapp_business_account") {
    return [];
  }

  const messages: MetaWhatsAppInboundTextMessage[] = [];
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) {
      continue;
    }

    for (const change of entry.changes) {
      if (!isRecord(change) || !isRecord(change.value) || !Array.isArray(change.value.messages)) {
        continue;
      }

      for (const message of change.value.messages) {
        if (
          !isRecord(message)
          || message.type !== "text"
          || typeof message.from !== "string"
          || typeof message.id !== "string"
          || !isRecord(message.text)
          || typeof message.text.body !== "string"
        ) {
          continue;
        }

        messages.push({
          from: message.from,
          id: message.id,
          text: message.text.body,
        });
      }
    }
  }

  return messages;
}

export function createMetaWhatsAppProcessor(
  config: MetaWhatsAppApiConfig,
  dependencies: MetaWhatsAppProcessorDependencies = {},
): MetaWhatsAppProcessor {
  const handleMessage = dependencies.handleMessage ?? onWhatsAppMessage;
  const sendText = dependencies.sendText
    ?? ((to, text) => sendMetaWhatsAppText(config, to, text));
  const processedMessageIds = new Set<string>();

  return async (payload: unknown): Promise<void> => {
    const messages = extractMetaWhatsAppTextMessages(payload);

    for (const message of messages) {
      if (processedMessageIds.has(message.id)) {
        continue;
      }

      rememberMessageId(processedMessageIds, message.id);

      const reply = await handleMessage({
        userId: `whatsapp:${message.from}`,
        text: message.text,
      });

      for (const chunk of splitMetaWhatsAppText(reply.text)) {
        await sendText(message.from, chunk);
      }
    }
  };
}

export async function sendMetaWhatsAppText(
  config: MetaWhatsAppApiConfig,
  to: string,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const version = config.graphApiVersion ?? DEFAULT_META_GRAPH_API_VERSION;

  if (!/^v\d+\.\d+$/.test(version)) {
    throw new Error("META_GRAPH_API_VERSION must use a value such as v25.0.");
  }

  const phoneNumberId = encodeURIComponent(config.phoneNumberId);
  const endpoint = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: text,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Meta WhatsApp message send failed with HTTP ${response.status}.`);
  }
}

export function splitMetaWhatsAppText(
  text: string,
  maxLength = META_WHATSAPP_TEXT_LIMIT,
): string[] {
  if (maxLength < 1) {
    throw new Error("WhatsApp message max length must be positive.");
  }

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxLength) {
    const candidate = remaining.slice(0, maxLength + 1);
    const newlineIndex = candidate.lastIndexOf("\n");
    const spaceIndex = candidate.lastIndexOf(" ");
    const naturalBreak = newlineIndex >= Math.floor(maxLength / 2)
      ? newlineIndex
      : spaceIndex;
    const splitAt = naturalBreak >= Math.floor(maxLength / 2)
      ? naturalBreak
      : maxLength;
    const chunk = remaining.slice(0, splitAt).trimEnd();

    if (chunk) {
      chunks.push(chunk);
    }

    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

function rememberMessageId(messageIds: Set<string>, messageId: string): void {
  const maxRememberedMessages = 1_000;

  if (messageIds.size >= maxRememberedMessages) {
    const oldestMessageId = messageIds.values().next().value;

    if (oldestMessageId) {
      messageIds.delete(oldestMessageId);
    }
  }

  messageIds.add(messageId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
