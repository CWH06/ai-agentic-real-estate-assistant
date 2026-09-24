import { describe, expect, it, vi } from "vitest";

import {
  createMetaWhatsAppProcessor,
  extractMetaWhatsAppTextMessages,
  sendMetaWhatsAppText,
  splitMetaWhatsAppText,
} from "../src/channels/metaWhatsApp";

const inboundPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            messages: [
              {
                from: "15550001111",
                id: "wamid.test-message",
                timestamp: "1777363200",
                type: "text",
                text: {
                  body: "Market stats for Irvine over 12 months",
                },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe("Meta WhatsApp channel", () => {
  it("extracts inbound text messages from a Cloud API webhook", () => {
    expect(extractMetaWhatsAppTextMessages(inboundPayload)).toEqual([
      {
        from: "15550001111",
        id: "wamid.test-message",
        text: "Market stats for Irvine over 12 months",
      },
    ]);
  });

  it("routes each unique inbound message to the assistant and sends the reply", async () => {
    const handleMessage = vi.fn(async () => ({
      userId: "whatsapp:15550001111",
      text: "Market report: Irvine",
    }));
    const sendText = vi.fn(async () => undefined);
    const processPayload = createMetaWhatsAppProcessor(
      {
        accessToken: "test-access-token",
        phoneNumberId: "123456789",
      },
      {
        handleMessage,
        sendText,
      },
    );

    await processPayload(inboundPayload);
    await processPayload(inboundPayload);

    expect(handleMessage).toHaveBeenCalledTimes(1);
    expect(handleMessage).toHaveBeenCalledWith({
      userId: "whatsapp:15550001111",
      text: "Market stats for Irvine over 12 months",
    });
    expect(sendText).toHaveBeenCalledWith(
      "15550001111",
      "Market report: Irvine",
    );
  });

  it("sends text replies through the versioned Graph API endpoint", async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => new Response(
        JSON.stringify({ messages: [{ id: "wamid.reply" }] }),
        { status: 200 },
      ),
    );

    await sendMetaWhatsAppText(
      {
        accessToken: "test-access-token",
        phoneNumberId: "123456789",
        graphApiVersion: "v25.0",
      },
      "15550001111",
      "Hello from the assistant",
      fetchMock as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://graph.facebook.com/v25.0/123456789/messages",
    );
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer test-access-token",
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "15550001111",
      type: "text",
      text: {
        preview_url: false,
        body: "Hello from the assistant",
      },
    });
  });

  it("splits replies at natural boundaries within the WhatsApp text limit", () => {
    const chunks = splitMetaWhatsAppText(
      "First section\nSecond section\nThird section",
      25,
    );

    expect(chunks).toEqual([
      "First section",
      "Second section",
      "Third section",
    ]);
    expect(chunks.every((chunk) => chunk.length <= 25)).toBe(true);
  });
});
