import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { closePool } from "../src/db/mysql";
import { ragSkill } from "../src/skills/rag";

async function ask(question: string): Promise<void> {
  const startedAt = Date.now();
  const result = await ragSkill(question);
  const elapsedSeconds = ((Date.now() - startedAt) / 1_000).toFixed(1);
  console.log(`\nAgent [${result.status}] (${elapsedSeconds}s):\n${result.message}\n`);
}

async function main(): Promise<void> {
  const commandLineQuestion = process.argv.slice(2).join(" ").trim();
  if (commandLineQuestion) {
    await ask(commandLineQuestion);
    return;
  }

  const rl = readline.createInterface({ input, output });
  console.log("Week 8 RAG demo. Ask a project/real-estate question; type exit to quit.");

  try {
    while (true) {
      let question: string;
      try {
        question = await rl.question("You: ");
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ERR_USE_AFTER_CLOSE") {
          break;
        }
        throw error;
      }

      const normalized = question.trim().toLowerCase();
      if (normalized === "exit" || normalized === "quit") break;
      if (!normalized) continue;

      await ask(question);
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
