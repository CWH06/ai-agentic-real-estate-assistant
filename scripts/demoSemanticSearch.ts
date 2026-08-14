import "dotenv/config";
import { closePool } from "../src/db/mysql";
import { semanticSearchSkill } from "../src/skills/semantic-search";

async function main(): Promise<void> {
  const query = process.argv.slice(2).join(" ")
    || "charming craftsman with mountain views and character";

  const result = await semanticSearchSkill(query);
  console.log(result.message);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
