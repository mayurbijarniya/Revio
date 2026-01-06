import { generateEmbedding } from "./embeddings";
import { searchChunks, type SearchResult } from "./qdrant";
import { REVIEW_CONFIG } from "@/lib/constants";

/**
 * Context chunk with relevance score
 */
export interface ContextChunk {
  filePath: string;
  content: string;
  language: string;
  startLine: number;
  endLine: number;
  type: string;
  name: string | null;
  score: number;
}

/**
 * Retrieved context for chat/review
 */
export interface RetrievedContext {
  chunks: ContextChunk[];
  totalTokens: number;
}

/**
 * Retrieve relevant code context for a query
 */
export async function retrieveContext(
  repositoryId: string,
  query: string,
  options: {
    maxChunks?: number;
    maxTokens?: number;
    scoreThreshold?: number;
  } = {}
): Promise<RetrievedContext> {
  const {
    maxChunks = REVIEW_CONFIG.maxContextChunks,
    maxTokens = REVIEW_CONFIG.maxContextTokens,
    scoreThreshold = REVIEW_CONFIG.minScoreThreshold,
  } = options;

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Search for similar chunks
  const results = await searchChunks(
    repositoryId,
    queryEmbedding,
    maxChunks * 2, // Get more than needed for filtering
    scoreThreshold
  );

  // Convert and deduplicate results
  const chunks = deduplicateAndRank(results);

  // Limit by tokens
  const { selectedChunks, totalTokens } = selectByTokenLimit(chunks, maxTokens);

  // Limit by count
  const finalChunks = selectedChunks.slice(0, maxChunks);

  return {
    chunks: finalChunks,
    totalTokens,
  };
}

/**
 * Retrieve context for multiple queries (e.g., PR review with multiple files)
 */
export async function retrieveMultiContext(
  repositoryId: string,
  queries: string[],
  options: {
    maxChunksPerQuery?: number;
    maxTotalChunks?: number;
    maxTokens?: number;
    scoreThreshold?: number;
  } = {}
): Promise<RetrievedContext> {
  const {
    maxChunksPerQuery = 5,
    maxTotalChunks = REVIEW_CONFIG.maxContextChunks,
    maxTokens = REVIEW_CONFIG.maxContextTokens,
    scoreThreshold = REVIEW_CONFIG.minScoreThreshold,
  } = options;

  const allResults: SearchResult[] = [];

  // Search for each query
  for (const query of queries) {
    const queryEmbedding = await generateEmbedding(query);
    const results = await searchChunks(
      repositoryId,
      queryEmbedding,
      maxChunksPerQuery,
      scoreThreshold
    );
    allResults.push(...results);
  }

  // Deduplicate and rank
  const chunks = deduplicateAndRank(allResults);

  // Limit by tokens
  const { selectedChunks, totalTokens } = selectByTokenLimit(chunks, maxTokens);

  // Limit by count
  const finalChunks = selectedChunks.slice(0, maxTotalChunks);

  return {
    chunks: finalChunks,
    totalTokens,
  };
}

/**
 * Deduplicate chunks by ID and rank by score
 */
function deduplicateAndRank(results: SearchResult[]): ContextChunk[] {
  const seen = new Set<string>();
  const chunks: ContextChunk[] = [];

  // Sort by score descending
  const sorted = [...results].sort((a, b) => b.score - a.score);

  for (const result of sorted) {
    if (seen.has(result.id)) continue;
    seen.add(result.id);

    chunks.push({
      filePath: result.filePath,
      content: result.content,
      language: result.language,
      startLine: result.startLine,
      endLine: result.endLine,
      type: result.type,
      name: result.name,
      score: result.score,
    });
  }

  return chunks;
}

/**
 * Select chunks up to token limit
 */
function selectByTokenLimit(
  chunks: ContextChunk[],
  maxTokens: number
): { selectedChunks: ContextChunk[]; totalTokens: number } {
  const selectedChunks: ContextChunk[] = [];
  let totalTokens = 0;

  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk.content);

    if (totalTokens + chunkTokens > maxTokens) {
      break;
    }

    selectedChunks.push(chunk);
    totalTokens += chunkTokens;
  }

  return { selectedChunks, totalTokens };
}

/**
 * Estimate token count for text
 */
function estimateTokens(text: string): number {
  // Rough approximation: ~4 characters per token for code
  return Math.ceil(text.length / 4);
}

/**
 * Format context chunks for LLM prompt
 */
export function formatContextForPrompt(chunks: ContextChunk[]): string {
  if (chunks.length === 0) {
    return "No relevant code context found.";
  }

  return chunks
    .map((chunk, i) => {
      const header = chunk.name
        ? `[${i + 1}] ${chunk.type} "${chunk.name}" in ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`
        : `[${i + 1}] ${chunk.type} in ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`;

      return `${header}\n\`\`\`${chunk.language}\n${chunk.content}\n\`\`\``;
    })
    .join("\n\n");
}

/**
 * Retrieve context across multiple repositories
 */
export async function retrieveMultiRepoContext(
  repositoryIds: string[],
  query: string,
  options: {
    maxChunks?: number;
    maxTokens?: number;
    scoreThreshold?: number;
  } = {}
): Promise<RetrievedContext> {
  const {
    maxChunks = REVIEW_CONFIG.maxContextChunks,
    maxTokens = REVIEW_CONFIG.maxContextTokens,
    scoreThreshold = REVIEW_CONFIG.minScoreThreshold,
  } = options;

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Search each repository
  const allResults: SearchResult[] = [];
  for (const repositoryId of repositoryIds) {
    const results = await searchChunks(
      repositoryId,
      queryEmbedding,
      Math.ceil(maxChunks / repositoryIds.length) * 2, // Get more for filtering
      scoreThreshold
    );
    allResults.push(...results);
  }

  // Convert and deduplicate results
  const chunks = deduplicateAndRank(allResults);

  // Limit by tokens
  const { selectedChunks, totalTokens } = selectByTokenLimit(chunks, maxTokens);

  // Limit by count
  const finalChunks = selectedChunks.slice(0, maxChunks);

  return {
    chunks: finalChunks,
    totalTokens,
  };
}
