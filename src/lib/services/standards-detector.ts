/**
 * Coding Standards Auto-Detection Service
 * Scans repositories for coding standards files (.claude.md, .cursorrules, agents.md, etc.)
 * Parses them and extracts rules to enhance PR reviews
 */

import { GitHubService } from "./github";
import { db } from "../db";
import { logger } from "../logger";

export interface ParsedRule {
  category: string;
  rule: string;
  severity?: "critical" | "warning" | "suggestion";
  pattern?: string;
}

export interface StandardsFile {
  source: string;
  filePath: string;
  content: string;
  parsedRules: ParsedRule[];
}

// Known coding standards files to detect
const STANDARDS_FILES = [
  { source: "claude_md", paths: [".claude/CLAUDE.md", ".claude.md", "CLAUDE.md"] },
  { source: "cursorrules", paths: [".cursorrules", ".cursor/rules", ".cursor/settings.json"] },
  { source: "agents_md", paths: ["agents.md", ".agents.md", "AGENTS.md"] },
  { source: "windsurf", paths: [".windsurf.md", "WINDSURF.md"] },
  { source: "aider", paths: [".aider/", ".aider.conf.yml"] },
  { source: "ai_folder", paths: [".ai/", ".ai/instructions.md"] },
  { source: "github_copilot", paths: [".github/copilot-instructions.md"] },
];

export class StandardsDetector {
  private github: GitHubService;

  constructor(accessToken: string) {
    this.github = new GitHubService(accessToken);
  }

  /**
   * Scan repository for coding standards files
   */
  public async detectStandards(
    owner: string,
    repo: string,
    repositoryId: string
  ): Promise<StandardsFile[]> {
    const detected: StandardsFile[] = [];

    logger.info(`Scanning repository for coding standards files`, {
      repositoryId,
      owner,
      repo,
    });

    for (const { source, paths } of STANDARDS_FILES) {
      for (const filePath of paths) {
        try {
          const content = await this.fetchFile(owner, repo, filePath);
          if (content) {
            const parsedRules = this.parseStandardsFile(source, content);
            detected.push({ source, filePath, content, parsedRules });
            logger.info(`Detected standards file: ${filePath}`, {
              repositoryId,
              source,
              rulesCount: parsedRules.length,
            });
            break; // Found one for this source, move to next
          }
        } catch {
          // File doesn't exist, continue to next
          continue;
        }
      }
    }

    return detected;
  }

  /**
   * Fetch file from GitHub repository
   */
  private async fetchFile(owner: string, repo: string, path: string): Promise<string | null> {
    return this.github.getFileContent(owner, repo, path);
  }


  /**
   * Parse standards file based on its source type
   */
  private parseStandardsFile(source: string, content: string): ParsedRule[] {
    switch (source) {
      case "claude_md":
        return this.parseClaudeMd(content);
      case "cursorrules":
        return this.parseCursorRules(content);
      case "agents_md":
      case "windsurf":
        return this.parseMarkdownInstructions(content);
      default:
        return this.parseGenericMarkdown(content);
    }
  }

