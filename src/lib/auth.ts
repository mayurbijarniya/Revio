import { db } from "./db";
import { encrypt, decrypt } from "./encryption";
import { getSession } from "./session";
import type { PublicUser, SessionPayload } from "@/types/auth";

/**
 * Get the current authenticated user from session
 */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      githubId: true,
      githubUsername: true,
      email: true,
      avatarUrl: true,
      plan: true,
      createdAt: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    githubId: user.githubId,
    githubUsername: user.githubUsername,
    email: user.email,
    avatarUrl: user.avatarUrl,
    plan: user.plan,
    createdAt: user.createdAt,
  };
}

/**
 * Get the decrypted access token for a user
 */
export async function getUserAccessToken(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { accessToken: true },
  });

  if (!user) {
    return null;
  }

  return decrypt(user.accessToken);
}

/**
 * Create or update a user from GitHub OAuth
 */
export async function upsertUser(data: {
  githubId: number;
  githubUsername: string;
  email: string | null;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}): Promise<PublicUser> {
  const encryptedAccessToken = encrypt(data.accessToken);
  const encryptedRefreshToken = data.refreshToken
    ? encrypt(data.refreshToken)
    : null;

  const user = await db.user.upsert({
    where: { githubId: data.githubId },
    create: {
      githubId: data.githubId,
      githubUsername: data.githubUsername,
      email: data.email,
      avatarUrl: data.avatarUrl,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: data.tokenExpiresAt,
      plan: "free",
    },
    update: {
      githubUsername: data.githubUsername,
      email: data.email,
      avatarUrl: data.avatarUrl,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: data.tokenExpiresAt,
    },
    select: {
      id: true,
      githubId: true,
      githubUsername: true,
      email: true,
      avatarUrl: true,
      plan: true,
      createdAt: true,
    },
  });

  return {
    id: user.id,
    githubId: user.githubId,
    githubUsername: user.githubUsername,
    email: user.email,
    avatarUrl: user.avatarUrl,
    plan: user.plan,
    createdAt: user.createdAt,
  };
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}

/**
 * Check if user has required plan
 */
export function hasRequiredPlan(
  userPlan: string,
  requiredPlan: "free" | "pro" | "team"
): boolean {
  const planHierarchy = { free: 0, pro: 1, team: 2 };
  return planHierarchy[userPlan as keyof typeof planHierarchy] >= planHierarchy[requiredPlan];
}
