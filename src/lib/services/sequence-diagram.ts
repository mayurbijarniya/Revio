import type { CodeGraphData, GraphNode } from "./code-graph";
import { findCallees, findCallers, findChangedNodes, isTestNode } from "./code-graph";

const MAX_CHANGED_FUNCTIONS = 6;
const MAX_LINKS_PER_FUNCTION = 3;
const MAX_STEPS = 14;

function sanitizeMessage(text: string): string {
  // ";" ends a statement and "#" starts an entity in Mermaid sequence diagrams
  return text.replace(/[;#]/g, " ");
}

/**
 * Build participant labels from file paths; use the parent folder when basenames collide
 */
function buildParticipantLabels(files: string[]): Map<string, string> {
  const baseCounts = new Map<string, number>();
  for (const file of files) {
    const base = file.split("/").pop() || file;
    baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
  }

  const labels = new Map<string, string>();
  for (const file of files) {
    const parts = file.split("/");
    const base = parts[parts.length - 1] || file;
    labels.set(file, (baseCounts.get(base) ?? 0) > 1 ? parts.slice(-2).join("/") : base);
  }
  return labels;
}

/**
 * Sequence diagram of the real cross-file calls around the changed functions:
 * who calls the changed code, and what the changed code calls in other files.
 * Returns null when the graph shows no cross-file interaction worth drawing.
 */
export function generateSequenceDiagram(params: {
  changedFiles: string[];
  graphData?: CodeGraphData | null;
  /** Changed line numbers per file, in the graph's coordinates (from the diff) */
  changedLinesByFile?: Record<string, number[]>;
  /** Definitions removed by the PR */
  extraChangedNodeIds?: string[];
}): string | null {
  const { changedFiles, graphData, changedLinesByFile, extraChangedNodeIds } = params;
  if (!graphData || changedFiles.length === 0) return null;

  const changedNodes = findChangedNodes(graphData, changedFiles, changedLinesByFile, extraChangedNodeIds).slice(
    0,
    MAX_CHANGED_FUNCTIONS
  );
  if (changedNodes.length === 0) return null;

  const isExternal = (node: GraphNode, from: GraphNode) =>
    node.file !== from.file && (node.type === "function" || node.type === "class") && !isTestNode(node);

  const participantOrder: string[] = [];
  const addParticipant = (file: string) => {
    if (!participantOrder.includes(file)) participantOrder.push(file);
  };

  const steps: Array<{ from: string; to: string; message: string }> = [];
  for (const node of changedNodes) {
    const callers = findCallers(graphData, node.id).filter((c) => isExternal(c, node)).slice(0, MAX_LINKS_PER_FUNCTION);
    const callees = findCallees(graphData, node.id).filter((c) => isExternal(c, node)).slice(0, MAX_LINKS_PER_FUNCTION);

    for (const caller of callers) {
      addParticipant(caller.file);
      addParticipant(node.file);
      steps.push({ from: caller.file, to: node.file, message: `${node.name}()` });
    }
    for (const callee of callees) {
      addParticipant(node.file);
      addParticipant(callee.file);
      steps.push({ from: node.file, to: callee.file, message: `${callee.name}()` });
    }
  }

  if (participantOrder.length < 2 || steps.length === 0) return null;

  const labels = buildParticipantLabels(participantOrder);
  const aliasOf = new Map(participantOrder.map((file, index) => [file, `P${index}`]));

  const lines = ["sequenceDiagram"];
  for (const file of participantOrder) {
    lines.push(`    participant ${aliasOf.get(file)} as ${sanitizeMessage(labels.get(file) ?? file)}`);
  }

  const seen = new Set<string>();
  for (const step of steps) {
    const line = `    ${aliasOf.get(step.from)}->>${aliasOf.get(step.to)}: ${sanitizeMessage(step.message)}`;
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
    if (seen.size >= MAX_STEPS) break;
  }

  return lines.join("\n");
}
