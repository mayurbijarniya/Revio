/**
 * Code Graph Service
 * Builds codebase graphs by parsing AST to understand function relationships,
 * call paths, and dependencies for enhanced PR review context
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import * as parser from "@babel/parser";
import traverse, { type NodePath } from "@babel/traverse";
import type { File } from "@babel/types";
import type Parser from "tree-sitter";
import { treeSitterService } from "./tree-sitter-parser";

export interface GraphNode {
  id: string;
  type: "function" | "class" | "file" | "variable" | "import";
  name: string;
  file: string;
  line?: number;
  endLine?: number;
  params?: string[];
  returnType?: string;
  exported?: boolean;
}

export interface GraphEdge {
  from: string; // Node ID
  to: string; // Node ID
  type: "calls" | "imports" | "extends" | "implements" | "exports";
  file?: string;
  line?: number;
}

export interface GraphMetadata {
  entryPoints: string[]; // Entry point node IDs
  circularDeps: string[][]; // Arrays of node IDs forming cycles
  stats: {
    totalNodes: number;
    totalEdges: number;
    functionCount: number;
    classCount: number;
    fileCount: number;
    avgCallsPerFunction: number;
  };
}

export interface CodeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: GraphMetadata;
}

interface ImportAlias {
  pattern: string;
  prefix: string;
  suffix: string;
  hasWildcard: boolean;
  targets: string[];
}

interface ImportResolverOptions {
  aliases: ImportAlias[];
  knownFiles: Set<string>;
}

/**
 * Build code graph for a repository
 */
export async function buildCodeGraph(
  repositoryId: string,
  files: Array<{ path: string; content: string; language: string }>
): Promise<CodeGraphData> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<string, GraphNode>();

  logger.info(`[CodeGraph] Building graph for ${files.length} files`, {
    repositoryId,
  });

  const resolverOptions = buildImportResolverOptions(files);

  // Parse each file and extract entities
  for (const file of files) {
    try {
      if (isSupportedLanguage(file.language)) {
        const { fileNodes, fileEdges } = parseFile(
          file.path,
          file.content,
          file.language,
          resolverOptions
        );

        // Add nodes to map (deduplicate by ID)
        for (const node of fileNodes) {
          nodeMap.set(node.id, node);
        }

        edges.push(...fileEdges);
      }
    } catch (error) {
      logger.warn(`[CodeGraph] Failed to parse ${file.path}`, { error });
      // Continue with other files
    }
  }

  nodes.push(...Array.from(nodeMap.values()));

  // Calculate metadata
  const metadata = calculateMetadata(nodes, edges);

  logger.info(`[CodeGraph] Graph built successfully`, {
    repositoryId,
    totalNodes: nodes.length,
    totalEdges: edges.length,
  });

  return { nodes, edges, metadata };
}

/**
 * Parse a single file and extract entities and relationships
 */
function parseFile(
  filePath: string,
  content: string,
  language: string,
  resolverOptions: ImportResolverOptions
): { fileNodes: GraphNode[]; fileEdges: GraphEdge[] } {
  const fileNodes: GraphNode[] = [];
  const fileEdges: GraphEdge[] = [];
  const normalizedLanguage = language.toLowerCase();

  // Add file node
  const fileNodeId = `file:${filePath}`;
  fileNodes.push({
    id: fileNodeId,
    type: "file",
    name: filePath,
    file: filePath,
  });

  const preAstNodeCount = fileNodes.length;
  const preAstEdgeCount = fileEdges.length;

  // Primary parser path: Tree-Sitter for all supported languages.
  const tree = treeSitterService.parseCode(content, normalizedLanguage);
  if (tree) {
    extractFromTreeSitterAST(tree, normalizedLanguage, filePath, fileNodes, fileEdges);
  }

  const treeSitterExtracted =
    fileNodes.length > preAstNodeCount || fileEdges.length > preAstEdgeCount;

  // Babel fallback for JS/TS edge cases Tree-Sitter could not parse/extract.
  if (!treeSitterExtracted && isBabelLanguage(normalizedLanguage)) {
    const babelAst = parseTypeScriptOrJavaScript(content, normalizedLanguage);
    if (babelAst) {
      extractFromTypeScriptAST(
        babelAst,
        filePath,
        fileNodes,
        fileEdges,
        resolverOptions
      );
    }
  }

  return { fileNodes, fileEdges };
}

/**
 * Extract entities and relationships using Tree-Sitter AST (for Python, Go, Rust, Java, etc.)
 */
