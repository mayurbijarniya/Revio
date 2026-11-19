"use client";

import { useState } from "react";
import { BrainCircuit, CheckCircle, Loader2, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewProvider } from "@/lib/constants";

interface ReviewModelCardProps {
  initialProvider: ReviewProvider;
  deepSeekAvailable: boolean;
}

interface ProviderOption {
  id: ReviewProvider;
  name: string;
  description: string;
  icon: LucideIcon;
}

const OPTIONS: ProviderOption[] = [
  {
    id: "google",
    name: "Google Gemini",
    description: "Fast reviews, usually ready in under a minute. The default.",
    icon: Sparkles,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Reasons longer before answering, for deeper reviews. Takes 1–3 minutes.",
    icon: BrainCircuit,
  },
];

/**
 * Choose the AI model for this user's PR reviews (GitHub, manual and Claude Code reviews)
 */
export function ReviewModelCard({ initialProvider, deepSeekAvailable }: ReviewModelCardProps) {
  const [provider, setProvider] = useState<ReviewProvider>(initialProvider);
  const [saving, setSaving] = useState<ReviewProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function choose(next: ReviewProvider) {
    if (next === provider || saving) return;
    const previous = provider;
    setProvider(next);
    setSaving(next);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewProvider: next }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error?.message ?? "Could not save your choice");
      }
      setSaved(true);
    } catch (saveError) {
      setProvider(previous);
      setError(saveError instanceof Error ? saveError.message : "Could not save your choice");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2 text-gray-900 dark:text-white">
        <BrainCircuit className="w-5 h-5" />
        Review Model
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        The AI model that writes your PR reviews: automatic and manual reviews on your repositories, and reviews
        from Claude Code.
      </p>

      <div role="radiogroup" aria-label="Review model" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = provider === option.id;
          const unavailable = option.id === "deepseek" && !deepSeekAvailable;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={unavailable || saving !== null}
              onClick={() => choose(option.id)}
              className={cn(
                "text-left rounded-lg border p-4 transition-colors",
                selected
                  ? "border-[#4F46E5] bg-[#EEF2FF] dark:bg-indigo-900/30 dark:border-indigo-500"
                  : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50",
                unavailable && "opacity-60 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                  <Icon className={cn("w-4 h-4", selected ? "text-[#4F46E5] dark:text-indigo-400" : "text-gray-500")} />
                  {option.name}
                </span>
                {saving === option.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#4F46E5]" />
                ) : (
                  selected && <CheckCircle className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400" />
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {unavailable ? "Not available yet on this server." : option.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-3 min-h-5 text-xs" aria-live="polite">
        {error ? (
          <span className="text-[#EF4444]">{error}</span>
        ) : saved ? (
          <span className="text-[#10B981]">Saved. Your next review uses this model.</span>
        ) : (
          <span className="text-gray-500 dark:text-gray-400">
            If DeepSeek is slow or unavailable, the review is written with Gemini instead, so it never fails.
          </span>
        )}
      </div>
    </div>
  );
}
