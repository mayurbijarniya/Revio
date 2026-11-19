import type { ReviewSettings } from "@/types/review";

/** ruleId the model sets on issues that violate a detected coding standard */
export const CODING_STANDARD_RULE_ID = "coding-standard";

/**
 * Keep an issue's ruleId only when it names a real rule: one of the repository's custom rules
 * or the coding-standards ID. The model sometimes invents labels such as "stale-price-reuse",
 * which would otherwise look like configured rules in the dashboard and skew learning.
 */
export function keepKnownRuleIds<T extends { ruleId?: string }>(
  issues: T[],
  settings: Pick<ReviewSettings, "customRules">
): T[] {
  const known = new Set<string>([CODING_STANDARD_RULE_ID, ...settings.customRules.map((rule) => rule.id)]);
  return issues.map((issue) => {
    if (!issue.ruleId || known.has(issue.ruleId)) return issue;
    const rest = { ...issue };
    delete rest.ruleId;
    return rest;
  });
}
