import crypto from "crypto";
import { INDEXING_CONFIG } from "@/lib/constants";
import type { CodeChunk } from "./embeddings";

/**
 * Detected file info
 */
export interface FileInfo {
  path: string;
  content: string;
  language: string;
  hash: string;
}

/**
 * Get language from file extension
 */
export function getLanguageFromPath(filePath: string): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (!ext) return null;

  const extWithDot = `.${ext}`;
  for (const [language, extensions] of Object.entries(
    INDEXING_CONFIG.supportedExtensions
  )) {
    if ((extensions as readonly string[]).includes(extWithDot)) {
      return language;
    }
  }

  return null;
}

/**
 * Check if file should be skipped
 */
export function shouldSkipFile(filePath: string): boolean {
  return INDEXING_CONFIG.skipPatterns.some((pattern) => {
    // Convert glob pattern to regex
    const regex = new RegExp(
      "^" +
        pattern
          .replace(/\*\*/g, ".*")
          .replace(/\*/g, "[^/]*")
          .replace(/\?/g, ".") +
        "$"
    );
    return regex.test(filePath);
  });
}

/**
 * Calculate file hash
 */
export function calculateFileHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Generate chunk ID
 */
export function generateChunkId(
  repositoryId: string,
  filePath: string,
  startLine: number
): string {
  const hash = crypto
    .createHash("md5")
    .update(`${repositoryId}:${filePath}:${startLine}`)
    .digest("hex");
  return hash;
}

/**
 * Chunk code by logical blocks (functions, classes, etc.)
 * This is a simplified chunker - a full implementation would use tree-sitter
 */
export function chunkCode(
  repositoryId: string,
  filePath: string,
  content: string,
  language: string
): CodeChunk[] {
  const lines = content.split("\n");
  const chunks: CodeChunk[] = [];

  // Patterns for detecting code blocks by language
  const patterns = getLanguagePatterns(language);

  let currentChunk: {
    startLine: number;
    endLine: number;
    content: string[];
    type: CodeChunk["type"];
    name?: string;
    depth: number;
  } | null = null;

  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const lineNum = i + 1;

    // Track brace depth for block detection
    braceDepth += (line.match(/\{/g) || []).length;
    braceDepth -= (line.match(/\}/g) || []).length;

    // Check for function/class definitions
    const match = matchCodeBlock(line, patterns);

    if (match && braceDepth <= 1) {
      // Save previous chunk if exists
      if (currentChunk && currentChunk.content.length > 0) {
        chunks.push(createChunk(repositoryId, filePath, language, currentChunk));
      }

      // Start new chunk
      currentChunk = {
        startLine: lineNum,
        endLine: lineNum,
        content: [line],
        type: match.type,
        name: match.name,
        depth: braceDepth,
      };
    } else if (currentChunk) {
      currentChunk.content.push(line);
      currentChunk.endLine = lineNum;

      // Check if block is complete
      if (braceDepth <= currentChunk.depth - 1 || braceDepth === 0) {
        if (currentChunk.content.length > 2) {
          chunks.push(createChunk(repositoryId, filePath, language, currentChunk));
        }
        currentChunk = null;
      }
    }
  }

  // Handle remaining content
  if (currentChunk && currentChunk.content.length > 0) {
    chunks.push(createChunk(repositoryId, filePath, language, currentChunk));
  }

  // If no chunks detected, create module-level chunks
  if (chunks.length === 0 && content.trim().length > 0) {
    chunks.push(...chunkBySize(repositoryId, filePath, content, language));
  }

  return chunks;
}

function createChunk(
  repositoryId: string,
  filePath: string,
  language: string,
  data: {
    startLine: number;
    endLine: number;
    content: string[];
    type: CodeChunk["type"];
    name?: string;
  }
): CodeChunk {
  const content = data.content.join("\n");
  return {
    id: generateChunkId(repositoryId, filePath, data.startLine),
    filePath,
    content,
    language,
    startLine: data.startLine,
    endLine: data.endLine,
    type: data.type,
    name: data.name,
  };
}

