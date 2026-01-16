"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCw,
  EyeOff,
  Eye,
  Plus,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IssueCategories } from "@/types/review";

type SuppressedPattern = {
  id: string;
  type: "category" | "issueType" | "text";
  category?: string;
  issueType?: string;
  pattern?: string;
  reason?: string;
  source?: string;
  enabled?: boolean;
  count?: number;
  createdAt?: string;
  updatedAt?: string;
};

type SuggestedRule = {
  id: string;
  rule: {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    pattern?: string;
    category: string;
    severity: string;
    message: string;
  };
  source: string;
  confidence: number;
  frequency: number;
  examples: string[];
  status: "suggested" | "dismissed" | "adopted";
  createdAt?: string;
  updatedAt?: string;
};

type LearningState = {
  repository: { id: string; fullName: string; organizationId: string | null };
  repoLearning: {
    id: string;
    suppressedPatterns: SuppressedPattern[];
    customRuleSuggestions: SuggestedRule[];
    feedbackStats: Record<string, { helpful: number; notHelpful: number }>;
    adoptionRates: Record<string, unknown>;
    updatedAt: string;
  };
  orgLearning: null | {
    id: string;
    suppressedPatterns: SuppressedPattern[];
    customRuleSuggestions: SuggestedRule[];
    feedbackStats: Record<string, { helpful: number; notHelpful: number }>;
    adoptionRates: Record<string, unknown>;
    updatedAt: string;
  };
  effective: {
    suppressedCategories: string[];
    suppressedIssueTypes: string[];
    suppressedText: string[];
  };
};

