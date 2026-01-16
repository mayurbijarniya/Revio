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

function escapeMermaidLabel(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildMermaidList(title: string, lines: string[], maxLines: number): string {
  const shown = lines.slice(0, maxLines);
  const remaining = Math.max(0, lines.length - shown.length);
  const parts = [title];

  if (shown.length > 0) {
    parts.push(...shown.map((l) => `- ${l}`));
  } else {
    parts.push("- (none)");
  }

  if (remaining > 0) {
    parts.push(`- … +${remaining} more`);
  }

  return escapeMermaidLabel(parts.join("<br/>"));
}

export function generateBlastRadius(args: {
  changedFiles: string[];
  graphData: CodeGraphData | null;
  maxDirectFiles?: number;
  maxFunctions?: number;
}): BlastRadiusData | null {
  const { graphData, changedFiles } = args;
  if (!graphData || changedFiles.length === 0) return null;

  const maxDirectFiles = args.maxDirectFiles ?? 20;
  const maxFunctions = args.maxFunctions ?? 15;

  const impact = analyzeChangeImpact(graphData, changedFiles);

  const changedFunctions = impact.directlyAffectedFunctions
    .map((id) => graphData.nodes.find((n) => n.id === id))
    .filter((n): n is GraphNode => Boolean(n))
    .map((n) => toFunctionSummary(graphData, n))
    .filter((n): n is BlastRadiusFunctionSummary => Boolean(n))
    .sort((a, b) => b.importance - a.importance);

  const indirectCallers = impact.indirectlyAffectedFunctions
    .map((id) => graphData.nodes.find((n) => n.id === id))
    .filter((n): n is GraphNode => Boolean(n))
    .map((n) => toFunctionSummary(graphData, n))
    .filter((n): n is BlastRadiusFunctionSummary => Boolean(n))
    .sort((a, b) => b.importance - a.importance);

  const affectedEntryPoints = graphData.metadata.entryPoints
    .filter(
      (id) =>
        impact.directlyAffectedFunctions.includes(id) ||
        impact.indirectlyAffectedFunctions.includes(id)
    )
    .map((id) => graphData.nodes.find((n) => n.id === id))
    .filter((n): n is GraphNode => Boolean(n))
    .map((n) => toFunctionSummary(graphData, n))
    .filter((n): n is BlastRadiusFunctionSummary => Boolean(n))
    .sort((a, b) => b.importance - a.importance);

  const directlyAffectedFiles = [...impact.directlyAffectedFiles].sort((a, b) => a.localeCompare(b));

  const risk = impact.riskLevel;
  const riskClass = risk;

  const changedFileNames = changedFiles.map((f) => f);
  const directFileNames = directlyAffectedFiles.map((f) => f);
  const callerNames = indirectCallers.map((f) => `${f.name} (${f.file}${f.line ? `:${f.line}` : ""})`);
  const entryPointNames = affectedEntryPoints.map((f) => `${f.name} (${f.file}${f.line ? `:${f.line}` : ""})`);

  const mermaid = [
    "flowchart LR",
    "  classDef low fill:#ECFDF5,stroke:#10B981,color:#065F46;",
    "  classDef medium fill:#FFFBEB,stroke:#F59E0B,color:#92400E;",
    "  classDef high fill:#FFF7ED,stroke:#F97316,color:#9A3412;",
    "  classDef critical fill:#FEF2F2,stroke:#EF4444,color:#991B1B;",
    `  CF["${buildMermaidList(`Changed Files (${changedFiles.length})`, changedFileNames, 6)}"]:::${riskClass}`,
    `  DF["${buildMermaidList(`Direct Dependents (${directlyAffectedFiles.length})`, directFileNames, 6)}"]:::${riskClass}`,
    `  IC["${buildMermaidList(`Indirect Callers (${indirectCallers.length})`, callerNames, 6)}"]:::${riskClass}`,
    `  EP["${buildMermaidList(`Entry Points Affected (${affectedEntryPoints.length})`, entryPointNames, 4)}"]:::${riskClass}`,
    "  CF --> DF",
    "  CF --> IC",
    "  IC --> EP",
  ].join("\n");

  return {
    riskLevel: risk,
    totalImpactRadius: impact.totalImpactRadius,
    changedFiles,
    directlyAffectedFiles: takeSample(directlyAffectedFiles, maxDirectFiles),
    changedFunctions: takeSample(changedFunctions, maxFunctions),
    indirectCallers: takeSample(indirectCallers, maxFunctions),
    affectedEntryPoints: takeSample(affectedEntryPoints, maxFunctions),
    mermaid,
  };
}

