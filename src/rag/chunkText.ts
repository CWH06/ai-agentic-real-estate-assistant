import { hashEmbeddingText } from "../embeddings/openaiEmbeddings";
import type { KnowledgeChunk, KnowledgeDocument } from "../types/rag";

export const DEFAULT_RAG_CHUNK_SIZE = 600;
export const DEFAULT_RAG_CHUNK_OVERLAP = 100;

export interface ChunkTextOptions {
  chunkSize?: number;
  overlap?: number;
}

interface MarkdownSection {
  heading: string | null;
  body: string;
}

function normalizeDocumentText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findNaturalEnd(
  text: string,
  start: number,
  targetEnd: number,
  chunkSize: number,
): number {
  const minimumNaturalEnd = start + Math.floor(chunkSize * 0.6);
  const candidates = [
    text.lastIndexOf("\n\n", targetEnd),
    text.lastIndexOf(". ", targetEnd),
    text.lastIndexOf("\n", targetEnd),
    text.lastIndexOf(" ", targetEnd),
  ].filter((index) => index >= minimumNaturalEnd);

  if (candidates.length === 0) return targetEnd;

  const boundary = Math.max(...candidates);
  const character = text[boundary];
  return character === "." ? boundary + 1 : boundary;
}

function alignNextStart(text: string, proposedStart: number, end: number): number {
  if (proposedStart <= 0 || proposedStart >= end) return proposedStart;
  if (/\s/.test(text[proposedStart - 1] ?? "")) return proposedStart;

  const nextWhitespace = text.indexOf(" ", proposedStart);
  if (nextWhitespace === -1 || nextWhitespace >= end) return proposedStart;
  return nextWhitespace + 1;
}

/**
 * Splits a document into bounded, overlapping, human-readable text chunks.
 * Natural paragraph or sentence boundaries are preferred near the chunk end.
 */
export function chunkText(
  text: string,
  options: ChunkTextOptions = {},
): string[] {
  const chunkSize = Math.floor(options.chunkSize ?? DEFAULT_RAG_CHUNK_SIZE);
  const overlap = Math.floor(options.overlap ?? DEFAULT_RAG_CHUNK_OVERLAP);

  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than zero.");
  }
  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error("overlap must be at least zero and smaller than chunkSize.");
  }

  const normalized = normalizeDocumentText(text);
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const targetEnd = Math.min(start + chunkSize, normalized.length);
    const end = targetEnd === normalized.length
      ? targetEnd
      : findNaturalEnd(normalized, start, targetEnd, chunkSize);
    const content = normalized.slice(start, end).trim();

    if (content) chunks.push(content);
    if (end >= normalized.length) break;

    const proposedStart = Math.max(start + 1, end - overlap);
    const nextStart = alignNextStart(normalized, proposedStart, end);
    start = nextStart > start ? nextStart : end;
  }

  return chunks;
}

function splitMarkdownSections(text: string): MarkdownSection[] {
  const normalized = normalizeDocumentText(text);
  if (!normalized) return [];

  const sections: MarkdownSection[] = [];
  let heading: string | null = null;
  let bodyLines: string[] = [];

  const flush = (): void => {
    const body = bodyLines.join("\n").trim();
    if (heading || body) sections.push({ heading, body });
    bodyLines = [];
  };

  for (const line of normalized.split("\n")) {
    if (/^#{1,6}\s+\S/.test(line)) {
      flush();
      heading = line.trim();
    } else {
      bodyLines.push(line);
    }
  }
  flush();

  return sections;
}

/**
 * Chunks Markdown one section at a time and repeats the section heading in
 * every chunk. This keeps table names and other retrieval keywords attached
 * to long bullet lists after chunking.
 */
export function chunkMarkdownText(
  text: string,
  options: ChunkTextOptions = {},
): string[] {
  const chunkSize = Math.floor(options.chunkSize ?? DEFAULT_RAG_CHUNK_SIZE);
  const overlap = Math.floor(options.overlap ?? DEFAULT_RAG_CHUNK_OVERLAP);

  // Reuse chunkText's option validation before calculating section sizes.
  chunkText("validation", { chunkSize, overlap });

  return splitMarkdownSections(text).flatMap((section) => {
    if (!section.heading) {
      return chunkText(section.body, { chunkSize, overlap });
    }
    if (!section.body) return [section.heading];

    const prefix = `${section.heading}\n`;
    const bodyChunkSize = chunkSize - prefix.length;
    if (bodyChunkSize <= 20) {
      return chunkText(`${section.heading}\n${section.body}`, {
        chunkSize,
        overlap,
      });
    }

    const bodyOverlap = Math.min(overlap, bodyChunkSize - 1);
    return chunkText(section.body, {
      chunkSize: bodyChunkSize,
      overlap: bodyOverlap,
    }).map((bodyChunk) => `${prefix}${bodyChunk}`);
  });
}

export function chunkKnowledgeDocument(
  document: KnowledgeDocument,
  options: ChunkTextOptions = {},
): KnowledgeChunk[] {
  return chunkMarkdownText(document.content, options).map((content, chunkIndex) => ({
    documentId: document.id,
    documentTitle: document.title,
    sourceUrl: document.sourceUrl,
    chunkIndex,
    content,
    textHash: hashEmbeddingText(`${document.title}\n${content}`),
  }));
}
