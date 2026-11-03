import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { findDocstringCandidates } from "./docstrings";

const content = [
  "function helper() {",            // 1  top-level, not exported
  "  const inner = () => 1;",       // 2  nested: skipped
  "  return inner();",
  "}",
  "",
  "/** Already documented */",
  "export function documented() {}", // 7  has JSDoc: skipped
  "",
  "export const publicApi = () => {", // 9  exported
  "  return helper();",
  "};",
  "",
  "export default class Service {}", // 13 exported default
].join("\n");

describe("findDocstringCandidates", () => {
  it("returns top-level, undocumented definitions on changed lines, marking exported ones", () => {
    const candidates = findDocstringCandidates("src/lib/service.ts", content, [{ start: 1, end: 13 }]);

    expect(candidates.map((c) => [c.startLine, c.exported])).toEqual([
      [1, false],
      [9, true],
      [13, true],
    ]);
  });

  it("ignores definitions outside the changed lines", () => {
    const candidates = findDocstringCandidates("src/lib/service.ts", content, [{ start: 9, end: 11 }]);
    expect(candidates.map((c) => c.startLine)).toEqual([9]);
  });
});
