import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { closePool } from "../src/db/mysql";
import { marketStatsSkill } from "../src/skills/market-stats";

async function main(): Promise<void> {
  const readline = createInterface({
    input,
    output,
  });

  console.log("California Real Estate Market Agent");
  console.log('Ask a market question, or type "exit".');
  console.log("");

  try {
    while (true) {
      const question = await readline.question("You: ");
      const trimmedQuestion = question.trim();
      const normalizedQuestion = trimmedQuestion.toLowerCase();

      if (
        normalizedQuestion === "exit" ||
        normalizedQuestion === "quit"
      ) {
        break;
      }

      if (!trimmedQuestion) {
        continue;
      }

      const result = await marketStatsSkill(trimmedQuestion);

      console.log(
        `Parsed filters: ${JSON.stringify(result.filters)}`,
      );
      console.log(`Agent:\n${result.message}`);
      console.log("");
    }
  } finally {
    readline.close();
    await closePool();
  }
}

main().catch(async (error) => {
  console.error("Market demo failed:", error);
  await closePool();
  process.exit(1);
});
