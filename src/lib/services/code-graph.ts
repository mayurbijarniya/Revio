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
import { isTestFile, isTestFunctionName } from "./test-files";

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
  /** Python module suffix ("pkg.mod", "mod") -> files, for src/-style layouts */
  pythonModules: Map<string, string[]>;
  /** File name -> repository paths, for suffix lookups (Java packages, C includes, Rust modules) */
  filesByBaseName: Map<string, string[]>;
}

/**
 * Languages where files in the same directory (package/module) see each other's
 * top-level definitions without an import
 */
const SAME_DIRECTORY_SCOPE_EXTENSIONS = /\.(go|java|kt|cs|swift)$/;

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

  // Link call edges to the real definitions (same file first, then imported files)
  const resolvedEdges = resolveCallEdges(nodes, edges);
  edges.length = 0;
  edges.push(...resolvedEdges);

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
 * Replace the base-branch entries of the given files with their PR-head versions.
 *
 * - Nodes and outgoing edges of each replaced file are rebuilt from headFiles.
 * - Edges from unchanged files into the replaced files are kept, so existing callers
 *   of a modified function stay linked (node ids are stable when names are unchanged).
 * - Definitions the PR removed are kept as line-less nodes and returned as removedNodeIds,
 *   so their existing callers still show up as impacted.
 *
 * configFiles (e.g. tsconfig.json at the PR head) are only used for import alias resolution.
 */
