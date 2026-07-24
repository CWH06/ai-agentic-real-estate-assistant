import { handlePropertySearch } from "../skills/property-search/conversation";

export interface WhatsAppInboundMessage {
  userId: string;
  text: string;
}

export interface WhatsAppOutboundMessage {
  userId: string;
  text: string;
}

export async function onWhatsAppMessage(
  inbound: WhatsAppInboundMessage,
): Promise<WhatsAppOutboundMessage> {
  const result = await handlePropertySearch(inbound.userId, inbound.text);

  return {
    userId: inbound.userId,
    text: result.message,
  };
}
