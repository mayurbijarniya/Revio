/**
 * End-to-end test of the Revio MCP server: the official MCP SDK client talks to the real
 * /api/mcp route handler in-process (database and AI calls mocked).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, runReviewCoreMock, retrieveContextMock } = vi.hoisted(() => ({
  dbMock: {
    apiKey: { findUnique: vi.fn(), update: vi.fn() },
    repository: { findMany: vi.fn(), count: vi.fn() },
    prReview: { findFirst: vi.fn(), count: vi.fn() },
    message: { count: vi.fn() },
    usage: { count: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    codeGraph: { findUnique: vi.fn() },
  },
  runReviewCoreMock: vi.fn(),
  retrieveContextMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://revio.test" }, requireEnv: () => "test" }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("@/lib/services/review-core", () => ({ runReviewCore: runReviewCoreMock }));
vi.mock("@/lib/services/review-providers", () => ({ createReviewProviders: vi.fn(() => ({})) }));
vi.mock("@/lib/services/retriever", () => ({
  retrieveContext: retrieveContextMock,
  retrieveMultiRepoContext: retrieveContextMock,
  formatContextForPrompt: vi.fn(),
}));

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { POST, GET, DELETE } from "./route";
import { buildCodeGraph } from "@/lib/services/code-graph";
import { generateApiKey } from "@/lib/api-keys";

const API_KEY = generateApiKey();

const repository = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "acme/shop",
  name: "shop",
  private: false,
  language: "TypeScript",
  indexStatus: "indexed",
  indexedAt: new Date("2026-11-10T00:00:00Z"),
  fileCount: 42,
  chunkCount: 300,
  autoReview: true,
  ignoredPaths: [],
  reviewRules: {},
  organizationId: null,
};

const diff = [
  "diff --git a/src/services/pricing.ts b/src/services/pricing.ts",
  "--- a/src/services/pricing.ts",
  "+++ b/src/services/pricing.ts",
  "@@ -1,3 +1,3 @@",
  " export function price(qty: number) {",
  "-  return qty * 10;",
  "+  return qty * 10 * 100;",
  " }",
].join("\n");

async function connect(key: string | null = API_KEY): Promise<Client> {
  const handlers: Record<string, (request: Request) => Promise<Response>> = { POST, GET, DELETE };
  const transport = new StreamableHTTPClientTransport(new URL("https://revio.test/api/mcp"), {
    requestInit: key ? { headers: { Authorization: `Bearer ${key}` } } : {},
    fetch: async (url, init) => {
      const request = new Request(url, init);
      const handler = handlers[request.method];
      return handler ? handler(request) : new Response(null, { status: 405 });
    },
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

function textOf(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = result.content as Array<{ type: string; text?: string }>;
  return content.map((c) => c.text ?? "").join("\n");
}

let client: Client | null = null;

beforeEach(() => {
  dbMock.apiKey.findUnique.mockResolvedValue({ id: "key-1", userId: "user-1", revokedAt: null, lastUsedAt: new Date() });
  dbMock.repository.findMany.mockResolvedValue([repository]);
  dbMock.repository.count.mockResolvedValue(1);
  dbMock.prReview.count.mockResolvedValue(0);
  dbMock.message.count.mockResolvedValue(0);
  dbMock.usage.count.mockResolvedValue(0);
  dbMock.usage.create.mockResolvedValue({});
  dbMock.user.findUnique.mockResolvedValue({ plan: "free" });
});

afterEach(async () => {
  await client?.close().catch(() => undefined);
  client = null;
});

describe("Revio MCP server", () => {
  it("rejects requests without a valid API key", async () => {
    await expect(connect(null)).rejects.toThrow();

    dbMock.apiKey.findUnique.mockResolvedValueOnce(null);
    await expect(connect(generateApiKey())).rejects.toThrow();
  });

  it("lists its tools and the review prompt", async () => {
    client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_impact",
      "get_pr_review",
      "list_repositories",
      "review_changes",
      "search_codebase",
    ]);
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);

    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(["review-my-changes"]);
  });

  it("lists the user's repositories", async () => {
    client = await connect();
    const result = await client.callTool({ name: "list_repositories", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain("acme/shop");
    expect(textOf(result)).toContain("index: indexed");
    expect(dbMock.repository.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
  });

  it("explains when a repository is not connected", async () => {
    client = await connect();
    const result = await client.callTool({ name: "get_pr_review", arguments: { repository: "acme/other", pr_number: 3 } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Connected repositories: acme/shop");
  });

  it("returns a stored PR review with issues", async () => {
    dbMock.prReview.findFirst.mockResolvedValue({
      id: "review-1",
      prTitle: "Add bulk pricing",
      prUrl: "https://github.com/acme/shop/pull/7",
      status: "completed",
      summary: "Pricing is multiplied twice.",
      issues: [{ file: "src/services/pricing.ts", line: 2, severity: "critical", category: "bug", title: "Price multiplied by 100", description: "Totals are 100x too high.", suggestion: "Remove * 100." }],
      recommendation: "request_changes",
      riskLevel: "high",
      confidenceScore: 2,
      blastRadius: {},
      updatedAt: new Date("2026-11-17T00:00:00Z"),
    });

    client = await connect();
    const text = textOf(await client.callTool({ name: "get_pr_review", arguments: { repository: "shop", pr_number: 7 } }));
    expect(text).toContain("Request changes");
    expect(text).toContain("[critical] src/services/pricing.ts:2 (bug) Price multiplied by 100");
    expect(text).toContain("Fix: Remove * 100.");
    expect(text).toContain("https://revio.test/dashboard/reviews/review-1");
  });

  it("reviews local changes and records the usage", async () => {
    runReviewCoreMock.mockResolvedValue({
      filteredFiles: [{ path: "src/services/pricing.ts" }],
      linesChanged: 2,
      modelReview: { recommendation: "request_changes" },
      review: {
        summary: "The price is 100x too high.",
        riskLevel: "high",
        recommendation: "request_changes",
        positives: [],
        issues: [{ file: "src/services/pricing.ts", line: 2, severity: "critical", category: "bug", title: "Extra * 100", description: "Overcharges customers." }],
      },
      confidence: { score: 2 },
      blastRadius: null,
      testCoverage: { missingTests: [] },
      tokensUsed: 1234,
    });

    client = await connect();
    const result = await client.callTool({
      name: "review_changes",
      arguments: { repository: "acme/shop", diff, files: [{ path: "src/services/pricing.ts", content: "export const x = 1;" }] },
    });

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain("[critical] src/services/pricing.ts:2 (bug) Extra * 100");
    expect(runReviewCoreMock).toHaveBeenCalledWith(
      expect.objectContaining({ diff, title: "Local changes" }),
      expect.anything(),
      expect.objectContaining({ repositoryId: repository.id })
    );
    expect(dbMock.usage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", actionType: "mcp_review", repositoryId: repository.id }),
    });
  });

  it("refuses non-diff input and reviews past the monthly limit", async () => {
    client = await connect();
    const notDiff = await client.callTool({ name: "review_changes", arguments: { repository: "acme/shop", diff: "hello" } });
    expect(notDiff.isError).toBe(true);
    expect(textOf(notDiff)).toContain("git diff");

    dbMock.prReview.count.mockResolvedValue(20); // free plan: 20 reviews per month
    const limited = await client.callTool({ name: "review_changes", arguments: { repository: "acme/shop", diff } });
    expect(limited.isError).toBe(true);
    expect(textOf(limited)).toContain("Monthly review limit reached");
    expect(runReviewCoreMock).not.toHaveBeenCalled();
  });

  it("reports callers from the code graph", async () => {
    const graph = await buildCodeGraph("repo", [
      { path: "src/services/pricing.ts", language: "typescript", content: "export function price(qty: number) { return qty * 10; }\n" },
      { path: "src/checkout.ts", language: "typescript", content: 'import { price } from "./services/pricing";\nexport function checkout() { return price(2); }\n' },
    ]);
    dbMock.codeGraph.findUnique.mockResolvedValue(graph);

    client = await connect();
    const text = textOf(
      await client.callTool({
        name: "get_impact",
        arguments: { repository: "acme/shop", files: ["src/services/pricing.ts"], functions: ["price"] },
      })
    );
    expect(text).toContain("checkout (src/checkout.ts:2)");
    expect(text).toContain("src/checkout.ts");
  });

  it("returns search results with file and line", async () => {
    retrieveContextMock.mockResolvedValue({
      chunks: [{ filePath: "src/services/pricing.ts", content: "export function price() {}", language: "typescript", startLine: 1, endLine: 3, type: "function", name: "price", score: 0.82 }],
      totalTokens: 10,
    });

    client = await connect();
    const text = textOf(await client.callTool({ name: "search_codebase", arguments: { query: "how is price calculated" } }));
    expect(text).toContain("### src/services/pricing.ts:1-3 (function price, score 0.82)");
  });

  it("validates tool arguments", async () => {
    client = await connect();
    const result = await client.callTool({ name: "get_pr_review", arguments: { repository: "acme/shop", pr_number: "seven" } });
    expect(result.isError).toBe(true);
  });
});
