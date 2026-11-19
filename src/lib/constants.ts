/**
 * Plan limits and pricing configuration
 */
export const PLAN_LIMITS = {
  free: {
    repos: 2,
    reviewsPerMonth: 20,
    messagesPerMonth: 50,
    maxFileSizeKb: 500,
    maxRepoSizeMb: 100,
    contextChunks: 10,
  },
  pro: {
    repos: 10,
    reviewsPerMonth: 200,
    messagesPerMonth: 500,
    maxFileSizeKb: 1000,
    maxRepoSizeMb: 500,
    contextChunks: 15,
  },
  team: {
    repos: -1, // unlimited
    reviewsPerMonth: -1, // unlimited
    messagesPerMonth: -1, // unlimited
    maxFileSizeKb: 2000,
    maxRepoSizeMb: 1000,
    contextChunks: 25,
  },
} as const;

/**
 * Rate limiting configuration per plan
 */
export const RATE_LIMITS = {
  free: {
    apiRequestsPerHour: 100,
    chatMessagesPerHour: 10,
    prReviewsPerHour: 5,
  },
  pro: {
    apiRequestsPerHour: 1000,
    chatMessagesPerHour: 100,
    prReviewsPerHour: 50,
  },
  team: {
    apiRequestsPerHour: 5000,
    chatMessagesPerHour: -1, // unlimited
    prReviewsPerHour: -1, // unlimited
  },
} as const;

/**
 * AI model configuration
 */
export const AI_CONFIG = {
  embedding: {
    model: "text-embedding-3-small",
    dimensions: 1536,
    maxTokens: 30000,
    /** OpenAI cap is 8192 tokens/input; minified JS can be ~1 char/token → use 6k chars to be safe across all file types */
    maxInputChars: 6_000,
  },
  chat: {
    model: "gemini-3.5-flash-lite",
    fallbackModel: "gemini-3.5-flash-lite",
    maxOutputTokens: 4096,
    temperature: 0.7,
    /** Most recent messages sent as conversation history */
    historyMessages: 20,
    /** Vector search settings shared by first messages and follow-ups */
    retrievalMaxChunks: 15,
    retrievalScoreThreshold: 0.1,
  },
  review: {
    model: "gemini-3.5-flash-lite",
    complexModel: "gemini-3.5-flash-lite",
    /**
     * Thinking effort for reviews: "minimal" | "low" | "medium" | "high".
     * Flash-Lite defaults to "minimal" (effectively no thinking), which made reviews shallow and
     * inconsistent between runs. Google recommends "medium" for complex code; "low" is the
     * cheaper fallback. Thinking tokens are billed as output tokens.
     */
    thinkingLevel: "medium",
    /** Room for thinking plus the JSON answer (thinking counts as output); billed only as used */
    maxOutputTokens: 16384,
    // No temperature: Google recommends keeping the default for Gemini 3.x models
    // Thresholds for upgrading to complex model
    complexThresholds: {
      changedFiles: 20,
      diffLength: 50000,
    },
    /**
     * DeepSeek through Subconscious (OpenAI-compatible API), chosen per user in Settings.
     * Reasoning tokens count toward max_tokens. On timeout, error or an unreadable answer the
     * review falls back to Gemini, so the timeout leaves room for that second call within the
     * serverless time limit.
     */
    deepseek: {
      baseURL: "https://api.subconscious.dev/v1",
      model: "subconscious/deepseek-v4.1-flash-marathon",
      maxOutputTokens: 24576,
      timeoutMs: 150_000,
    },
  },
} as const;

/**
 * AI providers a user can choose for PR reviews (stored in users.review_provider)
 */
export const REVIEW_PROVIDERS = ["google", "deepseek"] as const;
export type ReviewProvider = (typeof REVIEW_PROVIDERS)[number];
export const DEFAULT_REVIEW_PROVIDER: ReviewProvider = "google";

/**
 * Indexing configuration
 */
