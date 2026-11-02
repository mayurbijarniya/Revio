/**
 * Shared test-file / test-function detection used by graph impact and test coverage.
 */

export function isTestFile(filePath: string): boolean {
  const p = filePath.toLowerCase();
  const fileName = p.split("/").pop() ?? p;
  const originalFileName = filePath.split("/").pop() ?? filePath;

  return (
    /(^|\/)(__tests?__|tests?|e2e|spec|specs)\//.test(p) ||
    /\.(test|spec)\.[a-z0-9]+$/.test(fileName) ||
    /^test_.+\.py$/.test(fileName) ||
    /_test\.(py|go|rb|exs?)$/.test(fileName) ||
    /_spec\.rb$/.test(fileName) ||
    // UserServiceTest.java, OrderTests.cs (capital "Test" avoids matching "latest.java")
    /.Tests?\.(java|kt|cs|swift|php)$/.test(originalFileName) ||
    fileName === "conftest.py"
  );
}

export function isTestFunctionName(name: string): boolean {
  return /^test[_A-Z]/.test(name) || /^Test[A-Z_]/.test(name) || name === "test";
}
