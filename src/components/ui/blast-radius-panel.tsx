"use client";

import type { BlastRadiusData, BlastRadiusRiskLevel } from "@/types/blast-radius";
import { cn } from "@/lib/utils";
import { MermaidDiagram } from "./mermaid-diagram";

function getRiskStyles(risk: BlastRadiusRiskLevel) {
  switch (risk) {
    case "critical":
      return {
        badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
        ring: "border-red-300/70 dark:border-red-700/60",
        accent: "text-red-700 dark:text-red-300",
      };
    case "high":
      return {
        badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
        ring: "border-orange-300/70 dark:border-orange-700/60",
        accent: "text-orange-700 dark:text-orange-300",
      };
    case "medium":
      return {
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        ring: "border-amber-300/70 dark:border-amber-700/60",
        accent: "text-amber-700 dark:text-amber-300",
      };
    case "low":
    default:
      return {
        badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
        ring: "border-green-300/70 dark:border-green-700/60",
        accent: "text-green-700 dark:text-green-300",
      };
  }
}

function formatFunctionLabel(fn: { name: string; file: string; line: number | null }) {
  if (!fn.line) return `${fn.name} (${fn.file})`;
  return `${fn.name} (${fn.file}:${fn.line})`;
}

export function BlastRadiusPanel({ blastRadius }: { blastRadius: BlastRadiusData }) {
  const styles = getRiskStyles(blastRadius.riskLevel);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Blast Radius
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Impact radius based on code graph dependencies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("px-2 py-1 rounded text-xs font-medium", styles.badge)}>
            {blastRadius.riskLevel.toUpperCase()}
          </span>
          <span className="text-xs text-gray-500">
            {blastRadius.totalImpactRadius} affected nodes
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-64 h-64">
            <div className={cn("absolute inset-0 rounded-full border-2", styles.ring)} />
            <div className={cn("absolute inset-6 rounded-full border-2", styles.ring)} />
            <div className={cn("absolute inset-12 rounded-full border-2", styles.ring)} />
            <div className={cn("absolute inset-20 rounded-full border-2", styles.ring)} />

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className={cn("text-3xl font-bold", styles.accent)}>
                  {blastRadius.totalImpactRadius}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  total affected
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 w-full max-w-sm space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Changed files</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {blastRadius.changedFiles.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Changed functions</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {blastRadius.changedFunctions.total}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Direct dependents</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {blastRadius.directlyAffectedFiles.total}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Indirect callers</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {blastRadius.indirectCallers.total}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Entry points affected</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {blastRadius.affectedEntryPoints.total}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Changed files
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-200">
                {blastRadius.changedFiles.slice(0, 10).map((f) => (
                  <li key={f} className="font-mono truncate" title={f}>
                    {f}
                  </li>
                ))}
                {blastRadius.changedFiles.length > 10 && (
                  <li className="text-gray-500">… +{blastRadius.changedFiles.length - 10} more</li>
                )}
              </ul>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Direct dependents (sample)
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-200">
                {blastRadius.directlyAffectedFiles.sample.slice(0, 10).map((f) => (
                  <li key={f} className="font-mono truncate" title={f}>
                    {f}
                  </li>
                ))}
                {blastRadius.directlyAffectedFiles.truncated && (
                  <li className="text-gray-500">
                    … +{blastRadius.directlyAffectedFiles.total - blastRadius.directlyAffectedFiles.sample.length} more
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Indirect callers (sample)
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-200">
                {blastRadius.indirectCallers.sample.slice(0, 8).map((fn) => (
                  <li
                    key={fn.id}
                    className="font-mono truncate"
                    title={formatFunctionLabel(fn)}
                  >
                    {formatFunctionLabel(fn)}
                  </li>
                ))}
                {blastRadius.indirectCallers.truncated && (
                  <li className="text-gray-500">
                    … +{blastRadius.indirectCallers.total - blastRadius.indirectCallers.sample.length} more
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Entry points affected (sample)
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-200">
                {blastRadius.affectedEntryPoints.sample.slice(0, 8).map((fn) => (
                  <li
                    key={fn.id}
                    className="font-mono truncate"
                    title={formatFunctionLabel(fn)}
                  >
                    {formatFunctionLabel(fn)}
                  </li>
                ))}
                {blastRadius.affectedEntryPoints.truncated && (
                  <li className="text-gray-500">
                    … +{blastRadius.affectedEntryPoints.total - blastRadius.affectedEntryPoints.sample.length} more
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            Impact Diagram
          </div>
        </div>
        <MermaidDiagram chart={blastRadius.mermaid} />
      </div>
    </div>
  );
}

