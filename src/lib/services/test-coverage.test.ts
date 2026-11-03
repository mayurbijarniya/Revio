import { describe, expect, it } from "vitest";
import { analyzeTestCoverage } from "./test-coverage";

describe("analyzeTestCoverage", () => {
  it("suggests tests for library code but not for routes, pages, scripts or config", () => {
    const result = analyzeTestCoverage({
      changedFiles: [
        "src/lib/services/chat-service.ts",
        "src/app/api/chat/route.ts",
        "src/app/dashboard/chat/page.tsx",
        "scripts/eval/run-eval.ts",
        "vitest.config.ts",
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
