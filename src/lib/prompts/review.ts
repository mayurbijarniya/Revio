import {
  type ReviewSettings,
  type ReviewRule,
  DEFAULT_REVIEW_SETTINGS,
} from "@/types/review";
import type { BlastRadiusData } from "@/types/blast-radius";
import type { TestCoverageData } from "@/types/test-coverage";
import { shouldShowSequenceDiagram } from "@/lib/review-display";

/**
 * Build system prompt with custom rules
 */
export function buildReviewSystemPrompt(
  settings?: ReviewSettings,
  extraInstructions?: string
): string {
  const effectiveSettings = settings || DEFAULT_REVIEW_SETTINGS;

  let customRulesSection = "";
  const enabledRules = effectiveSettings.customRules.filter((r) => r.enabled);

  if (enabledRules.length > 0) {
    customRulesSection = `

## Custom Rules to Enforce
The following custom rules MUST be checked and reported. For an issue that violates one of them, set "ruleId" to that rule's ruleId exactly:
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

  return `You are an expert code reviewer for the Revio AI code review platform. Your role is to provide comprehensive, actionable feedback on pull requests.${customRulesSection}${categoriesSection}${severitySection}${extraInstructions || ""}

${REVIEW_CORE_INSTRUCTIONS}`;
}

/**
 * Format a custom rule for the prompt
 */
function formatRuleForPrompt(rule: ReviewRule): string {
  let ruleText = `- **${rule.name}** [ruleId: ${rule.id}] (${rule.severity}/${rule.category}): ${rule.description}`;
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

## Evidence Standard
- Only report an issue when the diff or provided codebase context gives enough evidence.
- Do not invent file paths, line numbers, call paths, behavior, or project intent that is not visible in the supplied diff/context.
- If a scanner finding appears to be a false positive, do not include it in "issues". Mention it briefly in the summary only when it is useful context.
- If uncertain, lower the severity or omit the issue. Avoid speculative findings.
- Defects visible in the diff are not speculative: wrong calculations or units, off-by-one boundaries, inverted conditions, a missing \`await\`, missing authorization/ownership checks, and injectable queries. Report each one as "warning" or higher.
- Before answering, check every added line against these questions:
  1. Trust: does a value from the client (request body, query string, params, headers) decide a price, discount, quantity, role, owner or permission without a server-side check or allow-list? That is a "critical" security issue.
  2. Access: does each new or changed route/handler check that the caller owns or may access the record it reads or changes?
  3. Repeats: can a state-changing action (cancel, refund, restock, pay, send, delete) run twice or out of order and apply its effect twice? Look for a missing status check.
  4. Input: are numbers checked for NaN, negatives and range, and are strings validated before use?
- Each diff line is prefixed with its line number in the new version of the file: "+   42 | code" (added), "    42 | code" (unchanged context), "-       | code" (removed). Use that number as the issue "line". Only cite numbered lines; for a problem in removed code, cite the nearest numbered line.
- The "Codebase Graph Analysis" section lists real callers and dependents of the changed code. Use it to judge breaking-change risk, but do not report graph facts as issues on their own.

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
      "ruleId": "only the ruleId of a listed custom rule or coding standard; omit otherwise"
    }
  ],
  "positives": ["List of good practices or improvements noticed in the PR"],
  "recommendation": "approve" | "request_changes" | "comment"
}

## Recommendation Rules
- Use "approve" only when there are no critical/warning issues, no unresolved security concerns, no correctness risk, and no meaningful missing-test risk.
- Use "request_changes" for security flaws, correctness bugs, data loss risk, auth/permission issues, broken user flows, or production reliability regressions.
- Use "comment" for non-blocking improvements, test suggestions, maintainability concerns, or low-risk follow-up items.
- The "riskLevel" must match the highest real impact in the review. Do not mark risk as low when warning or critical issues are present.

## Issue Wording Rules
- Titles must be specific, evidence-based, and under 80 characters.
- Descriptions must explain impact, not just restate the code.
- Suggestions must describe the concrete fix. Include a small code example only when it makes the fix clearer.
- Keep positives specific and limited to meaningful engineering choices. Do not praise obvious or cosmetic changes.

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
 * Track bracket/brace state for proper JSON structure analysis
 */
interface BracketState {
  stack: Array<'{' | '['>;
  inString: boolean;
  escapeNext: boolean;
}

/**
 * Analyze JSON string to find structural issues
 */
function analyzeJsonStructure(json: string): BracketState {
  const state: BracketState = {
    stack: [],
    inString: false,
    escapeNext: false,
  };

  for (let i = 0; i < json.length; i++) {
    const char = json[i];

    if (state.escapeNext) {
      state.escapeNext = false;
      continue;
    }

    if (char === '\\' && state.inString) {
      state.escapeNext = true;
      continue;
    }

    if (char === '"') {
      state.inString = !state.inString;
      continue;
    }

    if (state.inString) continue;

    if (char === '{' || char === '[') {
      state.stack.push(char);
    } else if (char === '}') {
      if (state.stack.length > 0 && state.stack[state.stack.length - 1] === '{') {
        state.stack.pop();
      }
    } else if (char === ']') {
      if (state.stack.length > 0 && state.stack[state.stack.length - 1] === '[') {
        state.stack.pop();
      }
    }
  }

  return state;
}

/**
 * Attempt to repair truncated or malformed JSON with comprehensive fixes
 */
function repairJson(json: string): string {
  let repaired = json.trim();

  // Step 1: Analyze current state
  let state = analyzeJsonStructure(repaired);

  // Step 2: If we're stuck inside a string, close it properly
  if (state.inString) {
    // Find a safe truncation point - remove partial content after last complete value
    // Look for patterns like: `"key": "incomplete value` and truncate
    const patterns = [
      /,\s*"[^"]*":\s*"[^"]*$/,           // "key": "partial value
      /,\s*"[^"]*":\s*\[[^\]]*$/,         // "key": [partial array
      /,\s*"[^"]*":\s*\{[^}]*$/,          // "key": {partial object
      /,\s*"[^"]*":\s*$/,                  // "key":
      /,\s*"[^"]*$/,                       // , "partial key
      /:\s*"[^"]*$/,                       // : "partial value
    ];

    for (const pattern of patterns) {
      if (pattern.test(repaired)) {
        repaired = repaired.replace(pattern, '');
        break;
      }
    }

    // Re-analyze after truncation
    state = analyzeJsonStructure(repaired);

    // If still in string, force close it
    if (state.inString) {
      repaired += '"';
      state = analyzeJsonStructure(repaired);
    }
  }

  // Step 3: Remove trailing incomplete elements
  // Remove trailing commas, colons, incomplete key-value pairs
  repaired = repaired
    .replace(/,\s*"[^"]*":\s*$/g, '')     // Remove incomplete key-value
    .replace(/,\s*"[^"]*$/g, '')          // Remove incomplete key
    .replace(/,\s*$/g, '')                // Remove trailing comma
    .replace(/:\s*$/g, ': null')          // Complete hanging colon with null
    .replace(/,(\s*[\]}])/g, '$1');       // Remove commas before closing brackets

  // Step 4: Close unclosed brackets and braces in correct order
  state = analyzeJsonStructure(repaired);
  
  // Close in reverse order (LIFO)
  while (state.stack.length > 0) {
    const openBracket = state.stack.pop();
    if (openBracket === '{') {
      repaired += '}';
    } else if (openBracket === '[') {
      repaired += ']';
    }
  }

  // Step 5: Final cleanup - remove any double commas or other artifacts
  repaired = repaired
    .replace(/,\s*,/g, ',')               // Double commas
    .replace(/\[\s*,/g, '[')              // Comma after opening bracket
    .replace(/{\s*,/g, '{')               // Comma after opening brace
    .replace(/,\s*\]/g, ']')              // Comma before closing bracket
    .replace(/,\s*}/g, '}');              // Comma before closing brace

  return repaired;
}