export const INDEXING_CONFIG = {
  maxFileSize: 1_000_000, // 1MB
  skipPatterns: [
    "**/node_modules/**",
    "**/vendor/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/*.min.js",
    "**/package-lock.json",
    "**/*.test.*",
    "**/__tests__/**",
  ],
  supportedExtensions: {
    javascript: [".js", ".jsx", ".mjs"],
    typescript: [".ts", ".tsx"],
    python: [".py"],
    java: [".java"],
    go: [".go"],
    ruby: [".rb"],
    rust: [".rs"],
    php: [".php"],
    csharp: [".cs"],
    cpp: [".cpp", ".cc", ".cxx", ".c", ".h", ".hpp"],
    swift: [".swift"],
  },
} as const;

/**
 * PR Review configuration
 */
export const REVIEW_CONFIG = {
  maxFiles: 50,
  maxLines: 5000,
  maxDiffBytes: 500000,
  maxIssues: 10,
  minScoreThreshold: 0.5,
  maxContextChunks: 15,
  maxContextTokens: 50000,
} as const;

/**
 * MCP server (Claude Code, Codex, ...) and personal API keys
 */
export const MCP_CONFIG = {
  serverName: "revio",
  serverVersion: "1.0.0",
  /** Every key starts with this, so leaked keys are easy to recognise and scan for */
  keyPrefix: "revio_sk_",
  maxKeysPerUser: 10,
  /** lastUsedAt is written at most this often per key, to avoid a database write per request */
  lastUsedUpdateIntervalMs: 5 * 60 * 1000,
  /** review_changes: optional full file contents sent by the client for the PR-aware graph */
  maxReviewFiles: 40,
  maxReviewFileChars: 300_000,
  maxSearchResults: 15,
  maxImpactFiles: 50,
  /** Usage.actionType for reviews requested through MCP (they count toward review limits) */
  reviewUsageAction: "mcp_review",
} as const;

/**
 * Webhook configuration
 */
export const WEBHOOK_CONFIG = {
  maxRetries: 3,
  retryDelays: [5, 30, 300], // seconds
  timeout: 30000, // 30 seconds
  signatureAlgorithm: "sha256",
  ignoredEvents: ["ping", "star"],
  reviewTriggers: ["opened", "synchronize", "reopened", "ready_for_review"],
} as const;

/**
 * Error codes for API responses
 */
export const ERROR_CODES = {
  // Authentication
  AUTH_001: "Invalid GitHub token",
  AUTH_002: "Session expired",
  AUTH_003: "Insufficient permissions",

  // Repository
  REPO_001: "Repository not found",
  REPO_002: "Repository access denied",
  REPO_003: "Repository already connected",

  // Indexing
  INDEX_001: "Indexing failed - repository too large",
  INDEX_002: "Indexing failed - unsupported language",
  INDEX_003: "Indexing in progress",

  // Chat
  CHAT_001: "No context found for query",
  CHAT_002: "Conversation not found",

  // PR Review
  REVIEW_001: "PR too large to review (>5000 lines)",
  REVIEW_002: "PR not found",
  REVIEW_003: "Review generation failed",

  // Rate Limiting
  LIMIT_001: "Monthly review limit exceeded",
  LIMIT_002: "Hourly API limit exceeded",
  LIMIT_003: "Repository limit reached",

  // General
  INTERNAL_001: "Internal server error",
  VALIDATION_001: "Invalid request parameters",
} as const;

/**
 * Text indicators for external output (GitHub comments, emails)
 */
export const TEXT_INDICATORS = {
  severity: {
    critical: "[CRITICAL]",
    warning: "[WARNING]",
    suggestion: "[SUGGESTION]",
    info: "[INFO]",
  },
  status: {
    approved: "[APPROVED]",
    changes_requested: "[CHANGES REQUESTED]",
    commented: "[COMMENTED]",
  },
  risk: {
    low: "[LOW RISK]",
    medium: "[MEDIUM RISK]",
    high: "[HIGH RISK]",
    critical: "[CRITICAL RISK]",
  },
} as const;
