/**
 * Unified diff parsing shared by the PR review pipeline.
 * Tracks real line numbers on both sides so every downstream step
 * (graph impact, security scan, inline comments) works on the same facts.
 */

export interface DiffLine {
  line: number;
  text: string;
}

export interface DiffFile {
  /** Path in the PR head (new path for renames) */
  path: string;
  /** Path in the base branch (old path for renames, same as path otherwise) */
  oldPath: string;
  status: "added" | "deleted" | "modified" | "renamed";
  /** Added lines joined with "\n" (kept for prompt/query building) */
  additions: string;
  /** Removed lines joined with "\n" */
  deletions: string;
  addedCount: number;
  deletedCount: number;
  /** Added lines with their line number in the new file */
  addedLines: DiffLine[];
  /** Base-branch line numbers touched by the change (removed lines + insertion points) */
  changedOldLines: number[];
  /** Head (PR) line numbers touched by the change (added lines + where lines were removed) */
  changedNewLines: number[];
  /** New-file line numbers GitHub accepts review comments on (added + context lines) */
  commentableLines: Set<number>;
  /** Raw diff block for this file, starting with "diff --git" */
  raw: string;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function stripPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function parseHeaderPaths(header: string): { oldPath: string; newPath: string } | null {
  const match = header.match(/^diff --git a\/(.+?) b\/(.+)$/);
  if (!match?.[1] || !match[2]) return null;
  return { oldPath: match[1], newPath: match[2] };
}

function parseFileBlock(raw: string): DiffFile | null {
  const lines = raw.split("\n");
  const headerPaths = parseHeaderPaths(lines[0] ?? "");

  let oldPath = headerPaths?.oldPath ?? "";
  let newPath = headerPaths?.newPath ?? "";
  let isNew = false;
  let isDeleted = false;
  let isRename = false;

  const addedLines: DiffLine[] = [];
  const deletedTexts: string[] = [];
  const changedOld = new Set<number>();
  const changedNew = new Set<number>();
  const commentableLines = new Set<number>();

  let inHunk = false;
  let oldLine = 0;
  let newLine = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const hunk = line.match(HUNK_HEADER);

    if (hunk) {
      inHunk = true;
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[3]);
      continue;
    }

    if (!inHunk) {
      if (line.startsWith("--- ")) {
        const value = line.slice(4).trim();
        if (value === "/dev/null") isNew = true;
        else oldPath = stripPrefix(value, "a/");
      } else if (line.startsWith("+++ ")) {
        const value = line.slice(4).trim();
        if (value === "/dev/null") isDeleted = true;
        else newPath = stripPrefix(value, "b/");
      } else if (line.startsWith("new file mode")) {
        isNew = true;
      } else if (line.startsWith("deleted file mode")) {
        isDeleted = true;
      } else if (line.startsWith("rename from ")) {
        isRename = true;
        oldPath = line.slice("rename from ".length).trim();
      } else if (line.startsWith("rename to ")) {
        isRename = true;
        newPath = line.slice("rename to ".length).trim();
      }
      continue;
    }

    if (line.startsWith("+")) {
      addedLines.push({ line: newLine, text: line.slice(1) });
      commentableLines.add(newLine);
      // An insertion sits between oldLine - 1 and oldLine in the base file
      if (oldLine > 1) changedOld.add(oldLine - 1);
      changedOld.add(oldLine);
      changedNew.add(newLine);
      newLine++;
    } else if (line.startsWith("-")) {
      deletedTexts.push(line.slice(1));
      changedOld.add(oldLine);
      // A removal sits between newLine - 1 and newLine in the head file
      if (newLine > 1) changedNew.add(newLine - 1);
      changedNew.add(newLine);
      oldLine++;
    } else if (line.startsWith(" ")) {
      commentableLines.add(newLine);
      oldLine++;
      newLine++;
    } else if (line.startsWith("\\")) {
      // "\ No newline at end of file"
      continue;
    } else if (line === "") {
      continue;
    }
  }

  const path = isDeleted ? oldPath || newPath : newPath || oldPath;
  if (!path) return null;

  return {
    path,
    oldPath: oldPath || path,
    status: isNew ? "added" : isDeleted ? "deleted" : isRename ? "renamed" : "modified",
    additions: addedLines.map((l) => l.text).join("\n"),
    deletions: deletedTexts.join("\n"),
    addedCount: addedLines.length,
    deletedCount: deletedTexts.length,
    addedLines,
    changedOldLines: isNew ? [] : Array.from(changedOld).sort((a, b) => a - b),
    changedNewLines: isDeleted ? [] : Array.from(changedNew).sort((a, b) => a - b),
    commentableLines,
    raw,
  };
}