function extractFromTreeSitterAST(
  ast: Parser.Tree,
  language: string,
  filePath: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
) {
  // 1. Extract Functions
  const functions = treeSitterService.getFunctions(ast, language);
  for (const fn of functions) {
    if (!fn) continue;
    const nodeId = `function:${filePath}:${fn.name}`;
    nodes.push({
      id: nodeId,
      type: "function",
      name: fn.name,
      file: filePath,
      line: fn.startLine,
      endLine: fn.endLine,
      exported: true, // Simplified: assume exported for global functions in non-JS
    });
    edges.push({
      from: `file:${filePath}`,
      to: nodeId,
      type: "exports",
      file: filePath,
      line: fn.startLine,
    });
  }

  // 2. Extract Classes
  const classes = treeSitterService.getClasses(ast, language);
  for (const cls of classes) {
    if (!cls) continue;
    const nodeId = `class:${filePath}:${cls.name}`;
    nodes.push({
      id: nodeId,
      type: "class",
      name: cls.name,
      file: filePath,
      line: cls.startLine,
      endLine: cls.endLine,
      exported: true,
    });
    edges.push({
      from: `file:${filePath}`,
      to: nodeId,
      type: "exports",
      file: filePath,
      line: cls.startLine,
    });
  }

  // 3. Extract Imports
  const imports = treeSitterService.getImports(ast, language);
  for (const imp of imports) {
    if (!imp) continue;
    // We don't always know what's imported, but we know the source module
    const nodeId = `import:${filePath}:${imp.source}`;
    nodes.push({
      id: nodeId,
      type: "import",
      name: imp.source,
      file: filePath,
      line: imp.startLine,
    });
    edges.push({
      from: `file:${filePath}`,
      to: nodeId,
      type: "imports",
      file: filePath,
      line: imp.startLine,
    });
  }

  // 4. Extract Calls
  const calls = treeSitterService.getCalls(ast, language);
  for (const call of calls) {
    if (!call) continue;
    // Simplified: attach calls to the file level since context tracking is hard cross-language
    const callerId = `file:${filePath}`;
    const calleeId = `function:${filePath}:${call.callee}`;
    edges.push({
      from: callerId,
      to: calleeId,
      type: "calls",
      file: filePath,
      line: call.startLine,
    });
  }
}

/**
 * Parse TypeScript/JavaScript code using Babel parser
 */
function parseTypeScriptOrJavaScript(content: string, language: string): File | null {
  try {
    const ast = parser.parse(content, {
      sourceType: "module",
      plugins: [
        "typescript",
        "jsx",
        "decorators-legacy",
        "classProperties",
        "objectRestSpread",
        "asyncGenerators",
        "dynamicImport",
        "optionalChaining",
        "nullishCoalescingOperator",
      ],
    });
    return ast;
  } catch (error) {
    logger.warn(`[CodeGraph] Failed to parse ${language} file`, { error });
    return null;
  }
}

/**
 * Extract entities and relationships from TypeScript/JavaScript AST
 */
