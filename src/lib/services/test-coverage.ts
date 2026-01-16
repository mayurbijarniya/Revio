import path from "path";
import type { CodeGraphData } from "@/lib/services/code-graph";
import type { TestCoverageData, TestCoverageMissingTest } from "@/types/test-coverage";

function isTestFile(filePath: string): boolean {
  const p = filePath.toLowerCase();
  return (
    p.includes("/__tests__/") ||
    p.includes("/__test__/") ||
    /(^|\/)(tests?|e2e)\//.test(p) ||
    /\.test\.[a-z0-9]+$/.test(p) ||
    /\.spec\.[a-z0-9]+$/.test(p)
  );
}

function isSupportedCodeFile(filePath: string): boolean {
  const ext = path.posix.extname(filePath).toLowerCase();
  return [".ts", ".tsx", ".js", ".jsx"].includes(ext);
}

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function buildSuggestedTestFiles(filePath: string): string[] {
  if (!isSupportedCodeFile(filePath)) return [];

  const ext = path.posix.extname(filePath);
  const base = path.posix.basename(filePath, ext);
  const dir = path.posix.dirname(filePath);

  const candidates: string[] = [
    path.posix.join(dir, `${base}.test${ext}`),
    path.posix.join(dir, `${base}.spec${ext}`),
    path.posix.join(dir, "__tests__", `${base}.test${ext}`),
    path.posix.join(dir, "__tests__", `${base}.spec${ext}`),
  ];

  if (filePath.startsWith("src/")) {
    const rel = filePath.slice("src/".length);
    const relDir = path.posix.dirname(rel);
    const relDirNormalized = relDir === "." ? "" : relDir;

    candidates.push(path.posix.join("tests", relDirNormalized, `${base}.test${ext}`));
    candidates.push(path.posix.join("tests", relDirNormalized, `${base}.spec${ext}`));
    candidates.push(path.posix.join("test", relDirNormalized, `${base}.test${ext}`));
    candidates.push(path.posix.join("test", relDirNormalized, `${base}.spec${ext}`));
  }

  return uniqueStrings(candidates);
}

function getRepoFileSet(graphData: CodeGraphData): Set<string> {
  const files = new Set<string>();
  for (const node of graphData.nodes) {
    if (node.file) files.add(node.file);
  }
  return files;
}

export function analyzeTestCoverage(params: {
  changedFiles: string[];
  graphData: CodeGraphData | null;
}): TestCoverageData | null {
  const changedFiles = params.changedFiles.filter(Boolean);
  if (changedFiles.length === 0) return null;

  const testFilesChanged = changedFiles.filter(isTestFile);
  const nonTestFilesChanged = changedFiles.filter((f) => !isTestFile(f));

  const repoFileSet = params.graphData ? getRepoFileSet(params.graphData) : null;
  const hasAnyTestsInRepo = repoFileSet
    ? Array.from(repoFileSet).some((f) => isTestFile(f))
    : null;

  const missingTests: TestCoverageMissingTest[] = [];

  for (const file of nonTestFilesChanged) {
    if (!isSupportedCodeFile(file)) continue;

    const suggested = buildSuggestedTestFiles(file);
    const matchedInRepo = repoFileSet
      ? suggested.filter((cand) => repoFileSet.has(cand))
      : [];
    const matchedInChange = suggested.filter((cand) => changedFiles.includes(cand));

    const hasRelatedTest = matchedInRepo.length > 0 || matchedInChange.length > 0;
    if (hasRelatedTest) continue;

    missingTests.push({
      file,
      suggestedTestFiles: suggested.slice(0, 6),
      reason: "No related test file detected for this change.",
    });
  }

  const coverageConfidence: TestCoverageData["coverageConfidence"] = repoFileSet
    ? "high"
    : "low";

  return {
    changedFiles,
    testFilesChanged,
    nonTestFilesChanged,
    missingTests,
    coverageConfidence,
    hasAnyTestsInRepo,
  };
}

