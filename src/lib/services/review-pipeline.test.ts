import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { buildPromptDiff, getChangedOldLinesByPath, matchesIgnoredPath, parseUnifiedDiff } from "./diff-parser";
import { decideReviewVerdict } from "./review-verdict";
import { generateBlastRadius } from "./blast-radius";
import { buildCodeGraph } from "./code-graph";
import { createInlineComments, type ReviewResult } from "@/lib/prompts/review";
import { isTestFile } from "./test-files";

const diff = [
  "diff --git a/app/agent.py b/app/agent.py",
  "index 111..222 100644",
  "--- a/app/agent.py",
  "+++ b/app/agent.py",
  "@@ -2,4 +2,5 @@ from app.utils import helper",
  " ",
  " def agent_logic(x):",
  "-    return helper(x) + 1",
  "+    value = helper(x)",
  "+    return value + 1",
  " ",
  "diff --git a/docs/readme.md b/docs/readme.md",
  "new file mode 100644",
  "--- /dev/null",
  "+++ b/docs/readme.md",
  "@@ -0,0 +1,1 @@",
  "+hello",
].join("\n");

const baseReview: ReviewResult = {
  summary: "ok",
  riskLevel: "low",
  issues: [],
  positives: [],
  recommendation: "approve",
};

describe("diff parser", () => {
  it("tracks new-file lines, base-branch changed lines and file status", () => {
    const files = parseUnifiedDiff(diff);
    expect(files.map((f) => [f.path, f.status])).toEqual([
      ["app/agent.py", "modified"],
      ["docs/readme.md", "added"],
    ]);

    const agent = files[0]!;
    expect(agent.addedLines).toEqual([
      { line: 4, text: "    value = helper(x)" },
      { line: 5, text: "    return value + 1" },
    ]);
    expect(agent.addedCount).toBe(2);
    expect(agent.deletedCount).toBe(1);
    expect(agent.changedOldLines).toContain(4);
    expect([...agent.commentableLines].sort()).toEqual([2, 3, 4, 5, 6]);

    // New files are not in the base-branch graph
    expect(getChangedOldLinesByPath(files)).toEqual({ "app/agent.py": agent.changedOldLines });
  });

  it("annotates the prompt diff with line numbers", () => {
    const { text } = buildPromptDiff(parseUnifiedDiff(diff), 100_000);
    expect(text).toContain("+    4 |     value = helper(x)");
    expect(text).toContain("     3 | def agent_logic(x):");
    expect(text).toContain("-      |     return helper(x) + 1");
  });

  it("matches ignored paths like before, with literal dots", () => {
    expect(matchesIgnoredPath("src/a.test.ts", ["*.test.ts"])).toBe(true);
    expect(matchesIgnoredPath("docs/guide/intro.md", ["docs/*"])).toBe(true);
    expect(matchesIgnoredPath("docs/guide/intro.md", ["docs/"])).toBe(true);
    expect(matchesIgnoredPath("src/atestXts", ["*.test.ts"])).toBe(false);
  });
});

describe("review verdict", () => {
  const settings = { blockOnCritical: true, blockOnSecurity: true };

  it("raises risk to match issues and never approves with warnings", () => {
    const verdict = decideReviewVerdict({
      review: {
        ...baseReview,
        issues: [{ file: "a.ts", line: 1, severity: "warning", category: "bug", title: "t", description: "d" }],
      },
      settings,
    });
    expect(verdict).toEqual({ riskLevel: "medium", recommendation: "comment" });
  });

  it("requests changes for critical issues when blocking is enabled", () => {
    const verdict = decideReviewVerdict({
      review: {
        ...baseReview,
        issues: [{ file: "a.ts", line: 1, severity: "critical", category: "logic", title: "t", description: "d" }],
      },
      settings,
    });
    expect(verdict).toEqual({ riskLevel: "high", recommendation: "request_changes" });
  });

  it("lets graph impact raise risk by one level only", () => {
    const verdict = decideReviewVerdict({ review: baseReview, graphImpact: "critical", settings });
    expect(verdict.riskLevel).toBe("medium");
    expect(verdict.recommendation).toBe("approve");
  });
});

describe("inline comments", () => {
  it("skips issues on lines GitHub cannot anchor to", () => {
    const review: ReviewResult = {
      ...baseReview,
      issues: [
        { file: "app/agent.py", line: 4, severity: "warning", category: "bug", title: "ok", description: "d" },
        { file: "app/agent.py", line: 40, severity: "warning", category: "bug", title: "bad", description: "d" },
      ],
    };
    const lines = new Map(parseUnifiedDiff(diff).map((f) => [f.path, f.commentableLines]));
    expect(createInlineComments(review, lines).map((c) => c.line)).toEqual([4]);
  });
});

describe("blast radius", () => {
  it("draws only boxes and edges that exist", async () => {
    const graph = await buildCodeGraph("repo", [
      {
        path: "app/agent.py",
        language: "python",
        content: "def agent_logic(x):\n    return x + 1\n",
      },
      {
        path: "tests/test_agent.py",
        language: "python",
        content: "from app.agent import agent_logic\n\ndef test_it():\n    assert agent_logic(1) == 2\n",
      },
    ]);

    const blast = generateBlastRadius({
      changedFiles: ["app/agent.py"],
      graphData: graph,
      changedLinesByFile: { "app/agent.py": [2] },
    })!;

    expect(blast.riskLevel).toBe("low");
    expect(blast.affectedEntryPoints.total).toBe(0);
    expect(blast.mermaid).not.toContain("IC -->");
    expect(blast.mermaid).not.toContain("EP");
    expect(blast.mermaid).not.toMatch(/<br\/>- /);
    expect(blast.mermaid).toContain("No downstream code");
  });
});

describe("test file detection", () => {
  it("recognises common test layouts across languages", () => {
    for (const p of ["tests/test_agent.py", "app/test_agent.py", "pkg/x_test.go", "src/__tests__/a.ts", "a.spec.ts", "src/UserServiceTest.java"]) {
      expect(isTestFile(p)).toBe(true);
    }
    for (const p of ["app/agent.py", "src/latest.java", "src/contest.ts"]) {
      expect(isTestFile(p)).toBe(false);
    }
  });
});
