import type { CodeGraphData } from "./code-graph";

function fileCategory(filePath: string): "frontend" | "api" | "service" | "db" | "infra" | "other" {
  if (filePath.startsWith("src/app/dashboard/") || filePath.startsWith("src/components/")) return "frontend";
  if (filePath.startsWith("src/app/api/")) return "api";
  if (filePath.startsWith("src/lib/services/")) return "service";
  if (filePath.startsWith("prisma/") || filePath === "src/lib/db.ts") return "db";
  if (filePath.includes("qdrant") || filePath.includes("webhooks")) return "infra";
  return "other";
}

function getImportedFiles(graphData: CodeGraphData, filePath: string): string[] {
  const fileNodeId = `file:${filePath}`;
  const importNodeIds = graphData.edges
    .filter((e) => e.type === "imports" && e.from === fileNodeId && e.to.startsWith("import:"))
    .map((e) => e.to);

  const importedFileIds = new Set<string>();
  for (const importNodeId of importNodeIds) {
    for (const edge of graphData.edges) {
      if (edge.type === "imports" && edge.from === importNodeId && edge.to.startsWith("file:")) {
        importedFileIds.add(edge.to.substring(5));
      }
    }
  }

  return Array.from(importedFileIds);
}

function participantLabel(kind: string): string {
  switch (kind) {
    case "frontend":
      return "Frontend";
    case "api":
      return "API";
    case "service":
      return "Service";
    case "db":
      return "Database";
    case "github":
      return "GitHub";
    case "vector":
      return "VectorDB";
    default:
      return "System";
  }
}

function addParticipant(participants: Set<string>, label: string): void {
  participants.add(label);
}

function shortFileLabel(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
}

export function generateSequenceDiagram(params: {
  changedFiles: string[];
  graphData?: CodeGraphData | null;
}): string | null {
  const { changedFiles, graphData } = params;
  if (changedFiles.length === 0) return null;

  const hasFrontend = changedFiles.some((f) => fileCategory(f) === "frontend");
  const hasApi = changedFiles.some((f) => fileCategory(f) === "api");
  const hasService = changedFiles.some((f) => fileCategory(f) === "service");
  const hasDb = changedFiles.some((f) => fileCategory(f) === "db");
  const hasWebhook = changedFiles.some((f) => f.includes("src/app/api/webhooks/"));
  const hasQdrant =
    changedFiles.some((f) => f.includes("qdrant")) ||
    changedFiles.some((f) => f.includes("src/lib/services/retriever")) ||
    changedFiles.some((f) => f.includes("src/lib/services/indexer"));

  const participants = new Set<string>();
  const steps: string[] = [];

  if (hasWebhook) addParticipant(participants, participantLabel("github"));
  if (hasFrontend) addParticipant(participants, participantLabel("frontend"));
  if (hasApi) addParticipant(participants, participantLabel("api"));
  if (hasService) addParticipant(participants, participantLabel("service"));
  if (hasDb) addParticipant(participants, participantLabel("db"));
  if (hasQdrant) addParticipant(participants, participantLabel("vector"));

  // If we only touched one layer, a sequence diagram usually isn't helpful.
  if (participants.size < 2) return null;

  // High-level flow
  if (hasWebhook) {
    steps.push("GitHub->>API: Webhook event (pull_request / issue_comment)");
  }
  if (hasFrontend && hasApi) {
    steps.push("Frontend->>API: Request data / trigger action");
  }

  // Add a couple of concrete file-based steps when graph is available.
  if (graphData) {
    const apiFiles = changedFiles.filter((f) => fileCategory(f) === "api");
    for (const apiFile of apiFiles.slice(0, 3)) {
      const imported = getImportedFiles(graphData, apiFile);
      const serviceDeps = imported.filter((p) => fileCategory(p) === "service").slice(0, 4);

      for (const svc of serviceDeps) {
        addParticipant(participants, participantLabel("service"));
        steps.push(`API->>Service: ${shortFileLabel(svc)}`);

        const svcImports = getImportedFiles(graphData, svc);
        const touchesDb = svcImports.some((p) => fileCategory(p) === "db");
        const touchesGitHub = svcImports.some((p) => p.includes("/github"));
        const touchesVector = svcImports.some((p) => p.includes("qdrant"));

        if (touchesDb) {
          addParticipant(participants, participantLabel("db"));
          steps.push("Service->>Database: Read/write data (Prisma)");
        }
        if (touchesGitHub) {
          addParticipant(participants, participantLabel("github"));
          steps.push("Service->>GitHub: GitHub API call");
        }
        if (touchesVector) {
          addParticipant(participants, participantLabel("vector"));
          steps.push("Service->>VectorDB: Semantic search / indexing");
        }
      }
    }
  } else {
    if (hasApi && hasService) steps.push("API->>Service: Domain logic");
    if (hasService && hasDb) steps.push("Service->>Database: Read/write data");
    if (hasService && hasQdrant) steps.push("Service->>VectorDB: Embeddings/search");
  }

  if (hasService && hasApi) {
    steps.push("Service-->>API: Result");
  }
  if (hasApi && hasFrontend) {
    steps.push("API-->>Frontend: Response");
  }
  if (hasWebhook) {
    steps.push("API-->>GitHub: Post review/comment");
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const uniqueSteps = steps.filter((s) => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });

  const orderedParticipants = Array.from(participants);
  const diagramLines: string[] = ["sequenceDiagram"];
  for (const p of orderedParticipants) {
    diagramLines.push(`    participant ${p}`);
  }

  diagramLines.push("");
  for (const step of uniqueSteps.slice(0, 14)) {
    diagramLines.push(`    ${step}`);
  }

  return diagramLines.join("\n");
}

