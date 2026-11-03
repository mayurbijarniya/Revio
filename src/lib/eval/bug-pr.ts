/**
 * Evaluation helpers: turn a benchmark bug fix into a "bug-introducing PR" and score reviews.
 *
 * Method: the fixed version is the PR base and the buggy version is the PR head, so the PR
 * introduces exactly the known bug. The lines the fix touched are the answer key.
 */
import { parseUnifiedDiff } from "@/lib/services/diff-parser";
import { isTestFile } from "@/lib/services/test-files";
import type { ReviewIssue, ReviewResult } from "@/lib/prompts/review";

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

function swapPathPrefix(value: string, from: "a/" | "b/", to: "a/" | "b/"): string {
  return value.startsWith(from) ? `${to}${value.slice(from.length)}` : value;
}

/**
 * Reverse a unified diff (old <-> new). Hunk bodies are tracked by their line counts, so
 * content lines that happen to start with "---" or "+++" are never mistaken for headers.
 */
export function reverseUnifiedDiff(diff: string): string {
  const lines = diff.split("\n");
  const out: string[] = [];
  let oldRemaining = 0;
  let newRemaining = 0;
  let pendingMinus: string | null = null;

  for (const line of lines) {
    const inHunk = oldRemaining > 0 || newRemaining > 0;

    if (inHunk) {
      if (line.startsWith("\\")) {
        out.push(line);
      } else if (line.startsWith("+")) {
        out.push(`-${line.slice(1)}`);
        newRemaining--;
      } else if (line.startsWith("-")) {
        out.push(`+${line.slice(1)}`);
        oldRemaining--;
      } else {
        // Context line (or an empty line standing for an empty context line)
        out.push(line);
        oldRemaining--;
        newRemaining--;
      }
      continue;
    }

    const hunk = line.match(HUNK_HEADER);
    if (hunk) {
      const [, oldStart, oldCount, newStart, newCount, rest] = hunk;
      oldRemaining = oldCount === undefined ? 1 : Number(oldCount);
      newRemaining = newCount === undefined ? 1 : Number(newCount);
      const oldPart = oldCount === undefined ? `${oldStart}` : `${oldStart},${oldCount}`;
      const newPart = newCount === undefined ? `${newStart}` : `${newStart},${newCount}`;
      out.push(`@@ -${newPart} +${oldPart} @@${rest ?? ""}`);
      continue;
    }

    if (line.startsWith("diff --git ")) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      out.push(match ? `diff --git a/${match[2]} b/${match[1]}` : line);
    } else if (line.startsWith("--- ")) {
      // Swapped with the following "+++" line
      pendingMinus = line.slice(4);
    } else if (line.startsWith("+++ ") && pendingMinus !== null) {
      const newValue = line.slice(4);
      out.push(`--- ${swapPathPrefix(newValue, "b/", "a/")}`);
      out.push(`+++ ${swapPathPrefix(pendingMinus, "a/", "b/")}`);
      pendingMinus = null;
    } else if (line.startsWith("new file mode")) {
      out.push(line.replace("new file mode", "deleted file mode"));
    } else if (line.startsWith("deleted file mode")) {
      out.push(line.replace("deleted file mode", "new file mode"));
    } else if (line.startsWith("rename from ")) {
      out.push(`rename to ${line.slice("rename from ".length)}`);
    } else if (line.startsWith("rename to ")) {
      out.push(`rename from ${line.slice("rename to ".length)}`);
    } else if (line.startsWith("index ")) {
      const match = line.match(/^index ([0-9a-f]+)\.\.([0-9a-f]+)(.*)$/);
      out.push(match ? `index ${match[2]}..${match[1]}${match[3] ?? ""}` : line);
    } else {
      out.push(line);
    }
  }

  return out.join("\n");
}

/**
 * Remove file blocks for test files. Benchmark fixes usually add a failing test; leaving it in
 * the PR would hand the reviewer the answer.
 */
export function stripTestFiles(diff: string): string {
  return diff
    .split(/^(?=diff --git )/m)
    .filter((block) => {
      if (!block.startsWith("diff --git ")) return block.trim().length > 0;
      const match = block.match(/^diff --git a\/(.+?) b\/(.+)$/m);
      const paths = match ? [match[1] ?? "", match[2] ?? ""] : [];
      return !paths.some((p) => p && isTestFile(p));
    })
    .join("");
}

export interface AnswerKeyEntry {
  file: string;
  /** Lines in the PR head (buggy version) where the bug is */
  lines: number[];
}

/**
 * Bug locations in the PR head: lines the PR added, plus where it removed lines
 */
