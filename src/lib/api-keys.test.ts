import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiKeyMock } = vi.hoisted(() => ({
  apiKeyMock: {
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ db: { apiKey: apiKeyMock } }));

import {
  ApiKeyLimitError,
  authenticateApiKey,
  createApiKey,
  generateApiKey,
  hashApiKey,
  isWellFormedApiKey,
  readBearerToken,
  revokeApiKey,
} from "./api-keys";
import { MCP_CONFIG } from "./constants";

beforeEach(() => {
  apiKeyMock.update.mockResolvedValue({});
});

describe("API key format", () => {
  it("generates unique, well-formed keys and stores only a hash", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a).not.toBe(b);
    expect(a.startsWith(MCP_CONFIG.keyPrefix)).toBe(true);
    expect(isWellFormedApiKey(a)).toBe(true);
    expect(hashApiKey(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(a)).toBe(hashApiKey(a));
    expect(hashApiKey(a)).not.toContain(a);
  });

  it("reads bearer tokens and rejects malformed keys", () => {
    expect(readBearerToken("Bearer revio_sk_abc")).toBe("revio_sk_abc");
    expect(readBearerToken("bearer   revio_sk_abc  ")).toBe("revio_sk_abc");
    expect(readBearerToken("Basic xyz")).toBeNull();
    expect(readBearerToken(null)).toBeNull();
    expect(isWellFormedApiKey("revio_sk_short")).toBe(false);
    expect(isWellFormedApiKey(`other_${"a".repeat(43)}`)).toBe(false);
  });
});

describe("createApiKey", () => {
  it("returns the full key once and saves its hash and visible prefix", async () => {
    apiKeyMock.count.mockResolvedValue(0);
    apiKeyMock.create.mockImplementation(async ({ data }) => ({
      id: "k1",
      name: data.name,
      keyPrefix: data.keyPrefix,
      createdAt: new Date(),
      lastUsedAt: null,
    }));

    const { key, apiKey } = await createApiKey("u1", "  My laptop  ");

    const saved = apiKeyMock.create.mock.calls[0]?.[0].data;
    expect(saved.keyHash).toBe(hashApiKey(key));
    expect(saved.name).toBe("My laptop");
    expect(key.startsWith(apiKey.keyPrefix)).toBe(true);
    expect(apiKey.keyPrefix).toHaveLength(MCP_CONFIG.keyPrefix.length + 4);
  });

  it("refuses more than the maximum number of active keys", async () => {
    apiKeyMock.count.mockResolvedValue(MCP_CONFIG.maxKeysPerUser);
    await expect(createApiKey("u1", "one more")).rejects.toBeInstanceOf(ApiKeyLimitError);
    expect(apiKeyMock.create).not.toHaveBeenCalled();
  });
});

describe("authenticateApiKey", () => {
  const key = generateApiKey();

  it("accepts an active key and records when it was used", async () => {
    apiKeyMock.findUnique.mockResolvedValue({ id: "k1", userId: "u1", revokedAt: null, lastUsedAt: null });

    await expect(authenticateApiKey(key)).resolves.toEqual({ keyId: "k1", userId: "u1" });
    expect(apiKeyMock.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { keyHash: hashApiKey(key) } }));
    expect(apiKeyMock.update).toHaveBeenCalledTimes(1);
  });

  it("does not rewrite lastUsedAt on every request", async () => {
    apiKeyMock.findUnique.mockResolvedValue({ id: "k1", userId: "u1", revokedAt: null, lastUsedAt: new Date() });
    await authenticateApiKey(key);
    expect(apiKeyMock.update).not.toHaveBeenCalled();
  });

  it("rejects revoked, unknown, malformed and missing keys", async () => {
    apiKeyMock.findUnique.mockResolvedValueOnce({ id: "k1", userId: "u1", revokedAt: new Date(), lastUsedAt: null });
    await expect(authenticateApiKey(key)).resolves.toBeNull();

    apiKeyMock.findUnique.mockResolvedValueOnce(null);
    await expect(authenticateApiKey(key)).resolves.toBeNull();

    await expect(authenticateApiKey("revio_sk_bad")).resolves.toBeNull();
    await expect(authenticateApiKey(null)).resolves.toBeNull();
  });
});

describe("revokeApiKey", () => {
  it("only revokes the user's own active key", async () => {
    apiKeyMock.updateMany.mockResolvedValueOnce({ count: 1 });
    await expect(revokeApiKey("u1", "k1")).resolves.toBe(true);
    expect(apiKeyMock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "k1", userId: "u1", revokedAt: null } })
    );

    apiKeyMock.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(revokeApiKey("u2", "k1")).resolves.toBe(false);
  });
});
