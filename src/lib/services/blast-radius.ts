import type { BlastRadiusCollection, BlastRadiusData, BlastRadiusFunctionSummary } from "@/types/blast-radius";
import type { CodeGraphData, GraphNode } from "./code-graph";
import {
  analyzeChangeImpact,
  calculateFunctionImportance,
  findCallees,
  findCallers,
} from "./code-graph";

function takeSample<T>(items: T[], limit: number): BlastRadiusCollection<T> {
  const sample = items.slice(0, limit);
  return {
    total: items.length,
    sample,
    truncated: items.length > limit,
  };
}

function toFunctionSummary(graphData: CodeGraphData, node: GraphNode): BlastRadiusFunctionSummary | null {
  if (node.type !== "function" && node.type !== "class") return null;

  return {
    id: node.id,
    name: node.name,
    file: node.file,
    line: typeof node.line === "number" ? node.line : null,
    type: node.type,
    importance: calculateFunctionImportance(graphData, node.id),
    callers: findCallers(graphData, node.id).length,
    callees: findCallees(graphData, node.id).length,
  };
}

function summarize(graphData: CodeGraphData, ids: string[]): BlastRadiusFunctionSummary[] {
  const nodeById = new Map(graphData.nodes.map((n) => [n.id, n]));
  return ids
    .map((id) => nodeById.get(id))
    .filter((n): n is GraphNode => Boolean(n))
    .map((n) => toFunctionSummary(graphData, n))
    .filter((n): n is BlastRadiusFunctionSummary => Boolean(n))
    .sort((a, b) => b.importance - a.importance);
}

/**
 * Mermaid label text: entity-encode characters that break quoted labels
 */
function escapeMermaidLabel(text: string): string {
  return text
    .replace(/&/g, "#amp;")
    .replace(/"/g, "#quot;")
    .replace(/</g, "#lt;")
    .replace(/>/g, "#gt;");
}

function baseName(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}

function buildMermaidList(title: string, lines: string[], maxLines: number): string {
  const shown = lines.slice(0, maxLines);
  const remaining = Math.max(0, lines.length - shown.length);
  // "•" never wraps onto its own line the way "- " does
  const parts = [title, ...shown.map((l) => `• ${l}`)];
  if (remaining > 0) parts.push(`… +${remaining} more`);
  return parts.map(escapeMermaidLabel).join("<br/>");
}

function functionLabel(f: BlastRadiusFunctionSummary): string {
  return `${f.name} (${baseName(f.file)}${f.line ? `:${f.line}` : ""})`;
}

export function generateBlastRadius(args: {
  changedFiles: string[];
  graphData: CodeGraphData | null;
  /** Changed line numbers per file, in the graph's coordinates (from the diff) */
  changedLinesByFile?: Record<string, number[]>;
  /** Definitions removed by the PR */
  extraChangedNodeIds?: string[];
  /** Files where the change modifies or removes existing lines (see analyzeChangeImpact) */
  filesWithRemovals?: string[];
  maxDirectFiles?: number;
  maxFunctions?: number;
}): BlastRadiusData | null {
  const { graphData, changedFiles, changedLinesByFile, extraChangedNodeIds, filesWithRemovals } = args;
  if (!graphData || changedFiles.length === 0) return null;

  const maxDirectFiles = args.maxDirectFiles ?? 20;
  const maxFunctions = args.maxFunctions ?? 15;

  const impact = analyzeChangeImpact(
    graphData,
    changedFiles,
    changedLinesByFile,
    extraChangedNodeIds,
    filesWithRemovals
  );

  const changedFunctions = summarize(graphData, impact.directlyAffectedFunctions);
  const indirectCallers = summarize(graphData, impact.indirectlyAffectedFunctions);
  const affectedEntryPoints = summarize(graphData, impact.affectedEntryPoints);
  const directlyAffectedFiles = [...impact.directlyAffectedFiles].sort((a, b) => a.localeCompare(b));

  const risk = impact.riskLevel;
  const changedEntryPointIds = new Set(
    affectedEntryPoints.filter((ep) => impact.directlyAffectedFunctions.includes(ep.id)).map((ep) => ep.id)
  );
  const callerEntryPointCount = affectedEntryPoints.length - changedEntryPointIds.size;

  const lines = [
    "flowchart LR",
    "  classDef low fill:#ECFDF5,stroke:#10B981,color:#065F46;",
    "  classDef medium fill:#FFFBEB,stroke:#F59E0B,color:#92400E;",
    "  classDef high fill:#FFF7ED,stroke:#F97316,color:#9A3412;",
    "  classDef critical fill:#FEF2F2,stroke:#EF4444,color:#991B1B;",
    `  CF["${buildMermaidList(
      `Changed (${changedFiles.length} file${changedFiles.length === 1 ? "" : "s"}, ${changedFunctions.length} function${changedFunctions.length === 1 ? "" : "s"})`,
      changedFunctions.length > 0 ? changedFunctions.map(functionLabel) : changedFiles.map(baseName),
      6
    )}"]:::${risk}`,
  ];

  // Only draw boxes and edges that exist, so the diagram never implies a path that isn't there
  if (directlyAffectedFiles.length > 0) {
    lines.push(
      `  DF["${buildMermaidList(`Dependent Files (${directlyAffectedFiles.length})`, directlyAffectedFiles.map(baseName), 6)}"]:::${risk}`,
      "  CF --> DF"
    );
  }
  if (indirectCallers.length > 0) {
    lines.push(
      `  IC["${buildMermaidList(`Callers (${indirectCallers.length})`, indirectCallers.map(functionLabel), 6)}"]:::${risk}`,
      "  CF --> IC"
    );
  }
  if (affectedEntryPoints.length > 0) {
    lines.push(
      `  EP["${buildMermaidList(`Entry Points Affected (${affectedEntryPoints.length})`, affectedEntryPoints.map(functionLabel), 4)}"]:::${risk}`
    );
    if (changedEntryPointIds.size > 0) lines.push("  CF --> EP");
    if (callerEntryPointCount > 0 && indirectCallers.length > 0) lines.push("  IC --> EP");
  }
  if (directlyAffectedFiles.length === 0 && indirectCallers.length === 0 && affectedEntryPoints.length === 0) {
    lines.push(`  NONE["${escapeMermaidLabel("No downstream code depends on the changed functions")}"]:::low`, "  CF -.- NONE");
  }

  return {
    riskLevel: risk,
    totalImpactRadius: impact.totalImpactRadius,
    changedFiles,
    directlyAffectedFiles: takeSample(directlyAffectedFiles, maxDirectFiles),
    changedFunctions: takeSample(changedFunctions, maxFunctions),
    indirectCallers: takeSample(indirectCallers, maxFunctions),
    affectedEntryPoints: takeSample(affectedEntryPoints, maxFunctions),
    mermaid: lines.join("\n"),
  };
}