/**
 * Chunk by size for files without clear structure
 */
function chunkBySize(
  repositoryId: string,
  filePath: string,
  content: string,
  language: string,
  maxLines: number = 50
): CodeChunk[] {
  const lines = content.split("\n");
  const chunks: CodeChunk[] = [];

  for (let i = 0; i < lines.length; i += maxLines) {
    const chunkLines = lines.slice(i, i + maxLines);
    const startLine = i + 1;
    const endLine = Math.min(i + maxLines, lines.length);

    chunks.push({
      id: generateChunkId(repositoryId, filePath, startLine),
      filePath,
      content: chunkLines.join("\n"),
      language,
      startLine,
      endLine,
      type: "block",
    });
  }

  return chunks;
}

interface BlockMatch {
  type: CodeChunk["type"];
  name?: string;
}

function matchCodeBlock(
  line: string,
  patterns: RegExp[]
): BlockMatch | null {
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const type = determineType(line);
      return {
        type,
        name: match[1] || undefined,
      };
    }
  }
  return null;
}

function determineType(line: string): CodeChunk["type"] {
  const lower = line.toLowerCase();
  if (lower.includes("class ")) return "class";
  if (lower.includes("interface ")) return "class";
  if (lower.includes("function ") || lower.includes("fn ")) return "function";
  if (lower.includes("def ")) return "function";
  if (lower.includes("func ")) return "function";
  return "method";
}

function getLanguagePatterns(language: string): RegExp[] {
  const patterns: Record<string, RegExp[]> = {
    javascript: [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /(?:export\s+)?class\s+(\w+)/,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/,
      /(\w+)\s*:\s*(?:async\s+)?function/,
    ],
    typescript: [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /(?:export\s+)?class\s+(\w+)/,
      /(?:export\s+)?interface\s+(\w+)/,
      /(?:export\s+)?type\s+(\w+)/,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/,
    ],
    python: [
      /^(?:async\s+)?def\s+(\w+)/,
      /^class\s+(\w+)/,
    ],
    go: [
      /^func\s+(?:\([^)]+\)\s+)?(\w+)/,
      /^type\s+(\w+)\s+struct/,
      /^type\s+(\w+)\s+interface/,
    ],
    rust: [
      /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/,
      /^(?:pub\s+)?struct\s+(\w+)/,
      /^(?:pub\s+)?impl(?:<[^>]+>)?\s+(\w+)/,
      /^(?:pub\s+)?trait\s+(\w+)/,
    ],
    java: [
      /(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/,
      /(?:public|private|protected)?\s*class\s+(\w+)/,
      /(?:public|private|protected)?\s*interface\s+(\w+)/,
    ],
    ruby: [
      /^def\s+(\w+)/,
      /^class\s+(\w+)/,
      /^module\s+(\w+)/,
    ],
    php: [
      /(?:public|private|protected)?\s*function\s+(\w+)/,
      /class\s+(\w+)/,
      /interface\s+(\w+)/,
    ],
    csharp: [
      /(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?(?:\w+\s+)+(\w+)\s*\(/,
      /(?:public|private|protected|internal)?\s*class\s+(\w+)/,
      /(?:public|private|protected|internal)?\s*interface\s+(\w+)/,
    ],
    cpp: [
      /^(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*(?:const)?\s*\{?$/,
      /^class\s+(\w+)/,
      /^struct\s+(\w+)/,
    ],
    swift: [
      /(?:public|private|internal|fileprivate|open)?\s*func\s+(\w+)/,
      /(?:public|private|internal|fileprivate|open)?\s*class\s+(\w+)/,
      /(?:public|private|internal|fileprivate|open)?\s*struct\s+(\w+)/,
    ],
  };

  return patterns[language] ?? patterns.javascript ?? [];
}
