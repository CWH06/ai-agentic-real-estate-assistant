import "dotenv/config";
import { createConnection, type Connection, type RowDataPacket } from "mysql2/promise";
import { getEmbeddingModel, getEmbeddingProviderName } from "../src/embeddings/openaiEmbeddings";
import { getLlmProviderName } from "../src/rag/generateGroundedAnswer";

let failures = 0;
function configured(name: string): boolean {
  const value = process.env[name]?.trim();
  return Boolean(value && !/your[-_]|replace-with|example\.com/i.test(value));
}
function settings(label: string, names: string[], required = true): boolean {
  const missing = names.filter((name) => !configured(name));
  if (!missing.length) { console.log(`PASS ${label}: settings present (credentials not validated)`); return true; }
  console.log(`${required ? "FAIL" : "WARN"} ${label}: missing/placeholder ${missing.join(", ")}`);
  if (required) failures++;
  return false;
}

async function checkDatabase(): Promise<void> {
  if (!settings("MySQL", ["MYSQL_USER", "MYSQL_DATABASE"])) return;
  let connection: Connection | undefined;
  try {
    connection = await createConnection({
      host: process.env.MYSQL_HOST ?? "localhost", port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE, connectTimeout: 5000,
    });
    const checks = [
      { label: "listing records", sql: "SELECT COUNT(*) AS total FROM rets_property", params: [] },
      { label: "sold records", sql: "SELECT COUNT(*) AS total FROM california_sold", params: [] },
      { label: "listing embeddings for configured model", sql: "SELECT COUNT(*) AS total FROM listing_embeddings WHERE model = ?", params: [getEmbeddingModel()] },
      { label: "at least one active indexed listing (1=yes)", sql: "SELECT EXISTS(SELECT 1 FROM listing_embeddings e JOIN rets_property r ON r.L_ListingID = e.listing_id WHERE e.model = ? AND r.L_Status = 'Active' LIMIT 1) AS total", params: [getEmbeddingModel()] },
      { label: "knowledge chunks for configured model", sql: "SELECT COUNT(*) AS total FROM rag_chunks WHERE model = ?", params: [getEmbeddingModel()] },
    ];
    for (const check of checks) {
      try {
        const [rows] = await connection.query<RowDataPacket[]>({ sql: check.sql, timeout: 5000 }, check.params);
        const total = Number(rows[0].total);
        console.log(`${total > 0 ? "PASS" : "FAIL"} ${check.label}: ${total}`);
        if (!total) failures++;
      } catch { console.log(`FAIL ${check.label}: table unavailable or query failed; check schema/index setup`); failures++; }
    }
  } catch { console.log("FAIL MySQL connection: check credentials, host, port and running database"); failures++; }
  finally { await connection?.end(); }
}

async function checkMeta(): Promise<void> {
  const present = settings("Meta WhatsApp", ["META_WHATSAPP_ACCESS_TOKEN", "META_WHATSAPP_PHONE_NUMBER_ID", "META_WHATSAPP_VERIFY_TOKEN", "META_WHATSAPP_APP_SECRET"]);
  const port = Number(process.env.META_WHATSAPP_PORT ?? 3001);
  try {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("port");
    const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok || (await response.text()).trim() !== "ok") throw new Error("health");
    console.log("PASS local Meta webhook /health (not a public HTTPS test)");
  } catch { console.log("FAIL local Meta webhook: check service and META_WHATSAPP_PORT"); failures++; }
  if (!present) return;
  const version = process.env.META_GRAPH_API_VERSION ?? "v25.0";
  if (!/^v\d+\.\d+$/.test(version)) { console.log("FAIL invalid META_GRAPH_API_VERSION"); failures++; return; }
  try {
    const id = encodeURIComponent(process.env.META_WHATSAPP_PHONE_NUMBER_ID!);
    // Read metadata only. Never sends a WhatsApp message or prints token/phone metadata.
    const response = await fetch(`https://graph.facebook.com/${version}/${id}?fields=id`, {
      headers: { Authorization: `Bearer ${process.env.META_WHATSAPP_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) console.log("PASS Meta token can read configured phone-number metadata");
    else { console.log(`FAIL Meta metadata HTTP ${response.status}: check token expiry, permissions and phone-number ID`); failures++; }
  } catch { console.log("FAIL Meta metadata request: network unavailable or timed out"); failures++; }
}

async function main(): Promise<void> {
  console.log("Read-only live-demo preflight. No indexing, model generation, SMTP delivery or WhatsApp messages.");
  const embedding = getEmbeddingProviderName();
  const llm = getLlmProviderName();
  settings(`Embeddings (${embedding})`, [embedding === "voyage" ? "VOYAGE_API_KEY" : "OPENAI_API_KEY"]);
  settings(`RAG answers (${llm})`, [llm === "deepseek" ? "DEEPSEEK_API_KEY" : "OPENAI_API_KEY"]);
  settings("SMTP (optional; not used by demo:live)", ["EMAIL_USER", "EMAIL_PASSWORD"], false);
  await checkDatabase();
  if (process.argv.includes("--meta")) await checkMeta();
  console.log("Provider/SMTP credentials, public TLS and end-to-end delivery need separate live validation.");
  console.log(failures ? `${failures} required check(s) failed. Sample mode remains available: npm run demo` : "Preflight checks passed.");
  if (failures) process.exitCode = 1;
}
main().catch(() => { console.error("FAIL preflight: invalid configuration. Check .env.example; secrets suppressed."); process.exitCode = 1; });
