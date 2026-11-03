import { GitHubService } from "./github";
import { generateChatResponse, type ChatMessage } from "./gemini";
import { logger } from "@/lib/logger";
import type { DocstringSuggestion } from "@/lib/prompts/review";
import { getLanguageFromPath } from "./chunker";
import { isTestFile } from "./test-files";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import type { File, Node } from "@babel/types";

interface LineRange {
  start: number;
  end: number;
}

function parseDiffHunkRanges(diff: string): Map<string, LineRange[]> {
  const rangesByFile = new Map<string, LineRange[]>();

  const blocks = diff.split(/^diff --git/m).slice(1);
  for (const block of blocks) {
    const fileMatch = block.match(/^\s*\+\+\+\s+b\/(.+)$/m);
    if (!fileMatch || !fileMatch[1]) continue;
    const filePath = fileMatch[1].trim();
    if (!filePath || filePath === "/dev/null") continue;

    const ranges: LineRange[] = [];
    const hunkRegex = /@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/g;
    let match: RegExpExecArray | null;
    while ((match = hunkRegex.exec(block)) !== null) {
      const start = Number(match[1]);
      const count = match[2] ? Number(match[2]) : 1;
      if (!Number.isFinite(start) || !Number.isFinite(count)) continue;
      if (count <= 0) continue;
      ranges.push({ start, end: start + count - 1 });
    }

    if (ranges.length > 0) {
      rangesByFile.set(filePath, ranges);
    }
  }

  return rangesByFile;
}

function isLineInRanges(line: number, ranges: LineRange[]): boolean {
  for (const r of ranges) {
    if (line >= r.start && line <= r.end) return true;
  }
  return false;
}

function hasJsDoc(lines: string[], startLine: number): boolean {
  let i = startLine - 2; // previous line (0-based)
  while (i >= 0 && lines[i] && lines[i]!.trim() === "") i -= 1;
  if (i < 0 || i >= lines.length) return false;
  const prev = lines[i]!.trim();
  if (!prev.endsWith("*/")) return false;

  // Look back a small window for the start of a JSDoc block
  for (let j = i; j >= 0 && i - j < 30; j -= 1) {
    const line = lines[j] || "";
    if (line.includes("/**")) return true;
    if (j !== i && line.includes("*/")) break;
  }

  return false;
}

function parseTypeScriptOrJavaScript(content: string): File | null {
  try {
    return parser.parse(content, {
      sourceType: "module",
      plugins: [
        "typescript",
        "jsx",
        "decorators-legacy",
        "classProperties",
        "objectRestSpread",
        "asyncGenerators",
        "dynamicImport",
        "optionalChaining",
        "nullishCoalescingOperator",
      ],
    });
  } catch (error) {
    logger.warn("[Docstrings] Failed to parse file for docstrings", {
      error,
    });
    return null;
  }
}

function nodeSnippet(params: {
  lines: string[];
  startLine: number;
  endLine?: number;
  maxLines?: number;
}): string {
  const { lines, startLine, endLine, maxLines = 80 } = params;
  const startIdx = Math.max(0, startLine - 1);
  const endIdx = Math.min(
    lines.length,
    (endLine ? Math.max(endLine, startLine) : startLine + maxLines) // 1-based lines
  );
  return lines.slice(startIdx, endIdx).join("\n");
}

function normalizeDocstring(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Strip code fences if present
  const fenceMatch = trimmed.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/);
  const withoutFences = fenceMatch?.[1]?.trim() || trimmed;

  if (withoutFences.startsWith("/**")) {
    const endIdx = withoutFences.lastIndexOf("*/");
    if (endIdx !== -1) {
      return withoutFences.slice(0, endIdx + 2).trim();
    }
    return withoutFences;
  }

  // Wrap a bare comment body into JSDoc
  const lines = withoutFences.split("\n").map((l) => l.trimEnd());
  const body = lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => ` * ${l}`)
    .join("\n");
  return ["/**", body || " * TODO: Document this.", " */"].join("\n");
}

function indentBlock(text: string, indent: string): string {
  return text
    .split("\n")
    .map((l) => (l.length > 0 ? indent + l : l))
    .join("\n");
}

async function generateJsDoc(params: {
  filePath: string;
  signatureLine: string;
  snippet: string;
}): Promise<string> {
  const systemPrompt =
    "You are a senior TypeScript/JavaScript engineer. Write a concise, accurate JSDoc block for the given function/class. " +
    "Return ONLY the JSDoc block comment (starting with /** and ending with */). Do not include code fences or any other text.";

  const userPrompt = [
    `File: ${params.filePath}`,
    "",
    "Signature line:",
    params.signatureLine,
    "",
    "Code snippet:",
    params.snippet,
  ].join("\n");

  const messages: ChatMessage[] = [{ role: "user", content: userPrompt }];
  const raw = await generateChatResponse(systemPrompt, messages, { temperature: 0.2 });
  return normalizeDocstring(raw);
}

