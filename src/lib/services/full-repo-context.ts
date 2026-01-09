import { db } from "@/lib/db";

/**
 * Get full repository context for "full_repo" chat mode
 * Fetches all indexed files and formats them for Gemini
 */
export async function getFullRepoContext(repositoryIds: string[]): Promise<string> {
  // Fetch all indexed files for the repositories
  const indexedFiles = await db.indexedFile.findMany({
    where: {
      repositoryId: { in: repositoryIds },
    },
    select: {
      filePath: true,
      language: true,
      repository: {
        select: {
          fullName: true,
        },
      },
    },
    orderBy: [
      { repositoryId: "asc" },
      { filePath: "asc" },
    ],
  });

  if (indexedFiles.length === 0) {
    return "No files have been indexed yet. Please wait for the repository indexing to complete.";
  }

  // Format files into context string
  let context = "# Full Repository Context\n\n";
  context += `Total files: ${indexedFiles.length}\n\n`;
  context += "---\n\n";

  let currentRepo = "";
  for (const file of indexedFiles) {
    // Add repo header when switching repos
    if (file.repository.fullName !== currentRepo) {
      currentRepo = file.repository.fullName;
      context += `## Repository: ${currentRepo}\n\n`;
    }

    // Add file with metadata
    context += `### File: ${file.filePath}\n`;
    if (file.language) {
      context += `Language: ${file.language}\n`;
    }
    context += "\n";
  }

  context += "\n---\n\n";
  context += "**Note**: This is the complete file structure of the indexed repositories. ";
  context += "Use this context to answer questions about the overall architecture, relationships between files, and high-level code organization.\n";

  return context;
}

/**
 * Format full repo context for storage in database
 * Returns a JSON-serializable object
 */
export function formatFullRepoContextForStorage(context: string) {
  return {
    content: context,
    generatedAt: new Date().toISOString(),
    type: "full_repo_file_list",
  };
}

/**
 * Extract context string from stored JSON
 */
export function extractFullRepoContext(storedContext: unknown): string | null {
  if (!storedContext || typeof storedContext !== "object") {
    return null;
  }

  const ctx = storedContext as { content?: string; type?: string };
  if (ctx.type === "full_repo_file_list" && typeof ctx.content === "string") {
    return ctx.content;
  }

  return null;
}
