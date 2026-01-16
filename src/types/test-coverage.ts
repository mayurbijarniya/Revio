export type TestCoverageConfidence = "high" | "medium" | "low";

export interface TestCoverageMissingTest {
  file: string;
  suggestedTestFiles: string[];
  reason: string;
}

export interface TestCoverageData {
  changedFiles: string[];
  testFilesChanged: string[];
  nonTestFilesChanged: string[];
  missingTests: TestCoverageMissingTest[];
  coverageConfidence: TestCoverageConfidence;
  hasAnyTestsInRepo: boolean | null;
}

