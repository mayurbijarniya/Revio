import { TEXT_INDICATORS } from "@/lib/constants";
import {
  type ReviewSettings,
  type ReviewRule,
  DEFAULT_REVIEW_SETTINGS,
} from "@/types/review";

/**
 * Build system prompt with custom rules
 */
export function buildReviewSystemPrompt(settings?: ReviewSettings): string {
  const effectiveSettings = settings || DEFAULT_REVIEW_SETTINGS;

  let customRulesSection = "";
  const enabledRules = effectiveSettings.customRules.filter((r) => r.enabled);

  if (enabledRules.length > 0) {
    customRulesSection = `

## Custom Rules to Enforce
The following custom rules MUST be checked and reported:
${enabledRules.map((rule) => formatRuleForPrompt(rule)).join("\n")}`;
  }

  const categoriesSection = effectiveSettings.enabledCategories.length > 0
    ? `\n\n## Focus Areas
Prioritize checking for issues in these categories: ${effectiveSettings.enabledCategories.join(", ")}`
    : "";

  const severitySection = `

## Severity Configuration
- Minimum severity to report: ${effectiveSettings.minSeverity}
- Block on critical issues: ${effectiveSettings.blockOnCritical ? "Yes" : "No"}
- Block on security issues: ${effectiveSettings.blockOnSecurity ? "Yes" : "No"}`;

  return `You are an expert code reviewer for the Revio AI code review platform. Your role is to provide comprehensive, actionable feedback on pull requests.${customRulesSection}${categoriesSection}${severitySection}

${REVIEW_CORE_INSTRUCTIONS}`;
}

/**
 * Format a custom rule for the prompt
 */
function formatRuleForPrompt(rule: ReviewRule): string {
  let ruleText = `- **${rule.name}** (${rule.severity}/${rule.category}): ${rule.description}`;
  if (rule.pattern) {
    ruleText += ` [Pattern: \`${rule.pattern}\`]`;
  }
  ruleText += ` → Report as: "${rule.message}"`;
  return ruleText;
}

/**
 * Core review instructions (shared)
 */
const REVIEW_CORE_INSTRUCTIONS = `## Your Responsibilities
1. Identify bugs, security vulnerabilities, and logic errors
2. Suggest performance improvements and optimizations
3. Ensure code follows best practices and design patterns
4. Check for proper error handling and edge cases
5. Verify code readability and maintainability
6. Identify potential breaking changes

## Review Format
You MUST respond with valid JSON in the following format:
{
  "summary": "A concise 2-3 sentence summary of the overall PR quality and main findings",
  "riskLevel": "low" | "medium" | "high" | "critical",
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical" | "warning" | "suggestion" | "info",
      "category": "bug" | "security" | "performance" | "style" | "logic" | "error_handling" | "testing" | "documentation",
      "title": "Brief issue title",
      "description": "Detailed explanation of the issue",
      "suggestion": "How to fix or improve (with code example if applicable)",
      "ruleId": "optional-custom-rule-id-if-matched"
    }
  ],
  "positives": ["List of good practices or improvements noticed in the PR"],
  "recommendation": "approve" | "request_changes" | "comment"
}

## Guidelines
- Be specific and actionable. Include file paths and line numbers for all issues.
- Prioritize issues by impact: security > bugs > performance > style
- Provide code examples in suggestions when helpful
- Be constructive, not harsh. Frame feedback positively.
- Consider the context of the codebase when making suggestions
- Don't flag minor style issues unless they impact readability
- Limit to the most important issues (max 10) to avoid overwhelming reviewers`;

/**
 * System prompt for PR code review (legacy - use buildReviewSystemPrompt for custom rules)
 */
export const REVIEW_SYSTEM_PROMPT = `You are an expert code reviewer for the Revio AI code review platform. Your role is to provide comprehensive, actionable feedback on pull requests.

## Your Responsibilities
1. Identify bugs, security vulnerabilities, and logic errors
2. Suggest performance improvements and optimizations
3. Ensure code follows best practices and design patterns
4. Check for proper error handling and edge cases
5. Verify code readability and maintainability
6. Identify potential breaking changes

## Review Format
You MUST respond with valid JSON in the following format:
{
  "summary": "A concise 2-3 sentence summary of the overall PR quality and main findings",
  "riskLevel": "low" | "medium" | "high" | "critical",
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical" | "warning" | "suggestion" | "info",
      "category": "bug" | "security" | "performance" | "style" | "logic" | "error_handling",
      "title": "Brief issue title",
      "description": "Detailed explanation of the issue",
      "suggestion": "How to fix or improve (with code example if applicable)"
    }
  ],
  "positives": ["List of good practices or improvements noticed in the PR"],
  "recommendation": "approve" | "request_changes" | "comment"
}

## Guidelines
- Be specific and actionable. Include file paths and line numbers for all issues.
- Prioritize issues by impact: security > bugs > performance > style
- Provide code examples in suggestions when helpful
- Be constructive, not harsh. Frame feedback positively.
- Consider the context of the codebase when making suggestions
- Don't flag minor style issues unless they impact readability
- Limit to the most important issues (max 10) to avoid overwhelming reviewers`;