function extractFromTypeScriptAST(
  ast: File,
  filePath: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  resolverOptions: ImportResolverOptions
) {
  const currentScope: string[] = [];
  const getCurrentClassScope = (): string | null => {
    for (let i = currentScope.length - 1; i >= 0; i -= 1) {
      const scopeId = currentScope[i];
      if (scopeId?.startsWith("class:")) return scopeId;
    }
    return null;
  };
  const getObjectOwnerName = (path: NodePath): string | null => {
    const objectExpression = path.parentPath;
    if (!objectExpression || objectExpression.node.type !== "ObjectExpression") {
      return null;
    }

    const container = objectExpression.parentPath;
    if (!container) return null;

    if (
      container.node.type === "VariableDeclarator" &&
      container.node.id.type === "Identifier"
    ) {
      return container.node.id.name;
    }

    if (
      container.node.type === "AssignmentExpression" &&
      container.node.left.type === "Identifier"
    ) {
      return container.node.left.name;
    }

    if (
      container.node.type === "ObjectProperty" &&
      container.node.key.type === "Identifier"
    ) {
      const propertyName = container.node.key.name;
      const maybeVarDecl = container.parentPath?.parentPath;
      if (
        maybeVarDecl?.node.type === "VariableDeclarator" &&
        maybeVarDecl.node.id.type === "Identifier"
      ) {
        return `${maybeVarDecl.node.id.name}.${propertyName}`;
      }
      return propertyName;
    }

    return null;
  };

  traverse(ast, {
    // Function declarations
    FunctionDeclaration(path) {
      const node = path.node;
      const functionName = node.id?.name;
      if (!functionName) return;

      const nodeId = `function:${filePath}:${functionName}`;
      nodes.push({
        id: nodeId,
        type: "function",
        name: functionName,
        file: filePath,
        line: node.loc?.start.line,
        endLine: node.loc?.end.line,
        params: node.params.map((p) => {
          if (p.type === "Identifier") return p.name;
          return "...";
        }),
        exported: path.parent.type === "ExportNamedDeclaration" || path.parent.type === "ExportDefaultDeclaration",
      });

      // Link to file
      edges.push({
        from: `file:${filePath}`,
        to: nodeId,
        type: "exports",
        file: filePath,
        line: node.loc?.start.line,
      });

      currentScope.push(nodeId);
    },

    // Arrow functions and function expressions (if assigned to variables)
    VariableDeclarator(path) {
      const node = path.node;
      if (
        node.id.type === "Identifier" &&
        (node.init?.type === "ArrowFunctionExpression" ||
          node.init?.type === "FunctionExpression")
      ) {
        const functionName = node.id.name;
        const nodeId = `function:${filePath}:${functionName}`;

        // Check if exported by looking at parent nodes
        let isExported = false;
        if (path.parent.type === "VariableDeclaration") {
          // Check if the variable declaration is exported
          const varDecl = path.parentPath;
          if (varDecl && varDecl.parent) {
            isExported =
              varDecl.parent.type === "ExportNamedDeclaration" ||
              varDecl.parent.type === "ExportDefaultDeclaration";
          }
        }

        nodes.push({
          id: nodeId,
          type: "function",
          name: functionName,
          file: filePath,
          line: node.loc?.start.line,
          endLine: node.loc?.end.line,
          params:
            node.init.params?.map((p) => {
              if (p.type === "Identifier") return p.name;
              return "...";
            }) || [],
          exported: isExported,
        });

        edges.push({
          from: `file:${filePath}`,
          to: nodeId,
          type: "exports",
          file: filePath,
          line: node.loc?.start.line,
        });

        currentScope.push(nodeId);
      }
    },

    // Class declarations
    ClassDeclaration(path) {
      const node = path.node;
      const className = node.id?.name;
      if (!className) return;

      const nodeId = `class:${filePath}:${className}`;
      nodes.push({
        id: nodeId,
        type: "class",
        name: className,
        file: filePath,
        line: node.loc?.start.line,
        endLine: node.loc?.end.line,
        exported: path.parent.type === "ExportNamedDeclaration" || path.parent.type === "ExportDefaultDeclaration",
      });

      edges.push({
        from: `file:${filePath}`,
        to: nodeId,
        type: "exports",
        file: filePath,
        line: node.loc?.start.line,
      });

      // Track inheritance
      if (node.superClass && node.superClass.type === "Identifier") {
        const superClassName = node.superClass.name;
        edges.push({
          from: nodeId,
          to: `class:${filePath}:${superClassName}`,
          type: "extends",
          file: filePath,
          line: node.loc?.start.line,
        });
      }

      currentScope.push(nodeId);
    },

    // Class methods
    ClassMethod(path) {
      const node = path.node;
      if (node.key.type === "Identifier") {
        const methodName = node.key.name;
        const classNodeId = getCurrentClassScope() || `class:${filePath}:Unknown`;
        const nodeId = `function:${classNodeId}:${methodName}`;

        nodes.push({
          id: nodeId,
          type: "function",
          name: methodName,
          file: filePath,
          line: node.loc?.start.line,
          endLine: node.loc?.end.line,
          params: node.params?.map((p) => {
            if (p.type === "Identifier") return p.name;
            return "...";
          }) || [],
          exported: false, // Methods are accessed via class
        });

        // Link method to class
        edges.push({
          from: classNodeId,
          to: nodeId,
          type: "exports",
          file: filePath,
          line: node.loc?.start.line,
        });

        currentScope.push(nodeId);
      }
    },

    // Object methods (e.g., in object literals)
    ObjectMethod(path) {
      const node = path.node;
      if (node.key.type === "Identifier") {
        const methodName = node.key.name;
        const ownerName = getObjectOwnerName(path);
        const nodeId = ownerName
          ? `function:${filePath}:${ownerName}.${methodName}`
          : `function:${filePath}:${methodName}`;

        nodes.push({
          id: nodeId,
          type: "function",
          name: methodName,
          file: filePath,
          line: node.loc?.start.line,
          endLine: node.loc?.end.line,
          params: node.params?.map((p) => {
            if (p.type === "Identifier") return p.name;
            return "...";
          }) || [],
          exported: false,
        });

        currentScope.push(nodeId);
      }
    },

    // Import declarations
    ImportDeclaration(path) {
      const node = path.node;
      const source = node.source.value;

      for (const specifier of node.specifiers) {
        if (specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportSpecifier") {
          const importedName = specifier.local.name;
          const nodeId = `import:${filePath}:${importedName}`;

          nodes.push({
            id: nodeId,
            type: "import",
            name: importedName,
            file: filePath,
            line: node.loc?.start.line,
          });

          edges.push({
            from: `file:${filePath}`,
            to: nodeId,
            type: "imports",
            file: filePath,
            line: node.loc?.start.line,
          });

          // Try to resolve the import to another file
          const targetFile = resolveImportPath(filePath, source, resolverOptions);
          if (targetFile) {
            edges.push({
              from: nodeId,
              to: `file:${targetFile}`,
              type: "imports",
              file: filePath,
              line: node.loc?.start.line,
            });
          }
        }
      }
    },

    // Call expressions (function calls)
    CallExpression(path) {
      const node = path.node;
      let calleeName: string | null = null;
      let classScopeId: string | null = null;
      let objectName: string | null = null;

      // Direct function call
      if (node.callee.type === "Identifier") {
        calleeName = node.callee.name;
      }
      // Method call (e.g., obj.method())
      else if (node.callee.type === "MemberExpression") {
        if (node.callee.property.type === "Identifier") {
          calleeName = node.callee.property.name;
          if (node.callee.object.type === "ThisExpression") {
            classScopeId = getCurrentClassScope();
          } else if (node.callee.object.type === "Identifier") {
            objectName = node.callee.object.name;
          }
        }
      }

      if (calleeName && currentScope.length > 0) {
        const caller = currentScope[currentScope.length - 1];
        if (!caller) return;

        const callee = classScopeId
          ? `function:${classScopeId}:${calleeName}`
          : objectName
            ? `function:${filePath}:${objectName}.${calleeName}`
            : `function:${filePath}:${calleeName}`;

        edges.push({
          from: caller,
          to: callee,
          type: "calls",
          file: filePath,
          line: node.loc?.start.line,
        });
      }
    },

    exit(path) {
      // Clean up scope when exiting function/class/method
      if (
        path.node.type === "FunctionDeclaration" ||
        path.node.type === "ClassDeclaration" ||
        path.node.type === "ClassMethod" ||
        path.node.type === "ObjectMethod" ||
        (path.node.type === "VariableDeclarator" &&
          (path.node.init?.type === "ArrowFunctionExpression" ||
            path.node.init?.type === "FunctionExpression"))
      ) {
        currentScope.pop();
      }
    },
  });
}

