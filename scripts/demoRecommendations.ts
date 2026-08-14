import "dotenv/config";
import { closePool } from "../src/db/mysql";
import { recommendationSkill } from "../src/skills/recommendations";

async function main(): Promise<void> {
  const listingId = process.argv[2];

  if (!listingId) {
    console.error("Usage: npm run demo:recommendations -- <listing-id>");
    process.exitCode = 1;
    return;
  }

  const result = await recommendationSkill(listingId);
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
