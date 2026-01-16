"use client";

import type { TestCoverageData, TestCoverageConfidence } from "@/types/test-coverage";
import { cn } from "@/lib/utils";

function getConfidenceStyles(confidence: TestCoverageConfidence) {
  switch (confidence) {
    case "high":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    case "low":
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

export function TestCoveragePanel({ testCoverage }: { testCoverage: TestCoverageData }) {
  const missing = Array.isArray(testCoverage.missingTests) ? testCoverage.missingTests : [];
  const nonTestChanged = Array.isArray(testCoverage.nonTestFilesChanged)
    ? testCoverage.nonTestFilesChanged
    : [];
  const testChanged = Array.isArray(testCoverage.testFilesChanged) ? testCoverage.testFilesChanged : [];

  const hasTestsInRepo = testCoverage.hasAnyTestsInRepo;
  const confidence = testCoverage.coverageConfidence;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Test Coverage
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Heuristic checks for related tests
          </p>
        </div>
        <span className={cn("px-2 py-1 rounded text-xs font-medium", getConfidenceStyles(confidence))}>
          {confidence.toUpperCase()} CONFIDENCE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-500">Non-test files changed</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{nonTestChanged.length}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-500">Test files changed</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{testChanged.length}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-500">Potential gaps</div>
          <div className={cn("text-2xl font-bold", missing.length > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white")}>
            {missing.length}
          </div>
        </div>
      </div>

      {hasTestsInRepo === false && (
        <div className="mb-4 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg p-3">
          No test files detected in the indexed repository.
        </div>
      )}

      {missing.length === 0 ? (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          No obvious missing tests detected for this PR.
        </div>
      ) : (
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Files that may need tests
          </div>
          <div className="space-y-2">
            {missing.slice(0, 10).map((m) => (
              <div
                key={m.file}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900"
              >
                <div className="text-xs font-mono text-gray-800 dark:text-gray-200 truncate" title={m.file}>
                  {m.file}
                </div>
                {m.suggestedTestFiles?.length > 0 && (
                  <div className="mt-1 text-xs text-gray-500">
                    Suggested:{" "}
                    <span className="font-mono">{m.suggestedTestFiles[0]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {missing.length > 10 && (
            <div className="mt-2 text-xs text-gray-500">
              … +{missing.length - 10} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

