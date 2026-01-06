import OpenAI from "openai";
import { AI_CONFIG } from "@/lib/constants";

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }
  return new OpenAI({ apiKey });
};

/**
 * Code chunk for embedding
 */
export interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  language: string;
  startLine: number;
  endLine: number;
  type: "function" | "class" | "method" | "module" | "block";
  name?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Embedded chunk with vector
 */
export interface EmbeddedChunk extends CodeChunk {
  embedding: number[];
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();

  const response = await client.embeddings.create({
    model: AI_CONFIG.embedding.model,
    input: text,
    dimensions: AI_CONFIG.embedding.dimensions,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("Failed to generate embedding");
  }
  return embedding;
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getOpenAIClient();

  // OpenAI allows up to 2048 inputs per request
  const batchSize = 100;
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await client.embeddings.create({
      model: AI_CONFIG.embedding.model,
      input: batch,
      dimensions: AI_CONFIG.embedding.dimensions,
    });

    embeddings.push(...response.data.map((d) => d.embedding));
  }

  return embeddings;
}

/**
 * Embed code chunks
 */
export async function embedCodeChunks(
  chunks: CodeChunk[]
): Promise<EmbeddedChunk[]> {
  if (chunks.length === 0) return [];

  // Create text representations for embedding
  const texts = chunks.map((chunk) => {
    const header = chunk.name
      ? `${chunk.type} ${chunk.name} in ${chunk.filePath}`
      : `${chunk.type} in ${chunk.filePath}`;
    return `${header}\n\n${chunk.content}`;
  });

  const embeddings = await generateEmbeddings(texts);

  return chunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i] ?? [],
  }));
}

/**
 * Estimate token count for text
 */
export function estimateTokenCount(text: string): number {
  // Rough approximation: ~4 characters per token for code
  return Math.ceil(text.length / 4);
}
