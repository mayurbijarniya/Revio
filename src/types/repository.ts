import { z } from "zod";

/**
 * Repository status for indexing
 */
export type IndexStatus =
  | "pending"
  | "indexing"
  | "indexed"
  | "failed"
  | "stale";

/**
 * Connected repository from database
 */
export interface ConnectedRepository {
  id: string;
  githubRepoId: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  language: string | null;
  indexStatus: IndexStatus;
  indexProgress: number;
  indexedAt: Date | null;
  indexError: string | null;
  indexQueuedAt: Date | null;
  indexStartedAt: Date | null;
  indexHeartbeatAt: Date | null;
  indexJobId: string | null;
  fileCount: number;
  chunkCount: number;
  autoReview: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * GitHub repository (not yet connected)
 */
export interface AvailableRepository {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  pushedAt: string;
  stargazersCount: number;
  isConnected: boolean;
}

/**
 * Connect repository request
 */
export const ConnectRepoSchema = z.object({
  githubRepoId: z.number(),
  name: z.string(),
  fullName: z.string(),
  private: z.boolean(),
  defaultBranch: z.string().default("main"),
  language: z.string().nullable().optional(),
});

export type ConnectRepoRequest = z.infer<typeof ConnectRepoSchema>;

/**
 * Update repository settings request
 */
export const UpdateRepoSettingsSchema = z.object({
  autoReview: z.boolean().optional(),
  ignoredPaths: z.array(z.string()).optional(),
});

export type UpdateRepoSettingsRequest = z.infer<typeof UpdateRepoSettingsSchema>;