export function overlayFilesOnGraph(params: {
  baseGraph: CodeGraphData;
  headFiles: Array<{ path: string; content: string; language: string }>;
  /** Base-branch paths these head files replace (old paths for renames) */
  replacedPaths: string[];
  configFiles?: Array<{ path: string; content: string }>;
}): { graph: CodeGraphData; removedNodeIds: string[] } {
  const { baseGraph, headFiles, configFiles = [] } = params;
  const replaced = new Set([...params.replacedPaths, ...headFiles.map((f) => f.path)]);

  // Resolver sees every file of the repository as it looks in the PR
  const repoFiles = new Set<string>();
  for (const node of baseGraph.nodes) {
    if (node.type === "file") repoFiles.add(node.file);
  }
  for (const path of params.replacedPaths) repoFiles.delete(path);
  for (const file of headFiles) repoFiles.add(file.path);
  const resolverOptions = buildImportResolverOptions([
    ...Array.from(repoFiles).map((path) => ({ path, content: "" })),
    ...configFiles,
  ]);

  const nodeMap = new Map<string, GraphNode>();
  const headEdges: GraphEdge[] = [];
  for (const file of headFiles) {
    if (!isSupportedLanguage(file.language)) {
      nodeMap.set(`file:${file.path}`, { id: `file:${file.path}`, type: "file", name: file.path, file: file.path });
      continue;
    }
    try {
      const { fileNodes, fileEdges } = parseFile(file.path, file.content, file.language, resolverOptions);
      for (const node of fileNodes) nodeMap.set(node.id, node);
      headEdges.push(...fileEdges);
    } catch (error) {
      logger.warn(`[CodeGraph] Failed to parse PR head version of ${file.path}`, { error });
    }
  }

  const keptNodes: GraphNode[] = [];
  const removedNodeIds: string[] = [];
  for (const node of baseGraph.nodes) {
    if (!replaced.has(node.file)) {
      keptNodes.push(node);
      continue;
    }
    const isDefinition = node.type === "function" || node.type === "class";
    if (isDefinition && !nodeMap.has(node.id)) {
      // Removed or renamed in the PR: keep it without line info so callers stay linked
      removedNodeIds.push(node.id);
      keptNodes.push({ ...node, line: undefined, endLine: undefined });
    }
  }

  const fileOfNode = new Map(baseGraph.nodes.map((n) => [n.id, n.file]));
  const keptEdges = baseGraph.edges.filter((edge) => {
    const fromFile = fileOfNode.get(edge.from);
    return fromFile !== undefined && !replaced.has(fromFile);
  });

  const nodes = [...keptNodes, ...nodeMap.values()];
  const edges = resolveCallEdges(nodes, [...keptEdges, ...headEdges]);

  return {
    graph: { nodes, edges, metadata: calculateMetadata(nodes, edges) },
    removedNodeIds,
  };
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
    extractFromTreeSitterAST(
      tree,
      normalizeLanguage(normalizedLanguage),
      filePath,
      fileNodes,
      fileEdges,
      resolverOptions
    );
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
  edges: GraphEdge[],
  resolverOptions: ImportResolverOptions
) {
  const fileNodeId = `file:${filePath}`;

  // 1. Classes
  const classNodes: GraphNode[] = [];
  for (const cls of treeSitterService.getClasses(ast, language)) {
    if (!cls) continue;
    const node: GraphNode = {
      id: `class:${filePath}:${cls.name}`,
      type: "class",
      name: cls.name,
      file: filePath,
      line: cls.startLine,
      endLine: cls.endLine,
      exported: isTreeSitterSymbolExported(language, cls.name, cls.exported, false),
    };
    nodes.push(node);
    classNodes.push(node);
    edges.push({ from: fileNodeId, to: node.id, type: "exports", file: filePath, line: cls.startLine });
  }

  // 2. Functions / methods (methods are qualified by their class to avoid id collisions)
  const functions = treeSitterService.getFunctions(ast, language).filter(Boolean);
  const functionNodes: GraphNode[] = [];
  for (const fn of functions) {
    const owner = findInnermostContaining(classNodes, fn.startLine, fn.endLine);
    const isNested = functions.some(
      (other) =>
        other !== fn &&
        other.startLine <= fn.startLine &&
        other.endLine >= fn.endLine &&
        (other.startLine !== fn.startLine || other.endLine !== fn.endLine)
    );
    const qualifiedName = owner ? `${owner.name}.${fn.name}` : fn.name;
    const node: GraphNode = {
      id: `function:${filePath}:${qualifiedName}`,
      type: "function",
      name: fn.name,
      file: filePath,
      line: fn.startLine,
      endLine: fn.endLine,
      exported: isTreeSitterSymbolExported(language, fn.name, fn.exported, Boolean(owner) || isNested),
    };
    nodes.push(node);
    functionNodes.push(node);
    edges.push({
      from: owner ? owner.id : fileNodeId,
      to: node.id,
      type: "exports",
      file: filePath,
      line: fn.startLine,
    });
  }

  // 3. Imports, resolved to repository files where possible
  for (const imp of treeSitterService.getImports(ast, language)) {
    if (!imp) continue;
    const nodeId = `import:${filePath}:${imp.source}`;
    nodes.push({ id: nodeId, type: "import", name: imp.source, file: filePath, line: imp.startLine });
    edges.push({ from: fileNodeId, to: nodeId, type: "imports", file: filePath, line: imp.startLine });

    for (const targetFile of resolveTreeSitterImport(filePath, imp, language, resolverOptions)) {
      if (targetFile === filePath) continue;
      edges.push({ from: nodeId, to: `file:${targetFile}`, type: "imports", file: filePath, line: imp.startLine });
    }
  }

  // 4. Calls, attributed to the innermost enclosing function (module-level calls stay on the file).
  // Targets are provisional; resolveCallEdges links them to real definitions after all files are parsed.
  for (const call of treeSitterService.getCalls(ast, language)) {
    if (!call) continue;
    const caller = findInnermostContaining(functionNodes, call.startLine, call.startLine);
    edges.push({
      from: caller?.id ?? fileNodeId,
      to: `function:${filePath}:${call.callee}`,
      type: "calls",
      file: filePath,
      line: call.startLine,
    });
  }
}

/**
 * Smallest node whose line range contains [start, end]
 */
function findInnermostContaining(
  candidates: GraphNode[],
  start: number,
  end: number
): GraphNode | null {
  let best: GraphNode | null = null;
  for (const node of candidates) {
    if (typeof node.line !== "number" || typeof node.endLine !== "number") continue;
    if (node.line > start || node.endLine < end) continue;
    if (!best || node.endLine - node.line < (best.endLine ?? 0) - (best.line ?? 0)) {
      best = node;
    }
  }
  return best;
}

/**
 * Whether a symbol is part of a module's public surface (used for entry-point detection)
 */
function isTreeSitterSymbolExported(
  language: string,
  name: string,
  syntaxExported: boolean | undefined,
  isMemberOrNested: boolean
): boolean {
  if (isMemberOrNested) return false;
  if (syntaxExported !== undefined) return syntaxExported;
  if (language === "python") return !name.startsWith("_");
  if (language === "go") return /^[A-Z]/.test(name);
  return true;
}

