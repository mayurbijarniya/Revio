import { z } from "zod";

/**
 * Severity levels for review issues
 */
export const SeverityLevels = ["critical", "warning", "suggestion", "info"] as const;
export type SeverityLevel = (typeof SeverityLevels)[number];

/**
 * Categories for review issues
 */
export const IssueCategories = [
  "bug",
  "security",
  "performance",
  "style",
  "logic",
  "error_handling",
  "testing",
  "documentation",
] as const;
export type IssueCategory = (typeof IssueCategories)[number];

/**
 * Custom review rule definition
 */
export interface ReviewRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  pattern?: string; // Regex pattern to match
  category: IssueCategory;
  severity: SeverityLevel;
  message: string;
}

/**
 * Review settings for a repository
 */
export interface ReviewSettings {
  // Severity thresholds
  minSeverity: SeverityLevel;
  blockOnCritical: boolean;
  blockOnSecurity: boolean;

  // Focus areas
  enabledCategories: IssueCategory[];

  // Language-specific settings
  languageRules: {
    [language: string]: {
      enabled: boolean;
      strictMode?: boolean;
    };
  };

  // Custom rules
  customRules: ReviewRule[];

  // Auto-approve criteria
  autoApprove: {
    enabled: boolean;
    maxFiles: number;
    maxLinesChanged: number;
    allowedAuthors: string[];
  };
}

/**
 * Default review settings
 */
export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = {
  minSeverity: "suggestion",
  blockOnCritical: true,
  blockOnSecurity: true,
  enabledCategories: ["bug", "security", "performance", "logic", "error_handling"],
  languageRules: {},
  customRules: [],
  autoApprove: {
    enabled: false,
    maxFiles: 3,
    maxLinesChanged: 100,
    allowedAuthors: [],
  },
};

/**
 * Pre-built rule templates
 */
export const REVIEW_RULE_TEMPLATES: ReviewRule[] = [
  {
    id: "no-console-log",
    name: "No Console Logs",
    description: "Flag console.log statements in production code",
    enabled: false,
    pattern: "console\\.log\\(",
    category: "style",
    severity: "warning",
    message: "Remove console.log statements before merging to production",
  },
  {
    id: "no-todo-comments",
    name: "No TODO Comments",
    description: "Flag TODO/FIXME comments that should be resolved",
    enabled: false,
    pattern: "(TODO|FIXME|XXX|HACK):",
    category: "documentation",
    severity: "info",
    message: "Consider resolving or creating an issue for this TODO",
  },
  {
    id: "no-hardcoded-secrets",
    name: "No Hardcoded Secrets",
    description: "Detect potential hardcoded API keys or secrets",
    enabled: true,
    pattern: "(api_key|apikey|secret|password|token)\\s*[=:]\\s*['\"][^'\"]+['\"]",
    category: "security",
    severity: "critical",
    message: "Potential hardcoded secret detected. Use environment variables instead.",
  },
  {
    id: "max-function-length",
    name: "Function Length",
    description: "Flag functions that are too long",
    enabled: false,
    category: "style",
    severity: "suggestion",
    message: "Consider breaking this function into smaller, focused functions",
  },
  {
    id: "require-error-handling",
    name: "Require Error Handling",
    description: "Ensure async functions have proper error handling",
    enabled: false,
    pattern: "async\\s+function.*\\{[^}]*(?<!try)[^}]*await[^}]*(?!catch)",
    category: "error_handling",
    severity: "warning",
    message: "Async function should have try-catch or proper error handling",
  },
  {
    id: "no-any-type",
    name: "No Any Type",
    description: "Discourage use of 'any' type in TypeScript",
    enabled: false,
    pattern: ":\\s*any\\b",
    category: "style",
    severity: "warning",
    message: "Avoid using 'any' type. Consider using a more specific type.",
  },
  {
    id: "require-tests",
    name: "Require Tests",
    description: "Encourage test coverage for new functions",
    enabled: false,
    category: "testing",
    severity: "suggestion",
    message: "Consider adding unit tests for this new functionality",
  },
  {
    id: "sql-injection",
    name: "SQL Injection Prevention",
    description: "Detect potential SQL injection vulnerabilities",
    enabled: true,
    pattern: "(query|execute)\\s*\\([^)]*\\$\\{|\\+\\s*['\"].*SELECT|\\+\\s*['\"].*INSERT|\\+\\s*['\"].*UPDATE|\\+\\s*['\"].*DELETE",
    category: "security",
    severity: "critical",
    message: "Potential SQL injection vulnerability. Use parameterized queries.",
  },
];

/**
 * Zod schema for review rule
 */
export const ReviewRuleSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  enabled: z.boolean(),
  pattern: z.string().optional(),
  category: z.enum(IssueCategories),
  severity: z.enum(SeverityLevels),
  message: z.string().min(1).max(500),
});

/**
 * Zod schema for review settings
 */
export const ReviewSettingsSchema = z.object({
  minSeverity: z.enum(SeverityLevels),
  blockOnCritical: z.boolean(),
  blockOnSecurity: z.boolean(),
  enabledCategories: z.array(z.enum(IssueCategories)),
  languageRules: z.record(
    z.object({
      enabled: z.boolean(),
      strictMode: z.boolean().optional(),
    })
  ),
  customRules: z.array(ReviewRuleSchema),
  autoApprove: z.object({
    enabled: z.boolean(),
    maxFiles: z.number().min(1).max(50),
    maxLinesChanged: z.number().min(1).max(10000),
    allowedAuthors: z.array(z.string()),
  }),
});

/**
 * Parse review settings from JSON, with defaults
 */
export function parseReviewSettings(json: unknown): ReviewSettings {
  if (!json || typeof json !== "object") {
    return DEFAULT_REVIEW_SETTINGS;
  }

  const result = ReviewSettingsSchema.safeParse(json);
  if (result.success) {
    return result.data;
  }

  // Merge with defaults for partial settings
  return {
    ...DEFAULT_REVIEW_SETTINGS,
    ...(json as Partial<ReviewSettings>),
  };
}
