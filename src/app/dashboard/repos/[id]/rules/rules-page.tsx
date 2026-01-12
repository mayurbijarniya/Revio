"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sliders, AlertCircle } from "lucide-react";
import { ReviewRulesEditor } from "@/components/ui/review-rules-editor";
import { type ReviewSettings } from "@/types/review";

interface RulesPageProps {
  repositoryId: string;
  repositoryName: string;
  initialSettings: ReviewSettings;
}

export function RulesPage({
  repositoryId,
  repositoryName,
  initialSettings,
}: RulesPageProps) {
  const router = useRouter();
  const [reviewSettings, setReviewSettings] =
    useState<ReviewSettings>(initialSettings);
  const [isUpdating, setIsUpdating] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSaveReviewRules = async (settings: ReviewSettings) => {
    setIsUpdating(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`/api/repos/${repositoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewRules: settings }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to save");
      }

      setReviewSettings(settings);
      setSaveMessage("Review rules saved successfully!");

      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);

      // Refresh the page data
      router.refresh();
    } catch (error) {
      console.error("Failed to save review rules:", error);
      setSaveMessage(
        error instanceof Error ? error.message : "Failed to save review rules"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Back button */}
      <Link
        href={`/dashboard/repos/${repositoryId}`}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to repository
      </Link>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            saveMessage.includes("success")
              ? "bg-[#ECFDF5] dark:bg-[#064E3B] border border-[#10B981] dark:border-[#059669]"
              : "bg-[#FEF2F2] dark:bg-[#7F1D1D] border border-[#FECACA] dark:border-[#991B1B]"
          }`}
        >
          <AlertCircle
            className={`w-5 h-5 ${
              saveMessage.includes("success")
                ? "text-[#10B981]"
                : "text-[#EF4444]"
            }`}
          />
          <span
            className={
              saveMessage.includes("success")
                ? "text-[#065F46] dark:text-[#A7F3D0]"
                : "text-[#991B1B] dark:text-[#FECACA]"
            }
          >
            {saveMessage}
          </span>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold">Custom Review Rules</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {repositoryName}
                </p>
              </div>
              {reviewSettings.customRules.length > 0 && (
                <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm rounded-full font-medium">
                  {reviewSettings.customRules.filter((r) => r.enabled).length} active{" "}
                  {reviewSettings.customRules.filter((r) => r.enabled).length === 1
                    ? "rule"
                    : "rules"}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
              Configure custom review rules, severity thresholds, and focus areas for AI-powered code reviews.
              These rules will be applied to all pull requests in this repository.
            </p>
          </div>
        </div>
      </div>

      {/* Rules Editor Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Review Configuration</h2>
        <ReviewRulesEditor
          settings={reviewSettings}
          onSave={handleSaveReviewRules}
          isLoading={isUpdating}
        />
      </div>

      {/* Help Card */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 p-6">
        <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-3">
          How Custom Rules Work
        </h3>
        <ul className="text-sm text-indigo-800 dark:text-indigo-300 space-y-2">
          <li>• Create rules using templates or build your own from scratch</li>
          <li>• Set severity levels (critical, warning, suggestion, info)</li>
          <li>• Assign categories (bug, security, performance, etc.)</li>
          <li>• Use regex patterns for code matching (optional)</li>
          <li>• Enable/disable rules individually without deleting them</li>
          <li>• Configure minimum severity and blocking thresholds</li>
        </ul>
      </div>
    </div>
  );
}