/**
 * Resolve import path to actual file path
 * Handles TypeScript/JavaScript module resolution with extensions and index files
 */
function resolveImportPath(
  fromFile: string,
  importPath: string,
  resolverOptions: ImportResolverOptions
): string | null {
  if (!importPath) return null;

  const fromDir = normalizeRepoPath(fromFile.split("/").slice(0, -1).join("/"));
  let basePaths: string[] = [];

  if (importPath.startsWith(".") || importPath.startsWith("/")) {
    let resolvedPath: string | null = null;

    if (importPath.startsWith("./")) {
      resolvedPath = `${fromDir}/${importPath.slice(2)}`;
    } else if (importPath.startsWith("../")) {
      const parts = fromDir.split("/");
      const upLevels = importPath.match(/\.\.\//g)?.length || 0;
      const newPath = parts.slice(0, parts.length - upLevels).join("/");
      const relativePath = importPath.replace(/\.\.\//g, "");
      resolvedPath = `${newPath}/${relativePath}`;
    } else if (importPath.startsWith("/")) {
      resolvedPath = importPath.slice(1);
    }

    if (resolvedPath) {
      basePaths = [resolvedPath];
    }
  } else {
    basePaths = resolveAliasImportCandidates(importPath, resolverOptions.aliases);
  }

  if (basePaths.length === 0) {
    return null;
  }

  const candidates = expandImportPathCandidates(basePaths);
  const normalizedCandidates = candidates.map((candidate) => normalizeRepoPath(candidate));
  const existing = normalizedCandidates.find((candidate) =>
    resolverOptions.knownFiles.has(candidate)
  );

  return existing ?? null;
}

function buildImportResolverOptions(
  files: Array<{ path: string; content: string }>
): ImportResolverOptions {
  const knownFiles = new Set(files.map((file) => normalizeRepoPath(file.path)));
  const aliases = buildImportAliases(files);

  return { aliases, knownFiles };
}

function buildImportAliases(
  files: Array<{ path: string; content: string }>
): ImportAlias[] {
  const configFile = findProjectConfigFile(files);
  if (configFile) {
    const config = parseJsonConfig(configFile.content);
    const compilerOptions =
      config && typeof config.compilerOptions === "object"
        ? (config.compilerOptions as Record<string, unknown>)
        : null;
    const paths =
      compilerOptions && typeof compilerOptions.paths === "object"
        ? (compilerOptions.paths as Record<string, unknown>)
        : null;

    if (compilerOptions && paths) {
      const baseUrl = typeof compilerOptions.baseUrl === "string" ? compilerOptions.baseUrl : "";
      const configDir = normalizeRepoPath(configFile.path.split("/").slice(0, -1).join("/"));
      const baseDir = normalizeRepoPath([configDir, baseUrl].filter(Boolean).join("/"));
      const aliases: ImportAlias[] = [];

      for (const [pattern, targets] of Object.entries(paths)) {
        const parsedPattern = parseAliasPattern(pattern);
        if (!parsedPattern || !Array.isArray(targets)) continue;

        const resolvedTargets = targets
          .filter((target): target is string => typeof target === "string")
          .map((target) => resolveAliasTarget(baseDir, target))
          .filter((target) => target.length > 0);

        if (resolvedTargets.length > 0) {
          aliases.push({ ...parsedPattern, targets: resolvedTargets });
        }
      }

      if (aliases.length > 0) {
        return aliases;
      }
    }
  }

  const fallbackTargets: string[] = [];
  if (files.some((file) => file.path.startsWith("src/"))) {
    fallbackTargets.push("src/*");
  }
  if (files.some((file) => file.path.startsWith("app/"))) {
    fallbackTargets.push("app/*");
  }
  if (files.some((file) => file.path.startsWith("pages/"))) {
    fallbackTargets.push("pages/*");
  }
  if (fallbackTargets.length === 0) {
    fallbackTargets.push("*");
  }

  return [
    {
      pattern: "@/*",
      prefix: "@/",
      suffix: "",
      hasWildcard: true,
      targets: fallbackTargets,
    },
  ];
}

function resolveAliasTarget(baseDir: string, target: string): string {
  if (target.startsWith("/")) {
    return normalizeRepoPath(target);
  }

  const combined = baseDir ? `${baseDir}/${target}` : target;
  return normalizeRepoPath(combined);
}

function findProjectConfigFile(
  files: Array<{ path: string; content: string }>
): { path: string; content: string } | null {
  const configNames = ["tsconfig.json", "jsconfig.json"];

  for (const name of configNames) {
    const exactMatch = files.find((file) => file.path === name);
    if (exactMatch) return exactMatch;
  }

  for (const name of configNames) {
    const nestedMatch = files.find((file) => file.path.endsWith(`/${name}`));
    if (nestedMatch) return nestedMatch;
  }

  return null;
}

function parseJsonConfig(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    // Fall through to comment-stripping parse.
  }

  try {
    const stripped = content
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const parsed = JSON.parse(stripped) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  return null;
}

function parseAliasPattern(pattern: string): Omit<ImportAlias, "targets"> | null {
  const wildcardIndex = pattern.indexOf("*");
  if (wildcardIndex === -1) {
    return { pattern, prefix: pattern, suffix: "", hasWildcard: false };
  }

  if (pattern.indexOf("*", wildcardIndex + 1) !== -1) {
    return null;
  }

  return {
    pattern,
    prefix: pattern.slice(0, wildcardIndex),
    suffix: pattern.slice(wildcardIndex + 1),
    hasWildcard: true,
  };
}

function resolveAliasImportCandidates(importPath: string, aliases: ImportAlias[]): string[] {
  const normalizedImportPath = normalizeRepoPath(importPath);
  const results: string[] = [];

  for (const alias of aliases) {
    let matchedSegment: string | null = null;

    if (alias.hasWildcard) {
      if (
        normalizedImportPath.startsWith(alias.prefix) &&
        normalizedImportPath.endsWith(alias.suffix)
      ) {
        matchedSegment = normalizedImportPath.slice(
          alias.prefix.length,
          normalizedImportPath.length - alias.suffix.length
        );
      }
    } else if (normalizedImportPath === alias.pattern) {
      matchedSegment = "";
    }

    if (matchedSegment === null) continue;

    for (const target of alias.targets) {
      const resolved = alias.hasWildcard ? target.replace("*", matchedSegment) : target;
      if (resolved) {
        results.push(resolved);
      }
    }
  }

  return results;
}

function normalizeRepoPath(input: string): string {
  const parts = input.replace(/\\/g, "/").split("/");
  const stack: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(part);
  }

  return stack.join("/");
}

function expandImportPathCandidates(basePaths: string[]): string[] {
  const candidates: string[] = [];

  for (const basePath of basePaths) {
    const normalizedBase = normalizeRepoPath(basePath);

    if (/\.(ts|tsx|js|jsx)$/.test(normalizedBase)) {
      candidates.push(normalizedBase);
      continue;
    }

    candidates.push(
      `${normalizedBase}.ts`,
      `${normalizedBase}.tsx`,
      `${normalizedBase}/index.ts`,
      `${normalizedBase}/index.tsx`,
      `${normalizedBase}.js`,
      `${normalizedBase}.jsx`,
      `${normalizedBase}/index.js`,
      `${normalizedBase}/index.jsx`
    );
  }

  return candidates;
}

/**
 * Calculate graph metadata
 */
function calculateMetadata(nodes: GraphNode[], edges: GraphEdge[]): GraphMetadata {
  const functionNodes = nodes.filter((n) => n.type === "function");
  const classNodes = nodes.filter((n) => n.type === "class");
  const fileNodes = nodes.filter((n) => n.type === "file");

  // Find entry points (exported functions/classes with no incoming calls)
  const calledNodeIds = new Set(edges.filter((e) => e.type === "calls").map((e) => e.to));
  const entryPoints = nodes
    .filter(
      (n) =>
        (n.type === "function" || n.type === "class") && n.exported && !calledNodeIds.has(n.id)
    )
    .map((n) => n.id);

  // Detect circular dependencies (simplified - full cycle detection is complex)
  const circularDeps: string[][] = detectCircularDependencies(nodes, edges);

  // Calculate average calls per function
  const callEdges = edges.filter((e) => e.type === "calls");
  const avgCallsPerFunction = functionNodes.length > 0 ? callEdges.length / functionNodes.length : 0;

  return {
    entryPoints,
    circularDeps,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      functionCount: functionNodes.length,
      classCount: classNodes.length,
      fileCount: fileNodes.length,
      avgCallsPerFunction: Math.round(avgCallsPerFunction * 100) / 100,
    },
  };
}

