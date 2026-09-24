import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createMetaWhatsAppWebhookServer } from "../src/server/metaWhatsAppWebhook";

const appSecret = "test-app-secret";
const verifyToken = "test-verify-token";
const runningServers: Server[] = [];

afterEach(async () => {
  await Promise.all(runningServers.splice(0).map(
    (server) => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    }),
  ));
});

describe("Meta WhatsApp webhook server", () => {
  it("returns a health response", async () => {
    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });

  it("answers a valid Meta webhook verification challenge", async () => {
    const { baseUrl } = await startServer();
    const query = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": verifyToken,
      "hub.challenge": "challenge-accepted",
    });
    const response = await fetch(`${baseUrl}/meta-whatsapp?${query}`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("challenge-accepted");
  });

  it("rejects a verification request with the wrong token", async () => {
    const { baseUrl } = await startServer();
    const query = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong-token",
      "hub.challenge": "challenge-rejected",
    });
    const response = await fetch(`${baseUrl}/meta-whatsapp?${query}`);

    expect(response.status).toBe(403);
  });

  it("acknowledges signed webhook events before processing them", async () => {
    const processPayload = vi.fn(async () => undefined);
    const { baseUrl } = await startServer(processPayload);
    const payload = {
      object: "whatsapp_business_account",
      entry: [],
    };
    const rawBody = JSON.stringify(payload);
    const signature = createHmac("sha256", appSecret)
      .update(rawBody)
      .digest("hex");
    const response = await fetch(`${baseUrl}/meta-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": `sha256=${signature}`,
      },
      body: rawBody,
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("EVENT_RECEIVED");
    await vi.waitFor(() => {
      expect(processPayload).toHaveBeenCalledWith(payload);
    });
  });

  it("rejects webhook events with an invalid signature", async () => {
    const processPayload = vi.fn(async () => undefined);
    const { baseUrl } = await startServer(processPayload);
    const response = await fetch(`${baseUrl}/meta-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": `sha256=${"0".repeat(64)}`,
      },
      body: JSON.stringify({
        object: "whatsapp_business_account",
        entry: [],
      }),
    });

    expect(response.status).toBe(401);
    expect(processPayload).not.toHaveBeenCalled();
  });
});

async function startServer(
  processPayload = vi.fn(async () => undefined),
): Promise<{ baseUrl: string }> {
  const server = createMetaWhatsAppWebhookServer({
    appSecret,
    processPayload,
    verifyToken,
    logger: {
      error: vi.fn(),
    },
  });
  runningServers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}
