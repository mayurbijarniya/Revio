"use client";

import { useState, useEffect } from "react";
import {
  FolderGit2,
  Lock,
  Globe,
  Check,
  Plus,
  Loader2,
  RefreshCw,
  AlertCircle,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvailableRepository, ConnectedRepository } from "@/types/repository";

type Tab = "connected" | "available";

export function RepoList() {
  const [activeTab, setActiveTab] = useState<Tab>("connected");
  const [connectedRepos, setConnectedRepos] = useState<ConnectedRepository[]>([]);
  const [availableRepos, setAvailableRepos] = useState<AvailableRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<number | null>(null);
  const [indexing, setIndexing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "connected") {
      fetchConnectedRepos();
    } else {
      fetchAvailableRepos();
    }
  }, [activeTab]);

  async function fetchConnectedRepos() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/repos/connected");
      const data = await res.json();
      if (data.success) {
        setConnectedRepos(data.data.repositories);
      } else {
        setError(data.error?.message || "Failed to fetch repositories");
      }
    } catch {
      setError("Failed to fetch repositories");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAvailableRepos() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/repos");
      const data = await res.json();
      if (data.success) {
        setAvailableRepos(data.data.repositories);
      } else {
        setError(data.error?.message || "Failed to fetch repositories");
      }
    } catch {
      setError("Failed to fetch repositories");
    } finally {
      setLoading(false);
    }
  }

  async function connectRepo(repo: AvailableRepository) {
    setConnecting(repo.id);
    try {
      const res = await fetch("/api/repos/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubRepoId: repo.id,
          name: repo.name,
          fullName: repo.fullName,
          private: repo.private,
          defaultBranch: repo.defaultBranch,
          language: repo.language,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Update available repos list
        setAvailableRepos((prev) =>
          prev.map((r) => (r.id === repo.id ? { ...r, isConnected: true } : r))
        );
        // Switch to connected tab
        setActiveTab("connected");
      } else {
        setError(data.error?.message || "Failed to connect repository");
      }
    } catch {
      setError("Failed to connect repository");
    } finally {
      setConnecting(null);
    }
  }

  async function disconnectRepo(repoId: string) {
    if (!confirm("Are you sure you want to disconnect this repository?")) {
      return;
    }

    try {
      const res = await fetch(`/api/repos/${repoId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setConnectedRepos((prev) => prev.filter((r) => r.id !== repoId));
      } else {
        setError(data.error?.message || "Failed to disconnect repository");
      }
    } catch {
      setError("Failed to disconnect repository");
    }
  }

  async function indexRepo(repoId: string) {
    setIndexing(repoId);
    setError(null);

    // Update local state to show indexing
    setConnectedRepos((prev) =>
      prev.map((r) =>
        r.id === repoId ? { ...r, indexStatus: "indexing" as const, indexProgress: 0 } : r
      )
    );

    try {
      const res = await fetch(`/api/repos/${repoId}/index`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        // Refresh the repos list
        fetchConnectedRepos();
      } else {
        setError(data.error?.message || "Failed to index repository");
        // Refresh to get actual status
        fetchConnectedRepos();
      }
    } catch {
      setError("Failed to index repository");
      fetchConnectedRepos();
    } finally {
      setIndexing(null);
    }
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("connected")}
          className={cn(
            "pb-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "connected"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Connected Repositories
        </button>
        <button
          onClick={() => setActiveTab("available")}
          className={cn(
            "pb-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "available"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Available to Connect
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Connected repos */}
      {!loading && activeTab === "connected" && (
        <div className="space-y-3">
          {connectedRepos.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <FolderGit2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No repositories connected</h3>
              <p className="text-gray-500 mb-4">
                Connect your first repository to get started
              </p>
              <button
                onClick={() => setActiveTab("available")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Connect Repository
              </button>
            </div>
          ) : (
            connectedRepos.map((repo) => (
              <ConnectedRepoCard
                key={repo.id}
                repo={repo}
                onDisconnect={() => disconnectRepo(repo.id)}
                onIndex={() => indexRepo(repo.id)}
                isIndexing={indexing === repo.id}
              />
            ))
          )}
        </div>
      )}

      {/* Available repos */}
      {!loading && activeTab === "available" && (
        <div className="space-y-3">
          {availableRepos.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <FolderGit2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No repositories found</h3>
              <p className="text-gray-500">
                We couldn&apos;t find any repositories in your GitHub account
              </p>
            </div>
          ) : (
            availableRepos.map((repo) => (
              <AvailableRepoCard
                key={repo.id}
                repo={repo}
                onConnect={() => connectRepo(repo)}
                isConnecting={connecting === repo.id}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ConnectedRepoCard({
  repo,
  onDisconnect,
  onIndex,
  isIndexing,
}: {
  repo: ConnectedRepository;
  onDisconnect: () => void;
  onIndex: () => void;
  isIndexing: boolean;
}) {
  const statusColors = {
    pending: "text-gray-500 bg-gray-100 dark:bg-gray-700",
    indexing: "text-blue-500 bg-blue-100 dark:bg-blue-900",
    indexed: "text-green-500 bg-green-100 dark:bg-green-900",
    failed: "text-red-500 bg-red-100 dark:bg-red-900",
    stale: "text-yellow-500 bg-yellow-100 dark:bg-yellow-900",
  };

  const canIndex = repo.indexStatus === "pending" || repo.indexStatus === "failed" || repo.indexStatus === "stale";
  const showIndexButton = canIndex || repo.indexStatus === "indexed";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <FolderGit2 className="w-5 h-5 text-gray-400 mt-0.5" />
          <div>
            <div className="flex items-center gap-2">
              <a
                href={`/dashboard/repos/${repo.id}`}
                className="font-medium hover:text-blue-600"
              >
                {repo.fullName}
              </a>
              {repo.private ? (
                <Lock className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-gray-400" />
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              {repo.language && <span>{repo.language}</span>}
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium",
                  statusColors[repo.indexStatus]
                )}
              >
                {repo.indexStatus === "indexing"
                  ? `Indexing ${repo.indexProgress}%`
                  : repo.indexStatus}
              </span>
              {repo.indexedAt && repo.indexStatus === "indexed" && (
                <span>
                  {repo.fileCount} files, {repo.chunkCount} chunks
                </span>
              )}
              {repo.indexError && (
                <span className="text-red-500 text-xs">{repo.indexError}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showIndexButton && (
            <button
              onClick={onIndex}
              disabled={isIndexing || repo.indexStatus === "indexing"}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors",
                canIndex
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700",
                (isIndexing || repo.indexStatus === "indexing") && "opacity-50 cursor-not-allowed"
              )}
              title={canIndex ? "Start Indexing" : "Reindex"}
            >
              {isIndexing || repo.indexStatus === "indexing" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {canIndex ? "Index" : "Reindex"}
            </button>
          )}
          <button
            onClick={onDisconnect}
            disabled={isIndexing || repo.indexStatus === "indexing"}
            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

function AvailableRepoCard({
  repo,
  onConnect,
  isConnecting,
}: {
  repo: AvailableRepository;
  onConnect: () => void;
  isConnecting: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <FolderGit2 className="w-5 h-5 text-gray-400 mt-0.5" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{repo.fullName}</span>
              {repo.private ? (
                <Lock className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-gray-400" />
              )}
            </div>
            {repo.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                {repo.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              {repo.language && <span>{repo.language}</span>}
              {repo.stargazersCount > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5" />
                  {repo.stargazersCount}
                </span>
              )}
            </div>
          </div>
        </div>
        <div>
          {repo.isConnected ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Check className="w-4 h-4" />
              Connected
            </span>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