export function LearningPanel({ repositoryId }: { repositoryId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LearningState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newPattern, setNewPattern] = useState("");
  const [newCategory, setNewCategory] = useState<(typeof IssueCategories)[number]>("style");

  const repoSuggestions = useMemo(
    () => state?.repoLearning.customRuleSuggestions?.filter((s) => s.status === "suggested") ?? [],
    [state]
  );
  const orgSuggestions = useMemo(
    () => state?.orgLearning?.customRuleSuggestions?.filter((s) => s.status === "suggested") ?? [],
    [state]
  );

  const fetchState = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repositoryId}/learning`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to load learning state");
      setState(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load learning state");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositoryId]);

  const triggerRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repositoryId}/learning/refresh`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to refresh learning");
      // Give background job a moment, then reload state.
      setTimeout(() => {
        void fetchState();
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh learning");
    } finally {
      setRefreshing(false);
    }
  };

  const toggleSuppression = async (suppressionId: string, enabled: boolean) => {
    setSavingId(suppressionId);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repositoryId}/learning`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_suppression",
          suppressionId,
          enabled,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to update suppression");
      await fetchState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update suppression");
    } finally {
      setSavingId(null);
    }
  };

  const addCategorySuppression = async () => {
    setSavingId("add_category");
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repositoryId}/learning`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_suppression",
          type: "category",
          category: newCategory,
          reason: "Manually suppressed category",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to add suppression");
      await fetchState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add suppression");
    } finally {
      setSavingId(null);
    }
  };

  const addTextSuppression = async () => {
    const pattern = newPattern.trim();
    if (!pattern) return;
    setSavingId("add_text");
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repositoryId}/learning`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_suppression",
          type: "text",
          pattern,
          reason: "Manually suppressed pattern",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to add suppression");
      setNewPattern("");
      await fetchState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add suppression");
    } finally {
      setSavingId(null);
    }
  };

  const dismissSuggestion = async (suggestionId: string) => {
    setSavingId(suggestionId);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repositoryId}/learning`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss_rule_suggestion", suggestionId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to dismiss suggestion");
      await fetchState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to dismiss suggestion");
    } finally {
      setSavingId(null);
    }
  };

  const acceptSuggestion = async (suggestionId: string) => {
    setSavingId(suggestionId);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repositoryId}/learning`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept_rule_suggestion", suggestionId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to accept suggestion");
      await fetchState();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to accept suggestion");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
        {error || "Failed to load learning state."}
      </div>
    );
  }

  const repoSuppressions =
    state.repoLearning.suppressedPatterns?.filter((p) => p.enabled !== false) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Learning & Memory
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Learns which categories/issues your team ignores and suggests custom rules from human PR comments.
          </p>
        </div>
        <button
          onClick={triggerRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Effective summary */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Effective suppression (applies to new reviews)
        </div>
        <div className="flex flex-wrap gap-2">
          {state.effective.suppressedCategories.length === 0 &&
            state.effective.suppressedIssueTypes.length === 0 &&
            state.effective.suppressedText.length === 0 && (
              <span className="text-xs text-gray-500">No learned suppressions yet.</span>
            )}
          {state.effective.suppressedCategories.map((c) => (
            <span
              key={c}
              className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              category:{c}
            </span>
          ))}
          {state.effective.suppressedText.slice(0, 6).map((p) => (
            <span
              key={p}
              className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              text:{p}
            </span>
          ))}
        </div>
      </div>

      {/* Manual suppressions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Suppress a Category
          </div>
          <div className="flex items-center gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as (typeof IssueCategories)[number])}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              {IssueCategories.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ")}
                </option>
              ))}
            </select>
            <button
              onClick={addCategorySuppression}
              disabled={savingId === "add_category"}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {savingId === "add_category" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Applies to future reviews unless a real bug/security risk is detected.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Suppress a Text Pattern
          </div>
          <div className="flex items-center gap-2">
            <input
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder='e.g. "naming nitpick"'
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            />
            <button
              onClick={addTextSuppression}
              disabled={savingId === "add_text" || !newPattern.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {savingId === "add_text" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Matches titles/descriptions (substring) and suppresses similar issues.
          </p>
        </div>
      </div>

      {/* Suppression list */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Active Suppressions (Repo)
            </h4>
            <span className="text-xs text-gray-500">
              {repoSuppressions.length} active
            </span>
          </div>
        </div>
        {repoSuppressions.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No suppressions yet.</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {repoSuppressions.map((s) => {
              const label =
                s.type === "category"
                  ? `category:${s.category}`
                  : s.type === "issueType"
                    ? `issue:${s.issueType}`
                    : `text:${s.pattern}`;
              const isEnabled = s.enabled !== false;
              return (
                <div key={s.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white break-all">
                      {label}
                    </div>
                    {s.reason && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {s.reason}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {s.source ? `source: ${s.source}` : "source: unknown"}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSuppression(s.id, !isEnabled)}
                    disabled={savingId === s.id}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-colors",
                      isEnabled
                        ? "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700",
                      savingId === s.id && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {savingId === s.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isEnabled ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    {isEnabled ? "Disable" : "Enable"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Suggested Custom Rules
            </h4>
            <span className="text-xs text-gray-500">
              {repoSuggestions.length} repo / {orgSuggestions.length} org
            </span>
          </div>
        </div>

        {repoSuggestions.length === 0 && orgSuggestions.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">
            No suggestions yet. Click Refresh to analyze recent human PR comments.
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {repoSuggestions.map((s) => (
              <div key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {s.rule.name}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {s.rule.severity}/{s.rule.category}
                      </span>
                      {typeof s.frequency === "number" && (
                        <span className="text-xs text-gray-400">freq: {s.frequency}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {s.rule.message}
                    </div>
                    {s.rule.pattern && (
                      <div className="mt-2 text-xs font-mono text-gray-500 break-all">
                        pattern: {s.rule.pattern}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => dismissSuggestion(s.id)}
                      disabled={savingId === s.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Dismiss
                    </button>
                    <button
                      onClick={() => acceptSuggestion(s.id)}
                      disabled={savingId === s.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#10B981] text-white rounded-lg hover:bg-[#059669] disabled:opacity-50"
                    >
                      {savingId === s.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Adopt
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {orgSuggestions.length > 0 && (
              <div className="p-4 bg-gray-50 dark:bg-gray-900">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organization-level suggestions (read-only)
                </div>
                <div className="space-y-2">
                  {orgSuggestions.slice(0, 5).map((s) => (
                    <div key={s.id} className="text-xs text-gray-600 dark:text-gray-400">
                      • {s.rule.name} ({s.rule.severity}/{s.rule.category})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
