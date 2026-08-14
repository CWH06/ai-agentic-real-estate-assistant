import { createHash } from "node:crypto";

export type EmbeddingVector = number[];

export type EmbeddingInputType = "query" | "document" | null;

export type EmbeddingProvider = (
  inputs: string[],
  model: string,
  inputType?: EmbeddingInputType,
) => Promise<EmbeddingVector[]>;

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
}

interface VoyageEmbeddingResponse {
  data?: Array<{
    embedding: number[];
    index: number;
  }>;
  embeddings?: number[][];
}

export type EmbeddingProviderName = "openai" | "voyage";

export const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_VOYAGE_EMBEDDING_MODEL = "voyage-4-lite";
export const EMBEDDING_INPUT_CHAR_LIMIT = 8_000;
export const DEFAULT_EMBEDDING_REQUEST_TIMEOUT_MS = 45_000;

function hasConfiguredValue(value: string | undefined): boolean {
  return Boolean(value && value.trim() && !value.includes("your-"));
}

function getEmbeddingRequestTimeoutMs(): number {
  const configuredTimeout = Number(process.env.EMBEDDING_REQUEST_TIMEOUT_MS);
  if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
    return Math.floor(configuredTimeout);
  }

  return DEFAULT_EMBEDDING_REQUEST_TIMEOUT_MS;
}

async function fetchEmbedding(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const timeoutMs = getEmbeddingRequestTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Embedding request timed out after ${timeoutMs}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function getEmbeddingProviderName(): EmbeddingProviderName {
  const configuredProvider = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();

  if (configuredProvider === "openai" || configuredProvider === "voyage") {
    return configuredProvider;
  }

  if (hasConfiguredValue(process.env.VOYAGE_API_KEY)) {
    return "voyage";
  }

  return "openai";
}

export function getEmbeddingModel(model?: string): string {
  if (model) return model;

  if (getEmbeddingProviderName() === "voyage") {
    return process.env.VOYAGE_EMBEDDING_MODEL ?? DEFAULT_VOYAGE_EMBEDDING_MODEL;
  }

  return process.env.OPENAI_EMBEDDING_MODEL ?? DEFAULT_OPENAI_EMBEDDING_MODEL;
}

export function normalizeEmbeddingInput(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, EMBEDDING_INPUT_CHAR_LIMIT);
}

export function hashEmbeddingText(text: string): string {
  return createHash("sha256")
    .update(normalizeEmbeddingInput(text))
    .digest("hex");
}

export async function createOpenAIEmbeddings(
  inputs: string[],
  model = getEmbeddingModel(),
  _inputType: EmbeddingInputType = null,
): Promise<EmbeddingVector[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!hasConfiguredValue(apiKey)) {
    throw new Error("OPENAI_API_KEY is required to generate embeddings.");
  }

  const normalizedInputs = inputs.map(normalizeEmbeddingInput);
  if (normalizedInputs.some((input) => input.length === 0)) {
    throw new Error("Embedding input cannot be empty.");
  }

  const response = await fetchEmbedding("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: normalizedInputs,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `OpenAI embeddings request failed: ${response.status} ${body}`,
    );
  }

  const payload = (await response.json()) as OpenAIEmbeddingResponse;
  const vectors = payload.data
    .slice()
    .sort((first, second) => first.index - second.index)
    .map((item) => item.embedding);

  if (vectors.length !== normalizedInputs.length) {
    throw new Error("OpenAI embeddings response count did not match input count.");
  }

  return vectors;
}

export async function createVoyageEmbeddings(
  inputs: string[],
  model = getEmbeddingModel(),
  inputType: EmbeddingInputType = null,
): Promise<EmbeddingVector[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!hasConfiguredValue(apiKey)) {
    throw new Error("VOYAGE_API_KEY is required to generate embeddings.");
  }

  const normalizedInputs = inputs.map(normalizeEmbeddingInput);
  if (normalizedInputs.some((input) => input.length === 0)) {
    throw new Error("Embedding input cannot be empty.");
  }

  const response = await fetchEmbedding("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: normalizedInputs,
      input_type: inputType,
      truncation: true,
      output_dtype: "float",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Voyage embeddings request failed: ${response.status} ${body}`,
    );
  }

  const payload = (await response.json()) as VoyageEmbeddingResponse;
  const vectors = payload.data
    ? payload.data
      .slice()
      .sort((first, second) => first.index - second.index)
      .map((item) => item.embedding)
    : payload.embeddings;

  if (!vectors || vectors.length !== normalizedInputs.length) {
    throw new Error("Voyage embeddings response count did not match input count.");
  }

  return vectors;
}

export function getConfiguredEmbeddingProvider(): EmbeddingProvider {
  return getEmbeddingProviderName() === "voyage"
    ? createVoyageEmbeddings
    : createOpenAIEmbeddings;
}

export async function createOpenAIEmbedding(
  input: string,
  model = getEmbeddingModel(),
): Promise<EmbeddingVector> {
  const [embedding] = await createOpenAIEmbeddings([input], model);
  return embedding;
}

export async function createEmbedding(
  input: string,
  model = getEmbeddingModel(),
  inputType: EmbeddingInputType = null,
): Promise<EmbeddingVector> {
  const provider = getConfiguredEmbeddingProvider();
  const [embedding] = await provider([input], model, inputType);
  return embedding;
}

export function serializeEmbedding(embedding: EmbeddingVector): string {
  return JSON.stringify(embedding);
}

export function parseEmbeddingJson(value: string): EmbeddingVector | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;

    const vector = parsed.map((item) => Number(item));
    if (vector.length === 0 || vector.some((item) => !Number.isFinite(item))) {
      return null;
    }

    return vector;
  } catch {
    return null;
  }
}

export function cosineSimilarity(
  first: EmbeddingVector,
  second: EmbeddingVector,
): number {
  const length = Math.min(first.length, second.length);
  if (length === 0) return 0;

  let dotProduct = 0;
  let firstMagnitude = 0;
  let secondMagnitude = 0;

  for (let index = 0; index < length; index += 1) {
    const firstValue = first[index];
    const secondValue = second[index];
    dotProduct += firstValue * secondValue;
    firstMagnitude += firstValue * firstValue;
    secondMagnitude += secondValue * secondValue;
  }

  if (firstMagnitude === 0 || secondMagnitude === 0) return 0;

  return dotProduct / (Math.sqrt(firstMagnitude) * Math.sqrt(secondMagnitude));
}
