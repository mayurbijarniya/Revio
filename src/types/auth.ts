import { z } from "zod";

/**
 * GitHub OAuth configuration
 */
export const GITHUB_OAUTH_CONFIG = {
  authorizationUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  userUrl: "https://api.github.com/user",
  emailsUrl: "https://api.github.com/user/emails",
  scopes: ["repo", "read:user", "user:email"],
} as const;

/**
 * GitHub user from API response
 */
export const GitHubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  avatar_url: z.string().nullable(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
});

export type GitHubUser = z.infer<typeof GitHubUserSchema>;

/**
 * GitHub email from API response
 */
export const GitHubEmailSchema = z.object({
  email: z.string().email(),
  primary: z.boolean(),
  verified: z.boolean(),
});

export type GitHubEmail = z.infer<typeof GitHubEmailSchema>;

/**
 * GitHub OAuth token response
 */
export const GitHubTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  scope: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
});

export type GitHubTokenResponse = z.infer<typeof GitHubTokenResponseSchema>;

/**
 * Session payload stored in JWT
 */
export interface SessionPayload {
  userId: string;
  githubId: number;
  githubUsername: string;
  email: string | null;
  avatarUrl: string | null;
  plan: string;
  iat: number;
  exp: number;
}

/**
 * Public user data (safe to send to client)
 */
export interface PublicUser {
  id: string;
  githubId: number;
  githubUsername: string;
  email: string | null;
  avatarUrl: string | null;
  plan: string;
  createdAt: Date;
}

/**
 * Auth state for client
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: PublicUser | null;
  isLoading: boolean;
}
