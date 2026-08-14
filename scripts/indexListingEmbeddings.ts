import "dotenv/config";
import { buildListingEmbeddingText } from "../src/embeddings/listingText";
import {
  getConfiguredEmbeddingProvider,
  getEmbeddingModel,
  getEmbeddingProviderName,
  hashEmbeddingText,
} from "../src/embeddings/openaiEmbeddings";
import {
  ensureListingEmbeddingsTable,
  getActiveListingEmbeddingSources,
  getExistingEmbeddingHashes,
  upsertListingEmbeddings,
} from "../src/db/semanticSearch";
import { closePool } from "../src/db/mysql";

interface ListingEmbeddingWorkItem {
  listingId: string;
  text: string;
  textHash: string;
}

function readNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function main(): Promise<void> {
  const model = getEmbeddingModel();
  const providerName = getEmbeddingProviderName();
  const embeddingProvider = getConfiguredEmbeddingProvider();
  const pageSize = Math.min(
    500,
    Math.max(1, Math.floor(readNumberEnv("EMBEDDINGS_PAGE_SIZE", 100))),
  );
  const batchSize = Math.min(
    100,
    Math.max(1, Math.floor(readNumberEnv("EMBEDDINGS_BATCH_SIZE", 50))),
  );
  const maxListings = Math.max(
    0,
    Math.floor(readNumberEnv("EMBEDDINGS_INDEX_LIMIT", 0)),
  );

  await ensureListingEmbeddingsTable();

  let offset = 0;
  let scanned = 0;
  let indexed = 0;
  let skipped = 0;

  while (true) {
    const remaining = maxListings > 0 ? maxListings - scanned : pageSize;
    if (remaining <= 0) break;

    const rows = await getActiveListingEmbeddingSources(
      Math.min(pageSize, remaining),
      offset,
    );
    if (rows.length === 0) break;

    const workItems: ListingEmbeddingWorkItem[] = rows
      .map((row) => {
        const listingId = row.L_ListingID;
        if (!listingId) return null;

        const text = buildListingEmbeddingText(row);
        return {
          listingId,
          text,
          textHash: hashEmbeddingText(text),
        };
      })
      .filter((item): item is ListingEmbeddingWorkItem => Boolean(item));

    const existingHashes = await getExistingEmbeddingHashes(
      workItems.map((item) => item.listingId),
      model,
    );

    const changedItems = workItems.filter(
      (item) => existingHashes.get(item.listingId) !== item.textHash,
    );

    skipped += workItems.length - changedItems.length;

    for (const batch of chunk(changedItems, batchSize)) {
      const embeddings = await embeddingProvider(
        batch.map((item) => item.text),
        model,
        "document",
      );

      await upsertListingEmbeddings(
        batch.map((item, index) => ({
          listingId: item.listingId,
          model,
          textHash: item.textHash,
          embedding: embeddings[index],
        })),
      );

      indexed += batch.length;
      console.log(
        `Indexed ${indexed} changed listings; skipped ${skipped}; scanned ${scanned + rows.length}.`,
      );
    }

    scanned += rows.length;
    offset += rows.length;
  }

  console.log(
    `Done. Scanned ${scanned}, indexed ${indexed}, skipped ${skipped}, provider ${providerName}, model ${model}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
