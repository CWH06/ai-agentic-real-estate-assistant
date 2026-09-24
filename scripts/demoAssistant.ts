import "dotenv/config";
import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { randomUUID } from "node:crypto";
import { closePool } from "../src/db/mysql";
import { createSampleAgents, DEMO_QUERIES } from "../src/demo/sampleAgents";
import { EmailWorkflow } from "../src/email/emailAgent";
import { orchestrate, type OrchestratorOptions } from "../src/orchestrator";

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const live = args.has("--live");
  if (live && args.has("--scripted")) throw new Error("Scripted mode is sample-only. Use --live interactively.");
  const userId = `demo:${randomUUID()}`;
  let options: OrchestratorOptions;
  if (live) {
    // Prevent accidental real delivery in a demo. Use demo:email / WhatsApp for approved SMTP delivery.
    const email = new EmailWorkflow({ emailSender: async () => {} });
    options = { agents: { emailDraftAgent: async (query, user) => {
      const result = await email.handle(query, user);
      return { message: result.status === "sent"
        ? "[DRY RUN] Approval recorded. No email was sent."
        : `[DRY RUN — email delivery disabled]\n${result.message}` };
    } } };
    console.log("LIVE DATA / API MODE — queries may incur provider charges. Email is DRY RUN.");
  } else {
    options = { agents: (await createSampleAgents()).agents };
    console.log("SAMPLE MODE — fictional listings/market data, illustrative vectors, document excerpts, simulated email. No external calls.");
  }
  const reply = async (text: string) => {
    const started = performance.now();
    const result = await orchestrate(text, userId, options);
    console.log(`Agent [${result.intent}] (${((performance.now() - started) / 1000).toFixed(2)}s):\n${result.message}\n`);
  };
  if (args.has("--scripted")) {
    for (const text of DEMO_QUERIES) { console.log(`You: ${text}`); await reply(text); }
    return;
  }
  console.log("Type help for examples; exit to quit.");
  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
  try {
    if (stdin.isTTY) { rl.setPrompt("You: "); rl.prompt(); }
    for await (const line of rl) {
      if (/^(?:exit|quit)$/i.test(line.trim())) break;
      if (line.trim()) await reply(line);
      if (stdin.isTTY) rl.prompt();
    }
  } finally { rl.close(); }
}

main().catch(() => {
  console.error("Demo failed. Check local configuration with npm run demo:check; no secrets are printed here.");
  process.exitCode = 1;
}).finally(closePool);
