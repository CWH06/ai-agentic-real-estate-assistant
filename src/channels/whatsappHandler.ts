import { handleChatMessage } from "../chat/router";

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
  const result = await handleChatMessage(inbound);

  return {
    userId: inbound.userId,
    text: result.text,
  };
}
