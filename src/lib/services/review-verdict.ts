/**
 * Final review verdict: the single place where risk level and recommendation are decided.
 * Every consumer (GitHub review event, comment text, database, confidence score)
 * reads the result of this function, so they can never disagree.
 */
import type { ReviewResult } from "@/lib/prompts/review";
import type { ReviewSettings } from "@/types/review";

type RiskLevel = ReviewResult["riskLevel"];
type Recommendation = ReviewResult["recommendation"];

const RISK_ORDER: RiskLevel[] = ["low", "medium", "high", "critical"];

function riskRank(risk: RiskLevel): number {
  return RISK_ORDER.indexOf(risk);
}

export interface ReviewVerdict {
  riskLevel: RiskLevel;
  recommendation: Recommendation;
}

export function decideReviewVerdict(params: {
  review: ReviewResult;
  /** Structural impact from the code graph; can raise risk by at most one level */
  graphImpact?: RiskLevel | null;
  settings: Pick<ReviewSettings, "blockOnCritical" | "blockOnSecurity">;
}): ReviewVerdict {
  const { review, graphImpact, settings } = params;
  const issues = review.issues ?? [];

  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasWarning = issues.some((i) => i.severity === "warning");
  const hasSecurityProblem = issues.some(
    (i) => i.category === "security" && (i.severity === "critical" || i.severity === "warning")
  );

  // 1. Risk: the model's assessment, never lower than what the issues imply
  let riskLevel: RiskLevel = RISK_ORDER.includes(review.riskLevel) ? review.riskLevel : "low";
  const issueFloor: RiskLevel = hasCritical ? "high" : hasWarning ? "medium" : "low";
  if (riskRank(issueFloor) > riskRank(riskLevel)) riskLevel = issueFloor;

  // 2. Wide downstream impact raises risk one step (a large graph alone is not a defect)
  if (graphImpact && riskRank(graphImpact) > riskRank(riskLevel)) {
    riskLevel = RISK_ORDER[riskRank(riskLevel) + 1] ?? riskLevel;
  }

  // 3. Recommendation must be consistent with the issues and the risk
  let recommendation: Recommendation = review.recommendation;
  if ((settings.blockOnCritical && hasCritical) || (settings.blockOnSecurity && hasSecurityProblem)) {
    recommendation = "request_changes";
  } else if (recommendation === "request_changes" && issues.length === 0) {
    // Requesting changes without naming any change is not actionable
    recommendation = "comment";
  } else if (
    recommendation === "approve" &&
    (hasCritical || hasWarning || riskRank(riskLevel) >= riskRank("high"))
  ) {
    recommendation = "comment";
  }

  return { riskLevel, recommendation };
}
