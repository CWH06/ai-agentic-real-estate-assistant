import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { closePool } from "../src/db/mysql";
import { orchestrate } from "../src/orchestrator";

async function ask(query: string): Promise<void> {
  const startedAt = Date.now();
  const result = await orchestrate(query, "orchestrator-demo-user");
  const elapsedSeconds = ((Date.now() - startedAt) / 1_000).toFixed(1);
  console.log(`\nAgent [${result.intent}] (${elapsedSeconds}s):\n${result.message}\n`);
}

async function main(): Promise<void> {
  const commandLineQuery = process.argv.slice(2).join(" ").trim();
  if (commandLineQuery) {
    await ask(commandLineQuery);
    return;
  }

  const rl = readline.createInterface({ input, output });
  console.log("Week 9 orchestrator demo. Ask a search, market, recommendation, knowledge, or mixed question; type exit to quit.");

  try {
    while (true) {
      let query: string;
      try {
        query = await rl.question("You: ");
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ERR_USE_AFTER_CLOSE") {
          break;
        }
        throw error;
      }

      const normalized = query.trim().toLowerCase();
      if (normalized === "exit" || normalized === "quit") break;
      if (!normalized) continue;

      await ask(query);
    }
  } finally {
    rl.close();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
