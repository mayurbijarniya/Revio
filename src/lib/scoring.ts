export function getQualityIssueWeight(severity?: string) {
  switch (severity) {
    case "critical":
      return 10;
    case "high":
      return 5;
    case "medium":
    case "warning":
      return 2;
    case "low":
    case "info":
    case "suggestion":
      return 0.5;
    default:
      return 1;
  }
}

export function calculateQualityScoreFromWeight(
  weightedIssues: number,
  reviewCount: number = 1
) {
  return Math.max(0, Math.min(100, 100 - Math.round(weightedIssues / Math.max(1, reviewCount))));
}

export function calculateWeightedIssues(issues: Array<{ severity?: string }>) {
  return issues.reduce((sum, issue) => sum + getQualityIssueWeight(issue.severity), 0);
}