export function buildAnswerKey(prDiff: string): AnswerKeyEntry[] {
  return parseUnifiedDiff(prDiff)
    .filter((file) => file.status !== "deleted" && file.changedNewLines.length > 0)
    .map((file) => ({ file: file.path, lines: file.changedNewLines }));
}

export interface PrStats {
  files: number;
  changedLines: number;
}

export function getPrStats(prDiff: string): PrStats {
  const files = parseUnifiedDiff(prDiff);
  return {
    files: files.length,
    changedLines: files.reduce((sum, f) => sum + f.addedCount + f.deletedCount, 0),
  };
}

export interface BugScore {
  /** At least one reported issue points at the bug */
  caught: boolean;
  /** At least one critical/warning issue points at the bug */
  caughtBlocking: boolean;
  totalIssues: number;
  matchedIssues: number;
  /** Issues pointing elsewhere: false-positive candidates (spot-check before calling them false) */
  unmatchedIssues: number;
  /** The review approved a PR that introduces a known bug */
  approvedBuggyPr: boolean;
}

function normalizePath(path: string): string {
  return path.replace(/^(\.\/|a\/|b\/)/, "");
}

export function issueMatchesKey(issue: ReviewIssue, key: AnswerKeyEntry[], tolerance: number): boolean {
  const file = normalizePath(issue.file);
  return key.some(
    (entry) =>
      normalizePath(entry.file) === file &&
      entry.lines.some((line) => Math.abs(line - issue.line) <= tolerance)
  );
}

export function scoreReview(review: ReviewResult, key: AnswerKeyEntry[], tolerance = 3): BugScore {
  const matched = review.issues.filter((issue) => issueMatchesKey(issue, key, tolerance));
  return {
    caught: matched.length > 0,
    caughtBlocking: matched.some((i) => i.severity === "critical" || i.severity === "warning"),
    totalIssues: review.issues.length,
    matchedIssues: matched.length,
    unmatchedIssues: review.issues.length - matched.length,
    approvedBuggyPr: review.recommendation === "approve",
  };
}

export interface EvalRecord {
  dataset: string;
  bugId: string;
  mode: string;
  score?: BugScore;
  tokensUsed?: number;
  error?: string;
}

export interface EvalSummaryRow {
  dataset: string;
  mode: string;
  bugs: number;
  errors: number;
  caught: number;
  caughtBlocking: number;
  avgIssuesPerPr: number;
  avgUnmatchedPerPr: number;
  approvedBuggyPrs: number;
  avgTokens: number;
}

export function summarizeEval(records: EvalRecord[]): EvalSummaryRow[] {
  const groups = new Map<string, EvalRecord[]>();
  for (const record of records) {
    const key = `${record.dataset}|${record.mode}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  const round = (value: number) => Math.round(value * 100) / 100;

  return Array.from(groups.entries()).map(([key, group]) => {
    const [dataset = "", mode = ""] = key.split("|");
    const scored = group.filter((r) => r.score);
    const n = scored.length || 1;
    return {
      dataset,
      mode,
      bugs: scored.length,
      errors: group.length - scored.length,
      caught: scored.filter((r) => r.score?.caught).length,
      caughtBlocking: scored.filter((r) => r.score?.caughtBlocking).length,
      avgIssuesPerPr: round(scored.reduce((s, r) => s + (r.score?.totalIssues ?? 0), 0) / n),
      avgUnmatchedPerPr: round(scored.reduce((s, r) => s + (r.score?.unmatchedIssues ?? 0), 0) / n),
      approvedBuggyPrs: scored.filter((r) => r.score?.approvedBuggyPr).length,
      avgTokens: Math.round(scored.reduce((s, r) => s + (r.tokensUsed ?? 0), 0) / n),
    };
  });
}

export function formatSummaryMarkdown(rows: EvalSummaryRow[]): string {
  const header =
    "| Dataset | Mode | Bugs | Caught | Caught (critical/warning) | Issues / PR | Unmatched / PR | Approved buggy PR | Avg tokens | Errors |\n" +
    "|---|---|---|---|---|---|---|---|---|---|";
  const body = rows
    .sort((a, b) => a.dataset.localeCompare(b.dataset) || a.mode.localeCompare(b.mode))
    .map(
      (r) =>
        `| ${r.dataset} | ${r.mode} | ${r.bugs} | ${r.caught}/${r.bugs} | ${r.caughtBlocking}/${r.bugs} | ` +
        `${r.avgIssuesPerPr} | ${r.avgUnmatchedPerPr} | ${r.approvedBuggyPrs}/${r.bugs} | ${r.avgTokens} | ${r.errors} |`
    )
    .join("\n");
  return `${header}\n${body}`;
}