/**
 * Escape unescaped special characters within string values
 */
function fixStringEscaping(json: string): string {
  let result = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < json.length; i++) {
    const char = json[i];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      // Check if this is a valid escape sequence
      const nextChar = json[i + 1];
      const validEscapes = ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'];
      if (nextChar && validEscapes.includes(nextChar)) {
        result += char;
        escapeNext = true;
      } else {
        // Invalid escape - double the backslash
        result += '\\\\';
      }
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString) {
      // Escape special characters that should be escaped in JSON strings
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else if (char === '\f') {
        result += '\\f';
      } else if (char === '\b') {
        result += '\\b';
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }

  return result;
}

/**
 * Extract and clean JSON from response that may contain markdown or other content
 */
function extractJsonFromResponse(response: string): string {
  // Try to find JSON in markdown code blocks first
  const codeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch?.[1]) {
    const content = codeBlockMatch[1].trim();
    if (content.startsWith('{')) {
      return content;
    }
  }

  // Find the outermost JSON object
  let depth = 0;
  let startIndex = -1;
  let endIndex = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < response.length; i++) {
    const char = response[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      if (depth === 0) {
        startIndex = i;
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && startIndex !== -1) {
        endIndex = i;
        break;
      }
    }
  }

  // If we found a complete object, return it
  if (startIndex !== -1 && endIndex !== -1) {
    return response.substring(startIndex, endIndex + 1);
  }

  // If we found an opening brace but no closing, return from start to end
  if (startIndex !== -1) {
    return response.substring(startIndex);
  }

  // Fallback to simple regex match
  const jsonMatch = response.match(/\{[\s\S]*\}?/);
  return jsonMatch ? jsonMatch[0] : response;
}

