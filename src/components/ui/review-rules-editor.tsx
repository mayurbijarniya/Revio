"use client";

import { useState } from "react";
import {
  Shield,
  Bug,
  Zap,
  Code,
  AlertTriangle,
  TestTube,
  BookOpen,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type ReviewSettings,
  type ReviewRule,
  REVIEW_RULE_TEMPLATES,
  SeverityLevels,
  IssueCategories,
  type SeverityLevel,
  type IssueCategory,
} from "@/types/review";

interface ReviewRulesEditorProps {
  settings: ReviewSettings;
  onSave: (settings: ReviewSettings) => Promise<void>;
  isLoading?: boolean;
}

const categoryIcons: Record<IssueCategory, React.ElementType> = {
  bug: Bug,
  security: Shield,
  performance: Zap,
  style: Code,
  logic: AlertTriangle,
  error_handling: AlertTriangle,
  testing: TestTube,
  documentation: BookOpen,
};

const severityColors: Record<SeverityLevel, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  suggestion: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  info: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

export function ReviewRulesEditor({
  settings: initialSettings,
  onSave,
  isLoading = false,
}: ReviewRulesEditorProps) {
  const [settings, setSettings] = useState<ReviewSettings>(initialSettings);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newRule, setNewRule] = useState<Partial<ReviewRule> | null>(null);

  const handleToggleCategory = (category: IssueCategory) => {
    const enabled = settings.enabledCategories.includes(category);
    setSettings({
      ...settings,
      enabledCategories: enabled
        ? settings.enabledCategories.filter((c) => c !== category)
        : [...settings.enabledCategories, category],
    });
    setIsEditing(true);
  };

  const handleToggleRule = (ruleId: string) => {
    setSettings({
      ...settings,
      customRules: settings.customRules.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      ),
    });
    setIsEditing(true);
  };

  const handleAddTemplate = (template: ReviewRule) => {
    if (settings.customRules.some((r) => r.id === template.id)) {
      return; // Already added
    }
    setSettings({
      ...settings,
      customRules: [...settings.customRules, { ...template, enabled: true }],
    });
    setShowTemplates(false);
    setIsEditing(true);
  };

  const handleRemoveRule = (ruleId: string) => {
    setSettings({
      ...settings,
      customRules: settings.customRules.filter((r) => r.id !== ruleId),
    });
    setIsEditing(true);
  };

  const handleAddCustomRule = () => {
    if (!newRule?.name || !newRule?.message) return;

    const rule: ReviewRule = {
      id: `custom-${Date.now()}`,
      name: newRule.name,
      description: newRule.description || "",
      enabled: true,
      pattern: newRule.pattern,
      category: newRule.category || "style",
      severity: newRule.severity || "warning",
      message: newRule.message,
    };

    setSettings({
      ...settings,
      customRules: [...settings.customRules, rule],
    });
    setNewRule(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    await onSave(settings);
    setIsEditing(false);
  };

  const handleReset = () => {
    setSettings(initialSettings);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Severity Settings */}
      <div>
        <h3 className="text-sm font-medium mb-3">Severity Thresholds</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Minimum severity to report
            </span>
            <div className="relative">
              <select
                value={settings.minSeverity}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    minSeverity: e.target.value as SeverityLevel,
                  });
                  setIsEditing(true);
                }}
                className="px-3 py-1.5 pr-8 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4F46E5] appearance-none"
              >
                {SeverityLevels.map((level) => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.blockOnCritical}
              onChange={(e) => {
                setSettings({ ...settings, blockOnCritical: e.target.checked });
                setIsEditing(true);
              }}
              className="w-4 h-4 rounded border-gray-300 accent-[#4F46E5] cursor-pointer"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Request changes on critical issues
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.blockOnSecurity}
              onChange={(e) => {
                setSettings({ ...settings, blockOnSecurity: e.target.checked });
                setIsEditing(true);
              }}
              className="w-4 h-4 rounded border-gray-300 accent-[#4F46E5] cursor-pointer"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Request changes on security issues
            </span>
          </label>
        </div>
      </div>

      {/* Focus Categories */}
      <div>
        <h3 className="text-sm font-medium mb-3">Focus Areas</h3>
        <div className="flex flex-wrap gap-2">
          {IssueCategories.map((category) => {
            const Icon = categoryIcons[category];
            const isEnabled = settings.enabledCategories.includes(category);
            return (
              <button
                key={category}
                onClick={() => handleToggleCategory(category)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  isEnabled
                    ? "bg-[#4F46E5] text-white"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {category.replace("_", " ")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Rules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Custom Rules</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[#4F46E5] hover:bg-[#EEF2FF] rounded transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Templates
              {showTemplates ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={() =>
                setNewRule({
                  name: "",
                  description: "",
                  category: "style",
                  severity: "warning",
                  message: "",
                })
              }
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-[#4F46E5] text-white rounded hover:bg-[#4338CA] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Rule
            </button>
          </div>
        </div>

        {/* Templates dropdown */}
        {showTemplates && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 mb-2">
              Click to add a template rule:
            </p>
            <div className="space-y-2">
              {REVIEW_RULE_TEMPLATES.filter(
                (t) => !settings.customRules.some((r) => r.id === t.id)
              ).map((template) => {
                const Icon = categoryIcons[template.category];
                return (
                  <button
                    key={template.id}
                    onClick={() => handleAddTemplate(template)}
                    className="w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">{template.name}</span>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-xs",
                          severityColors[template.severity]
                        )}
                      >
                        {template.severity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      {template.description}
                    </p>
                  </button>
                );
              })}
              {REVIEW_RULE_TEMPLATES.every((t) =>
                settings.customRules.some((r) => r.id === t.id)
              ) && (
                  <p className="text-xs text-gray-500 text-center py-2">
                    All templates have been added
                  </p>
                )}
            </div>
          </div>
        )}

        {/* New rule form */}
        {newRule && (
          <div className="mb-4 p-3 bg-[#EEF2FF] dark:bg-[#4F46E5]/10 rounded-lg border border-[#4F46E5]/20">
            <h4 className="text-sm font-medium mb-3">New Custom Rule</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Rule name"
                value={newRule.name || ""}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
              />
              <input
                type="text"
                placeholder="Description"
                value={newRule.description || ""}
                onChange={(e) =>
                  setNewRule({ ...newRule, description: e.target.value })
                }
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
              />
              <input
                type="text"
                placeholder="Regex pattern (optional)"
                value={newRule.pattern || ""}
                onChange={(e) =>
                  setNewRule({ ...newRule, pattern: e.target.value })
                }
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4F46E5] font-mono"
              />
              <textarea
                placeholder="Message to show when rule is violated"
                value={newRule.message || ""}
                onChange={(e) =>
                  setNewRule({ ...newRule, message: e.target.value })
                }
                rows={2}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
              />
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={newRule.category || "style"}
                    onChange={(e) =>
                      setNewRule({
                        ...newRule,
                        category: e.target.value as IssueCategory,
                      })
                    }
                    className="w-full px-3 py-1.5 pr-8 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4F46E5] appearance-none"
                  >
                    {IssueCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
                <div className="relative flex-1">
                  <select
                    value={newRule.severity || "warning"}
                    onChange={(e) =>
                      setNewRule({
                        ...newRule,
                        severity: e.target.value as SeverityLevel,
                      })
                    }
                    className="w-full px-3 py-1.5 pr-8 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4F46E5] appearance-none"
                  >
                    {SeverityLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setNewRule(null)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCustomRule}
                  disabled={!newRule.name || !newRule.message}
                  className="px-3 py-1.5 text-sm bg-[#4F46E5] text-white rounded hover:bg-[#4338CA] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add Rule
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rules list */}
        <div className="space-y-2">
          {settings.customRules.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No custom rules configured. Add from templates or create your own.
            </p>
          ) : (
            settings.customRules.map((rule) => {
              const Icon = categoryIcons[rule.category];
              const isExpanded = expandedRule === rule.id;
              return (
                <div
                  key={rule.id}
                  className={cn(
                    "p-3 rounded-lg border transition-colors",
                    rule.enabled
                      ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      : "bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <button
                        onClick={() => handleToggleRule(rule.id)}
                        className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                          rule.enabled
                            ? "bg-[#4F46E5] border-[#4F46E5] text-white"
                            : "border-gray-300 dark:border-gray-600"
                        )}
                      >
                        {rule.enabled && <Check className="w-3 h-3" />}
                      </button>
                      <Icon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">{rule.name}</span>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-xs",
                          severityColors[rule.severity]
                        )}
                      >
                        {rule.severity}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setExpandedRule(isExpanded ? null : rule.id)
                        }
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRemoveRule(rule.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-3 pl-7 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <p>{rule.description}</p>
                      {rule.pattern && (
                        <p>
                          <span className="font-medium">Pattern:</span>{" "}
                          <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">
                            {rule.pattern}
                          </code>
                        </p>
                      )}
                      <p>
                        <span className="font-medium">Message:</span> {rule.message}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Save/Reset buttons */}
      {isEditing && (
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}
