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
  },
  chat: {
    model: "gemini-2.5-flash-lite",
    fallbackModel: "gemini-2.5-flash",
    maxOutputTokens: 4096,
    temperature: 0.7,
  },
  review: {
    model: "gemini-2.5-flash-lite",
    complexModel: "gemini-2.5-flash",
    maxOutputTokens: 4096,
    temperature: 0.2,
    // Thresholds for upgrading to complex model
    complexThresholds: {
      changedFiles: 20,
      diffLength: 50000,
    },
  },
} as const;

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
