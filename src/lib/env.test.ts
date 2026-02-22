import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe("env validation", () => {
  it("fails fast in production when required vars are missing", async () => {
    process.env = {
      NODE_ENV: "production",
      BACKGROUND_MODE: "hybrid",
    };

    await expect(import("@/lib/env")).rejects.toThrow(
      "Missing required environment variables"
    );
  });

  it("allows startup in development when vars are missing", async () => {
    process.env = {
      NODE_ENV: "development",
      BACKGROUND_MODE: "hybrid",
    };

    const envModule = await import("@/lib/env");
    expect(envModule.env.NODE_ENV).toBe("development");
    expect(envModule.getMissingRequiredEnvKeys().length).toBeGreaterThan(0);
  });
});
