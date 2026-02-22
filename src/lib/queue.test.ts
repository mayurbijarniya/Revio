import { describe, expect, it } from "vitest";
import { buildIndexJobId, buildReviewJobId } from "@/lib/queue";

describe("queue job id builders", () => {
  it("builds deterministic index job ids with sanitized branch names", () => {
    const jobId = buildIndexJobId({
      repositoryId: "repo-123",
      defaultBranch: "feature/new-ui",
      headSha: "1234567890abcdef1234567890abcdef12345678",
    });

    expect(jobId).toBe("index:repo-123:feature_new-ui:1234567890ab");
  });

  it("uses latest marker when index head sha is absent", () => {
    const jobId = buildIndexJobId({
      repositoryId: "repo-123",
      defaultBranch: "main",
      headSha: null,
    });

    expect(jobId).toBe("index:repo-123:main:latest");
  });

  it("builds deterministic review job ids", () => {
    const jobId = buildReviewJobId({
      repositoryId: "repo-123",
      prNumber: 42,
      headSha: "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
    });

    expect(jobId).toBe("review:repo-123:42:abcdefabcdef");
  });
});