/**
 * Validate and sanitize a ReviewIssue object
 */
function sanitizeIssue(issue: Partial<ReviewIssue>): ReviewIssue | null {
  if (!issue || typeof issue !== 'object') return null;

  // Required fields
  if (!issue.file || typeof issue.file !== 'string') return null;
  if (typeof issue.line !== 'number' || !Number.isFinite(issue.line) || issue.line < 1) {
    issue.line = 1; // Default to line 1 if invalid
  }

  // Validate and default severity
  const validSeverities = ['critical', 'warning', 'suggestion', 'info'];
  if (!issue.severity || !validSeverities.includes(issue.severity)) {
    issue.severity = 'info';
  }

  // Validate and default category
  const validCategories = ['bug', 'security', 'performance', 'style', 'logic', 'error_handling', 'testing', 'documentation'];
  if (!issue.category || !validCategories.includes(issue.category)) {
    issue.category = 'style';
  }

  // Required string fields with defaults
  issue.title = typeof issue.title === 'string' ? issue.title : 'Untitled Issue';
  issue.description = typeof issue.description === 'string' ? issue.description : '';
  issue.suggestion = typeof issue.suggestion === 'string' ? issue.suggestion : undefined;
  issue.ruleId = typeof issue.ruleId === 'string' ? issue.ruleId : undefined;

  const combinedText = [
    issue.title,
    issue.description,
    issue.suggestion,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    combinedText.includes("false positive") ||
    combinedText.includes("ignore this specific automated security finding")
  ) {
    return null;
  }

  return issue as ReviewIssue;
}

/**
 * Validate and sanitize the entire ReviewResult object
 */
function sanitizeReviewResult(parsed: Partial<ReviewResult>): ReviewResult | null {
  if (!parsed || typeof parsed !== 'object') return null;

  // Validate required fields
  if (!parsed.summary || typeof parsed.summary !== 'string') {
    // Try to create a default summary if missing
    if (Array.isArray(parsed.issues) && parsed.issues.length > 0) {
      parsed.summary = `Found ${parsed.issues.length} issue(s) in the code review.`;
    } else {
      return null; // Cannot recover without summary and issues
    }
  }

  // Validate and default riskLevel
  const validRiskLevels = ['low', 'medium', 'high', 'critical'];
  if (!parsed.riskLevel || !validRiskLevels.includes(parsed.riskLevel)) {
    // Infer risk level from issues if possible
    if (Array.isArray(parsed.issues)) {
      const hasCritical = parsed.issues.some(i => i?.severity === 'critical');
      const hasWarning = parsed.issues.some(i => i?.severity === 'warning');
      parsed.riskLevel = hasCritical ? 'high' : hasWarning ? 'medium' : 'low';
    } else {
      parsed.riskLevel = 'low';
    }
  }

  // Validate and sanitize issues array
  if (!Array.isArray(parsed.issues)) {
    parsed.issues = [];
  } else {
    parsed.issues = parsed.issues
      .map(issue => sanitizeIssue(issue))
      .filter((issue): issue is ReviewIssue => issue !== null);
  }

  // Validate and default positives
  if (!Array.isArray(parsed.positives)) {
    parsed.positives = [];
  } else {
    parsed.positives = parsed.positives.filter(p => typeof p === 'string');
  }

  // Validate and default recommendation
  const validRecommendations = ['approve', 'request_changes', 'comment'];
  if (!parsed.recommendation || !validRecommendations.includes(parsed.recommendation)) {
    // Infer recommendation from issues
    const hasCritical = parsed.issues.some(i => i.severity === 'critical');
    const hasWarning = parsed.issues.some(i => i.severity === 'warning');
    parsed.recommendation = hasCritical ? 'request_changes' : hasWarning ? 'comment' : 'approve';
  }

  return parsed as ReviewResult;
}

