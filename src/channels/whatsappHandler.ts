import { orchestrate } from "../orchestrator";

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
  const result = await orchestrate(inbound.text, inbound.userId);

  return {
    userId: inbound.userId,
    text: result.message,
  };
}