function resolveTreeSitterImport(
  fromFile: string,
  imp: { source: string; names?: string[] },
  language: string,
  resolverOptions: ImportResolverOptions
): string[] {
  if (isBabelLanguage(language)) {
    const target = resolveImportPath(fromFile, imp.source, resolverOptions);
    return target ? [target] : [];
  }
  if (language === "python") {
    return resolvePythonImport(fromFile, imp.source, imp.names ?? [], resolverOptions);
  }

  const fromDir = fromFile.split("/").slice(0, -1).join("/");
  const found = (path: string | null) => (path ? [path] : []);

  switch (language) {
    case "java": {
      // com.app.util.Helper, or com.app.util.Math.add for static imports; package wildcards have no file
      if (imp.source.endsWith(".*")) return [];
      const segments = imp.source.split(".");
      for (let length = segments.length; length > 0; length--) {
        const match = findFileBySuffix(`${segments.slice(0, length).join("/")}.java`, resolverOptions);
        if (match) return [match];
      }
      return [];
    }
    case "cpp": {
      // #include "util/helper.h": relative to the file first, then anywhere; <system> headers are skipped
      if (imp.source.startsWith("<")) return [];
      const relative = normalizeRepoPath(`${fromDir}/${imp.source}`);
      if (resolverOptions.knownFiles.has(relative)) return [relative];
      return found(findFileBySuffix(imp.source, resolverOptions));
    }
    case "ruby": {
      // require_relative "lib/util" or require "util"
      const withExtension = imp.source.endsWith(".rb") ? imp.source : `${imp.source}.rb`;
      const relative = normalizeRepoPath(`${fromDir}/${withExtension}`);
      if (resolverOptions.knownFiles.has(relative)) return [relative];
      return found(findFileBySuffix(withExtension, resolverOptions));
    }
    case "php": {
      // use App\Models\User -> .../Models/User.php (PSR-4 roots vary, so match by suffix)
      const segments = imp.source.replace(/^\\/, "").split("\\").filter(Boolean);
      for (let start = 0; start < segments.length; start++) {
        const match = findFileBySuffix(`${segments.slice(start).join("/")}.php`, resolverOptions);
        if (match) return [match];
      }
      return [];
    }
    case "rust":
      return resolveRustUse(imp.source, resolverOptions);
    default:
      return [];
  }
}

/**
 * The single repository file whose path ends with the given suffix (null when none or ambiguous)
 */