/**
 * Detect circular dependencies using DFS
 */
function detectCircularDependencies(nodes: GraphNode[], edges: GraphEdge[]): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  // Build adjacency list
  const graph = new Map<string, string[]>();
  for (const edge of edges) {
    if (!graph.has(edge.from)) {
      graph.set(edge.from, []);
    }
    graph.get(edge.from)!.push(edge.to);
  }

  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
      }
    }

    recursionStack.delete(nodeId);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }

  return cycles.slice(0, 10); // Limit to 10 cycles for performance
}

/**
 * Check if language is supported for AST parsing
 */
function isSupportedLanguage(language: string): boolean {
  const normalized = normalizeLanguage(language);
  if (!SUPPORTED_AST_LANGUAGES.has(normalized)) {
    return false;
  }
  if (isBabelLanguage(normalized)) {
    return true;
  }
  return treeSitterService.isSupported(normalized);
}

const SUPPORTED_AST_LANGUAGES = new Set([
  "javascript",
  "typescript",
  "tsx",
  "python",
  "go",
  "rust",
  "java",
  "ruby",
  "php",
  "csharp",
  "cpp",
  "swift",
]);

function isBabelLanguage(language: string): boolean {
  return ["javascript", "typescript", "tsx"].includes(normalizeLanguage(language));
}