/**
 * Split a unified diff into per-file blocks
 */
function splitDiffBlocks(diff: string): string[] {
  return diff
    .split(/^(?=diff --git )/m)
    .filter((block) => block.startsWith("diff --git "));
}

export function parseUnifiedDiff(diff: string): DiffFile[] {
  return splitDiffBlocks(diff)
    .map((block) => parseFileBlock(block))
    .filter((file): file is DiffFile => file !== null);
}

/**
 * Render a file block with new-file line numbers so the model can cite exact lines.
 * Added/context lines get the new line number; removed lines get "-".
 */
function annotateFileBlock(raw: string): string {
  const lines = raw.split("\n");
  const out: string[] = [];
  let inHunk = false;
  let newLine = 0;

  for (const line of lines) {
    const hunk = line.match(HUNK_HEADER);
    if (hunk) {
      inHunk = true;
      newLine = Number(hunk[3]);
      out.push(line);
      continue;
    }

    if (!inHunk || line.startsWith("\\")) {
      out.push(line);
      continue;
    }

    if (line.startsWith("+")) {
      out.push(`+${String(newLine).padStart(5)} | ${line.slice(1)}`);
      newLine++;
    } else if (line.startsWith("-")) {
      out.push(`-${"".padStart(5)} | ${line.slice(1)}`);
    } else if (line.startsWith(" ")) {
      out.push(` ${String(newLine).padStart(5)} | ${line.slice(1)}`);
      newLine++;
    } else {
      out.push(line);
    }
  }

  return out.join("\n");
}

/**
 * Build the diff text sent to the model: only the given files, annotated with line
 * numbers, cut at file boundaries so no file is sent half-way.
 */
export function buildPromptDiff(
  files: DiffFile[],
  maxBytes: number
): { text: string; includedFiles: string[]; omittedFiles: string[] } {
  const parts: string[] = [];
  const includedFiles: string[] = [];
  const omittedFiles: string[] = [];
  let size = 0;

  for (const file of files) {
    const annotated = annotateFileBlock(file.raw);
    if (size + annotated.length > maxBytes && includedFiles.length > 0) {
      omittedFiles.push(file.path);
      continue;
    }
    // Always include at least the first file, truncated if it alone is too large
    const chunk = annotated.length > maxBytes ? `${annotated.slice(0, maxBytes)}\n[... file truncated ...]` : annotated;
    parts.push(chunk);
    includedFiles.push(file.path);
    size += chunk.length;
  }

  let text = parts.join("\n");
  if (omittedFiles.length > 0) {
    text += `\n[Diff truncated: ${omittedFiles.length} more file(s) not shown: ${omittedFiles.slice(0, 20).join(", ")}]`;
  }

  return { text, includedFiles, omittedFiles };
}

/**
 * Map of base-branch path -> changed line numbers, for graph impact analysis
 */
export function getChangedOldLinesByPath(files: DiffFile[]): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const file of files) {
    if (file.status === "added") continue;
    result[file.oldPath] = file.changedOldLines;
  }
  return result;
}

/**
 * Convert an ignored-path glob to a RegExp. "*" matches any characters
 * (including "/"), "?" matches one character; everything else is literal.
 */
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*+/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

export function matchesIgnoredPath(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const trimmed = pattern.trim();
    if (!trimmed) return false;
    // "docs/" covers the whole directory
    const normalized = trimmed.endsWith("/") ? `${trimmed}*` : trimmed;
    return globToRegExp(normalized).test(path);
  });
}
