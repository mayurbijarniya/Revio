import path from "path";
import type { CodeGraphData } from "@/lib/services/code-graph";
import type { TestCoverageData, TestCoverageMissingTest } from "@/types/test-coverage";
import { isTestFile } from "./test-files";

const JS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

function isSupportedCodeFile(filePath: string): boolean {
  const ext = path.posix.extname(filePath).toLowerCase();
  const base = path.posix.basename(filePath);
  if (ext === ".py") return base !== "__init__.py" && base !== "setup.py";
  if (ext === ".go") return true;
  return JS_EXTENSIONS.includes(ext);
}

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function buildSuggestedTestFiles(filePath: string): string[] {
  if (!isSupportedCodeFile(filePath)) return [];

  const ext = path.posix.extname(filePath);
  const base = path.posix.basename(filePath, ext);
  const dir = path.posix.dirname(filePath);

  if (ext === ".go") {
    return [path.posix.join(dir, `${base}_test.go`)];
  }

  if (ext === ".py") {
    return uniqueStrings([
      path.posix.join(dir, `test_${base}.py`),
      path.posix.join(dir, `${base}_test.py`),
      path.posix.join("tests", `test_${base}.py`),
      path.posix.join("tests", dir === "." ? "" : dir, `test_${base}.py`),
      path.posix.join("test", `test_${base}.py`),
    ]);
  }

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

/**
 * Python test layouts vary a lot (tests/, tests/unit/, pkg/tests/); match test_<name>.py anywhere
 */
function hasPythonTestAnywhere(filePath: string, files: string[]): boolean {
  const base = path.posix.basename(filePath, ".py");
  const testNames = new Set([`test_${base}.py`, `${base}_test.py`]);
  return files.some((f) => testNames.has(path.posix.basename(f)));
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
    const matchedByName = path.posix.extname(file) === ".py"
      ? hasPythonTestAnywhere(file, [...(repoFileSet ?? []), ...changedFiles])
      : false;

    const hasRelatedTest = matchedInRepo.length > 0 || matchedInChange.length > 0 || matchedByName;
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