/**
 * Parse Gemini response to ReviewResult with comprehensive error recovery
 */
export function parseReviewResponse(response: string): ReviewResult | null {
  if (!response || typeof response !== 'string' || response.trim().length === 0) {
    console.error("[parseReviewResponse] Empty or invalid response");
    return null;
  }

  try {
    // Step 1: Extract JSON content from response
    let jsonContent = extractJsonFromResponse(response);

    // Step 2: Clean control characters (preserve \n, \r for later handling)
    jsonContent = jsonContent.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');

    // Define parsing strategies in order of aggressiveness
    const strategies: Array<{ name: string; fn: () => unknown }> = [
      {
        name: 'Direct parse',
        fn: () => JSON.parse(jsonContent),
      },
      {
        name: 'Fix string escaping',
        fn: () => JSON.parse(fixStringEscaping(jsonContent)),
      },
      {
        name: 'Repair truncated JSON',
        fn: () => JSON.parse(repairJson(jsonContent)),
      },
      {
        name: 'Fix escaping + repair',
        fn: () => JSON.parse(repairJson(fixStringEscaping(jsonContent))),
      },
      {
        name: 'Aggressive string escape + repair',
        fn: () => {
          // More aggressive: escape ALL special chars in string values
          let fixed = jsonContent;
          // Replace problematic characters outside of proper escaping
          fixed = fixed.replace(/[\u0000-\u001F]/g, (match) => {
            const code = match.charCodeAt(0);
            switch (code) {
              case 0x09: return '\\t';
              case 0x0A: return '\\n';
              case 0x0D: return '\\r';
              default: return ' ';
            }
          });
          return JSON.parse(repairJson(fixed));
        },
      },
      {
        name: 'Nuclear option - regex extraction',
        fn: () => {
          // Last resort: try to extract key fields using regex
          const summaryMatch = jsonContent.match(/"summary"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
          const riskMatch = jsonContent.match(/"riskLevel"\s*:\s*"(low|medium|high|critical)"/);
          const recommendationMatch = jsonContent.match(/"recommendation"\s*:\s*"(approve|request_changes|comment)"/);

          if (!summaryMatch || !riskMatch) {
            throw new Error("Cannot extract required fields");
          }

          // Extract issues array if possible
          const issuesMatch = jsonContent.match(/"issues"\s*:\s*\[([\s\S]*?)\]/);
          let issues: ReviewIssue[] = [];
          
          if (issuesMatch?.[1]) {
            try {
              // Try to parse issues array
              const issuesJson = '[' + issuesMatch[1] + ']';
              const parsedIssues = JSON.parse(repairJson(issuesJson));
              if (Array.isArray(parsedIssues)) {
                issues = parsedIssues
                  .map(i => sanitizeIssue(i))
                  .filter((i): i is ReviewIssue => i !== null);
              }
            } catch {
              // Ignore issues parsing failure
            }
          }

          // Extract positives if possible
          const positivesMatch = jsonContent.match(/"positives"\s*:\s*\[([\s\S]*?)\]/);
          let positives: string[] = [];
          
          if (positivesMatch?.[1]) {
            try {
              const positivesJson = '[' + positivesMatch[1] + ']';
              const parsedPositives = JSON.parse(repairJson(positivesJson));
              if (Array.isArray(parsedPositives)) {
                positives = parsedPositives.filter(p => typeof p === 'string');
              }
            } catch {
              // Ignore positives parsing failure
            }
          }

          return {
            summary: (summaryMatch[1] ?? '').replace(/\\"/g, '"').replace(/\\n/g, '\n'),
            riskLevel: riskMatch[1] as ReviewResult['riskLevel'],
            issues,
            positives,
            recommendation: recommendationMatch?.[1] || 'comment',
          };
        },
      },
    ];

    let parsed: ReviewResult | null = null;
    let lastError: Error | null = null;

    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      if (!strategy) continue;
      
      try {
        const result = strategy.fn();
        if (result && typeof result === 'object') {
          // Validate and sanitize the result
          parsed = sanitizeReviewResult(result as Partial<ReviewResult>);
          if (parsed) {
            if (i > 0) {
              console.warn(`[parseReviewResponse] Parsed using strategy ${i + 1}: ${strategy.name}`);
            }
            break;
          }
        }
      } catch (e) {
        lastError = e as Error;
        if (i === 0) {
          console.warn("[parseReviewResponse] Standard JSON parse failed, trying fallback strategies...");
        }
      }
    }

    if (!parsed) {
      console.error("[parseReviewResponse] All JSON parse strategies failed:", lastError?.message);
      console.error("[parseReviewResponse] Response preview (first 500 chars):", jsonContent.substring(0, 500));
      console.error("[parseReviewResponse] Response preview (last 200 chars):", jsonContent.substring(jsonContent.length - 200));
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("[parseReviewResponse] Unexpected error:", error);
    return null;
  }
}

/**
 * Format review for GitHub comment
 */
export interface DocstringSuggestion {
  path: string;
  line: number;
  language?: string;
  docstring: string;
  signatureLine: string;
}

const SEVERITY_ORDER: Record<ReviewIssue["severity"], number> = {
  critical: 0,
  warning: 1,
  suggestion: 2,
  info: 3,
};

const SEVERITY_LABEL: Record<ReviewIssue["severity"], string> = {
  critical: "Critical",
  warning: "Warning",
  suggestion: "Suggestion",
  info: "Info",
};

/** Blocking-level findings get inline comments; suggestions and info stay in the summary */
function isMajorIssue(issue: ReviewIssue): boolean {
  return issue.severity === "critical" || issue.severity === "warning";
}

function sortBySeverity(issues: ReviewIssue[]): ReviewIssue[] {
  return [...issues].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );
}

/** Text safe inside a markdown table cell */
function tableCell(text: string): string {
  return text.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function getMissingTestCount(testCoverage?: TestCoverageData | null): number {
  return Array.isArray(testCoverage?.missingTests) ? testCoverage.missingTests.length : 0;
}

/**
 * Verdict headline derived only from the final recommendation (see review-verdict.ts),
 * so it always matches the GitHub review event.
 */
function formatVerdict(review: ReviewResult): string {
  if (review.recommendation === "request_changes") return "Changes requested";
  if (review.recommendation === "approve") return "Ready to merge";
  return review.issues.some((issue) => issue.severity === "warning")
    ? "Worth fixing before merge"
    : "Non-blocking comments";
}

/** "2 critical, 1 warning, 3 minor" */
function formatFindingCounts(issues: ReviewIssue[]): string {
  if (issues.length === 0) return "No issues found";
  const critical = issues.filter((i) => i.severity === "critical").length;
  const warning = issues.filter((i) => i.severity === "warning").length;
  const minor = issues.length - critical - warning;
  return [
    critical ? `${critical} critical` : "",
    warning ? pluralize(warning, "warning") : "",
    minor ? `${minor} minor` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/** Full write-up of one issue, for findings that cannot be shown as inline comments */
function formatIssueDetail(issue: ReviewIssue): string {
  let text = `**${SEVERITY_LABEL[issue.severity] ?? "Info"}: ${issue.title}**  \n`;
  text += `\`${issue.file}:${issue.line}\` · ${issue.category}\n\n`;
  if (issue.description) text += `${issue.description}\n\n`;
  if (issue.suggestion) text += `**Suggested fix:** ${issue.suggestion}\n\n`;
  return text;
}

function details(summary: string, body: string): string {
  return `<details>\n<summary>${summary}</summary>\n\n${body.trim()}\n\n</details>\n\n`;
}

/**
 * Main GitHub review body. Modeled on the short format of current AI reviewers: verdict and
 * confidence first, one findings table (details live in the inline comments), and everything
 * secondary (minor suggestions, impact, diagrams, test gaps) collapsed.
 *
 * commentableLines: lines GitHub can anchor inline comments to. Major findings outside them are
 * written out in full here, because they get no inline comment.
 */
export function formatReviewForGitHub(
  review: ReviewResult,
  options: {
    confidenceScore?: number;
    sequenceDiagram?: string | null;
    docstringSuggestions?: DocstringSuggestion[] | null;
    blastRadius?: BlastRadiusData | null;
    testCoverage?: TestCoverageData | null;
    commentableLines?: Map<string, Set<number>>;
  } = {}
): string {
  const { confidenceScore, sequenceDiagram, docstringSuggestions, blastRadius, testCoverage, commentableLines } =
    options;

  const issues = sortBySeverity(review.issues);
  const major = issues.filter(isMajorIssue);
  const minor = issues.filter((issue) => !isMajorIssue(issue));
  const isInline = (issue: ReviewIssue) =>
    !commentableLines || Boolean(commentableLines.get(issue.file)?.has(issue.line));
  const outsideDiff = major.filter((issue) => !isInline(issue));

  // Headline: verdict, risk and confidence on one line
  const headline = [
    `**${formatVerdict(review)}**`,
    `Risk: **${capitalize(review.riskLevel)}**`,
    typeof confidenceScore === "number" ? `Confidence: **${confidenceScore}/5**` : "",
    formatFindingCounts(issues),
  ].filter(Boolean);

  let comment = `## Revio Review\n\n`;
  comment += `${headline.join(" · ")}\n\n`;
  comment += `${review.summary.trim()}\n\n`;

  if (major.length > 0) {
    comment += `### Findings\n\n`;
    comment += `| Severity | Issue | Location |\n|---|---|---|\n`;
    for (const issue of major) {
      const marker = isInline(issue) ? "" : " (outside diff)";
      comment += `| ${SEVERITY_LABEL[issue.severity]} | ${tableCell(issue.title)} | \`${tableCell(`${issue.file}:${issue.line}`)}\`${marker} |\n`;
    }
    comment += `\n`;
    if (outsideDiff.length < major.length) {
      comment += `Details and fixes are in the inline comments on the changed lines.\n\n`;
    }
  }

  if (outsideDiff.length > 0) {
    comment += details(
      `Findings outside the diff (${outsideDiff.length})`,
      outsideDiff.map(formatIssueDetail).join("---\n\n")
    );
  }

  if (minor.length > 0) {
    comment += details(`Minor suggestions (${minor.length})`, minor.map(formatIssueDetail).join("---\n\n"));
  }

  if (blastRadius?.mermaid) {
    comment += details(
      `Impact: ${capitalize(blastRadius.riskLevel)} (${pluralize(blastRadius.totalImpactRadius, "downstream function")})`,
      "```mermaid\n" + blastRadius.mermaid + "\n```"
    );
  }

  if (shouldShowSequenceDiagram(sequenceDiagram ?? null)) {
    comment += details("Sequence diagram", "```mermaid\n" + sequenceDiagram + "\n```");
  }

  const missingTestCount = getMissingTestCount(testCoverage);
  if (missingTestCount > 0 && testCoverage) {
    const lines = testCoverage.missingTests.slice(0, 10).map((item) => {
      const suggestion = item.suggestedTestFiles?.[0] ? ` → \`${item.suggestedTestFiles[0]}\`` : "";
      return `- \`${item.file}\`${suggestion}`;
    });
    comment += details(
      `Test gaps: ${pluralize(missingTestCount, "changed file")} without tests (confidence: ${testCoverage.coverageConfidence})`,
      lines.join("\n")
    );
  }

  if (review.positives.length > 0) {
    comment += details(
      `Highlights (${review.positives.length})`,
      review.positives.map((positive) => `- ${positive}`).join("\n")
    );
  }

  if (docstringSuggestions && docstringSuggestions.length > 0) {
    comment += details(
      `Docstring suggestions (${docstringSuggestions.length})`,
      docstringSuggestions
        .slice(0, 10)
        .map((s) => `- \`${s.path}:${s.line}\``)
        .join("\n") + "\n\nApply them from the inline suggestions where available."
    );
  }

  comment += `---\n<sub>Reviewed by [Revio](https://revio.mayur.app). Reply with \`@revio-bot\` to ask about a finding.</sub>`;

  return comment;
}

/**
 * Inline comments for critical and warning findings (minor ones stay in the review body, so
 * the diff is not flooded with nitpicks). When commentableLines is given, issues on lines GitHub
 * cannot anchor to are skipped; they are written out in the review body instead, so one bad line
 * never drops every comment.
 */
export function createInlineComments(
  review: ReviewResult,
  commentableLines?: Map<string, Set<number>>
): Array<{ path: string; line: number; body: string }> {
  return sortBySeverity(review.issues)
    .filter(isMajorIssue)
    .filter((issue) => !commentableLines || commentableLines.get(issue.file)?.has(issue.line))
    .map((issue) => {
      let body = `**${SEVERITY_LABEL[issue.severity]}: ${issue.title}** · ${issue.category}\n\n`;
      if (issue.description) body += `${issue.description}\n\n`;
      if (issue.suggestion) body += `**Suggested fix:** ${issue.suggestion}\n`;

      return {
        path: issue.file,
        line: issue.line,
        body: body.trim(),
      };
    });
}
