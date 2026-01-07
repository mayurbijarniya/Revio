import { generateChatResponse, type ChatMessage } from "./gemini";
import { retrieveContext, formatContextForPrompt } from "./retriever";
import { db } from "@/lib/db";

/**
 * Code explanation request
 */
export interface ExplainCodeRequest {
  repositoryId: string;
  code?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  question?: string;
  depth?: "brief" | "detailed" | "comprehensive";
}

/**
 * Code explanation response
 */
export interface ExplainCodeResponse {
  explanation: string;
  concepts: string[];
  relatedFiles: string[];
  suggestions?: string[];
}

const EXPLANATION_PROMPTS = {
  brief: `Provide a concise explanation of this code in 2-3 sentences. Focus on what it does, not how.`,

  detailed: `Explain this code in detail:
1. **Purpose**: What is the main goal of this code?
2. **How it works**: Step-by-step explanation of the logic
3. **Key concepts**: Important programming concepts used
4. **Dependencies**: What other code/modules does it rely on?`,

  comprehensive: `Provide a comprehensive analysis of this code:

1. **Overview**: High-level summary of what this code does
2. **Detailed Walkthrough**: Line-by-line or block-by-block explanation
3. **Data Flow**: How data moves through the code
4. **Key Concepts**: Programming patterns, algorithms, or techniques used
5. **Dependencies & Integrations**: External modules, APIs, or services used
6. **Edge Cases**: Potential edge cases and how they're handled
7. **Performance Considerations**: Any performance implications
8. **Potential Improvements**: Suggestions for refactoring or optimization
9. **Related Code**: Other parts of the codebase that interact with this code`,
};

/**
 * Build system prompt for code explanation
 */
function buildExplainerSystemPrompt(depth: ExplainCodeRequest["depth"] = "detailed"): string {
  return `You are an expert code explainer and software educator. Your task is to explain code clearly and thoroughly.

${EXPLANATION_PROMPTS[depth]}

Guidelines:
- Use clear, simple language that developers of all levels can understand
- Include code snippets when helpful to illustrate points
- Reference specific line numbers when explaining complex logic
- Explain any domain-specific terminology
- If the code has issues, mention them constructively
- When referencing other files, use the format \`path/to/file.ts\`

Format your response in markdown with proper headings and code blocks.`;
}

/**
 * Build the explanation prompt
 */
function buildExplainerPrompt(
  code: string,
  filePath: string | undefined,
  question: string | undefined,
  context: string
): string {
  let prompt = "";

  if (filePath) {
    prompt += `## File: \`${filePath}\`\n\n`;
  }

  prompt += "## Code to Explain\n\n```\n" + code + "\n```\n\n";

  if (question) {
    prompt += `## Specific Question\n${question}\n\n`;
  }

  if (context && context !== "No relevant context found.") {
    prompt += `## Related Codebase Context\n${context}\n\n`;
  }

  prompt += "Please provide your explanation.";

  return prompt;
}

/**
 * Explain a code snippet or file
 */
export async function explainCode(
  request: ExplainCodeRequest
): Promise<ExplainCodeResponse> {
  const { repositoryId, code, filePath, startLine: _startLine, endLine: _endLine, question, depth = "detailed" } = request;
  void _startLine; // Suppress unused variable warning
  void _endLine; // Suppress unused variable warning

  // Get code content
  const codeToExplain = code || "";
  const actualFilePath = filePath;

  if (!codeToExplain && filePath) {
    // Fetch code from indexed files
    const indexedFile = await db.indexedFile.findFirst({
      where: {
        repositoryId,
        filePath,
      },
    });

    if (!indexedFile) {
      throw new Error(`File not found: ${filePath}`);
    }

    // We don't store full content in IndexedFile, so we'll use context retrieval
    // to get relevant chunks
  }

  // Retrieve related context from the codebase
  const contextQuery = codeToExplain
    ? `Code explanation: ${codeToExplain.slice(0, 500)}`
    : `File: ${filePath}`;

  let contextChunks = "";
  const repo = await db.repository.findUnique({
    where: { id: repositoryId },
    select: { indexStatus: true },
  });

  if (repo?.indexStatus === "indexed") {
    const context = await retrieveContext(repositoryId, contextQuery, {
      maxChunks: 5,
      scoreThreshold: 0.1,
    });
    contextChunks = formatContextForPrompt(context.chunks);
  }

  // Build prompts
  const systemPrompt = buildExplainerSystemPrompt(depth);
  const userPrompt = buildExplainerPrompt(
    codeToExplain,
    actualFilePath,
    question,
    contextChunks
  );

  // Generate explanation
  const messages: ChatMessage[] = [{ role: "user", content: userPrompt }];
  const explanation = await generateChatResponse(systemPrompt, messages);

  // Extract concepts and related files from the explanation
  const concepts = extractConcepts(explanation);
  const relatedFiles = extractFilePaths(explanation);
  const suggestions = depth === "comprehensive" ? extractSuggestions(explanation) : undefined;

  return {
    explanation,
    concepts,
    relatedFiles,
    suggestions,
  };
}

