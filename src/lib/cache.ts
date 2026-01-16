/**
 * In-memory caching layer for API responses
 * Provides fast access to frequently requested data with automatic TTL and invalidation
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class Cache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;
  private maxSize = 1000; // Maximum cache entries
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every 5 minutes
    if (typeof window === "undefined") {
      // Only run cleanup on server
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  /**
   * Generate cache key from multiple parameters
   */
  public generateKey(...parts: (string | number | boolean | null | undefined)[]): string {
    return parts
      .filter((p) => p !== null && p !== undefined)
      .map((p) => String(p))
      .join(":");
  }

  /**
   * Get value from cache
   */
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data;
  }

  /**
   * Set value in cache with TTL (in seconds)
   */
  public set<T>(key: string, data: T, ttlSeconds = 300): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
      createdAt: Date.now(),
    };

    this.cache.set(key, entry as CacheEntry<unknown>);
  }

  /**
   * Delete specific key from cache
   */
  public delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete all keys matching a pattern
   */
  public deletePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Cleanup on shutdown
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Export singleton instance
export const cache = new Cache();

/**
 * Cache invalidation helpers for common patterns
 */
export const CacheInvalidation = {
  /**
   * Invalidate all caches for a user
   */
  user(userId: string): void {
    cache.deletePattern(`^user:${userId}:`);
  },

  /**
   * Invalidate all caches for a repository
   */
  repository(repositoryId: string): void {
    cache.deletePattern(`^repo:${repositoryId}:`);
  },

  /**
   * Invalidate all caches for a conversation
   */
  conversation(conversationId: string): void {
    cache.deletePattern(`^conversation:${conversationId}:`);
  },

  /**
   * Invalidate all caches for an organization
   */
  organization(organizationId: string): void {
    cache.deletePattern(`^org:${organizationId}:`);
  },

  /**
   * Invalidate PR review caches
   */
  prReview(repositoryId: string, prNumber?: number): void {
    if (prNumber) {
      cache.deletePattern(`^pr:${repositoryId}:${prNumber}`);
    } else {
      cache.deletePattern(`^pr:${repositoryId}:`);
    }
  },

  /**
   * Invalidate analytics caches
   */
  analytics(scope: "user" | "repo" | "org", id: string): void {
    cache.deletePattern(`^analytics:${scope}:${id}:`);
  },
};

/**
 * Utility to cache async function results
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds = 300
): Promise<T> {
  // Check cache first
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Execute function and cache result
  const result = await fn();
  cache.set(key, result, ttlSeconds);
  return result;
}

/**
 * Common cache keys for frequently accessed data
 */
export const CacheKeys = {
  // User data
  userRepos: (userId: string) => cache.generateKey("user", userId, "repos"),
  userConversations: (userId: string) =>
    cache.generateKey("user", userId, "conversations"),
  userReviews: (userId: string) => cache.generateKey("user", userId, "reviews"),
  userUsage: (userId: string) => cache.generateKey("user", userId, "usage"),
  userOrgs: (userId: string) => cache.generateKey("user", userId, "orgs"),

  // Repository data
  repoDetails: (repoId: string) => cache.generateKey("repo", repoId, "details"),
  repoFiles: (repoId: string) => cache.generateKey("repo", repoId, "files"),
  repoReviews: (repoId: string) => cache.generateKey("repo", repoId, "reviews"),
  repoPRs: (repoId: string) => cache.generateKey("repo", repoId, "prs"),
  repoInsights: (repoId: string) => cache.generateKey("repo", repoId, "insights"),

  // Conversation data
  conversationDetails: (convId: string) =>
    cache.generateKey("conversation", convId, "details"),
  conversationMessages: (convId: string) =>
    cache.generateKey("conversation", convId, "messages"),

  // Organization data
  orgDetails: (orgId: string) => cache.generateKey("org", orgId, "details"),
  orgMembers: (orgId: string) => cache.generateKey("org", orgId, "members"),
  orgRepos: (orgId: string) => cache.generateKey("org", orgId, "repos"),
  orgActivity: (orgId: string) => cache.generateKey("org", orgId, "activity"),
  orgAnalytics: (orgId: string, days: number) =>
    cache.generateKey("org", orgId, "analytics", days),

  // PR Review data
  prReview: (repoId: string, prNumber: number) =>
    cache.generateKey("pr", repoId, prNumber),
  prReviewList: (repoId: string) => cache.generateKey("pr", repoId, "list"),

  // Analytics data
  analyticsOverview: (userId: string, days: number) =>
    cache.generateKey("analytics", "user", userId, days),
  analyticsRepo: (repoId: string, days: number) =>
    cache.generateKey("analytics", "repo", repoId, days),
};
