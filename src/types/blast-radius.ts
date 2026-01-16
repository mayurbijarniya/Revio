export type BlastRadiusRiskLevel = "low" | "medium" | "high" | "critical";

export interface BlastRadiusFunctionSummary {
  id: string;
  name: string;
  file: string;
  line: number | null;
  type: "function" | "class";
  importance: number;
  callers: number;
  callees: number;
}

export interface BlastRadiusCollection<T> {
  total: number;
  sample: T[];
  truncated: boolean;
}

export interface BlastRadiusData {
  riskLevel: BlastRadiusRiskLevel;
  totalImpactRadius: number;
  changedFiles: string[];
  directlyAffectedFiles: BlastRadiusCollection<string>;
  changedFunctions: BlastRadiusCollection<BlastRadiusFunctionSummary>;
  indirectCallers: BlastRadiusCollection<BlastRadiusFunctionSummary>;
  affectedEntryPoints: BlastRadiusCollection<BlastRadiusFunctionSummary>;
  mermaid: string;
}

