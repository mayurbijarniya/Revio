/**
 * PR-aware code graph: the indexed base-branch graph with the PR's changed files
 * re-parsed at the PR head, so new and edited functions have real graph data.
 */
import type { CodeGraphData } from "./code-graph";
import { overlayFilesOnGraph } from "./code-graph";
import type { DiffFile } from "./diff-parser";
import { getLanguageFromPath } from "./chunker";

const MAX_OVERLAY_FILES = 40;
const MAX_FILE_CHARS = 300_000;
const FETCH_CONCURRENCY = 5;
const JS_TS_EXTENSION = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

export interface PrGraphScope {
  graph: CodeGraphData;
  /** Graph paths of the changed files (head path when re-parsed, base path otherwise) */
  changedFiles: string[];
  /** Changed line numbers per graph path, in the coordinates of that file's graph nodes */
  changedLinesByFile: Record<string, number[]>;
  /** Definitions the PR removed; their existing callers are impacted */
  extraChangedNodeIds: string[];
  /** Graph paths of changed files where existing lines were modified or removed */
  filesWithRemovals: string[];
  /** Number of changed files re-parsed at the PR head */
  headParsedFiles: number;
}

/**
 * Scope that uses the base-branch graph only (base line numbers, base paths)
 */
export function baseGraphScope(graph: CodeGraphData, files: DiffFile[]): PrGraphScope {
  const changedLinesByFile: Record<string, number[]> = {};
  for (const file of files) {
    if (file.status !== "added") changedLinesByFile[file.oldPath] = file.changedOldLines;
  }
  return {
    graph,
    changedFiles: files.map((f) => f.oldPath),
    changedLinesByFile,
    extraChangedNodeIds: [],
    filesWithRemovals: files.filter((f) => f.deletedCount > 0).map((f) => f.oldPath),
    headParsedFiles: 0,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function buildPrGraphScope(params: {
  baseGraph: CodeGraphData;
  files: DiffFile[];
  /** Load a file's content at the PR head; resolve null when unavailable */
  loadHeadFile: (path: string) => Promise<string | null>;
}): Promise<PrGraphScope> {
  const { baseGraph, files, loadHeadFile } = params;

  const candidates = files
    .filter((f) => f.status !== "deleted" && getLanguageFromPath(f.path) !== null)
    .slice(0, MAX_OVERLAY_FILES);
  if (candidates.length === 0) return baseGraphScope(baseGraph, files);

  const contents = await mapWithConcurrency(candidates, FETCH_CONCURRENCY, (f) => loadHeadFile(f.path));

  const headFiles: Array<{ path: string; content: string; language: string }> = [];
  const overlaid = new Map<string, DiffFile>();
  candidates.forEach((file, index) => {
    const content = contents[index];
    const language = getLanguageFromPath(file.path);
    if (content === null || content === undefined || content.length > MAX_FILE_CHARS || !language) return;
    headFiles.push({ path: file.path, content, language });
    overlaid.set(file.path, file);
  });
  if (headFiles.length === 0) return baseGraphScope(baseGraph, files);

  // tsconfig/jsconfig paths at the PR head resolve aliases such as "@/lib/x" in new files
  const configFiles: Array<{ path: string; content: string }> = [];
  if (headFiles.some((f) => JS_TS_EXTENSION.test(f.path))) {
    for (const path of ["tsconfig.json", "jsconfig.json"]) {
      const content = await loadHeadFile(path);
      if (content) configFiles.push({ path, content });
    }
  }

  const { graph, removedNodeIds } = overlayFilesOnGraph({
    baseGraph,
    headFiles,
    replacedPaths: Array.from(overlaid.values()).map((f) => f.oldPath),
    configFiles,
  });

  const changedLinesByFile: Record<string, number[]> = {};
  const changedFiles: string[] = [];
  for (const file of files) {
    if (overlaid.has(file.path)) {
      changedFiles.push(file.path);
      changedLinesByFile[file.path] = file.changedNewLines;
    } else {
      changedFiles.push(file.oldPath);
      if (file.status !== "added") changedLinesByFile[file.oldPath] = file.changedOldLines;
    }
  }

  return {
    graph,
    changedFiles,
    changedLinesByFile,
    extraChangedNodeIds: removedNodeIds,
    filesWithRemovals: files
      .filter((f) => f.deletedCount > 0)
      .map((f) => (overlaid.has(f.path) ? f.path : f.oldPath)),
    headParsedFiles: headFiles.length,
  };
}
