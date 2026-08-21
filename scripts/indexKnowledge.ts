import "dotenv/config";
import { closePool } from "../src/db/mysql";
import { indexKnowledgeBase } from "../src/rag/indexKnowledge";

async function main(): Promise<void> {
  console.log("Indexing Markdown files from the knowledge directory...");
  const stats = await indexKnowledgeBase();

  console.log([
    "Knowledge indexing complete.",
    `Documents: ${stats.documents}`,
    `Chunks: ${stats.chunks}`,
    `New or changed: ${stats.indexed}`,
    `Unchanged: ${stats.skipped}`,
    `Embedding provider: ${stats.provider}`,
    `Embedding model: ${stats.model}`,
  ].join("\n"));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