/**
 * Extract programming concepts mentioned in the explanation
 */
function extractConcepts(text: string): string[] {
  const conceptPatterns = [
    /\*\*([\w\s]+)\*\*/g, // Bold terms
    /`([A-Z][a-zA-Z]+(?:Pattern|Strategy|Factory|Singleton|Observer|Decorator))`/g, // Design patterns
    /(?:uses?|implements?|applies?)\s+(?:the\s+)?([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:pattern|principle|algorithm)/gi,
  ];

  const concepts = new Set<string>();

  for (const pattern of conceptPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const concept = match[1]?.trim();
      if (concept && concept.length > 2 && concept.length < 50) {
        concepts.add(concept);
      }
    }
  }

  return Array.from(concepts).slice(0, 10);
}

/**
 * Extract file paths mentioned in the explanation
 */
function extractFilePaths(text: string): string[] {
  const filePattern = /`([a-zA-Z0-9_\-/.]+\.[a-zA-Z]{2,4})`/g;
  const files = new Set<string>();

  let match;
  while ((match = filePattern.exec(text)) !== null) {
    const file = match[1];
    if (file && !file.includes("example") && !file.includes("sample")) {
      files.add(file);
    }
  }

  return Array.from(files).slice(0, 10);
}

/**
 * Extract suggestions from comprehensive explanations
 */
function extractSuggestions(text: string): string[] {
  const suggestions: string[] = [];

  // Look for suggestion sections
  const suggestionPatterns = [
    /(?:suggest|recommend|could|should|consider|improve)(?:s|ed|ing)?\s*:?\s*([^.!?\n]+[.!?])/gi,
    /\d+\.\s*\*\*(?:Suggestion|Improvement|Recommendation)\*\*:?\s*([^\n]+)/gi,
  ];

  for (const pattern of suggestionPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const suggestion = match[1]?.trim();
      if (suggestion && suggestion.length > 10 && suggestion.length < 200) {
        suggestions.push(suggestion);
      }
    }
  }

  return suggestions.slice(0, 5);
}

/**
 * Generate architecture documentation for a repository
 */
export async function generateArchitectureDoc(
  repositoryId: string
): Promise<string> {
  // Get repository info
  const repo = await db.repository.findUnique({
    where: { id: repositoryId },
    include: {
      indexedFiles: {
        select: {
          filePath: true,
          language: true,
        },
        orderBy: { filePath: "asc" },
      },
    },
  });

  if (!repo) {
    throw new Error("Repository not found");
  }

  // Build file tree structure
  const fileTree = buildFileTree(repo.indexedFiles.map((f) => f.filePath));

  // Get language distribution
  const languages: Record<string, number> = {};
  for (const file of repo.indexedFiles) {
    if (file.language) {
      languages[file.language] = (languages[file.language] || 0) + 1;
    }
  }

  // Build the prompt
  const systemPrompt = `You are a software architect expert at documenting codebases. Generate comprehensive architecture documentation.`;

  const userPrompt = `Generate architecture documentation for the repository: ${repo.fullName}

## File Structure
\`\`\`
${fileTree}
\`\`\`

## Language Distribution
${Object.entries(languages)
  .sort((a, b) => b[1] - a[1])
  .map(([lang, count]) => `- ${lang}: ${count} files`)
  .join("\n")}

## Total Files: ${repo.indexedFiles.length}

Please generate:
1. **Overview**: What this project does based on its structure
2. **Architecture Diagram** (ASCII): Visual representation of the main components
3. **Key Directories**: Purpose of each major directory
4. **Entry Points**: Main files that serve as entry points
5. **Data Flow**: How data typically flows through the application
6. **Dependencies**: Key external dependencies (inferred from file types)
7. **Development Setup**: Typical setup steps (inferred from structure)`;

  const docMessages: ChatMessage[] = [{ role: "user", content: userPrompt }];
  const doc = await generateChatResponse(systemPrompt, docMessages);

  return doc;
}

/**
 * Build a visual file tree from paths
 */
function buildFileTree(paths: string[]): string {
  const tree: Record<string, unknown> = {};

  for (const path of paths) {
    const parts = path.split("/");
    let current = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      if (i === parts.length - 1) {
        current[part] = null; // File
      } else {
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
    }
  }

  function renderTree(obj: Record<string, unknown>, prefix = ""): string {
    const entries = Object.entries(obj);
    let result = "";

    entries.forEach(([key, value], index) => {
      const isLast = index === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const extension = isLast ? "    " : "│   ";

      result += prefix + connector + key + "\n";

      if (value !== null && typeof value === "object") {
        result += renderTree(value as Record<string, unknown>, prefix + extension);
      }
    });

    return result;
  }

  // Limit tree depth for large repos
  const maxFiles = 100;
  if (paths.length > maxFiles) {
    return `(Showing first ${maxFiles} files of ${paths.length})\n` +
      renderTree(buildFileTree(paths.slice(0, maxFiles)) as unknown as Record<string, unknown>);
  }

  return renderTree(tree);
}