  /**
   * Parse .claude.md / CLAUDE.md files
   */
  private parseClaudeMd(content: string): ParsedRule[] {
    const rules: ParsedRule[] = [];
    const lines = content.split("\n");

    let currentCategory = "General";
    for (const line of lines) {
      // Detect category headers
      if (line.startsWith("##")) {
        currentCategory = line.replace(/^##\s*/, "").trim();
      }

      // Detect rules (bullets or numbered lists)
      if (line.match(/^[\s]*[-*]\s+/) || line.match(/^\d+\.\s+/)) {
        const rule = line.replace(/^[\s]*[-*\d.]\s+/, "").trim();
        if (rule.length > 10) {
          // Filter out very short lines
          rules.push({
            category: currentCategory,
            rule,
            severity: this.detectSeverity(rule),
          });
        }
      }

      // Detect IMPORTANT/CRITICAL markers
      if (line.includes("IMPORTANT:") || line.includes("CRITICAL:")) {
        rules.push({
          category: currentCategory,
          rule: line.replace(/^[\s]*[-*]\s*/, "").trim(),
          severity: "critical",
        });
      }
    }

    return rules;
  }

  /**
   * Parse .cursorrules files (JSON or plain text)
   */
  private parseCursorRules(content: string): ParsedRule[] {
    const rules: ParsedRule[] = [];

    try {
      // Try parsing as JSON first
      const json = JSON.parse(content);
      if (json.rules && Array.isArray(json.rules)) {
        for (const rule of json.rules) {
          rules.push({
            category: rule.category || "General",
            rule: rule.description || rule.rule || String(rule),
            severity: rule.severity,
            pattern: rule.pattern,
          });
        }
      }
    } catch {
      // Not JSON, parse as plain text
      return this.parseGenericMarkdown(content);
    }

    return rules;
  }

  /**
   * Parse agents.md or similar markdown instruction files
   */
  private parseMarkdownInstructions(content: string): ParsedRule[] {
    return this.parseGenericMarkdown(content);
  }

  /**
   * Generic markdown parser for instruction files
   */
  private parseGenericMarkdown(content: string): ParsedRule[] {
    const rules: ParsedRule[] = [];
    const lines = content.split("\n");

    let currentCategory = "General";
    for (const line of lines) {
      // Detect headers as categories
      if (line.startsWith("#")) {
        currentCategory = line.replace(/^#+\s*/, "").trim();
      }

      // Detect rule lines (bullets, numbers, or imperative sentences)
      if (
        line.match(/^[\s]*[-*]\s+/) ||
        line.match(/^\d+\.\s+/) ||
        line.match(/^(Always|Never|Must|Should|Don't|Do not|Prefer|Avoid)/i)
      ) {
        const rule = line.replace(/^[\s]*[-*\d.]\s*/, "").trim();
        if (rule.length > 15) {
          rules.push({
            category: currentCategory,
            rule,
            severity: this.detectSeverity(rule),
          });
        }
      }
    }

    return rules;
  }

  /**
   * Detect rule severity from text
   */
  private detectSeverity(text: string): "critical" | "warning" | "suggestion" {
    const lower = text.toLowerCase();

    // Critical keywords
    if (
      lower.includes("never") ||
      lower.includes("must not") ||
      lower.includes("critical") ||
      lower.includes("security") ||
      lower.includes("forbidden")
    ) {
      return "critical";
    }

    // Warning keywords
    if (
      lower.includes("should not") ||
      lower.includes("avoid") ||
      lower.includes("warning") ||
      lower.includes("important")
    ) {
      return "warning";
    }

    // Default to suggestion
    return "suggestion";
  }

  /**
   * Save detected standards to database
   */
  public async saveStandards(
    repositoryId: string,
    standards: StandardsFile[]
  ): Promise<void> {
    for (const standard of standards) {
      await db.codingStandards.upsert({
        where: {
          repositoryId_source: {
            repositoryId,
            source: standard.source,
          },
        },
        create: {
          repositoryId,
          source: standard.source,
          filePath: standard.filePath,
          content: standard.content,
          parsedRules: standard.parsedRules as unknown as object,
          enabled: true,
        },
        update: {
          filePath: standard.filePath,
          content: standard.content,
          parsedRules: standard.parsedRules as unknown as object,
          updatedAt: new Date(),
        },
      });
    }

    logger.info(`Saved ${standards.length} coding standards files`, {
      repositoryId,
    });
  }

  /**
   * Get all enabled standards for a repository
   */
  public static async getRepositoryStandards(
    repositoryId: string
  ): Promise<StandardsFile[]> {
    const standards = await db.codingStandards.findMany({
      where: {
        repositoryId,
        enabled: true,
      },
      orderBy: {
        detectedAt: "desc",
      },
    });

    return standards.map((s) => ({
      source: s.source,
      filePath: s.filePath,
      content: s.content,
      parsedRules: s.parsedRules as unknown as ParsedRule[],
    }));
  }

  /**
   * Format standards for PR review prompt
   */
  public static formatStandardsForPrompt(standards: StandardsFile[]): string {
    if (standards.length === 0) {
      return "";
    }

    let prompt = "\n\n## Repository Coding Standards\n\n";
    prompt +=
      "The following coding standards have been detected in this repository. ";
    prompt +=
      "Please ensure the PR follows these standards and flag any violations:\n\n";

    for (const standard of standards) {
      prompt += `### ${standard.source} (${standard.filePath})\n\n`;

      // Group rules by category
      const rulesByCategory = new Map<string, ParsedRule[]>();
      for (const rule of standard.parsedRules) {
        const category = rule.category || "General";
        if (!rulesByCategory.has(category)) {
          rulesByCategory.set(category, []);
        }
        rulesByCategory.get(category)!.push(rule);
      }

      for (const [category, rules] of rulesByCategory) {
        prompt += `**${category}:**\n`;
        for (const rule of rules) {
          const severity = rule.severity || "suggestion";
          const icon =
            severity === "critical" ? "[CRITICAL]" : severity === "warning" ? "[WARNING]" : "[TIP]";
          prompt += `${icon} ${rule.rule}\n`;
        }
        prompt += "\n";
      }
    }

    return prompt;
  }
}
