import { generateEmbedding } from "./embeddings";
import { searchChunks, type SearchResult } from "./qdrant";
import { REVIEW_CONFIG } from "@/lib/constants";
import { db } from "@/lib/db";

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

/**
 * Hybrid search: combines vector search with keyword matching
 * Keywords boost scores for exact matches
 */
export async function hybridSearch(
  repositoryId: string,
  query: string,
  options: {
    maxChunks?: number;
    maxTokens?: number;
    scoreThreshold?: number;
    keywordBoost?: number;
  } = {}
): Promise<RetrievedContext> {
  const {
    maxChunks = REVIEW_CONFIG.maxContextChunks,
    maxTokens = REVIEW_CONFIG.maxContextTokens,
    scoreThreshold = REVIEW_CONFIG.minScoreThreshold,
    keywordBoost = 0.2, // How much to boost for keyword matches
  } = options;

  // Extract keywords from query
  const keywords = extractKeywords(query);

  // Get vector search results
  const queryEmbedding = await generateEmbedding(query);
  const vectorResults = await searchChunks(
    repositoryId,
    queryEmbedding,
    maxChunks * 3, // Get more for re-ranking
    scoreThreshold * 0.5 // Lower threshold for hybrid
  );

  // Apply keyword boosting
  const boostedResults = vectorResults.map((result) => {
    let boost = 0;

    // Check for keyword matches in content
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      const contentLower = result.content.toLowerCase();
      const filePathLower = result.filePath.toLowerCase();
      const nameLower = (result.name || "").toLowerCase();

      // Exact match in content
      if (contentLower.includes(keywordLower)) {
        boost += keywordBoost;
      }

      // Match in file path (higher boost)
      if (filePathLower.includes(keywordLower)) {
        boost += keywordBoost * 1.5;
      }

      // Match in function/class name (highest boost)
      if (nameLower.includes(keywordLower)) {
        boost += keywordBoost * 2;
      }
    }

    return {
      ...result,
      score: Math.min(1, result.score + boost), // Cap at 1.0
    };
  });

  // Re-sort by boosted score
  boostedResults.sort((a, b) => b.score - a.score);

  // Filter by new threshold
  const filtered = boostedResults.filter((r) => r.score >= scoreThreshold);

  // Convert and deduplicate
  const chunks = deduplicateAndRank(filtered);

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
 * Extract meaningful keywords from a query
 */
function extractKeywords(query: string): string[] {
  // Common stop words to ignore
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "dare",
    "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
    "from", "up", "about", "into", "over", "after", "beneath", "under",
    "above", "and", "or", "but", "if", "because", "as", "until", "while",
    "although", "though", "unless", "since", "when", "where", "how", "what",
    "which", "who", "whom", "whose", "why", "this", "that", "these", "those",
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you",
    "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself",
    "she", "her", "hers", "herself", "it", "its", "itself", "they", "them",
    "their", "theirs", "themselves", "code", "function", "file", "class",
  ]);

  // Extract words
  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  // Also extract camelCase and snake_case identifiers
  const identifierPattern = /[a-zA-Z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)*/g;
  const identifiers = query.match(identifierPattern) || [];

  // Combine and deduplicate
  const allKeywords = new Set([...words, ...identifiers.map((id) => id.toLowerCase())]);

  return Array.from(allKeywords).slice(0, 10); // Limit to 10 keywords
}

/**
 * Search for code by file path pattern
 */
export async function searchByFilePath(
  repositoryId: string,
  pattern: string,
  options: {
    maxResults?: number;
  } = {}
): Promise<Array<{ filePath: string; language: string | null; chunkCount: number }>> {
  const { maxResults = 20 } = options;

  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, "\\.")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");

  const files = await db.indexedFile.findMany({
    where: {
      repositoryId,
      filePath: {
        contains: pattern.replace(/[*?]/g, ""),
      },
    },
    select: {
      filePath: true,
      language: true,
      chunkCount: true,
    },
    take: maxResults * 2,
  });

  // Filter by regex pattern
  const regex = new RegExp(regexPattern, "i");
  const filtered = files.filter((f) => regex.test(f.filePath));

  return filtered.slice(0, maxResults);
}

/**
 * Search for code by function/class name
 */
export async function searchByName(
  repositoryId: string,
  name: string,
  options: {
    maxChunks?: number;
    scoreThreshold?: number;
  } = {}
): Promise<RetrievedContext> {
  const {
    maxChunks = 10,
    scoreThreshold = 0.1,
  } = options;

  // Build a specific query for function/class search
  const query = `function ${name} class ${name} method ${name} definition implementation`;

  // Use hybrid search with high keyword boost for name matching
  return hybridSearch(repositoryId, query, {
    maxChunks,
    scoreThreshold,
    keywordBoost: 0.4, // Higher boost for name searches
  });
}