function normalizeLanguage(language: string): string {
  const normalized = language.toLowerCase();
  if (normalized === "js" || normalized === "jsx" || normalized === "mjs") {
    return "javascript";
  }
  if (normalized === "ts") return "typescript";
  if (normalized === "py") return "python";
  if (normalized === "rb") return "ruby";
  if (normalized === "cs" || normalized === "c#") return "csharp";
  if (normalized === "c" || normalized === "cc" || normalized === "cxx" || normalized === "c++") {
    return "cpp";
  }
  return normalized;
}

/**
 * Save code graph to database
 */
export async function saveCodeGraph(
  repositoryId: string,
  graphData: CodeGraphData
): Promise<void> {
  await db.codeGraph.upsert({
    where: { repositoryId },
    create: {
      repositoryId,
      nodes: graphData.nodes as unknown as object,
      edges: graphData.edges as unknown as object,
      metadata: graphData.metadata as unknown as object,
    },
    update: {
      nodes: graphData.nodes as unknown as object,
      edges: graphData.edges as unknown as object,
      metadata: graphData.metadata as unknown as object,
      updatedAt: new Date(),
    },
  });

  logger.info(`[CodeGraph] Saved graph to database`, {
    repositoryId,
    totalNodes: graphData.nodes.length,
    totalEdges: graphData.edges.length,
  });
}

/**
 * Get code graph from database
 */
export async function getCodeGraph(repositoryId: string): Promise<CodeGraphData | null> {
  const graph = await db.codeGraph.findUnique({
    where: { repositoryId },
  });

  if (!graph) {
    return null;
  }

  return {
    nodes: graph.nodes as unknown as GraphNode[],
    edges: graph.edges as unknown as GraphEdge[],
    metadata: graph.metadata as unknown as GraphMetadata,
  };
}

/**
 * Find nodes related to a given node (1-hop neighbors)
 */