function findFileBySuffix(suffix: string, resolverOptions: ImportResolverOptions): string | null {
  const normalized = normalizeRepoPath(suffix);
  const baseName = normalized.split("/").pop() ?? normalized;
  const matches = (resolverOptions.filesByBaseName.get(baseName) ?? []).filter(
    (path) => path === normalized || path.endsWith(`/${normalized}`)
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

/**
 * Resolve "use crate::models::user::{User, Role};" to src/models/user.rs (or .../mod.rs)
 */
function resolveRustUse(source: string, resolverOptions: ImportResolverOptions): string[] {
  const path = source
    .replace(/^\s*(pub(\([^)]*\))?\s+)?use\s+/, "")
    .replace(/;\s*$/, "")
    .split("::{")[0]
    ?.trim();
  if (!path) return [];

  const segments = path
    .split("::")
    .map((s) => s.trim())
    .filter((s) => s && !["crate", "self", "super"].includes(s) && !s.includes(" "));

  for (let length = segments.length; length > 0; length--) {
    const modulePath = segments.slice(0, length).join("/");
    const match =
      findFileBySuffix(`${modulePath}.rs`, resolverOptions) ??
      findFileBySuffix(`${modulePath}/mod.rs`, resolverOptions);
    if (match) return [match];
  }
  return [];
}

/**
 * Resolve "import a.b", "from a.b import c" and "from ..a import b" to repository files
 */
function resolvePythonImport(
  fromFile: string,
  source: string,
  names: string[],
  resolverOptions: ImportResolverOptions
): string[] {
  const results = new Set<string>();
  const { knownFiles, pythonModules } = resolverOptions;

  const tryModule = (modulePath: string, dottedName: string | null): boolean => {
    if (modulePath) {
      for (const candidate of [`${modulePath}.py`, `${modulePath}/__init__.py`]) {
        const normalized = normalizeRepoPath(candidate);
        if (knownFiles.has(normalized)) {
          results.add(normalized);
          return true;
        }
      }
    }
    // Absolute imports in src/-style layouts: match by module suffix when unambiguous
    if (dottedName) {
      const matches = pythonModules.get(dottedName) ?? [];
      if (matches.length === 1 && matches[0]) {
        results.add(matches[0]);
        return true;
      }
    }
    return false;
  };

  const leadingDots = source.match(/^\.+/)?.[0].length ?? 0;
  const rest = source.slice(leadingDots);

  if (leadingDots > 0) {
    const dirParts = fromFile.split("/").slice(0, -1);
    const baseParts = dirParts.slice(0, Math.max(0, dirParts.length - (leadingDots - 1)));
    const modulePath = [...baseParts, ...(rest ? rest.split(".") : [])].join("/");

    const moduleFound = rest ? tryModule(modulePath, null) : false;
    let submoduleFound = false;
    for (const name of names) {
      submoduleFound = tryModule(`${modulePath}/${name.replace(/\./g, "/")}`, null) || submoduleFound;
    }
    if (!moduleFound && !submoduleFound) tryModule(modulePath, null);
  } else {
    const modulePath = rest.replace(/\./g, "/");
    tryModule(modulePath, rest);
    for (const name of names) {
      tryModule(`${modulePath}/${name.replace(/\./g, "/")}`, `${rest}.${name}`);
    }
  }

  return Array.from(results);
}

function buildPythonModuleIndex(files: Array<{ path: string }>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const file of files) {
    const normalized = normalizeRepoPath(file.path);
    if (!normalized.endsWith(".py")) continue;

    const parts = normalized.slice(0, -3).split("/");
    if (parts[parts.length - 1] === "__init__") parts.pop();

    for (let i = 0; i < parts.length; i++) {
      const key = parts.slice(i).join(".");
      if (!key) continue;
      const existing = index.get(key) ?? [];
      if (!existing.includes(normalized)) existing.push(normalized);
      index.set(key, existing);
    }
  }
  return index;
}

/**
 * Point each call edge at the real definition it refers to.
 * Lookup order: the caller's own file, then files it imports (and, for package-scoped languages,
 * its directory), then a repo-wide definition with a unique, distinctive name.
 * Calls that cannot be matched to a known definition (library/builtin calls) are dropped,
 * so the graph only contains edges between real nodes.
 */