/**
 * Ranking configuration for search results
 */
interface RankingConfig {
  similarityWeight: number;
  keywordWeight: number;
  typeWeight: number;
  diversityPenalty: number;
  maxResultsPerFile: number;
}

const DEFAULT_RANKING_CONFIG: RankingConfig = {
  similarityWeight: 0.6,
  keywordWeight: 0.25,
  typeWeight: 0.15,
  diversityPenalty: 0.1,
  maxResultsPerFile: 3,
};

/**
 * Code entity type weights for ranking
 * Higher weights for more important code structures
 */
const TYPE_WEIGHTS: Record<string, number> = {
  class: 1.0,
  interface: 0.95,
  function: 0.9,
  method: 0.85,
  type: 0.8,
  enum: 0.75,
  constant: 0.7,
  variable: 0.5,
  import: 0.3,
  comment: 0.2,
  unknown: 0.4,
};

/**
 * File importance weights based on common patterns
 */
const FILE_IMPORTANCE_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /index\.(ts|js|tsx|jsx)$/, weight: 1.2 }, // Entry points
  { pattern: /main\.(ts|js|tsx|jsx)$/, weight: 1.2 },
  { pattern: /app\.(ts|js|tsx|jsx)$/, weight: 1.15 },
  { pattern: /route\.(ts|js)$/, weight: 1.1 }, // API routes
  { pattern: /page\.(ts|js|tsx|jsx)$/, weight: 1.1 }, // Pages
  { pattern: /layout\.(ts|js|tsx|jsx)$/, weight: 1.05 },
  { pattern: /\.test\.(ts|js|tsx|jsx)$/, weight: 0.7 }, // Tests (lower priority)
  { pattern: /\.spec\.(ts|js|tsx|jsx)$/, weight: 0.7 },
  { pattern: /\.d\.ts$/, weight: 0.6 }, // Type definitions
  { pattern: /\.config\.(ts|js)$/, weight: 0.8 }, // Config files
];

/**
 * Calculate file importance weight based on file path
 */
function getFileImportanceWeight(filePath: string): number {
  for (const { pattern, weight } of FILE_IMPORTANCE_PATTERNS) {
    if (pattern.test(filePath)) {
      return weight;
    }
  }
  return 1.0; // Default weight
}

/**
 * Advanced search with multi-factor ranking
 */
export async function rankedSearch(
  repositoryId: string,
  query: string,
  options: {
    maxChunks?: number;
    maxTokens?: number;
    scoreThreshold?: number;
    rankingConfig?: Partial<RankingConfig>;
  } = {}
): Promise<RetrievedContext> {
  const {
    maxChunks = REVIEW_CONFIG.maxContextChunks,
    maxTokens = REVIEW_CONFIG.maxContextTokens,
    scoreThreshold = REVIEW_CONFIG.minScoreThreshold,
    rankingConfig = {},
  } = options;

  const config = { ...DEFAULT_RANKING_CONFIG, ...rankingConfig };

  // Extract keywords for keyword matching
  const keywords = extractKeywords(query);

  // Get vector search results
  const queryEmbedding = await generateEmbedding(query);
  const vectorResults = await searchChunks(
    repositoryId,
    queryEmbedding,
    maxChunks * 4, // Get more results for re-ranking
    scoreThreshold * 0.3 // Lower initial threshold
  );

  // Calculate multi-factor scores
  const scoredResults = vectorResults.map((result) => {
    // 1. Similarity score (normalized)
    const similarityScore = result.score;

    // 2. Keyword match score
    let keywordScore = 0;
    const contentLower = result.content.toLowerCase();
    const filePathLower = result.filePath.toLowerCase();
    const nameLower = (result.name || "").toLowerCase();

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      if (contentLower.includes(keywordLower)) keywordScore += 0.2;
      if (filePathLower.includes(keywordLower)) keywordScore += 0.3;
      if (nameLower.includes(keywordLower)) keywordScore += 0.5;
    }
    keywordScore = Math.min(1, keywordScore); // Cap at 1.0

    // 3. Type weight
    const typeScore = TYPE_WEIGHTS[result.type] ?? TYPE_WEIGHTS.unknown ?? 0.4;

    // 4. File importance
    const fileImportance = getFileImportanceWeight(result.filePath);

    // Calculate combined score
    const combinedScore =
      (config.similarityWeight * similarityScore +
        config.keywordWeight * keywordScore +
        config.typeWeight * (typeScore ?? 0.4)) *
      fileImportance;

    return {
      ...result,
      combinedScore,
      factors: {
        similarity: similarityScore,
        keyword: keywordScore,
        type: typeScore,
        fileImportance,
      },
    };
  });

  // Sort by combined score
  scoredResults.sort((a, b) => b.combinedScore - a.combinedScore);

  // Apply diversity: limit results per file
  const fileResultCounts: Record<string, number> = {};
  const diverseResults = scoredResults.filter((result) => {
    const count = fileResultCounts[result.filePath] || 0;
    if (count >= config.maxResultsPerFile) {
      return false;
    }
    fileResultCounts[result.filePath] = count + 1;
    return true;
  });

  // Apply diversity penalty for results from same file
  const finalResults = diverseResults.map((result) => {
    const sameFileCount = fileResultCounts[result.filePath] || 1;
    const diversityPenalty =
      sameFileCount > 1 ? config.diversityPenalty * (sameFileCount - 1) : 0;

    return {
      ...result,
      score: Math.max(0, result.combinedScore - diversityPenalty),
    };
  });

  // Re-sort after diversity penalty
  finalResults.sort((a, b) => b.score - a.score);

  // Filter by threshold and convert
  const filtered = finalResults.filter((r) => r.score >= scoreThreshold);
  const chunks = deduplicateAndRank(filtered);

  // Limit by tokens
  const { selectedChunks, totalTokens } = selectByTokenLimit(chunks, maxTokens);

  // Limit by count
  const limitedChunks = selectedChunks.slice(0, maxChunks);

  return {
    chunks: limitedChunks,
    totalTokens,
  };
}

