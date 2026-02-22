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

  public async detectStandards(
    owner: string,
    repo: string,
    repositoryId: string,
    defaultBranch?: string
  ): Promise<StandardsFile[]> {
    const detected: StandardsFile[] = [];

    logger.info(`Scanning repository for coding standards files`, {
      repositoryId,
      owner,
      repo,
    });

    let pathLookup: Map<string, string> | null = null;
    try {
      pathLookup = await this.buildRepositoryPathLookup(owner, repo, defaultBranch);
    } catch {
      pathLookup = null;
    }

    for (const { source, paths } of STANDARDS_FILES) {
      for (const filePath of paths) {
        const candidatePath = pathLookup?.get(filePath.toLowerCase());
        if (pathLookup && !candidatePath) {
          continue;
        }

        const resolvedPath = candidatePath ?? filePath;
        const content = await this.fetchFile(owner, repo, resolvedPath, defaultBranch);
        if (!content) {
          continue;
        }

        const parsedRules = this.parseStandardsFile(source, content);
        detected.push({ source, filePath: resolvedPath, content, parsedRules });
        logger.info(`Detected standards file: ${resolvedPath}`, {
          repositoryId,
          source,
          rulesCount: parsedRules.length,
        });
        break;
      }
    }

    return detected;
  }

  private async fetchFile(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string | null> {
    try {
      return await this.github.getFileContent(owner, repo, path, ref);
    } catch {
      return null;
    }
  }

  private async buildRepositoryPathLookup(
    owner: string,
    repo: string,
    defaultBranch?: string
  ): Promise<Map<string, string>> {
    const branch =
      defaultBranch || (await this.github.getRepo(owner, repo)).default_branch;

    const files = await this.github.getRepositoryTree(owner, repo, branch);
    const lookup = new Map<string, string>();

    for (const file of files) {
      lookup.set(file.path.toLowerCase(), file.path);
    }

    return lookup;
  }

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

  private parseClaudeMd(content: string): ParsedRule[] {
    const rules: ParsedRule[] = [];
    const lines = content.split("\n");

    let currentCategory = "General";
    for (const line of lines) {
      if (line.startsWith("##")) {
        currentCategory = line.replace(/^##\s*/, "").trim();
      }

      if (line.match(/^[\s]*[-*]\s+/) || line.match(/^\d+\.\s+/)) {
        const rule = line.replace(/^[\s]*[-*\d.]\s+/, "").trim();
        if (rule.length > 10) {
          rules.push({
            category: currentCategory,
            rule,
            severity: this.detectSeverity(rule),
          });
        }
      }

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

  private parseCursorRules(content: string): ParsedRule[] {
    const rules: ParsedRule[] = [];

    try {
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
      return this.parseGenericMarkdown(content);
    }

    return rules;
  }

  private parseMarkdownInstructions(content: string): ParsedRule[] {
    return this.parseGenericMarkdown(content);
  }

  private parseGenericMarkdown(content: string): ParsedRule[] {
    const rules: ParsedRule[] = [];
    const lines = content.split("\n");

    let currentCategory = "General";
    for (const line of lines) {
      if (line.startsWith("#")) {
        currentCategory = line.replace(/^#+\s*/, "").trim();
      }

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

  private detectSeverity(text: string): "critical" | "warning" | "suggestion" {
    const lower = text.toLowerCase();

    if (
      lower.includes("never") ||
      lower.includes("must not") ||
      lower.includes("critical") ||
      lower.includes("security") ||
      lower.includes("forbidden")
    ) {
      return "critical";
    }

    if (
      lower.includes("should not") ||
      lower.includes("avoid") ||
      lower.includes("warning") ||
      lower.includes("important")
    ) {
      return "warning";
    }

    return "suggestion";
  }

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
