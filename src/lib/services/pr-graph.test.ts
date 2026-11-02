import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { analyzeChangeImpact, buildCodeGraph } from "./code-graph";
import { parseUnifiedDiff } from "./diff-parser";
import { buildPrGraphScope } from "./pr-graph";
import { generateBlastRadius } from "./blast-radius";
import { generateSequenceDiagram } from "./sequence-diagram";

const baseFiles = [
  {
    path: "app/agent.py",
    language: "python",
    content: [
      "from app.utils import helper",
      "",
      "def agent_logic(x):",
      "    return helper(x) + 1",
      "",
      "def legacy(y):",
      "    return y",
    ].join("\n"),
  },
  {
    path: "app/utils.py",
    language: "python",
    content: ["def helper(v):", "    return v * 2"].join("\n"),
  },
  {
    path: "app/main.py",
    language: "python",
    content: [
      "from app.agent import agent_logic, legacy",
      "",
      "def main():",
      "    return agent_logic(1) + legacy(2)",
    ].join("\n"),
  },
];

// PR: rewrite agent.py (adds score(), removes legacy()), and add a new file app/report.py
const headAgent = [
  "from app.utils import helper",
  "",
  "def agent_logic(x):",
  "    return score(helper(x))",
  "",
  "def score(v):",
  "    return v + 1",
].join("\n");

const headReport = [
  "from app.agent import agent_logic",
  "",
  "def build_report():",
  "    return agent_logic(3)",
].join("\n");

const diff = [
  "diff --git a/app/agent.py b/app/agent.py",
  "--- a/app/agent.py",
  "+++ b/app/agent.py",
  "@@ -3,5 +3,5 @@ from app.utils import helper",
  " def agent_logic(x):",
  "-    return helper(x) + 1",
  "+    return score(helper(x))",
  " ",
  "-def legacy(y):",
  "-    return y",
  "+def score(v):",
  "+    return v + 1",
  "diff --git a/app/report.py b/app/report.py",
  "new file mode 100644",
  "--- /dev/null",
  "+++ b/app/report.py",
  "@@ -0,0 +1,4 @@",
  "+from app.agent import agent_logic",
  "+",
  "+def build_report():",
  "+    return agent_logic(3)",
].join("\n");

const headContent: Record<string, string> = {
  "app/agent.py": headAgent,
  "app/report.py": headReport,
};

async function buildScope() {
  const baseGraph = await buildCodeGraph("repo", baseFiles);
  return buildPrGraphScope({
    baseGraph,
    files: parseUnifiedDiff(diff),
    loadHeadFile: async (path) => headContent[path] ?? null,
  });
}

describe("PR-head graph overlay", () => {
  it("includes functions added in the PR and their calls", async () => {
    const scope = await buildScope();
    expect(scope.headParsedFiles).toBe(2);

    const impact = analyzeChangeImpact(
      scope.graph,
      scope.changedFiles,
      scope.changedLinesByFile,
      scope.extraChangedNodeIds
    );

    expect(impact.directlyAffectedFunctions.sort()).toEqual([
      "function:app/agent.py:agent_logic",
      "function:app/agent.py:legacy",
      "function:app/agent.py:score",
      "function:app/report.py:build_report",
    ]);
  });

  it("keeps callers of removed functions as impacted", async () => {
    const scope = await buildScope();
    expect(scope.extraChangedNodeIds).toEqual(["function:app/agent.py:legacy"]);

    const impact = analyzeChangeImpact(
      scope.graph,
      scope.changedFiles,
      scope.changedLinesByFile,
      scope.extraChangedNodeIds
    );
    // main() still calls agent_logic and the removed legacy(); report.py is part of the PR itself
    expect(impact.indirectlyAffectedFunctions).toEqual(["function:app/main.py:main"]);
    expect(impact.directlyAffectedFiles).toEqual(["app/main.py"]);
  });

  it("feeds the diagrams with PR-head data", async () => {
    const scope = await buildScope();

    const blast = generateBlastRadius({
      changedFiles: scope.changedFiles,
      graphData: scope.graph,
      changedLinesByFile: scope.changedLinesByFile,
      extraChangedNodeIds: scope.extraChangedNodeIds,
    })!;
    expect(blast.changedFunctions.total).toBe(4);
    expect(blast.indirectCallers.total).toBe(1);

    const sequence = generateSequenceDiagram({
      changedFiles: scope.changedFiles,
      graphData: scope.graph,
      changedLinesByFile: scope.changedLinesByFile,
      extraChangedNodeIds: scope.extraChangedNodeIds,
    });
    expect(sequence).toContain("participant");
    expect(sequence).toContain("agent_logic()");
    expect(sequence).toContain("helper()");
  });

  it("falls back to the base graph when head files cannot be loaded", async () => {
    const baseGraph = await buildCodeGraph("repo", baseFiles);
    const scope = await buildPrGraphScope({
      baseGraph,
      files: parseUnifiedDiff(diff),
      loadHeadFile: async () => null,
    });

    expect(scope.headParsedFiles).toBe(0);
    expect(scope.graph).toBe(baseGraph);
    expect(scope.changedLinesByFile["app/agent.py"]?.length).toBeGreaterThan(0);
  });
});
