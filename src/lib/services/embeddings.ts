import OpenAI from "openai";
import { createHash } from "crypto";
import { AI_CONFIG } from "@/lib/constants";
import { requireEnv } from "@/lib/env";

const getOpenAIClient = () => {
  const apiKey = requireEnv("OPENAI_API_KEY");
  return new OpenAI({ apiKey });
};

/**
 * In-memory embedding cache with LRU eviction
 * Key: content hash, Value: embedding vector
 */
class EmbeddingCache {
  private cache: Map<string, number[]> = new Map();
  private maxSize: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  private hashContent(text: string): string {
    return createHash("sha256").update(text).digest("hex").substring(0, 16);
  }

  get(text: string): number[] | undefined {
    const hash = this.hashContent(text);
    const embedding = this.cache.get(hash);
    if (embedding) {
      this.hits++;
      // Move to end for LRU
      this.cache.delete(hash);
      this.cache.set(hash, embedding);
      return embedding;
    }
    this.misses++;
    return undefined;
  }

  set(text: string, embedding: number[]): void {
    const hash = this.hashContent(text);

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(hash, embedding);
  }

  getMany(texts: string[]): Map<number, number[]> {
    const results = new Map<number, number[]>();
    texts.forEach((text, index) => {
      const embedding = this.get(text);
      if (embedding) {
        results.set(index, embedding);
      }
    });
    return results;
  }

  setMany(texts: string[], embeddings: number[][]): void {
    texts.forEach((text, index) => {
      const embedding = embeddings[index];
      if (embedding) {
        this.set(text, embedding);
      }
    });
  }

  getStats(): { hits: number; misses: number; size: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

// Global embedding cache instance
const embeddingCache = new EmbeddingCache(10000);

/**
 * Get embedding cache statistics
 */
export function getEmbeddingCacheStats() {
  return embeddingCache.getStats();
}

/**
 * Clear the embedding cache
 */
export function clearEmbeddingCache() {
  embeddingCache.clear();
}

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
 * Generate embeddings for multiple texts (batch) with caching
 */
export async function generateEmbeddings(
  texts: string[],
  useCache: boolean = true
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getOpenAIClient();
  const embeddings: number[][] = new Array(texts.length);

  // Check cache first
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  if (useCache) {
    texts.forEach((text, index) => {
      const cached = embeddingCache.get(text);
      if (cached) {
        embeddings[index] = cached;
      } else {
        uncachedIndices.push(index);
        uncachedTexts.push(text);
      }
    });
  } else {
    texts.forEach((_, index) => {
      uncachedIndices.push(index);
    });
    uncachedTexts.push(...texts);
  }

  // Generate embeddings for uncached texts
  if (uncachedTexts.length > 0) {
    // OpenAI allows up to 2048 inputs per request
    const batchSize = 100;
    const newEmbeddings: number[][] = [];

    for (let i = 0; i < uncachedTexts.length; i += batchSize) {
      const batch = uncachedTexts.slice(i, i + batchSize);

      const response = await client.embeddings.create({
        model: AI_CONFIG.embedding.model,
        input: batch,
        dimensions: AI_CONFIG.embedding.dimensions,
      });

      newEmbeddings.push(...response.data.map((d) => d.embedding));
    }

    // Store in cache and result array
    uncachedIndices.forEach((originalIndex, newIndex) => {
      const embedding = newEmbeddings[newIndex];
      if (embedding) {
        embeddings[originalIndex] = embedding;
        if (useCache) {
          embeddingCache.set(texts[originalIndex] ?? "", embedding);
        }
      }
    });
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
