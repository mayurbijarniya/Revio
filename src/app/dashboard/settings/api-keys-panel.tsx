"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plug,
  Plus,
  Terminal,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MCP_CONFIG } from "@/lib/constants";

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const KEY_PLACEHOLDER = "YOUR_REVIO_API_KEY";

const MCP_TOOLS = [
  { name: "review_changes", description: "Review your local changes before you push, with the same analysis as a PR review" },
  { name: "get_pr_review", description: "Fetch Revio's review of a pull request so Claude can fix the issues" },
  { name: "get_impact", description: "Callers, dependent files and entry points affected by changing files or functions" },
  { name: "search_codebase", description: "Semantic search over your indexed repositories" },
  { name: "list_repositories", description: "Your connected repositories and their index status" },
];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatLastUsed(value: string | null): string {
  if (!value) return "Never used";
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 5) return "Used just now";
  if (minutes < 60) return `Used ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Used ${hours} h ago`;
  return `Used ${formatDate(value)}`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); the text stays selectable
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeSnippet({ code, label }: { code: string; label: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
      <pre className="flex-1 min-w-0 overflow-x-auto text-xs font-mono leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre">
        {code}
      </pre>
      <CopyButton text={code} label={label} />
    </div>
  );
}

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyItem | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    // The current site's address, so preview deployments show their own endpoint
    setOrigin(window.location.origin);

    async function loadKeys() {
      try {
        const res = await fetch("/api/api-keys");
        const data = await res.json();
        if (data.success) {
          setKeys(data.data.keys);
        } else {
          setError(data.error?.message || "Failed to load API keys");
        }
      } catch {
        setError("Failed to load API keys");
      } finally {
        setIsLoading(false);
      }
    }
    loadKeys();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newKeyName.trim();
    if (!name || isCreating) return;

    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success) {
        setKeys((prev) => [data.data.apiKey, ...prev]);
        setCreatedKey(data.data.key);
        setNewKeyName("");
      } else {
        setError(data.error?.message || "Failed to create API key");
      }
    } catch {
      setError("Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke() {
    if (!keyToRevoke) return;
    setIsRevoking(true);
    try {
      const res = await fetch(`/api/api-keys/${keyToRevoke.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setKeys((prev) => prev.filter((k) => k.id !== keyToRevoke.id));
        setKeyToRevoke(null);
      } else {
        setError(data.error?.message || "Failed to revoke API key");
      }
    } catch {
      setError("Failed to revoke API key");
    } finally {
      setIsRevoking(false);
    }
  }

  const endpoint = `${origin}/api/mcp`;
  const keyForSnippets = createdKey ?? KEY_PLACEHOLDER;
  const claudeCommand =
    `claude mcp add --transport http ${MCP_CONFIG.serverName} ${endpoint} ` +
    `--header "Authorization: Bearer ${keyForSnippets}" --scope user`;
  const projectConfig = JSON.stringify(
    {
      mcpServers: {
        [MCP_CONFIG.serverName]: {
          type: "http",
          url: endpoint,
          headers: { Authorization: "Bearer ${REVIO_API_KEY}" },
        },
      },
    },
    null,
    2
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
          <span className="text-sm text-red-600 dark:text-red-400 flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* API Keys */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2 text-gray-900 dark:text-white">
          <KeyRound className="w-5 h-5" />
          API Keys
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Keys let Claude Code and other MCP clients use Revio on your behalf. A key can access your
          connected repositories, so keep it private. You can have up to {MCP_CONFIG.maxKeysPerUser} active keys.
        </p>

        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name, e.g. My laptop - Claude Code"
            maxLength={100}
            aria-label="API key name"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isCreating || !newKeyName.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#4F46E5] text-white text-sm font-medium rounded-lg hover:bg-[#4338CA] transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create key
          </button>
        </form>

        {createdKey && (
          <div className="mb-4 p-4 rounded-lg border border-[#10B981]/40 bg-[#ECFDF5] dark:bg-green-900/20">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Copy your new key now. For your security it will not be shown again.
              </p>
              <button
                onClick={() => setCreatedKey(null)}
                className="text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200"
                aria-label="Hide the new key"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 break-all px-3 py-2 text-xs font-mono rounded-lg bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800 text-gray-900 dark:text-gray-100">
                {createdKey}
              </code>
              <CopyButton text={createdKey} label="Copy API key" />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 mx-auto mb-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">No API keys yet. Create one to connect Claude Code.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{key.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="font-mono">{key.keyPrefix}••••••••</span>
                    <span>Created {formatDate(key.createdAt)}</span>
                    <span>{formatLastUsed(key.lastUsedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setKeyToRevoke(key)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Connect Claude Code */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2 text-gray-900 dark:text-white">
          <Plug className="w-5 h-5" />
          Connect Claude Code
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Revio runs as a remote MCP server, so there is nothing to install.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">MCP endpoint</label>
            <div className="mt-1.5">
              <CodeSnippet code={endpoint} label="Copy endpoint" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              1. Add Revio (run once in a terminal)
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-1.5">
              {createdKey
                ? "Your new key is already filled in."
                : `Replace ${KEY_PLACEHOLDER} with a key from above.`}{" "}
              <span className="font-mono">--scope user</span> makes Revio available in all your projects.
            </p>
            <CodeSnippet code={claudeCommand} label="Copy command" />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">2. Check the connection</label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              In Claude Code, run <span className="font-mono">/mcp</span>. Revio should show as connected with its tools listed.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">For teams: share one config file</label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-1.5">
              Commit this as <span className="font-mono">.mcp.json</span> in your repository. Each teammate sets their own{" "}
              <span className="font-mono">REVIO_API_KEY</span> environment variable, so no key is committed.
            </p>
            <CodeSnippet code={projectConfig} label="Copy .mcp.json" />
          </div>
        </div>
      </div>

      {/* Tools */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2 text-gray-900 dark:text-white">
          <Wrench className="w-5 h-5" />
          Available Tools
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Ask in plain language, for example &quot;review my changes with Revio before I push&quot;. Reviews
          count toward your plan&apos;s monthly review limit.
        </p>
        <ul className="space-y-3">
          {MCP_TOOLS.map((tool) => (
            <li key={tool.name} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
              <span className="font-mono text-xs px-2 py-1 rounded bg-[#EEF2FF] dark:bg-indigo-900/30 text-[#4F46E5] dark:text-indigo-400 shrink-0 w-fit">
                {tool.name}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-300">{tool.description}</span>
            </li>
          ))}
        </ul>
      </div>

      <ConfirmDialog
        isOpen={keyToRevoke !== null}
        onClose={() => setKeyToRevoke(null)}
        onConfirm={handleRevoke}
        title="Revoke API Key"
        message={`Revoke "${keyToRevoke?.name ?? ""}"? Any Claude Code or MCP client using it will stop working immediately. This cannot be undone.`}
        confirmText="Revoke"
        cancelText="Cancel"
        variant="danger"
        isLoading={isRevoking}
      />
    </div>
  );
}