/**
 * Build the user prompt for PR review
 */
export function buildReviewPrompt(
  prTitle: string,
  prDescription: string | null,
  diff: string,
  codebaseContext: string
): string {
  return `## Pull Request
**Title:** ${prTitle}
${prDescription ? `**Description:** ${prDescription}` : ""}

## Changed Files (Diff)
\`\`\`diff
${diff}
\`\`\`

## Codebase Context
The following code snippets are from the existing codebase and may be relevant to understanding the changes:

${codebaseContext}

Please review the pull request and provide your analysis in the required JSON format.`;
}

/**
 * Review issue from Gemini
 */
export interface ReviewIssue {
  file: string;
  line: number;
  severity: "critical" | "warning" | "suggestion" | "info";
  category: "bug" | "security" | "performance" | "style" | "logic" | "error_handling" | "testing" | "documentation";
  title: string;
  description: string;
  suggestion?: string;
  ruleId?: string; // ID of custom rule that triggered this issue
}

/**
 * Complete review result from Gemini
 */
export interface ReviewResult {
  summary: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  issues: ReviewIssue[];
  positives: string[];
  recommendation: "approve" | "request_changes" | "comment";
}

/**
 * Parse Gemini response to ReviewResult
 */
export function parseReviewResponse(response: string): ReviewResult | null {
  try {
    let jsonContent = response;
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }

    jsonContent = jsonContent.replace(/[\x00-\x1F\x7F-\x9F]/g, " ");

    try {
      const parsed = JSON.parse(jsonContent) as ReviewResult;

      if (!parsed.summary || !parsed.riskLevel || !Array.isArray(parsed.issues)) {
        console.error("Invalid review response structure");
        return null;
      }

      return parsed;
    } catch (parseError) {
      console.warn("Standard JSON parse failed, trying fallback...", parseError);
      const cleaned = jsonContent.replace(/"\s*\n\s*"/g, '""');
      const parsed = JSON.parse(cleaned) as ReviewResult;
      return parsed;
    }
  } catch (error) {
    console.error("Failed to parse review response:", error);
    return null;
  }
}

/**
 * Format review for GitHub comment
 */
export function formatReviewForGitHub(review: ReviewResult): string {
  const { severity, risk } = TEXT_INDICATORS;

  const riskBadge = risk[review.riskLevel as keyof typeof risk] || risk.low;

  let comment = `## Revio AI Code Review\n\n`;
  comment += `${riskBadge} **Risk Level:** ${review.riskLevel.toUpperCase()}\n\n`;
  comment += `### Summary\n${review.summary}\n\n`;

  if (review.issues.length > 0) {
    comment += `### Issues Found (${review.issues.length})\n\n`;

    for (const issue of review.issues) {
      const severityBadge = severity[issue.severity as keyof typeof severity] || severity.info;
      comment += `#### ${severityBadge} ${issue.title}\n`;
      comment += `**File:** \`${issue.file}:${issue.line}\`\n`;
      comment += `**Category:** ${issue.category}\n\n`;
      comment += `${issue.description}\n\n`;

      if (issue.suggestion) {
        comment += `**Suggestion:**\n${issue.suggestion}\n\n`;
      }

      comment += `---\n\n`;
    }
  }

  if (review.positives.length > 0) {
    comment += `### Positives\n`;
    for (const positive of review.positives) {
      comment += `- ${positive}\n`;
    }
    comment += `\n`;
  }

  comment += `### Recommendation\n`;
  const recommendationText = {
    approve: "This PR looks good and is ready to merge.",
    request_changes: "This PR requires changes before merging.",
    comment: "This PR has some items to address but may be mergeable.",
  };
  comment += recommendationText[review.recommendation];

  comment += `\n\n---\n*Powered by [Revio](https://revio.mayur.app) AI Code Review*`;

  return comment;
}

/**
 * Create inline comments for GitHub PR review
 */
export function createInlineComments(
  review: ReviewResult
): Array<{ path: string; line: number; body: string }> {
  return review.issues.map((issue) => {
    const { severity } = TEXT_INDICATORS;
    const badge = severity[issue.severity as keyof typeof severity] || severity.info;

    let body = `${badge} **${issue.title}**\n\n`;
    body += `${issue.description}\n\n`;

    if (issue.suggestion) {
      body += `**Suggestion:** ${issue.suggestion}`;
    }

    return {
      path: issue.file,
      line: issue.line,
      body,
    };
  });
}
