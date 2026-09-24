import http from "node:http";
import { onWhatsAppMessage } from "../channels/whatsappHandler";

export function createWhatsAppWebhookServer() {
  return http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    if (req.method === "POST" && req.url === "/whatsapp") {
      let body = "";

      req.on("data", (chunk) => {
        body += chunk;
      });

      req.on("end", async () => {
        try {
          const params = new URLSearchParams(body);
          const text = params.get("Body") ?? "";
          const userId = params.get("From") ?? "whatsapp-demo-user";

          const reply = await onWhatsAppMessage({ userId, text });
          const twiml = `<Response><Message>${escapeXml(reply.text)}</Message></Response>`;

          res.writeHead(200, { "Content-Type": "text/xml" });
          res.end(twiml);
        } catch (error) {
          console.error("WhatsApp webhook error:", error);
          res.writeHead(200, { "Content-Type": "text/xml" });
          res.end("<Response><Message>Sorry, I hit an issue. Please try again.</Message></Response>");
        }
      });

      req.on("error", (error) => {
        console.error("WhatsApp request error:", error);
        if (!res.headersSent) {
          res.writeHead(400, { "Content-Type": "text/plain" });
        }
        res.end("bad request");
      });

      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}