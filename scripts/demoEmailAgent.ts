import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { closePool } from "../src/db/mysql";
import { orchestrate } from "../src/orchestrator";

const DEMO_USER_ID = "email-demo-user";

async function main(): Promise<void> {
  const readline = createInterface({ input, output });

  console.log("Week 11 email approval demo.");
  console.log(
    "Try: Draft a weekly market report for Irvine to name@example.com",
  );
  console.log("Then reply CONFIRM EMAIL or CANCEL EMAIL. Type exit to quit.");

  try {
    while (true) {
      const query = (await readline.question("You: ")).trim();
      if (/^(?:exit|quit)$/i.test(query)) break;
      if (!query) continue;

      const result = await orchestrate(query, DEMO_USER_ID);
      console.log(`\nAgent [${result.intent}]:\n${result.message}\n`);
    }
  } finally {
    readline.close();
    await closePool();
  }
}

main().catch(async (error: unknown) => {
  console.error("Email demo failed.", error);
  await closePool();
  process.exitCode = 1;
});
