import { describe, expect, it } from "vitest";
import { createInlineComments, formatReviewForGitHub, type ReviewResult } from "./review";

const review: ReviewResult = {
  summary: "Adds coupons and order cancellation; two access and pricing bugs need fixing.",
  riskLevel: "high",
  recommendation: "request_changes",
  positives: ["Cancellation restocks items in one place"],
  issues: [
    {
      file: "src/services/pricing.ts",
      line: 25,
      severity: "warning",
      category: "bug",
      title: "Tax is charged on the pre-discount subtotal",
      description: "calculateTax now receives the subtotal.",
      suggestion: "Pass the discounted amount.",
    },
    {
      file: "src/routes/orders.ts",
      line: 31,
      severity: "critical",
      category: "security",
      title: "Any user can read any order | IDOR",
      description: "GET /:id has no ownership check.",
      suggestion: "Compare order.customer_id with req.userId.",
    },
    {
      file: "src/routes/orders.ts",
      line: 3,
      severity: "suggestion",
      category: "style",
      title: "Group imports",
      description: "Minor.",
    },
    {
      file: "src/services/orders.ts",
      line: 90,
      severity: "warning",
      category: "logic",
      title: "Cancelling twice restocks twice",
      description: "No status check.",
    },
  ],
};

const commentableLines = new Map([
  ["src/routes/orders.ts", new Set([3, 31])],
  ["src/services/pricing.ts", new Set([25])],
  ["src/services/orders.ts", new Set([40])],
]);

describe("formatReviewForGitHub", () => {
  const body = formatReviewForGitHub(review, { confidenceScore: 2, commentableLines });

  it("leads with verdict, risk, confidence and counts", () => {
    expect(body).toContain("## Revio Review");
    expect(body).toContain(
      "**Changes requested** · Risk: **High** · Confidence: **2/5** · 1 critical, 2 warnings, 1 minor"
    );
    expect(body).toContain(review.summary);
  });

  it("lists major findings in one table, most severe first, with escaped cells", () => {
    const table = body.slice(body.indexOf("| Severity |"), body.indexOf("Details and fixes"));
    const rows = table.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| Severity"));
    expect(rows[0]).toBe("| Critical | Any user can read any order \\| IDOR | `src/routes/orders.ts:31` |");
    expect(rows).toHaveLength(3);
    expect(table).not.toContain("Group imports");
  });

  it("writes out findings that cannot be inline comments", () => {
    expect(body).toContain("`src/services/orders.ts:90` (outside diff)");
    expect(body).toContain("<summary>Findings outside the diff (1)</summary>");
    expect(body).toContain("**Warning: Cancelling twice restocks twice**");
  });

  it("collapses minor suggestions and highlights", () => {
    expect(body).toContain("<summary>Minor suggestions (1)</summary>");
    expect(body).toContain("<summary>Highlights (1)</summary>");
  });

  it("says ready to merge only when approving", () => {
    const clean = formatReviewForGitHub({ ...review, issues: [], positives: [], recommendation: "approve", riskLevel: "low" });
    expect(clean).toContain("**Ready to merge** · Risk: **Low** · No issues found");
    expect(clean).not.toContain("### Findings");
  });
});

describe("createInlineComments", () => {
  it("comments inline only on anchorable critical and warning findings", () => {
    const comments = createInlineComments(review, commentableLines);
    expect(comments.map((c) => `${c.path}:${c.line}`)).toEqual([
      "src/routes/orders.ts:31",
      "src/services/pricing.ts:25",
    ]);
    expect(comments[0]?.body).toBe(
      "**Critical: Any user can read any order | IDOR** · security\n\n" +
        "GET /:id has no ownership check.\n\n" +
        "**Suggested fix:** Compare order.customer_id with req.userId."
    );
  });
});