export function findRelatedNodes(
  graphData: CodeGraphData,
  nodeId: string,
  maxDepth: number = 1
): GraphNode[] {
  const relatedNodeIds = new Set<string>();
  const visited = new Set<string>();

  function traverse(currentId: string, depth: number) {
    if (depth > maxDepth || visited.has(currentId)) return;
    visited.add(currentId);
    relatedNodeIds.add(currentId);

    // Find outgoing edges
    for (const edge of graphData.edges) {
      if (edge.from === currentId) {
        traverse(edge.to, depth + 1);
      }
      if (edge.to === currentId) {
        traverse(edge.from, depth + 1);
      }
    }
  }

  traverse(nodeId, 0);

  return graphData.nodes.filter((n) => relatedNodeIds.has(n.id));
}

/**
 * Find all functions that call a given function
 */
export function findCallers(graphData: CodeGraphData, functionId: string): GraphNode[] {
  const callerIds = graphData.edges
    .filter((e) => e.type === "calls" && e.to === functionId)
    .map((e) => e.from);

  return graphData.nodes.filter((n) => callerIds.includes(n.id));
}

/**
 * Find all functions called by a given function
 */
export function findCallees(graphData: CodeGraphData, functionId: string): GraphNode[] {
  const calleeIds = graphData.edges
    .filter((e) => e.type === "calls" && e.from === functionId)
    .map((e) => e.to);

  return graphData.nodes.filter((n) => calleeIds.includes(n.id));
}

/**
 * Calculate function importance score based on:
 * - Number of callers (incoming edges)
 * - Whether it's an entry point
 * - Number of callees (outgoing edges)
 */
export function calculateFunctionImportance(
  graphData: CodeGraphData,
  functionId: string
): number {
  let score = 0;

  // Entry points are highly important
  if (graphData.metadata.entryPoints.includes(functionId)) {
    score += 10;
  }

  // Functions called by many others are important
  const callers = findCallers(graphData, functionId);
  score += callers.length * 2;

  // Functions that call many others coordinate logic
  const callees = findCallees(graphData, functionId);
  score += callees.length;

  return score;
}

/**
 * Find all files that depend on a given file (via imports)
 */
export function findDependentFiles(graphData: CodeGraphData, fileId: string): GraphNode[] {
  // Find all import nodes that import from this file
  const importNodeIds = graphData.edges
    .filter((e) => e.type === "imports" && e.to === fileId)
    .map((e) => e.from);

  // Get the files containing these import nodes
  const dependentFileIds = new Set<string>();
  for (const importNodeId of importNodeIds) {
    const importNode = graphData.nodes.find((n) => n.id === importNodeId);
    if (importNode) {
      dependentFileIds.add(`file:${importNode.file}`);
    }
  }

  return graphData.nodes.filter((n) => dependentFileIds.has(n.id));
}

/**
 * Calculate impact radius for changed files
 * Returns files and functions affected by changes
 */
export interface ImpactAnalysis {
  directlyAffectedFiles: string[]; // Files that import changed files
  directlyAffectedFunctions: string[]; // Functions in changed files
  indirectlyAffectedFunctions: string[]; // Functions that call changed functions
  totalImpactRadius: number; // Total unique affected entities
  riskLevel: "low" | "medium" | "high" | "critical";
}

export function analyzeChangeImpact(
  graphData: CodeGraphData,
  changedFiles: string[]
): ImpactAnalysis {
  const directlyAffectedFiles = new Set<string>();
  const directlyAffectedFunctions = new Set<string>();
  const indirectlyAffectedFunctions = new Set<string>();

  // For each changed file
  for (const changedFile of changedFiles) {
    const fileId = changedFile.startsWith("file:")
      ? changedFile
      : `file:${changedFile}`;

    // Find files that depend on this file
    const dependents = findDependentFiles(graphData, fileId);
    for (const dep of dependents) {
      directlyAffectedFiles.add(dep.id);
    }

    // Find all functions in the changed file
    const functionsInFile = graphData.nodes.filter(
      (n) => n.file === changedFile && (n.type === "function" || n.type === "class")
    );

    for (const func of functionsInFile) {
      directlyAffectedFunctions.add(func.id);

      // Find all callers of this function
      const callers = findCallers(graphData, func.id);
      for (const caller of callers) {
        indirectlyAffectedFunctions.add(caller.id);
      }
    }
  }

  const totalImpactRadius =
    directlyAffectedFiles.size +
    directlyAffectedFunctions.size +
    indirectlyAffectedFunctions.size;

  // Determine risk level
  let riskLevel: "low" | "medium" | "high" | "critical" = "low";
  if (totalImpactRadius > 50) {
    riskLevel = "critical";
  } else if (totalImpactRadius > 20) {
    riskLevel = "high";
  } else if (totalImpactRadius > 10) {
    riskLevel = "medium";
  }

  // If any entry points are affected, increase risk
  const affectedEntryPoints = graphData.metadata.entryPoints.filter(
    (ep) =>
      directlyAffectedFunctions.has(ep) || indirectlyAffectedFunctions.has(ep)
  );
  if (affectedEntryPoints.length > 0 && riskLevel === "low") {
    riskLevel = "medium";
  }
  if (affectedEntryPoints.length > 3 && riskLevel === "medium") {
    riskLevel = "high";
  }

  return {
    directlyAffectedFiles: Array.from(directlyAffectedFiles).map((id) =>
      id.startsWith("file:") ? id.substring(5) : id
    ),
    directlyAffectedFunctions: Array.from(directlyAffectedFunctions),
    indirectlyAffectedFunctions: Array.from(indirectlyAffectedFunctions),
    totalImpactRadius,
    riskLevel,
  };
}

