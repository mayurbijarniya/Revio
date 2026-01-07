/**
 * Security Scanner Service
 * Detects common security vulnerabilities in code
 */

export interface SecurityIssue {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: "secrets" | "injection" | "xss" | "auth" | "crypto" | "exposure" | "config";
  title: string;
  description: string;
  file: string;
  line: number;
  code: string;
  cwe?: string;
  owasp?: string;
  suggestion?: string;
}

interface SecurityPattern {
  id: string;
  name: string;
  pattern: RegExp;
  severity: SecurityIssue["severity"];
  category: SecurityIssue["category"];
  description: string;
  cwe?: string;
  owasp?: string;
  suggestion?: string;
  languages?: string[];
}

// Common secrets patterns
const SECRET_PATTERNS: SecurityPattern[] = [
  {
    id: "hardcoded-aws-key",
    name: "AWS Access Key",
    pattern: /(?:AKIA|A3T|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    severity: "critical",
    category: "secrets",
    description: "AWS access key detected in source code",
    cwe: "CWE-798",
    owasp: "A3:2017",
    suggestion: "Use environment variables or AWS secrets manager",
  },
  {
    id: "hardcoded-aws-secret",
    name: "AWS Secret Key",
    pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*['"][A-Za-z0-9/+=]{40}['"]/gi,
    severity: "critical",
    category: "secrets",
    description: "AWS secret key detected in source code",
    cwe: "CWE-798",
    owasp: "A3:2017",
    suggestion: "Use environment variables or AWS secrets manager",
  },
  {
    id: "hardcoded-api-key",
    name: "Generic API Key",
    pattern: /(?:api[_-]?key|apikey|api_secret)\s*[=:]\s*['"][A-Za-z0-9_\-]{20,}['"]/gi,
    severity: "high",
    category: "secrets",
    description: "API key detected in source code",
    cwe: "CWE-798",
    owasp: "A3:2017",
    suggestion: "Store API keys in environment variables",
  },
  {
    id: "hardcoded-password",
    name: "Hardcoded Password",
    pattern: /(?:password|passwd|pwd|secret)\s*[=:]\s*['"][^'"]{8,}['"]/gi,
    severity: "high",
    category: "secrets",
    description: "Hardcoded password detected",
    cwe: "CWE-798",
    owasp: "A3:2017",
    suggestion: "Use secure credential storage",
  },
  {
    id: "github-token",
    name: "GitHub Token",
    pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/g,
    severity: "critical",
    category: "secrets",
    description: "GitHub personal access token detected",
    cwe: "CWE-798",
    owasp: "A3:2017",
    suggestion: "Use GitHub secrets or environment variables",
  },
  {
    id: "jwt-token",
    name: "JWT Token",
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    severity: "high",
    category: "secrets",
    description: "JWT token detected in source code",
    cwe: "CWE-798",
    suggestion: "Tokens should not be hardcoded",
  },
  {
    id: "private-key",
    name: "Private Key",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    severity: "critical",
    category: "secrets",
    description: "Private key detected in source code",
    cwe: "CWE-321",
    owasp: "A3:2017",
    suggestion: "Store private keys in secure key management",
  },
  {
    id: "slack-webhook",
    name: "Slack Webhook",
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[A-Za-z0-9]{24}/g,
    severity: "high",
    category: "secrets",
    description: "Slack webhook URL detected",
    cwe: "CWE-798",
    suggestion: "Store webhook URLs in environment variables",
  },
  {
    id: "stripe-key",
    name: "Stripe API Key",
    pattern: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}/g,
    severity: "critical",
    category: "secrets",
    description: "Stripe API key detected",
    cwe: "CWE-798",
    suggestion: "Use environment variables for Stripe keys",
  },
];

// SQL Injection patterns
const SQL_INJECTION_PATTERNS: SecurityPattern[] = [
  {
    id: "sql-string-concat",
    name: "SQL String Concatenation",
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\s+.*?\+\s*(?:req\.|request\.|params\.|query\.)/gi,
    severity: "critical",
    category: "injection",
    description: "SQL query with string concatenation detected",
    cwe: "CWE-89",
    owasp: "A1:2017",
    suggestion: "Use parameterized queries or prepared statements",
    languages: ["javascript", "typescript", "python", "java", "php"],
  },
  {
    id: "sql-template-literal",
    name: "SQL Template Literal",
    pattern: /(?:query|execute|raw)\s*\(\s*`[^`]*\$\{[^}]*(?:req|request|params|query|body)[^}]*\}[^`]*`/gi,
    severity: "critical",
    category: "injection",
    description: "SQL query with template literal injection",
    cwe: "CWE-89",
    owasp: "A1:2017",
    suggestion: "Use parameterized queries",
    languages: ["javascript", "typescript"],
  },
  {
    id: "sql-format-string",
    name: "SQL Format String",
    pattern: /(?:execute|cursor\.execute)\s*\(\s*['"][^'"]*%s[^'"]*['"]\s*%/gi,
    severity: "critical",
    category: "injection",
    description: "SQL query with format string injection",
    cwe: "CWE-89",
    owasp: "A1:2017",
    suggestion: "Use parameterized queries with %s placeholders",
    languages: ["python"],
  },
];

// XSS patterns
const XSS_PATTERNS: SecurityPattern[] = [
  {
    id: "innerHTML-assignment",
    name: "innerHTML Assignment",
    pattern: /\.innerHTML\s*=\s*(?!['"`])/g,
    severity: "high",
    category: "xss",
    description: "Direct innerHTML assignment with dynamic content",
    cwe: "CWE-79",
    owasp: "A7:2017",
    suggestion: "Use textContent or sanitize HTML input",
    languages: ["javascript", "typescript"],
  },
  {
    id: "document-write",
    name: "document.write",
    pattern: /document\.write\s*\(/g,
    severity: "medium",
    category: "xss",
    description: "document.write can lead to XSS vulnerabilities",
    cwe: "CWE-79",
    owasp: "A7:2017",
    suggestion: "Use DOM manipulation methods instead",
    languages: ["javascript", "typescript"],
  },
  {
    id: "eval-usage",
    name: "eval Usage",
    pattern: /\beval\s*\(/g,
    severity: "high",
    category: "xss",
    description: "eval() with dynamic content is dangerous",
    cwe: "CWE-95",
    owasp: "A1:2017",
    suggestion: "Avoid eval(), use safer alternatives",
    languages: ["javascript", "typescript", "python"],
  },
  {
    id: "dangerouslySetInnerHTML",
    name: "dangerouslySetInnerHTML",
    pattern: /dangerouslySetInnerHTML\s*=\s*\{/g,
    severity: "medium",
    category: "xss",
    description: "React dangerouslySetInnerHTML usage",
    cwe: "CWE-79",
    owasp: "A7:2017",
    suggestion: "Sanitize HTML content before rendering",
    languages: ["javascript", "typescript"],
  },
];

// Command Injection patterns
const COMMAND_INJECTION_PATTERNS: SecurityPattern[] = [
  {
    id: "exec-user-input",
    name: "Command Execution",
    pattern: /(?:exec|spawn|execSync|spawnSync|system|popen)\s*\([^)]*(?:req\.|request\.|params\.|query\.|body\.)/gi,
    severity: "critical",
    category: "injection",
    description: "Command execution with user input",
    cwe: "CWE-78",
    owasp: "A1:2017",
    suggestion: "Avoid executing commands with user input",
    languages: ["javascript", "typescript", "python", "ruby", "php"],
  },
  {
    id: "shell-true",
    name: "Shell True Option",
    pattern: /(?:subprocess|exec|spawn)\s*\([^)]*shell\s*[:=]\s*[Tt]rue/g,
    severity: "high",
    category: "injection",
    description: "Shell execution enabled - potential command injection",
    cwe: "CWE-78",
    owasp: "A1:2017",
    suggestion: "Avoid shell=True when possible",
    languages: ["python"],
  },
];

// Authentication/Authorization patterns
const AUTH_PATTERNS: SecurityPattern[] = [
  {
    id: "jwt-none-alg",
    name: "JWT None Algorithm",
    pattern: /(?:algorithm|alg)\s*[:=]\s*['"]none['"]/gi,
    severity: "critical",
    category: "auth",
    description: "JWT with 'none' algorithm is insecure",
    cwe: "CWE-327",
    suggestion: "Use a secure signing algorithm like RS256 or HS256",
  },
  {
    id: "weak-jwt-secret",
    name: "Weak JWT Secret",
    pattern: /(?:jwt|token).*(?:secret|key)\s*[:=]\s*['"][^'"]{1,15}['"]/gi,
    severity: "high",
    category: "auth",
    description: "JWT secret appears to be weak (less than 16 characters)",
    cwe: "CWE-326",
    suggestion: "Use a strong, random secret of at least 32 characters",
  },
  {
    id: "disabled-csrf",
    name: "Disabled CSRF Protection",
    pattern: /csrf\s*[:=]\s*false|disable.*csrf|csrf.*disable/gi,
    severity: "high",
    category: "auth",
    description: "CSRF protection appears to be disabled",
    cwe: "CWE-352",
    owasp: "A5:2017",
    suggestion: "Enable CSRF protection",
  },
];

// Crypto patterns
const CRYPTO_PATTERNS: SecurityPattern[] = [
  {
    id: "weak-hash-md5",
    name: "Weak Hash MD5",
    pattern: /(?:md5|MD5)\s*\(/g,
    severity: "medium",
    category: "crypto",
    description: "MD5 is cryptographically weak",
    cwe: "CWE-328",
    suggestion: "Use SHA-256 or stronger hashing algorithms",
  },
  {
    id: "weak-hash-sha1",
    name: "Weak Hash SHA1",
    pattern: /(?:sha1|SHA1)\s*\(/g,
    severity: "medium",
    category: "crypto",
    description: "SHA1 is cryptographically weak",
    cwe: "CWE-328",
    suggestion: "Use SHA-256 or stronger hashing algorithms",
  },
  {
    id: "insecure-random",
    name: "Insecure Random",
    pattern: /Math\.random\s*\(\)/g,
    severity: "medium",
    category: "crypto",
    description: "Math.random() is not cryptographically secure",
    cwe: "CWE-330",
    suggestion: "Use crypto.randomBytes() or crypto.getRandomValues()",
    languages: ["javascript", "typescript"],
  },
  {
    id: "weak-cipher-des",
    name: "Weak Cipher DES",
    pattern: /(?:DES|des|3DES|3des|DES3)\s*[.(]/g,
    severity: "high",
    category: "crypto",
    description: "DES/3DES ciphers are outdated and weak",
    cwe: "CWE-327",
    suggestion: "Use AES-256 or ChaCha20",
  },
];

// Data Exposure patterns
const EXPOSURE_PATTERNS: SecurityPattern[] = [
  {
    id: "console-log-sensitive",
    name: "Console Log Sensitive Data",
    pattern: /console\.log\s*\([^)]*(?:password|secret|token|key|credential|auth)/gi,
    severity: "medium",
    category: "exposure",
    description: "Logging potentially sensitive data",
    cwe: "CWE-532",
    suggestion: "Remove sensitive data from logs",
  },
  {
    id: "error-stack-exposure",
    name: "Stack Trace Exposure",
    pattern: /(?:res|response)\.(?:send|json)\s*\([^)]*(?:err|error)\.stack/gi,
    severity: "medium",
    category: "exposure",
    description: "Stack trace exposed in API response",
    cwe: "CWE-209",
    suggestion: "Don't expose stack traces in production",
  },
];

// Configuration patterns
const CONFIG_PATTERNS: SecurityPattern[] = [
  {
    id: "cors-wildcard",
    name: "CORS Wildcard",
    pattern: /(?:Access-Control-Allow-Origin|cors.*origin)\s*[:=]\s*['"]\*['"]/gi,
    severity: "medium",
    category: "config",
    description: "CORS allows all origins",
    cwe: "CWE-942",
    owasp: "A6:2017",
    suggestion: "Restrict CORS to specific trusted origins",
  },
  {
    id: "debug-mode-production",
    name: "Debug Mode",
    pattern: /(?:debug|DEBUG)\s*[:=]\s*(?:true|True|1|['"]true['"])/g,
    severity: "medium",
    category: "config",
    description: "Debug mode may be enabled",
    cwe: "CWE-489",
    suggestion: "Disable debug mode in production",
  },
  {
    id: "ssl-verify-disabled",
    name: "SSL Verification Disabled",
    pattern: /(?:verify|rejectUnauthorized|ssl_verify)\s*[:=]\s*(?:false|False|0)/g,
    severity: "high",
    category: "config",
    description: "SSL certificate verification disabled",
    cwe: "CWE-295",
    suggestion: "Enable SSL certificate verification",
  },
];

// Combine all patterns
const ALL_PATTERNS: SecurityPattern[] = [
  ...SECRET_PATTERNS,
  ...SQL_INJECTION_PATTERNS,
  ...XSS_PATTERNS,
  ...COMMAND_INJECTION_PATTERNS,
  ...AUTH_PATTERNS,
  ...CRYPTO_PATTERNS,
  ...EXPOSURE_PATTERNS,
  ...CONFIG_PATTERNS,
];

/**
 * Scan code for security vulnerabilities
 */
export function scanCode(
  file: string,
  content: string,
  language: string
): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  const lines = content.split("\n");

  for (const pattern of ALL_PATTERNS) {
    // Skip patterns not applicable to this language
    if (pattern.languages && !pattern.languages.includes(language)) {
      continue;
    }

    // Reset regex state
    pattern.pattern.lastIndex = 0;

    let match;
    while ((match = pattern.pattern.exec(content)) !== null) {
      // Find line number
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split("\n").length;
      const codeLine = lines[lineNumber - 1] || "";

      // Skip if in comment
      if (isInComment(codeLine, language)) {
        continue;
      }

      issues.push({
        id: pattern.id,
        severity: pattern.severity,
        category: pattern.category,
        title: pattern.name,
        description: pattern.description,
        file,
        line: lineNumber,
        code: codeLine.trim(),
        cwe: pattern.cwe,
        owasp: pattern.owasp,
        suggestion: pattern.suggestion,
      });
    }
  }

  return issues;
}

/**
 * Check if line is a comment
 */
function isInComment(line: string, language: string): boolean {
  const trimmed = line.trim();

  // Single line comments
  if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
    return true;
  }

  // Python/Ruby docstrings
  if (
    (language === "python" || language === "ruby") &&
    (trimmed.startsWith('"""') || trimmed.startsWith("'''"))
  ) {
    return true;
  }

  // Block comment indicators
  if (trimmed.startsWith("/*") || trimmed.startsWith("*")) {
    return true;
  }

  return false;
}

/**
 * Calculate security score based on issues
 */
export function calculateSecurityScore(issues: SecurityIssue[]): number {
  if (issues.length === 0) return 100;

  // Weight by severity
  const weights = {
    critical: 25,
    high: 15,
    medium: 8,
    low: 3,
    info: 1,
  };

  let penalty = 0;
  for (const issue of issues) {
    penalty += weights[issue.severity];
  }

  // Cap penalty at 100
  return Math.max(0, 100 - Math.min(100, penalty));
}

/**
 * Get severity counts
 */
export function getSeverityCounts(
  issues: SecurityIssue[]
): Record<SecurityIssue["severity"], number> {
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const issue of issues) {
    counts[issue.severity]++;
  }

  return counts;
}

/**
 * Get category counts
 */
export function getCategoryCounts(
  issues: SecurityIssue[]
): Record<SecurityIssue["category"], number> {
  const counts: Record<SecurityIssue["category"], number> = {
    secrets: 0,
    injection: 0,
    xss: 0,
    auth: 0,
    crypto: 0,
    exposure: 0,
    config: 0,
  };

  for (const issue of issues) {
    counts[issue.category]++;
  }

  return counts;
}

/**
 * Scan multiple files and aggregate results
 */
export function scanFiles(
  files: Array<{ path: string; content: string; language: string }>
): {
  issues: SecurityIssue[];
  score: number;
  severityCounts: Record<SecurityIssue["severity"], number>;
  categoryCounts: Record<SecurityIssue["category"], number>;
} {
  const allIssues: SecurityIssue[] = [];

  for (const file of files) {
    const issues = scanCode(file.path, file.content, file.language);
    allIssues.push(...issues);
  }

  return {
    issues: allIssues,
    score: calculateSecurityScore(allIssues),
    severityCounts: getSeverityCounts(allIssues),
    categoryCounts: getCategoryCounts(allIssues),
  };
}
