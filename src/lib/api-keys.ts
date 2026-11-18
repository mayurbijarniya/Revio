/**
 * Personal API keys for the Revio MCP server.
 *
 * A key looks like `revio_sk_<43 random chars>`. Only its SHA-256 hash is stored, so a
 * database leak does not reveal usable keys; the key itself is shown to the user once.
 */
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { MCP_CONFIG } from "@/lib/constants";

export interface ApiKeySummary {
  id: string;
  name: string;
  /** Visible start of the key, e.g. "revio_sk_AbCd" (enough to recognise it, not to use it) */
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface ApiKeyIdentity {
  keyId: string;
  userId: string;
}

const KEY_PATTERN = new RegExp(`^${MCP_CONFIG.keyPrefix}[A-Za-z0-9_-]{43}$`);
const VISIBLE_PREFIX_LENGTH = MCP_CONFIG.keyPrefix.length + 4;

const summarySelect = {
  id: true,
  name: true,
  keyPrefix: true,
  createdAt: true,
  lastUsedAt: true,
} as const;

export function generateApiKey(): string {
  // 32 random bytes -> 43 base64url characters (256 bits of entropy)
  return `${MCP_CONFIG.keyPrefix}${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function isWellFormedApiKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/**
 * Key from an "Authorization: Bearer <key>" header, or null
 */
export function readBearerToken(authorization: string | null): string | null {
  const match = authorization?.match(/^Bearer\s+(\S+)\s*$/i);
  return match?.[1] ?? null;
}

export class ApiKeyLimitError extends Error {
  constructor() {
    super(`You can have at most ${MCP_CONFIG.maxKeysPerUser} active API keys. Revoke one to create another.`);
    this.name = "ApiKeyLimitError";
  }
}

/**
 * Create a key. Returns the full key exactly once; it cannot be recovered later.
 */
export async function createApiKey(
  userId: string,
  name: string
): Promise<{ key: string; apiKey: ApiKeySummary }> {
  const activeCount = await db.apiKey.count({ where: { userId, revokedAt: null } });
  if (activeCount >= MCP_CONFIG.maxKeysPerUser) throw new ApiKeyLimitError();

  const key = generateApiKey();
  const apiKey = await db.apiKey.create({
    data: {
      userId,
      name: name.trim(),
      keyHash: hashApiKey(key),
      keyPrefix: key.slice(0, VISIBLE_PREFIX_LENGTH),
    },
    select: summarySelect,
  });

  return { key, apiKey };
}

export async function listApiKeys(userId: string): Promise<ApiKeySummary[]> {
  return db.apiKey.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: summarySelect,
  });
}

/**
 * Revoke one of the user's keys. Returns false when the key does not exist or is not theirs.
 */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const result = await db.apiKey.updateMany({
    where: { id: keyId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

/**
 * Identify the caller of an MCP request. Returns null for missing, malformed, unknown or
 * revoked keys (callers never learn which of these it was).
 */
export async function authenticateApiKey(key: string | null): Promise<ApiKeyIdentity | null> {
  if (!key || !isWellFormedApiKey(key)) return null;

  const record = await db.apiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
    select: { id: true, userId: true, revokedAt: true, lastUsedAt: true },
  });
  if (!record || record.revokedAt) return null;

  const now = Date.now();
  if (!record.lastUsedAt || now - record.lastUsedAt.getTime() > MCP_CONFIG.lastUsedUpdateIntervalMs) {
    // Best effort: a failed timestamp update must not fail the request
    await db.apiKey
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date(now) } })
      .catch(() => undefined);
  }

  return { keyId: record.id, userId: record.userId };
}
