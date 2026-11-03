import { describe, expect, it } from "vitest";
import {
  buildAnswerKey,
  formatSummaryMarkdown,
  reverseUnifiedDiff,
  scoreReview,
  stripTestFiles,
  summarizeEval,
} from "./bug-pr";
import { parseUnifiedDiff } from "@/lib/services/diff-parser";
import type { ReviewResult } from "@/lib/prompts/review";

// A fix: changes "< " to "<=" and adds a guard line. A SQL-style comment line starting
// with "--" checks that hunk bodies are not mistaken for file headers.
const fixDiff = [
  "diff --git a/src/range.py b/src/range.py",
  "index 1111111..2222222 100644",
  "--- a/src/range.py",
  "+++ b/src/range.py",
  "@@ -1,4 +1,5 @@",
  " def in_range(x, hi):",
  "-    return x < hi",
  "+    if hi is None:",
  "+        return False",
  "+    return x <= hi",
  " --- not a header",
  " # end",
  "diff --git a/tests/test_range.py b/tests/test_range.py",
  "--- a/tests/test_range.py",
  "+++ b/tests/test_range.py",
  "@@ -1,1 +1,2 @@",
  " import range",
  "+assert in_range(2, 2)",
  "",
].join("\n");

const review = (issues: ReviewResult["issues"], recommendation: ReviewResult["recommendation"] = "comment"): ReviewResult => ({
  summary: "s",
  riskLevel: "medium",
  issues,
  positives: [],
  recommendation,
});

describe("bug-introducing PR from a fix", () => {
  it("reverses the diff so applying it re-introduces the bug", () => {
    const pr = parseUnifiedDiff(reverseUnifiedDiff(fixDiff));
    const file = pr.find((f) => f.path === "src/range.py")!;

    expect(file.addedLines.map((l) => l.text)).toEqual(["    return x < hi"]);
    expect(file.deletions).toContain("return x <= hi");
    expect(file.deletedCount).toBe(3);
    // Hunk header swapped: PR head (buggy file) has 4 lines in this hunk
    expect(file.commentableLines.has(4)).toBe(true);
    expect(file.commentableLines.has(5)).toBe(false);
  });

  it("drops test files and keys the answer on the buggy lines", () => {
    const pr = stripTestFiles(reverseUnifiedDiff(fixDiff));
    expect(pr).not.toContain("tests/test_range.py");

    const key = buildAnswerKey(pr);
    expect(key).toEqual([{ file: "src/range.py", lines: expect.arrayContaining([2]) }]);
  });
});

describe("scoring", () => {
  const key = [{ file: "src/range.py", lines: [2] }];

  it("counts an issue near the bug as caught and others as unmatched", () => {
    const score = scoreReview(
      review([
        { file: "src/range.py", line: 3, severity: "warning", category: "bug", title: "off by one", description: "d" },
        { file: "src/other.py", line: 2, severity: "suggestion", category: "style", title: "naming", description: "d" },
      ]),
      key
    );
    expect(score).toEqual({
      caught: true,
      caughtBlocking: true,
      totalIssues: 2,
      matchedIssues: 1,
      unmatchedIssues: 1,
      approvedBuggyPr: false,
    });
  });

  it("flags an approval of a buggy PR", () => {
    expect(scoreReview(review([], "approve"), key)).toMatchObject({ caught: false, approvedBuggyPr: true });
  });

  it("summarizes per dataset and mode", () => {
    const rows = summarizeEval([
      { dataset: "bugsinpy", bugId: "1", mode: "diff", score: scoreReview(review([]), key), tokensUsed: 100 },
      {
        dataset: "bugsinpy",
        bugId: "2",
        mode: "diff",
        score: scoreReview(review([{ file: "src/range.py", line: 2, severity: "critical", category: "bug", title: "t", description: "d" }]), key),
        tokensUsed: 300,
      },
      { dataset: "bugsinpy", bugId: "3", mode: "diff", error: "model failed" },
    ]);
    expect(rows).toEqual([
      {
        dataset: "bugsinpy",
        mode: "diff",
        bugs: 2,
        errors: 1,
        caught: 1,
        caughtBlocking: 1,
        avgIssuesPerPr: 0.5,
        avgUnmatchedPerPr: 0,
        approvedBuggyPrs: 0,
        avgTokens: 200,
      },
    ]);
    expect(formatSummaryMarkdown(rows)).toContain("| bugsinpy | diff | 2 | 1/2 | 1/2 |");
  });
});
