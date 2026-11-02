import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { analyzeChangeImpact, buildCodeGraph, findCallers } from "./code-graph";

const pythonFiles = [
  {
    path: "app/agent.py",
    language: "python",
    content: [
      "from app.utils import helper",
      "",
      "def agent_logic(x):",
      "    return helper(x) + 1",
      "",
      "class Agent:",
      "    def run(self):",
      "        return agent_logic(2)",
      "",
      "def _private():",
      "    pass",
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
      "from .agent import agent_logic",
      "",
      "def main():",
      "    print(agent_logic(1))",
    ].join("\n"),
  },
  {
    path: "tests/test_agent.py",
    language: "python",
    content: [
      "from app.agent import agent_logic",
      "",
      "def test_agent_logic():",
      "    assert agent_logic(1) == 3",
    ].join("\n"),
  },
];

const tsFiles = [
  {
    path: "src/lib/math.ts",
    language: "typescript",
    content: [
      "export function add(a: number, b: number) {",
      "  return a + b;",
      "}",
      "",
      "export const double = (n: number) => add(n, n);",
    ].join("\n"),
  },
  {
    path: "src/app/page.ts",
    language: "typescript",
    content: [
      'import { double } from "../lib/math";',
      "",
      "export function render(items: number[]) {",
      "  return items.map((item) => double(item));",
      "}",
    ].join("\n"),
  },
];

describe("buildCodeGraph", () => {
  it("links Python calls across files and resolves imports", async () => {
    const graph = await buildCodeGraph("repo", pythonFiles);

    const callers = findCallers(graph, "function:app/agent.py:agent_logic").map((n) => n.id);
    expect(callers).toContain("function:app/main.py:main");
    expect(callers).toContain("function:app/agent.py:Agent.run");

    const helperCallers = findCallers(graph, "function:app/utils.py:helper").map((n) => n.id);
    expect(helperCallers).toEqual(["function:app/agent.py:agent_logic"]);

    const importsUtils = graph.edges.some(
      (e) => e.type === "imports" && e.from.startsWith("import:app/agent.py") && e.to === "file:app/utils.py"
    );
    expect(importsUtils).toBe(true);
  });

  it("never marks tests, methods or private functions as entry points", async () => {
    const graph = await buildCodeGraph("repo", pythonFiles);

    expect(graph.metadata.entryPoints).toContain("function:app/main.py:main");
    expect(graph.metadata.entryPoints).not.toContain("function:tests/test_agent.py:test_agent_logic");
    expect(graph.metadata.entryPoints).not.toContain("function:app/agent.py:Agent.run");
    expect(graph.metadata.entryPoints).not.toContain("function:app/agent.py:_private");
    expect(graph.metadata.entryPoints).not.toContain("function:app/agent.py:agent_logic");
  });

  it("links TypeScript calls through imports and skips inline callbacks", async () => {
    const graph = await buildCodeGraph("repo", tsFiles);

    const callers = findCallers(graph, "function:src/lib/math.ts:double").map((n) => n.id);
    expect(callers).toEqual(["function:src/app/page.ts:render"]);

    const functionNames = graph.nodes.filter((n) => n.type === "function").map((n) => n.name);
    expect(functionNames.sort()).toEqual(["add", "double", "render"]);
  });
});

describe("analyzeChangeImpact", () => {
  it("only counts functions whose lines changed", async () => {
    const graph = await buildCodeGraph("repo", pythonFiles);

    // Line 4 is inside agent_logic only
    const impact = analyzeChangeImpact(graph, ["app/agent.py"], { "app/agent.py": [4] });

    expect(impact.directlyAffectedFunctions).toEqual(["function:app/agent.py:agent_logic"]);
    expect(impact.indirectlyAffectedFunctions.sort()).toEqual([
      "function:app/agent.py:Agent.run",
      "function:app/main.py:main",
    ]);
    // tests/test_agent.py imports agent.py too, but tests are not downstream impact
    expect(impact.directlyAffectedFiles).toEqual(["app/main.py"]);
    expect(impact.affectedEntryPoints).toEqual(["function:app/main.py:main"]);
    expect(impact.totalImpactRadius).toBe(3);
    expect(impact.riskLevel).toBe("medium");
  });

  it("ignores changes that touch only tests", async () => {
    const graph = await buildCodeGraph("repo", pythonFiles);

    const impact = analyzeChangeImpact(graph, ["tests/test_agent.py"], { "tests/test_agent.py": [4] });

    expect(impact.directlyAffectedFunctions).toEqual([]);
    expect(impact.indirectlyAffectedFunctions).toEqual([]);
    expect(impact.affectedEntryPoints).toEqual([]);
    expect(impact.riskLevel).toBe("low");
  });
});