export async function generateDocstringSuggestions(params: {
  owner: string;
  repo: string;
  accessToken: string;
  headSha: string | null;
  diff: string;
  maxSuggestions?: number;
}): Promise<{
  suggestions: DocstringSuggestion[];
  inlineComments: Array<{ path: string; line: number; body: string }>;
}> {
  const { owner, repo, accessToken, headSha, diff, maxSuggestions = 3 } = params;

  if (!headSha) {
    return { suggestions: [], inlineComments: [] };
  }

  const rangesByFile = parseDiffHunkRanges(diff);
  if (rangesByFile.size === 0) {
    return { suggestions: [], inlineComments: [] };
  }

  const github = new GitHubService(accessToken);
  const out: DocstringSuggestion[] = [];
  const comments: Array<{ path: string; line: number; body: string }> = [];

  // Application code first; tests and type declarations never need docstring suggestions
  const files = Array.from(rangesByFile.entries())
    .filter(([filePath]) => {
      const language = getLanguageFromPath(filePath);
      return (
        (language === "typescript" || language === "javascript") &&
        !isTestFile(filePath) &&
        !filePath.endsWith(".d.ts")
      );
    })
    .sort(([a], [b]) => filePriority(a) - filePriority(b))
    .slice(0, MAX_FILES_TO_SCAN);

  const candidates: DocstringCandidate[] = [];
  for (const [filePath, ranges] of files) {
    let content: string;
    try {
      content = await github.getFileContent(owner, repo, filePath, headSha);
    } catch {
      continue;
    }
    candidates.push(...findDocstringCandidates(filePath, content, ranges));
  }

  // Exported (public) definitions are the ones other people read and call
  const ranked = candidates
    .map((candidate, order) => ({ candidate, order }))
    .sort(
      (a, b) =>
        Number(b.candidate.exported) - Number(a.candidate.exported) ||
        filePriority(a.candidate.filePath) - filePriority(b.candidate.filePath) ||
        a.order - b.order
    )
    .map((r) => r.candidate);

  for (const candidate of ranked) {
    if (out.length >= maxSuggestions) break;
    const language = getLanguageFromPath(candidate.filePath) ?? "typescript";

    try {
      const docstring = await generateJsDoc({
        filePath: candidate.filePath,
        signatureLine: candidate.signatureLine,
        snippet: candidate.snippet,
      });
      if (!docstring) continue;

      const indent = (candidate.signatureLine.match(/^\s*/) || [""])[0] || "";
      const indentedDocstring = indentBlock(docstring, indent);
      const replacement = `${indentedDocstring}\n${candidate.signatureLine}`;

      const body =
        `📝 **Docstring suggestion**\n\n` +
        "```suggestion\n" +
        replacement +
        "\n```";

      out.push({
        path: candidate.filePath,
        line: candidate.startLine,
        language,
        docstring: indentedDocstring,
        signatureLine: candidate.signatureLine,
      });
      comments.push({ path: candidate.filePath, line: candidate.startLine, body });
    } catch (error) {
      logger.warn("[Docstrings] Failed to generate docstring", {
        filePath: candidate.filePath,
        error,
      });
    }
  }

  return { suggestions: out, inlineComments: comments };
}

const MAX_FILES_TO_SCAN = 10;

interface DocstringCandidate {
  filePath: string;
  startLine: number;
  endLine?: number;
  signatureLine: string;
  snippet: string;
  exported: boolean;
}

/** Lower is better: application code, then other code, then scripts/examples */
function filePriority(filePath: string): number {
  if (/(^|\/)(scripts?|examples?|tools)\//.test(filePath)) return 2;
  if (/(^|\/)(src|lib|app|packages)\//.test(filePath)) return 0;
  return 1;
}

/**
 * Top-level functions/classes (plain or exported) on changed lines that have no JSDoc yet.
 * Helpers nested inside other functions are skipped: they are implementation details.
 */
export function findDocstringCandidates(
  filePath: string,
  content: string,
  ranges: LineRange[]
): DocstringCandidate[] {
  const ast = parseTypeScriptOrJavaScript(content);
  if (!ast) return [];

  const lines = content.split("\n");
  const seen = new Set<number>();
  const candidates: DocstringCandidate[] = [];

  const addCandidate = (node: Node, exported: boolean) => {
    const loc = (node as { loc?: { start: { line: number }; end: { line: number } } }).loc;
    if (!loc) return;
    const startLine = loc.start.line;
    if (seen.has(startLine) || !isLineInRanges(startLine, ranges) || hasJsDoc(lines, startLine)) return;
    seen.add(startLine);

    candidates.push({
      filePath,
      startLine,
      endLine: loc.end.line,
      signatureLine: lines[startLine - 1] || "",
      snippet: nodeSnippet({ lines, startLine, endLine: loc.end.line, maxLines: 80 }),
      exported,
    });
  };

  /** "program" for top-level, "export" for exported top-level, null for nested */
  const placement = (parentType: string | undefined): "program" | "export" | null => {
    if (parentType === "Program") return "program";
    if (parentType === "ExportNamedDeclaration" || parentType === "ExportDefaultDeclaration") return "export";
    return null;
  };

  traverse(ast, {
    FunctionDeclaration(path) {
      const where = placement(path.parent.type);
      if (where) addCandidate(path.node, where === "export");
    },
    ClassDeclaration(path) {
      const where = placement(path.parent.type);
      if (where) addCandidate(path.node, where === "export");
    },
    VariableDeclarator(path) {
      const init = path.node.init;
      if (!init || (init.type !== "ArrowFunctionExpression" && init.type !== "FunctionExpression")) return;
      const where = placement(path.parentPath.parent?.type);
      if (where) addCandidate(path.node, where === "export");
    },
  });

  return candidates;
}