/**
 * Search with result grouping by file
 */
export async function groupedSearch(
  repositoryId: string,
  query: string,
  options: {
    maxFiles?: number;
    maxChunksPerFile?: number;
    maxTokens?: number;
    scoreThreshold?: number;
  } = {}
): Promise<{
  groups: Array<{
    filePath: string;
    language: string;
    chunks: ContextChunk[];
    totalScore: number;
  }>;
  totalTokens: number;
}> {
  const {
    maxFiles = 10,
    maxChunksPerFile = 3,
    maxTokens = REVIEW_CONFIG.maxContextTokens,
    scoreThreshold = REVIEW_CONFIG.minScoreThreshold,
  } = options;

  // Get ranked results
  const results = await rankedSearch(repositoryId, query, {
    maxChunks: maxFiles * maxChunksPerFile * 2,
    maxTokens,
    scoreThreshold,
    rankingConfig: {
      maxResultsPerFile: maxChunksPerFile,
    },
  });

  // Group by file
  const fileGroups: Record<
    string,
    {
      filePath: string;
      language: string;
      chunks: ContextChunk[];
      totalScore: number;
    }
  > = {};

  for (const chunk of results.chunks) {
    let group = fileGroups[chunk.filePath];
    if (!group) {
      group = {
        filePath: chunk.filePath,
        language: chunk.language,
        chunks: [],
        totalScore: 0,
      };
      fileGroups[chunk.filePath] = group;
    }

    group.chunks.push(chunk);
    group.totalScore += chunk.score;
  }

  // Sort groups by total score
  const sortedGroups = Object.values(fileGroups)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, maxFiles);

  // Sort chunks within each group by line number
  for (const group of sortedGroups) {
    group.chunks.sort((a, b) => a.startLine - b.startLine);
  }

  return {
    groups: sortedGroups,
    totalTokens: results.totalTokens,
  };
}

/**
 * Format grouped search results for prompt
 */
export function formatGroupedContextForPrompt(
  groups: Array<{
    filePath: string;
    language: string;
    chunks: ContextChunk[];
  }>
): string {
  if (groups.length === 0) {
    return "No relevant code context found.";
  }

  return groups
    .map((group, fileIndex) => {
      const fileHeader = `## [${fileIndex + 1}] ${group.filePath}\n`;

      const chunksContent = group.chunks
        .map((chunk) => {
          const chunkHeader = chunk.name
            ? `### ${chunk.type} "${chunk.name}" (lines ${chunk.startLine}-${chunk.endLine})`
            : `### ${chunk.type} (lines ${chunk.startLine}-${chunk.endLine})`;

          return `${chunkHeader}\n\`\`\`${chunk.language}\n${chunk.content}\n\`\`\``;
        })
        .join("\n\n");

      return fileHeader + chunksContent;
    })
    .join("\n\n---\n\n");
}
