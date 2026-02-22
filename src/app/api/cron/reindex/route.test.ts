import { beforeEach, describe, expect, it, vi } from "vitest";

const { envState, mockFindMany, mockUpdateMany, mockUpdate, mockScheduleIndexing, mockDecrypt } =
  vi.hoisted(() => ({
    envState: {
      CRON_SECRET: "cron-secret",
      NODE_ENV: "production",
      BACKGROUND_MODE: "hybrid",
    },
    mockFindMany: vi.fn(),
    mockUpdateMany: vi.fn(),
    mockUpdate: vi.fn(),
    mockScheduleIndexing: vi.fn(),
    mockDecrypt: vi.fn(),
  }));

vi.mock("@/lib/env", () => ({
  env: envState,
}));

vi.mock("@/lib/db", () => ({
  db: {
    repository: {
      findMany: mockFindMany,
      updateMany: mockUpdateMany,
      update: mockUpdate,
    },
  },
}));

vi.mock("@/lib/services/background-orchestrator", () => ({
  scheduleIndexing: mockScheduleIndexing,
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: mockDecrypt,
}));

import { GET } from "@/app/api/cron/reindex/route";

describe("cron watchdog reindex route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockScheduleIndexing.mockResolvedValue({
      mode: "queue",
      jobId: "index__repo-1__main__latest",
      message: "queued",
    });
    mockDecrypt.mockReturnValue("token");
  });

  it("recovers pending repositories that exceeded queue timeout", async () => {
    mockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "repo-1",
          userId: "user-1",
          fullName: "owner/repo",
          defaultBranch: "main",
          indexStatus: "pending",
          indexQueuedAt: new Date(Date.now() - 20 * 60 * 1000),
          indexStartedAt: null,
          indexHeartbeatAt: null,
          indexedAt: null,
          user: { accessToken: "encrypted-token" },
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await GET(
      new Request("http://localhost/api/cron/reindex", {
        headers: {
          authorization: "Bearer cron-secret",
        },
      }) as never
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { recovered: number; results: Array<{ reason: string }> };
    expect(body.recovered).toBe(1);
    expect(body.results[0]?.reason).toBe("pending_timeout");
    expect(mockScheduleIndexing).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryId: "repo-1",
        trigger: "cron",
      })
    );
  });

  it("marks indexing timeout repos stale and re-enqueues indexing", async () => {
    mockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "repo-2",
          userId: "user-2",
          fullName: "owner/repo-two",
          defaultBranch: "main",
          indexStatus: "indexing",
          indexQueuedAt: new Date(Date.now() - 40 * 60 * 1000),
          indexStartedAt: new Date(Date.now() - 30 * 60 * 1000),
          indexHeartbeatAt: new Date(Date.now() - 25 * 60 * 1000),
          indexedAt: null,
          user: { accessToken: "encrypted-token" },
        },
      ]);

    const response = await GET(
      new Request("http://localhost/api/cron/reindex", {
        headers: {
          authorization: "Bearer cron-secret",
        },
      }) as never
    );

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "repo-2" },
        data: expect.objectContaining({
          indexStatus: "stale",
        }),
      })
    );
    expect(mockScheduleIndexing).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryId: "repo-2",
        trigger: "cron",
      })
    );
  });
});
