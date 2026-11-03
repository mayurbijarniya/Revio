import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { analyzeTestCoverage } from "./test-coverage";
import { buildCodeGraph } from "./code-graph";

describe("analyzeTestCoverage", () => {
  it("suggests tests for library code but not for routes, pages, scripts or config", () => {
    const result = analyzeTestCoverage({
      changedFiles: [
        "src/lib/services/chat-service.ts",
        "src/app/api/chat/route.ts",
        "src/app/dashboard/chat/page.tsx",
        "scripts/eval/run-eval.ts",
        "vitest.config.ts",
        "src/config.ts",
        "src/constants.ts",
        "src/types/global.d.ts",
        "app/agent.py",
      ],
      graphData: null,
    });

    expect(result?.missingTests.map((m) => m.file)).toEqual([
      "src/lib/services/chat-service.ts",
      "app/agent.py",
    ]);
  });

  it("finds an existing Python test anywhere in the change", () => {
    const result = analyzeTestCoverage({
      changedFiles: ["app/agent.py", "tests/unit/test_agent.py"],
      graphData: null,
    });

    expect(result?.missingTests).toEqual([]);
    expect(result?.testFilesChanged).toEqual(["tests/unit/test_agent.py"]);
  });
});

describe("analyzeTestCoverage with a flat tests/ folder (demo repo layout)", () => {
  const repoFiles = [
    {
      path: "src/services/pricing.ts",
      language: "typescript",
      content: "export function price(qty: number) { return qty * 10; }\n",
    },
    {
      path: "src/services/inventory.ts",
      language: "typescript",
      content: "export function stock() { return 3; }\n",
    },
    {
      path: "src/services/shipping.ts",
      language: "typescript",
      content: "export function ship() { return 1; }\n",
    },
    { path: "src/config.ts", language: "typescript", content: "export const config = { currency: \"USD\" };\n" },
    {
      // Flat layout: named after the file, no services/ folder
      path: "tests/pricing.test.ts",
      language: "typescript",
      content: 'import { price } from "../src/services/pricing";\ntest("price", () => price(1));\n',
    },
    {
      // Not named after inventory.ts, but imports it
      path: "tests/stock-levels.test.ts",
      language: "typescript",
      content: 'import { stock } from "../src/services/inventory";\ntest("stock", () => stock());\n',
    },
  ];

  it("counts flat-layout and importing tests, skips config, and still flags untested code", async () => {
    const graph = await buildCodeGraph("repo", repoFiles);
    const result = analyzeTestCoverage({
      changedFiles: ["src/services/pricing.ts", "src/services/inventory.ts", "src/services/shipping.ts", "src/config.ts"],
      graphData: graph,
    });

    expect(result?.missingTests.map((m) => m.file)).toEqual(["src/services/shipping.ts"]);
  });

  it("counts a test changed in the same PR that imports the changed file", async () => {
    const graph = await buildCodeGraph("repo", [
      ...repoFiles,
      {
        path: "tests/bulk-discount.test.ts",
        language: "typescript",
        content: 'import { ship } from "../src/services/shipping";\ntest("bulk", () => ship());\n',
      },
    ]);
    const result = analyzeTestCoverage({
      changedFiles: ["src/services/shipping.ts", "tests/bulk-discount.test.ts"],
      graphData: graph,
    });

    expect(result?.missingTests).toEqual([]);
  });

  it("does not match generic names like index.ts by name alone", () => {
    const result = analyzeTestCoverage({
      changedFiles: ["src/billing/index.ts", "tests/other/index.test.ts"],
      graphData: null,
    });

    expect(result?.missingTests.map((m) => m.file)).toEqual(["src/billing/index.ts"]);
  });
});
