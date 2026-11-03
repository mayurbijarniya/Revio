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

/**
 * Files that are normally covered by integration/e2e tests or none at all; suggesting a
 * unit test file next to them is noise (Next.js route files, scripts, config and constants,
 * type files, migrations).
 */
function isRarelyUnitTested(filePath: string): boolean {
  const p = filePath.toLowerCase();
  const fileName = p.split("/").pop() ?? p;
  return (
    /(^|\/)(scripts?|examples?|tools|migrations)\//.test(p) ||
    /(^|\/)app\/(.+\/)?(page|layout|loading|error|not-found|template|default|route)\.[jt]sx?$/.test(p) ||
    /^middleware\.[jt]s$/.test(fileName) ||
    /\.config\.[cm]?[jt]s$/.test(fileName) ||
    // Plain configuration / constant modules (config.ts, constants.py, settings.py)
    /^(config|constants|settings)\.([cm]?[jt]sx?|py)$/.test(fileName) ||
    p.endsWith(".d.ts") ||
    fileName === "manage.py"
  );
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

/** Names too generic to identify a file's test by name alone (index.test.ts could test anything) */
const GENERIC_BASE_NAMES = new Set(["index", "main", "utils", "util", "helpers", "types", "mod", "__init__"]);

/**
 * Test layouts vary a lot (tests/, test/unit/, pkg/tests/, flat or mirrored), so a test file
 * named after the changed file anywhere in the repo counts: pricing.test.ts, pricing.spec.js,
 * test_pricing.py, pricing_test.py.
 */
function hasNamedTestAnywhere(filePath: string, files: string[]): boolean {
  const ext = path.posix.extname(filePath).toLowerCase();
  const base = path.posix.basename(filePath, path.posix.extname(filePath));
  if (GENERIC_BASE_NAMES.has(base.toLowerCase())) return false;

  const testNames = new Set<string>();
  if (ext === ".py") {
    testNames.add(`test_${base}.py`);
    testNames.add(`${base}_test.py`);
  } else if (JS_EXTENSIONS.includes(ext)) {
    for (const kind of ["test", "spec"]) {
      for (const testExt of JS_EXTENSIONS) testNames.add(`${base}.${kind}${testExt}`);
    }
  } else {
    return false;
  }
  return files.some((f) => testNames.has(path.posix.basename(f)));
}

/**
 * Changed file -> test files that import it, from the code graph's import edges
 * (file -> import node -> imported file). Catches tests not named after the file,
 * e.g. tests/bulk-discount.test.ts importing src/services/pricing.ts.
 */
function findImportingTests(graphData: CodeGraphData, targets: Set<string>): Map<string, string[]> {
  const fileOfNode = new Map(graphData.nodes.map((n) => [n.id, n.file]));
  const result = new Map<string, string[]>();

  for (const edge of graphData.edges) {
    if (edge.type !== "imports" || !edge.from.startsWith("import:") || !edge.to.startsWith("file:")) continue;
    const target = edge.to.substring(5);
    if (!targets.has(target)) continue;

    const importer = fileOfNode.get(edge.from);
    if (!importer || !isTestFile(importer)) continue;
    const tests = result.get(target) ?? [];
    if (!tests.includes(importer)) tests.push(importer);
    result.set(target, tests);
  }
  return result;
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
  const knownFiles = [...(repoFileSet ?? []), ...changedFiles];
  const importingTests = params.graphData
    ? findImportingTests(params.graphData, new Set(nonTestFilesChanged))
    : new Map<string, string[]>();

  for (const file of nonTestFilesChanged) {
    if (!isSupportedCodeFile(file) || isRarelyUnitTested(file)) continue;

    const suggested = buildSuggestedTestFiles(file);
    const matchedInRepo = repoFileSet
      ? suggested.filter((cand) => repoFileSet.has(cand))
      : [];
    const matchedInChange = suggested.filter((cand) => changedFiles.includes(cand));

    const hasRelatedTest =
      matchedInRepo.length > 0 ||
      matchedInChange.length > 0 ||
      hasNamedTestAnywhere(file, knownFiles) ||
      (importingTests.get(file)?.length ?? 0) > 0;
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

