import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { closePool } from "../src/db/mysql";
import { detectChatIntent, handleChatMessage } from "../src/chat/router";

async function main(): Promise<void> {
  const userId = "interactive-cli-user";
  const rl = readline.createInterface({ input, output });

  console.log("Real estate assistant demo. Type help for examples, exit to quit.");

  try {
    while (true) {
      let text: string;
      try {
        text = await rl.question("You: ");
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ERR_USE_AFTER_CLOSE") {
          break;
        }

        throw error;
      }

      const normalized = text.trim().toLowerCase();

      if (normalized === "exit" || normalized === "quit") {
        break;
      }

      const intent = detectChatIntent(text);
      const startedAt = Date.now();
      if (intent === "semantic-search") {
        console.log("Agent [semantic-search]: Searching embeddings...");
      } else if (intent === "recommendations") {
        console.log("Agent [recommendations]: Building recommendations...");
      }

      const reply = await handleChatMessage({
        userId,
        text,
      });
      const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

      console.log(`Agent [${reply.intent}] (${elapsedSeconds}s): ${reply.text}`);
    }
  } finally {
    rl.close();
    await closePool();
  }
}

main().catch(async (error: unknown) => {
  console.error(error);
  await closePool();
  process.exitCode = 1;
});
