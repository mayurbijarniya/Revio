/**
 * Local stand-in for Revio's Qdrant vector search, used by the evaluation's --semantic option.
 *
 * Production searches the whole indexed repository. To keep evaluation cost bounded, this
 * searches the changed files and their graph neighbours (importers and imported files), using
 * the same chunker, embedding text, queries, per-query limit and score threshold as production.
 */
import type { CodeGraphData } from "@/lib/services/code-graph";
import { findDependentFiles } from "@/lib/services/code-graph";
import type { DiffFile } from "@/lib/services/diff-parser";
import { chunkCode, getLanguageFromPath } from "@/lib/services/chunker";
import { embedCodeChunks, generateEmbedding } from "@/lib/services/embeddings";
import { formatContextForPrompt, type ContextChunk } from "@/lib/services/retriever";
import { REVIEW_CONFIG } from "@/lib/constants";

const MAX_CANDIDATE_FILES = 40;
const MAX_CHUNKS = 400;
const CHUNKS_PER_QUERY = 3;

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

function neighbourFiles(graph: CodeGraphData, changedPaths: string[]): string[] {
  const result = new Set<string>(changedPaths);
  for (const file of changedPaths) {
    for (const dependent of findDependentFiles(graph, `file:${file}`)) result.add(dependent.file);

    // Files this file imports: file -> import node -> file
    const importIds = graph.edges
      .filter((e) => e.type === "imports" && e.from === `file:${file}` && e.to.startsWith("import:"))
      .map((e) => e.to);
    for (const edge of graph.edges) {
      if (edge.type === "imports" && importIds.includes(edge.from) && edge.to.startsWith("file:")) {
        result.add(edge.to.substring(5));
      }
    }
  }
  return Array.from(result).slice(0, MAX_CANDIDATE_FILES);
}

export async function buildLocalSemanticContext(params: {
  files: DiffFile[];
  graph: CodeGraphData | null;
  /** Base-branch content by repository path */
  repoContent: Map<string, string>;
}): Promise<string | null> {
  const { files, graph, repoContent } = params;
  const changedPaths = files.map((f) => f.oldPath);
  const candidates = graph ? neighbourFiles(graph, changedPaths) : changedPaths;

  const chunks = candidates
    .flatMap((filePath) => {
      const content = repoContent.get(filePath);
      const language = getLanguageFromPath(filePath);
      return content && language ? chunkCode("eval", filePath, content, language) : [];
    })
    .slice(0, MAX_CHUNKS);
  if (chunks.length === 0) return null;

  const embedded = await embedCodeChunks(chunks);

  // Same queries as the production reviewer
  const queries = files.slice(0, 10).map((file) => `File changes in ${file.path}: ${file.additions.slice(0, 500)}`);

  const selected = new Map<string, ContextChunk>();
  for (const query of queries) {
    const queryEmbedding = await generateEmbedding(query);
    const ranked = embedded
      .map((chunk) => ({ chunk, score: cosine(queryEmbedding, chunk.embedding) }))
      .filter((r) => r.score >= REVIEW_CONFIG.minScoreThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, CHUNKS_PER_QUERY);

    for (const { chunk, score } of ranked) {
      if (selected.has(chunk.id) || selected.size >= REVIEW_CONFIG.maxContextChunks) continue;
      selected.set(chunk.id, {
        filePath: chunk.filePath,
        content: chunk.content,
        language: chunk.language,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        type: chunk.type,
        name: chunk.name ?? null,
        score,
      });
    }
  }

  return formatContextForPrompt(Array.from(selected.values()));
}
