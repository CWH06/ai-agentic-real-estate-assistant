import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { KnowledgeDocument } from "../types/rag";

function titleFromMarkdown(content: string, fallback: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
}
function canonicalUrlFromMarkdown(content: string): string | null {
  const match = content.match(/^Canonical source:\s*(https?:\/\/\S+)\s*$/im);
  return match?.[1] ?? null;
}

export async function loadKnowledgeDocuments(
  directory = process.env.RAG_KNOWLEDGE_DIR
    ? path.resolve(process.env.RAG_KNOWLEDGE_DIR)
    : path.resolve(process.cwd(), "knowledge"),
): Promise<KnowledgeDocument[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name)
    .sort((first, second) => first.localeCompare(second));

  return Promise.all(
    markdownFiles.map(async (fileName) => {
      const sourcePath = path.join(directory, fileName);
      const content = (await readFile(sourcePath, "utf8")).trim();
      const id = path.basename(fileName, path.extname(fileName));

      return {
        id,
        title: titleFromMarkdown(content, id),
        content,
        sourcePath,
        sourceUrl: canonicalUrlFromMarkdown(content),
      };
    }),
  );
}
