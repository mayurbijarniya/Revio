import { beforeEach, describe, expect, it, vi } from "vitest";

const { envState, mockAddIndexingJob, mockAddPrReviewJob, mockRepositoryUpdate, mockPrReviewUpsert, mockIndexRepository, mockDecrypt } =
  vi.hoisted(() => ({
    envState: {
      BACKGROUND_MODE: "hybrid" as "hybrid" | "queue" | "serverless",
    },
    mockAddIndexingJob: vi.fn(),
    mockAddPrReviewJob: vi.fn(),
    mockRepositoryUpdate: vi.fn(),
    mockPrReviewUpsert: vi.fn(),
    mockIndexRepository: vi.fn(),
    mockDecrypt: vi.fn(),
  }));

vi.mock("@/lib/env", () => ({
  env: envState,
}));

vi.mock("@/lib/queue", () => ({
  addIndexingJob: mockAddIndexingJob,
  addPrReviewJob: mockAddPrReviewJob,
}));

vi.mock("@/lib/db", () => ({
  db: {
    repository: {
      update: mockRepositoryUpdate,
    },
    prReview: {
      upsert: mockPrReviewUpsert,
    },
  },
}));

vi.mock("@/lib/services/indexer", () => ({
  indexRepository: mockIndexRepository,
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: mockDecrypt,
}));

import { scheduleIndexing, schedulePrReview } from "@/lib/services/background-orchestrator";

describe("background orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.BACKGROUND_MODE = "hybrid";
    mockRepositoryUpdate.mockResolvedValue({});
    mockPrReviewUpsert.mockResolvedValue({});
    mockIndexRepository.mockResolvedValue({});
    mockDecrypt.mockReturnValue("decrypted-token");
  });

  it("queues indexing successfully when queue is available", async () => {
    mockAddIndexingJob.mockResolvedValue("index__repo-1__main__latest");

    const result = await scheduleIndexing({
      repositoryId: "repo-1",
      userId: "user-1",
      fullName: "owner/repo",
      defaultBranch: "main",
      encryptedAccessToken: "encrypted-token",
      trigger: "connect",
    });

    expect(result).toEqual({
      mode: "queue",
      jobId: "index__repo-1__main__latest",
      message: "Indexing queued in background.",
    });
    expect(mockAddIndexingJob).toHaveBeenCalledOnce();
    expect(mockRepositoryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "repo-1" },
        data: expect.objectContaining({
          indexStatus: "pending",
          indexJobId: "index__repo-1__main__latest",
        }),
      })
    );
    expect(mockIndexRepository).not.toHaveBeenCalled();
  });

  it("falls back to direct indexing when queue fails in hybrid mode", async () => {
    mockAddIndexingJob.mockRejectedValue(new Error("redis unavailable"));

    const result = await scheduleIndexing({
      repositoryId: "repo-1",
      userId: "user-1",
      fullName: "owner/repo",
      defaultBranch: "main",
      encryptedAccessToken: "encrypted-token",
      fallbackAccessToken: "fallback-token",
      trigger: "manual",
    });

    expect(result.mode).toBe("fallback");
    expect(mockIndexRepository).toHaveBeenCalledWith(
      "repo-1",
      "user-1",
      "owner/repo",
      "main",
      "fallback-token",
      false
    );
    expect(mockRepositoryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "repo-1" },
        data: expect.objectContaining({
          indexStatus: "indexing",
        }),
      })
    );
  });

  it("queues PR review and records queue telemetry", async () => {
    mockAddPrReviewJob.mockResolvedValue("review__repo-1__12__abcd1234abcd");

    const fallbackTask = vi.fn(async () => {});
    const result = await schedulePrReview({
      repositoryId: "repo-1",
      prNumber: 12,
      prTitle: "Fix bug",
      prAuthor: "octocat",
      encryptedAccessToken: "encrypted-token",
      trigger: "push",
      fallbackTask,
    });

    expect(result.mode).toBe("queue");
    expect(result.jobId).toBe("review__repo-1__12__abcd1234abcd");
    expect(mockPrReviewUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          repositoryId_prNumber: {
            repositoryId: "repo-1",
            prNumber: 12,
          },
        },
      })
    );
    expect(fallbackTask).not.toHaveBeenCalled();
  });
});