/**
 * Get call path between two functions (BFS)
 */
export function findCallPath(
  graphData: CodeGraphData,
  fromFunctionId: string,
  toFunctionId: string,
  maxDepth: number = 5
): string[] | null {
  const queue: Array<{ nodeId: string; path: string[] }> = [
    { nodeId: fromFunctionId, path: [fromFunctionId] },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    if (current.path.length > maxDepth) continue;

    if (current.nodeId === toFunctionId) {
      return current.path;
    }

    if (visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);

    // Find all callees
    const callees = findCallees(graphData, current.nodeId);
    for (const callee of callees) {
      queue.push({
        nodeId: callee.id,
        path: [...current.path, callee.id],
      });
    }
  }

  return null; // No path found
}

/**
 * Format graph context for AI review prompt
 */
export function formatGraphContextForPrompt(
  graphData: CodeGraphData,
  changedFiles: string[]
): string {
  const impact = analyzeChangeImpact(graphData, changedFiles);

  let context = "\n## Codebase Graph Analysis\n\n";

  context += `**Impact Radius:**\n`;
  context += `- ${impact.directlyAffectedFiles.length} files directly depend on changed files\n`;
  context += `- ${impact.directlyAffectedFunctions.length} functions/classes in changed files\n`;
  context += `- ${impact.indirectlyAffectedFunctions.length} functions call the changed functions\n`;
  context += `- **Risk Level:** ${impact.riskLevel.toUpperCase()}\n\n`;

  // Show entry points if affected
  const affectedEntryPoints = graphData.metadata.entryPoints.filter(
    (ep) =>
      impact.directlyAffectedFunctions.includes(ep) ||
      impact.indirectlyAffectedFunctions.includes(ep)
  );

  if (affectedEntryPoints.length > 0) {
    context += `**[WARNING] Entry Points Affected:** ${affectedEntryPoints.length}\n`;
    context += affectedEntryPoints
      .slice(0, 5)
      .map((ep) => {
        const node = graphData.nodes.find((n) => n.id === ep);
        return `- ${node?.name || ep} (${node?.file || "unknown"})`;
      })
      .join("\n");
    context += "\n\n";
  }

  // Show circular dependencies if any involve changed files
  const relevantCycles = graphData.metadata.circularDeps.filter((cycle) =>
    cycle.some((nodeId) => {
      const node = graphData.nodes.find((n) => n.id === nodeId);
      return node && changedFiles.includes(node.file);
    })
  );

  if (relevantCycles.length > 0) {
    context += `**[WARNING] Circular Dependencies Detected:** ${relevantCycles.length}\n`;
    for (let i = 0; i < Math.min(3, relevantCycles.length); i++) {
      const cycle = relevantCycles[i];
      if (!cycle) continue;

      const cycleNames = cycle
        .map((id) => {
          const node = graphData.nodes.find((n) => n.id === id);
          return node?.name || id;
        })
        .join(" → ");
      context += `- ${cycleNames} → (cycle)\n`;
    }
    context += "\n";
  }

  // Show top high-importance functions in changed files
  const changedFunctions = graphData.nodes.filter(
    (n) =>
      changedFiles.includes(n.file) &&
      (n.type === "function" || n.type === "class")
  );

  const functionsWithImportance = changedFunctions
    .map((func) => ({
      ...func,
      importance: calculateFunctionImportance(graphData, func.id),
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 5);

  if (functionsWithImportance.length > 0) {
    context += `**Key Changed Functions (by importance):**\n`;
    for (const func of functionsWithImportance) {
      const callers = findCallers(graphData, func.id);
      context += `- \`${func.name}\` (${func.file}:${func.line}) - ${callers.length} callers\n`;
    }
  }

  return context;
}
