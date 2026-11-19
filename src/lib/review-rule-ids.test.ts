import { describe, expect, it } from "vitest";
import { CODING_STANDARD_RULE_ID, keepKnownRuleIds } from "./review-rule-ids";
import { DEFAULT_REVIEW_SETTINGS, type ReviewRule } from "@/types/review";

const customRule: ReviewRule = {
  id: "no-console-log",
  name: "No console.log",
  description: "",
  enabled: true,
  category: "style",
  severity: "suggestion",
  message: "Remove console.log",
};

describe("keepKnownRuleIds", () => {
  it("keeps configured rules and the coding-standard ID, drops invented labels", () => {
    const settings = { ...DEFAULT_REVIEW_SETTINGS, customRules: [customRule] };
    const issues = [
      { title: "a", ruleId: "no-console-log" },
      { title: "b", ruleId: CODING_STANDARD_RULE_ID },
      { title: "c", ruleId: "stale-price-reuse" },
      { title: "d" },
    ];

    expect(keepKnownRuleIds(issues, settings)).toEqual([
      { title: "a", ruleId: "no-console-log" },
      { title: "b", ruleId: CODING_STANDARD_RULE_ID },
      { title: "c" },
      { title: "d" },
    ]);
  });

  it("drops every label except coding-standard when no custom rules exist", () => {
    const result = keepKnownRuleIds([{ ruleId: "sql-injection" }], DEFAULT_REVIEW_SETTINGS);
    expect(result[0]).not.toHaveProperty("ruleId");
  });
});

describe("custom rules in the review prompt", () => {
  it("gives the model each enabled rule's exact ruleId", async () => {
    const { buildReviewSystemPrompt } = await import("@/lib/prompts/review");
    const prompt = buildReviewSystemPrompt({ ...DEFAULT_REVIEW_SETTINGS, customRules: [customRule] });
    expect(prompt).toContain("**No console.log** [ruleId: no-console-log]");
    expect(prompt).toContain('set "ruleId" to that rule\'s ruleId exactly');
  });
});