function resolveCallEdges(nodes: GraphNode[], edges: GraphEdge[]): GraphEdge[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const definitionsByFile = new Map<string, Map<string, string[]>>();
  const definitionsByName = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.type !== "function" && node.type !== "class") continue;
    const byName = definitionsByFile.get(node.file) ?? new Map<string, string[]>();
    const ids = byName.get(node.name) ?? [];
    ids.push(node.id);
    byName.set(node.name, ids);
    definitionsByFile.set(node.file, byName);
    if (!isTestNode(node)) {
      definitionsByName.set(node.name, [...(definitionsByName.get(node.name) ?? []), node.id]);
    }
  }

  const importTargets = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.type === "imports" && edge.from.startsWith("import:") && edge.to.startsWith("file:")) {
      const targets = importTargets.get(edge.from) ?? [];
      targets.push(edge.to.substring(5));
      importTargets.set(edge.from, targets);
    }
  }

  const importedFilesByFile = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.type === "imports" && edge.from.startsWith("file:") && edge.to.startsWith("import:")) {
      const file = edge.from.substring(5);
      const set = importedFilesByFile.get(file) ?? new Set<string>();
      for (const target of importTargets.get(edge.to) ?? []) set.add(target);
      importedFilesByFile.set(file, set);
    }
  }

  // Go/Java/Kotlin/C#/Swift definitions are visible across files of the same package
  // (approximated as: same directory, same file extension)
  const packageKey = (file: string) =>
    `${file.split("/").slice(0, -1).join("/")}|${file.slice(file.lastIndexOf("."))}`;
  const packageFiles = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.type !== "file" || !SAME_DIRECTORY_SCOPE_EXTENSIONS.test(node.file)) continue;
    const key = packageKey(node.file);
    packageFiles.set(key, [...(packageFiles.get(key) ?? []), node.file]);
  }

  const MAX_AMBIGUOUS_TARGETS = 3;
  const result: GraphEdge[] = [];
  const seenCalls = new Set<string>();

  const pushCall = (edge: GraphEdge, to: string) => {
    if (to === edge.from) return; // ignore direct recursion
    const key = `${edge.from}->${to}`;
    if (seenCalls.has(key)) return;
    seenCalls.add(key);
    result.push({ ...edge, to });
  };

  for (const edge of edges) {
    if (edge.type !== "calls") {
      result.push(edge);
      continue;
    }

    const callerNode = nodeById.get(edge.from);
    if (!callerNode) continue;

    if (nodeById.has(edge.to)) {
      pushCall(edge, edge.to);
      continue;
    }

    const rawName = edge.to.substring(edge.to.lastIndexOf(":") + 1);
    const calleeName = rawName.substring(rawName.lastIndexOf(".") + 1);
    if (!calleeName) continue;

    const callerFile = callerNode.file;
    const local = definitionsByFile.get(callerFile)?.get(calleeName) ?? [];
    if (local.length > 0) {
      for (const id of local.slice(0, MAX_AMBIGUOUS_TARGETS)) pushCall(edge, id);
      continue;
    }

    const scopeFiles = new Set<string>(importedFilesByFile.get(callerFile) ?? []);
    if (SAME_DIRECTORY_SCOPE_EXTENSIONS.test(callerFile)) {
      for (const sibling of packageFiles.get(packageKey(callerFile)) ?? []) {
        if (sibling !== callerFile) scopeFiles.add(sibling);
      }
    }

    const candidates: string[] = [];
    for (const file of scopeFiles) {
      candidates.push(...(definitionsByFile.get(file)?.get(calleeName) ?? []));
    }
    // Common names (get, run, ...) defined in many imported files are too ambiguous to link
    if (candidates.length > MAX_AMBIGUOUS_TARGETS) continue;
    if (candidates.length > 0) {
      for (const id of candidates) pushCall(edge, id);
      continue;
    }

    // Fallback for calls imports could not explain (re-exports, dynamic imports, implicit
    // packages): link when exactly one definition in the repo, in the same language, has a
    // distinctive name
    const unique = findUniqueDefinition(calleeName, callerFile);
    if (unique) pushCall(edge, unique);
  }

  return result;

  function findUniqueDefinition(name: string, callerFile: string): string | null {
    if (!isDistinctiveName(name)) return null;
    const matches = (definitionsByName.get(name) ?? []).filter(
      (id) => fileExtension(nodeById.get(id)?.file ?? "") === fileExtension(callerFile)
    );
    return matches.length === 1 ? (matches[0] ?? null) : null;
  }
}

/**
 * Names generic enough that a single repo-wide definition is probably not the one being called
 * (it is more likely a library/builtin method with the same name)
 */
const COMMON_CALL_NAMES = new Set([
  "get", "set", "put", "post", "patch", "delete", "remove", "add", "save", "load", "run", "exec",
  "execute", "call", "apply", "bind", "init", "initialize", "setup", "start", "stop", "close", "open",
  "read", "write", "send", "fetch", "parse", "format", "render", "update", "create", "build", "make",
  "handle", "process", "validate", "check", "test", "main", "map", "filter", "reduce", "find", "sort",
  "push", "pop", "shift", "join", "split", "toString", "valueOf", "equals", "hashCode", "compareTo",
  "length", "size", "count", "keys", "values", "items", "next", "then", "catch", "finally", "resolve",
  "reject", "emit", "on", "off", "log", "print", "debug", "info", "warn", "error", "clear", "reset",
  "copy", "clone", "merge", "append", "insert", "contains", "has", "includes", "index", "default",
  "constructor", "__init__", "__call__", "__str__", "__repr__", "super", "require", "import",
]);

function isDistinctiveName(name: string): boolean {
  return name.length >= 4 && !COMMON_CALL_NAMES.has(name) && !COMMON_CALL_NAMES.has(name.toLowerCase());
}

