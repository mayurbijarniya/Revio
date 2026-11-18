/**
 * Revio MCP server: tools for Claude Code (and other MCP clients) backed by a user's
 * connected repositories. One server instance is created per request (stateless).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MCP_CONFIG, REVIEW_CONFIG } from "@/lib/constants";
import {
  getImpactTool,
  getPrReviewTool,
  listRepositoriesTool,
  reviewChangesTool,
  searchCodebaseTool,
  type McpContext,
  type ToolOutput,
} from "./tools";

const SERVER_INSTRUCTIONS = `Revio is an AI code review service connected to the user's GitHub repositories.
- Use review_changes to review the user's work before they push or open a PR. Pass the output of \`git diff\` (uncommitted work) or \`git diff <base>...HEAD\` (a branch). For better impact analysis also pass the full new content of the changed files.
- Use get_pr_review to fetch Revio's review of an existing pull request, then fix the reported issues.
- Use get_impact before changing a function or file to see its callers, dependent files and entry points.
- Use search_codebase for semantic search across indexed repositories.
- Repository arguments accept "owner/name" or the repository name; call list_repositories when unsure.
Reviews count toward the user's monthly Revio review limit, so call review_changes once per set of changes, not repeatedly.`;

const repositoryArg = z
  .string()
  .min(1)
  .max(255)
  .describe('Repository as "owner/name" (or just the name when unique), as listed by list_repositories');

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

function toResult(output: ToolOutput) {
  return {
    content: [{ type: "text" as const, text: output.text }],
    ...(output.isError ? { isError: true } : {}),
  };
}

/**
 * Run a tool, turning unexpected failures into a readable error instead of a protocol error
 */
async function safely(name: string, run: () => Promise<ToolOutput>) {
  try {
    return toResult(await run());
  } catch (error) {
    console.error(`[MCP] Tool ${name} failed:`, error);
    return toResult({ text: `Revio could not complete ${name} because of a server error. Please try again.`, isError: true });
  }
}

export function createRevioMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    { name: MCP_CONFIG.serverName, version: MCP_CONFIG.serverVersion },
    { instructions: SERVER_INSTRUCTIONS }
  );

  server.registerTool(
    "list_repositories",
    {
      title: "List repositories",
      description: "List the repositories connected to Revio, with their index status.",
      annotations: readOnly,
    },
    () => safely("list_repositories", () => listRepositoriesTool(ctx))
  );

  server.registerTool(
    "review_changes",
    {
      title: "Review changes",
      description:
        "Review a unified diff (for example from `git diff`) with Revio's full PR review: issues with file and line, " +
        "risk, verdict, structural impact and test gaps. Nothing is posted to GitHub. Counts toward the monthly review limit.",
      inputSchema: {
        repository: repositoryArg,
        diff: z
          .string()
          .min(1)
          .max(REVIEW_CONFIG.maxDiffBytes)
          .describe("Unified diff of the changes, e.g. the output of `git diff` or `git diff main...HEAD`"),
        title: z.string().max(300).optional().describe("Short description of the change, like a PR title"),
        description: z.string().max(5000).optional().describe("Longer context, like a PR description"),
        files: z
          .array(
            z.object({
              path: z.string().min(1).max(500).describe("Path relative to the repository root"),
              content: z.string().max(MCP_CONFIG.maxReviewFileChars).describe("Full new content of the file"),
            })
          )
          .max(MCP_CONFIG.maxReviewFiles)
          .optional()
          .describe("Optional full new content of changed files, for more accurate impact analysis"),
      },
      annotations: { ...readOnly, idempotentHint: false },
    },
    (args) => safely("review_changes", () => reviewChangesTool(ctx, args))
  );

  server.registerTool(
    "get_pr_review",
    {
      title: "Get PR review",
      description: "Fetch Revio's review of a pull request: verdict, risk, summary and every issue with file and line.",
      inputSchema: {
        repository: repositoryArg,
        pr_number: z.number().int().positive().describe("Pull request number"),
      },
      annotations: readOnly,
    },
    (args) => safely("get_pr_review", () => getPrReviewTool(ctx, args))
  );

  server.registerTool(
    "get_impact",
    {
      title: "Get change impact",
      description:
        "Show what depends on files or functions before changing them: callers in other files, dependent files and " +
        "public entry points, from Revio's code graph of the last indexed version.",
      inputSchema: {
        repository: repositoryArg,
        files: z
          .array(z.string().min(1).max(500))
          .min(1)
          .max(MCP_CONFIG.maxImpactFiles)
          .describe("File paths relative to the repository root"),
        functions: z
          .array(z.string().min(1).max(200))
          .max(50)
          .optional()
          .describe("Optional function or class names in those files; without them every definition in the files counts"),
      },
      annotations: readOnly,
    },
    (args) => safely("get_impact", () => getImpactTool(ctx, args))
  );

  server.registerTool(
    "search_codebase",
    {
      title: "Search codebase",
      description: "Semantic code search over indexed repositories. Returns the most relevant code snippets with file and line.",
      inputSchema: {
        query: z.string().min(1).max(1000).describe("What to look for, in natural language or code terms"),
        repository: repositoryArg.optional().describe("Limit the search to one repository; omit to search all indexed ones"),
        max_results: z.number().int().min(1).max(MCP_CONFIG.maxSearchResults).optional().describe("Number of snippets (default 8)"),
      },
      annotations: readOnly,
    },
    (args) => safely("search_codebase", () => searchCodebaseTool(ctx, args))
  );

  server.registerPrompt(
    "review-my-changes",
    {
      title: "Review my changes with Revio",
      description: "Review the current branch or uncommitted changes with Revio before pushing",
      argsSchema: {
        repository: z.string().optional().describe('Repository as "owner/name"; detected from git when omitted'),
        base: z.string().optional().describe("Base branch to compare against, e.g. main; uncommitted changes when omitted"),
      },
    },
    ({ repository, base }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Review my changes with Revio:",
              repository
                ? `1. The repository is ${repository}.`
                : "1. Find the repository's owner/name from `git remote get-url origin`.",
              base
                ? `2. Get the diff with \`git diff ${base}...HEAD\`.`
                : "2. Get the diff with `git diff HEAD` (uncommitted changes, staged and unstaged).",
              "3. Call the Revio review_changes tool with that diff and the full new content of the changed files.",
              "4. Summarize the verdict and issues, then offer to fix them, most severe first.",
            ].join("\n"),
          },
        },
      ],
    })
  );

  return server;
}
