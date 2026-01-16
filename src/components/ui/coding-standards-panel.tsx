"use client";

import { useState } from "react";
import {
  FileCode2,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  AlertOctagon,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

interface ParsedRule {
  category: string;
  rule: string;
  severity?: "critical" | "warning" | "suggestion";
}

interface CodingStandard {
  id: string;
  source: string;
  filePath: string;
  rulesCount: number;
  enabled: boolean;
  detectedAt: string;
  updatedAt: string;
  parsedRules?: ParsedRule[];
}

interface CodingStandardsPanelProps {
  repositoryId: string;
  initialStandards: CodingStandard[];
}

const SOURCE_LABELS: Record<string, string> = {
  claude_md: "Claude Code (.claude.md)",
  cursorrules: "Cursor (.cursorrules)",
  agents_md: "Agents (agents.md)",
  windsurf: "Windsurf (.windsurf.md)",
  aider: "Aider (.aider)",
  ai_folder: "AI Folder (.ai/)",
  github_copilot: "GitHub Copilot",
};

export function CodingStandardsPanel({
  repositoryId,
  initialStandards,
}: CodingStandardsPanelProps) {
  const [standards, setStandards] = useState<CodingStandard[]>(initialStandards);
  const [isDetecting, setIsDetecting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleDetect = async () => {
    setIsDetecting(true);
    try {
      const res = await fetch(`/api/repos/${repositoryId}/standards`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to detect standards");
      }

      // Refresh standards list
      const refreshRes = await fetch(`/api/repos/${repositoryId}/standards`);
      const data = await refreshRes.json();
      if (data.success) {
        setStandards(data.data.standards);
      }
    } catch (error) {
      console.error("Failed to detect coding standards:", error);
      alert("Failed to detect coding standards. Please try again.");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleToggle = async (standardId: string, currentEnabled: boolean) => {
    setTogglingId(standardId);
    try {
      const res = await fetch(`/api/repos/${repositoryId}/standards`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          standardId,
          enabled: !currentEnabled,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to toggle standard");
      }

      // Update local state
      setStandards((prev) =>
        prev.map((s) =>
          s.id === standardId ? { ...s, enabled: !currentEnabled } : s
        )
      );
    } catch (error) {
      console.error("Failed to toggle coding standard:", error);
      alert("Failed to update standard. Please try again.");
    } finally {
      setTogglingId(null);
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case "critical":
        return <AlertOctagon className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default:
        return <Lightbulb className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Coding Standards
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Auto-detected coding standards files from your repository
          </p>
        </div>
        <button
          onClick={handleDetect}
          disabled={isDetecting}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isDetecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {isDetecting ? "Detecting..." : "Detect Standards"}
        </button>
      </div>

      {standards.length === 0 ? (
        <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
          <FileCode2 className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            No coding standards detected
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Add files like .claude.md, .cursorrules, or agents.md to your repository
          </p>
          <button
            onClick={handleDetect}
            disabled={isDetecting}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Scan Repository
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {standards.map((standard) => {
            const isExpanded = expandedId === standard.id;
            const isToggling = togglingId === standard.id;

            return (
              <div
                key={standard.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileCode2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {SOURCE_LABELS[standard.source] || standard.source}
                        </span>
                        {standard.enabled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
                            <Check className="w-3 h-3" />
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                            <X className="w-3 h-3" />
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {standard.filePath}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {standard.rulesCount} rules detected
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(standard.id, standard.enabled)}
                        disabled={isToggling}
                        className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        {isToggling ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : standard.enabled ? (
                          "Disable"
                        ) : (
                          "Enable"
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setExpandedId(isExpanded ? null : standard.id)
                        }
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && standard.parsedRules && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
                    <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Parsed Rules
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {standard.parsedRules.map((rule, idx) => (
                        <div
                          key={idx}
                          className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-start gap-2">
                            {getSeverityIcon(rule.severity)}
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-white mb-1">
                                {rule.category}
                              </p>
                              <p className="text-gray-600 dark:text-gray-400">
                                {rule.rule}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-blue-800 dark:text-blue-300">
            <strong>How it works:</strong> Revio automatically scans your repository
            for coding standards files (.claude.md, .cursorrules, agents.md, etc.) and
            uses them to enhance PR reviews. Enabled standards will be included in all
            future reviews.
          </p>
        </div>
      </div>
    </div>
  );
}