function fileExtension(file: string): string {
  const dot = file.lastIndexOf(".");
  return dot === -1 ? "" : file.slice(dot).toLowerCase();
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
    // normalizeRepoPath collapses "./" and "../" segments
    basePaths = [importPath.startsWith("/") ? importPath.slice(1) : `${fromDir}/${importPath}`];
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
  const pythonModules = buildPythonModuleIndex(files);
  const filesByBaseName = new Map<string, string[]>();
  for (const path of knownFiles) {
    const baseName = path.split("/").pop() ?? path;
    filesByBaseName.set(baseName, [...(filesByBaseName.get(baseName) ?? []), path]);
  }

  return { aliases, knownFiles, pythonModules, filesByBaseName };
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

  // Find entry points (exported functions/classes nothing in the repo calls).
  // Tests are never entry points: nothing calls them by design.
  const calledNodeIds = new Set(edges.filter((e) => e.type === "calls").map((e) => e.to));
  const entryPoints = nodes
    .filter(
      (n) =>
        (n.type === "function" || n.type === "class") &&
        n.exported &&
        !calledNodeIds.has(n.id) &&
        !isTestNode(n)
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
 * Test files and test functions are excluded from impact: nothing depends on them.
 */
export function isTestNode(node: GraphNode): boolean {
  if (isTestFile(node.file)) return true;
  return (node.type === "function" || node.type === "class") && isTestFunctionName(node.name);
}

/**
 * Functions/classes touched by a change.
 * With changedLinesByFile (diff line numbers in the graph's coordinates), only the innermost
 * definition containing each changed line counts. Without it, every definition in the
 * file counts (legacy whole-file behaviour, used by the impact API).
 * extraChangedNodeIds adds definitions that cannot be found by line, such as functions
 * the PR removed (see overlayFilesOnGraph).
 */
export function findChangedNodes(
  graphData: CodeGraphData,
  changedFiles: string[],
  changedLinesByFile?: Record<string, number[]>,
  extraChangedNodeIds: string[] = []
): GraphNode[] {
  const changed = new Map<string, GraphNode>();

  if (extraChangedNodeIds.length > 0) {
    const extraIds = new Set(extraChangedNodeIds);
    for (const node of graphData.nodes) {
      if (extraIds.has(node.id)) changed.set(node.id, node);
    }
  }

  for (const changedFile of changedFiles) {
    const definitions = graphData.nodes.filter(
      (n) => n.file === changedFile && (n.type === "function" || n.type === "class")
    );
    if (definitions.length === 0) continue;

    if (!changedLinesByFile) {
      for (const node of definitions) changed.set(node.id, node);
      continue;
    }

    for (const line of changedLinesByFile[changedFile] ?? []) {
      const node = findInnermostContaining(definitions, line, line);
      if (node) changed.set(node.id, node);
    }
  }

  return Array.from(changed.values()).filter((n) => !isTestNode(n));
}

/**
 * Structural impact of a change on the rest of the codebase
 */
export interface ImpactAnalysis {
  directlyAffectedFiles: string[]; // Other files that import or call into the changed code
  directlyAffectedFunctions: string[]; // Functions/classes the change touches
  indirectlyAffectedFunctions: string[]; // Functions/classes elsewhere that call the changed ones
  affectedEntryPoints: string[]; // Public entry points among the changed functions and their callers
  totalImpactRadius: number; // Downstream size: dependent files + callers
  riskLevel: "low" | "medium" | "high" | "critical"; // Structural impact only, not a code-quality verdict
}

export function analyzeChangeImpact(
  graphData: CodeGraphData,
  changedFiles: string[],
  changedLinesByFile?: Record<string, number[]>,
  extraChangedNodeIds: string[] = []
): ImpactAnalysis {
  const changedFileSet = new Set(changedFiles);
  const changedNodes = findChangedNodes(graphData, changedFiles, changedLinesByFile, extraChangedNodeIds);
  const changedIds = new Set(changedNodes.map((n) => n.id));

  const dependentFiles = new Set<string>();
  const callerIds = new Set<string>();

  const addDependentFile = (file: string) => {
    if (!changedFileSet.has(file) && !isTestFile(file)) dependentFiles.add(file);
  };

  // Files importing a changed file (only when the file actually has changed lines)
  for (const changedFile of changedFiles) {
    const hasChangedLines = !changedLinesByFile || (changedLinesByFile[changedFile]?.length ?? 0) > 0;
    if (!hasChangedLines) continue;
    for (const dep of findDependentFiles(graphData, `file:${changedFile}`)) {
      addDependentFile(dep.file);
    }
  }

  // Callers of the changed functions outside the changed set
  for (const node of changedNodes) {
    for (const caller of findCallers(graphData, node.id)) {
      if (changedIds.has(caller.id) || isTestNode(caller)) continue;
      if (caller.type === "file") {
        addDependentFile(caller.file);
      } else {
        callerIds.add(caller.id);
      }
    }
  }

  const entryPointSet = new Set(graphData.metadata.entryPoints);
  const nodeById = new Map(graphData.nodes.map((n) => [n.id, n]));
  const affectedEntryPoints = [...changedIds, ...callerIds].filter((id) => {
    const node = nodeById.get(id);
    return entryPointSet.has(id) && node !== undefined && !isTestNode(node);
  });

  const downstream = dependentFiles.size + callerIds.size;

  let riskLevel: ImpactAnalysis["riskLevel"] = "low";
  if (downstream > 30) {
    riskLevel = "critical";
  } else if (downstream > 12) {
    riskLevel = "high";
  } else if (downstream > 3) {
    riskLevel = "medium";
  }

  // Touching public entry points (routes, CLI mains, exported APIs) raises impact
  if (affectedEntryPoints.length > 0 && riskLevel === "low") {
    riskLevel = "medium";
  }
  if (affectedEntryPoints.length > 3 && riskLevel === "medium") {
    riskLevel = "high";
  }

  return {
    directlyAffectedFiles: Array.from(dependentFiles),
    directlyAffectedFunctions: Array.from(changedIds),
    indirectlyAffectedFunctions: Array.from(callerIds),
    affectedEntryPoints,
    totalImpactRadius: downstream,
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
 * Format graph context for AI review prompt.
 * Only structural facts are given; the model decides the review risk itself.
 */
export function formatGraphContextForPrompt(
  graphData: CodeGraphData,
  changedFiles: string[],
  changedLinesByFile?: Record<string, number[]>,
  extraChangedNodeIds: string[] = []
): string {
  const impact = analyzeChangeImpact(graphData, changedFiles, changedLinesByFile, extraChangedNodeIds);
  const nodeById = new Map(graphData.nodes.map((n) => [n.id, n]));
  const describe = (id: string) => {
    const node = nodeById.get(id);
    return node ? `\`${node.name}\` (${node.file}${node.line ? `:${node.line}` : ""})` : id;
  };

  let context = "\n## Codebase Graph Analysis\n";
  context += "Structural facts from the repository code graph, with the changed files parsed at the PR head when available.\n\n";

  context += `- Changed functions/classes found in the graph: ${impact.directlyAffectedFunctions.length}\n`;
  for (const id of impact.directlyAffectedFunctions.slice(0, 8)) {
    context += `  - ${describe(id)} - ${findCallers(graphData, id).length} caller(s)\n`;
  }

  context += `- Other files that import or call the changed code: ${impact.directlyAffectedFiles.length}\n`;
  for (const file of impact.directlyAffectedFiles.slice(0, 8)) {
    context += `  - ${file}\n`;
  }

  context += `- Functions elsewhere that call the changed functions: ${impact.indirectlyAffectedFunctions.length}\n`;
  for (const id of impact.indirectlyAffectedFunctions.slice(0, 8)) {
    context += `  - ${describe(id)}\n`;
  }

  if (impact.affectedEntryPoints.length > 0) {
    context += `- Public entry points touched: ${impact.affectedEntryPoints.length}\n`;
    for (const id of impact.affectedEntryPoints.slice(0, 5)) {
      context += `  - ${describe(id)}\n`;
    }
  }

  context += `- Structural impact: ${impact.riskLevel.toUpperCase()} (size of downstream code only, not a judgement of code quality)\n\n`;

  // Show circular dependencies if any involve changed files
  const relevantCycles = graphData.metadata.circularDeps.filter((cycle) =>
    cycle.some((nodeId) => {
      const node = nodeById.get(nodeId);
      return node && changedFiles.includes(node.file);
    })
  );

  if (relevantCycles.length > 0) {
    context += `**[WARNING] Circular Dependencies Detected:** ${relevantCycles.length}\n`;
    for (const cycle of relevantCycles.slice(0, 3)) {
      const cycleNames = cycle.map((id) => nodeById.get(id)?.name || id).join(" → ");
      context += `- ${cycleNames} → (cycle)\n`;
    }
    context += "\n";
  }

  return context;
}
