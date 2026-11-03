/* eslint-disable @typescript-eslint/no-require-imports */
import Parser from "tree-sitter";
import { logger } from "@/lib/logger";

function safeLoadGrammar(
  packageName: string,
  loader: () => unknown
): unknown | null {
  try {
    return loader();
  } catch (error) {
    logger.warn(`[TreeSitter] Failed to load grammar module ${packageName}`, {
      error,
    });
    return null;
  }
}

function getModuleExport(grammarModule: unknown, key: string): unknown {
  if (!grammarModule || typeof grammarModule !== "object") {
    return undefined;
  }
  return (grammarModule as Record<string, unknown>)[key];
}

const JavaScriptGrammarModule: unknown = safeLoadGrammar(
  "tree-sitter-javascript",
  () => require("tree-sitter-javascript")
);
const TypeScriptGrammarModule: unknown = safeLoadGrammar(
  "tree-sitter-typescript",
  () => require("tree-sitter-typescript")
);
const PythonGrammarModule: unknown = safeLoadGrammar(
  "tree-sitter-python",
  () => require("tree-sitter-python")
);
const GoGrammarModule: unknown = safeLoadGrammar(
  "tree-sitter-go",
  () => require("tree-sitter-go")
);
const RustGrammarModule: unknown = safeLoadGrammar(
  "tree-sitter-rust",
  () => require("tree-sitter-rust")
);
const JavaGrammarModule: unknown = safeLoadGrammar(
  "tree-sitter-java",
  () => require("tree-sitter-java")
);
const RubyGrammarModule: unknown = safeLoadGrammar(
  "tree-sitter-ruby",
  () => require("tree-sitter-ruby")
);
const PhpGrammarModule: unknown = safeLoadGrammar(
  "tree-sitter-php",
  () => require("tree-sitter-php")
);
const CSharpGrammarModule: unknown = safeLoadGrammar(
  "tree-sitter-c-sharp",
  () => require("tree-sitter-c-sharp")
);
const CppGrammarModule: unknown = safeLoadGrammar(
  "tree-sitter-cpp",
  () => require("tree-sitter-cpp")
);
const SwiftGrammarModule: unknown = safeLoadGrammar(
  "tree-sitter-swift",
  () => require("tree-sitter-swift")
);

type QueryType = "function" | "class" | "import" | "call";

export interface TreeSitterSymbol {
  name: string;
  startLine: number;
  endLine: number;
  /** Only set for JS/TS, where export status is visible in the syntax tree */
  exported?: boolean;
  /** Interface / protocol / trait: a type contract, never an entry point */
  isInterface?: boolean;
}

export interface TreeSitterImport {
  source: string;
  startLine: number;
  /** Names imported by a Python "from x import a, b" statement */
  names?: string[];
}

const JS_LANGUAGES = new Set(["javascript", "typescript", "tsx"]);
const ANONYMOUS_FUNCTION_TYPES = new Set(["arrow_function", "function_expression", "function"]);

export interface TreeSitterCall {
  callee: string;
  startLine: number;
}

type LanguageConfig = {
  grammarModule: unknown;
  queries: Record<QueryType, string[]>;
};

const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  javascript: {
    grammarModule: JavaScriptGrammarModule,
    queries: {
      function: [
        `(function_declaration name: (_) @name) @function`,
        `(generator_function_declaration name: (_) @name) @function`,
        `(function_expression) @function`,
        `(arrow_function) @function`,
        `(method_definition name: (_) @name) @function`,
      ],
      class: [`(class_declaration name: (_) @name) @class`],
      import: [
        `(import_statement source: (string) @source) @import`,
        `(call_expression function: (import) arguments: (arguments (string) @source)) @import`,
      ],
      call: [
        `(call_expression function: (identifier) @callee) @call`,
        `(call_expression function: (member_expression property: (property_identifier) @callee)) @call`,
        `(new_expression constructor: (identifier) @callee) @call`,
        // <Component /> uses a component the same way a call does
        `(jsx_opening_element name: (identifier) @callee) @call`,
        `(jsx_self_closing_element name: (identifier) @callee) @call`,
      ],
    },
  },
  typescript: {
    grammarModule:
      getModuleExport(TypeScriptGrammarModule, "typescript") ??
      TypeScriptGrammarModule,
    queries: {
      function: [
        `(function_declaration name: (_) @name) @function`,
        `(generator_function_declaration name: (_) @name) @function`,
        `(function_expression) @function`,
        `(arrow_function) @function`,
        `(method_definition name: (_) @name) @function`,
      ],
      // Interfaces are types, not runnable code: they get no graph nodes
      class: [`(class_declaration name: (_) @name) @class`],
      import: [
        `(import_statement source: (string) @source) @import`,
        `(call_expression function: (import) arguments: (arguments (string) @source)) @import`,
      ],
      call: [
        `(call_expression function: (identifier) @callee) @call`,
        `(call_expression function: (member_expression property: (property_identifier) @callee)) @call`,
        `(new_expression constructor: (identifier) @callee) @call`,
      ],
    },
  },
  tsx: {
    grammarModule:
      getModuleExport(TypeScriptGrammarModule, "tsx") ??
      getModuleExport(TypeScriptGrammarModule, "typescript") ??
      TypeScriptGrammarModule,
    queries: {
      function: [
        `(function_declaration name: (_) @name) @function`,
        `(function_expression) @function`,
        `(arrow_function) @function`,
        `(method_definition name: (_) @name) @function`,
      ],
      class: [`(class_declaration name: (_) @name) @class`],
      import: [`(import_statement source: (string) @source) @import`],
      call: [
        `(call_expression function: (identifier) @callee) @call`,
        `(call_expression function: (member_expression property: (property_identifier) @callee)) @call`,
        `(new_expression constructor: (identifier) @callee) @call`,
        `(jsx_opening_element name: (identifier) @callee) @call`,
        `(jsx_self_closing_element name: (identifier) @callee) @call`,
      ],
    },
  },
  python: {
    grammarModule: PythonGrammarModule,
    queries: {
      function: [`(function_definition name: (_) @name) @function`],
      class: [`(class_definition name: (_) @name) @class`],
      import: [
        `(import_statement name: (dotted_name) @source) @import`,
        `(import_statement name: (aliased_import name: (dotted_name) @source)) @import`,
        `(import_from_statement module_name: (dotted_name) @source) @import`,
        `(import_from_statement module_name: (relative_import) @source) @import`,
      ],
      call: [
        `(call function: (identifier) @callee) @call`,
        `(call function: (attribute attribute: (identifier) @callee)) @call`,
      ],
    },
  },
  go: {
    grammarModule: GoGrammarModule,
    queries: {
      function: [
        `(function_declaration name: (_) @name) @function`,
        `(method_declaration name: (_) @name) @function`,
      ],
      class: [
        `(type_declaration (type_spec name: (_) @name type: (struct_type))) @class`,
        `(type_declaration (type_spec name: (_) @name type: (interface_type))) @class`,
      ],
      import: [`(import_spec path: (interpreted_string_literal) @source) @import`],
      call: [
        `(call_expression function: (identifier) @callee) @call`,
        `(call_expression function: (selector_expression field: (_) @callee)) @call`,
      ],
    },
  },
  rust: {
    grammarModule: RustGrammarModule,
    queries: {
      function: [`(function_item name: (_) @name) @function`],
      class: [
        `(struct_item name: (_) @name) @class`,
        `(trait_item name: (_) @name) @class`,
        `(enum_item name: (_) @name) @class`,
      ],
      // Keep this broad; tree-sitter-rust node fields vary across versions.
      import: [`(use_declaration) @source`],
      call: [
        `(call_expression function: (identifier) @callee) @call`,
        `(call_expression function: (field_expression field: (_) @callee)) @call`,
      ],
    },
  },
  java: {
    grammarModule: JavaGrammarModule,
    queries: {
      function: [
        `(method_declaration name: (_) @name) @function`,
        `(constructor_declaration name: (_) @name) @function`,
      ],
      class: [
        `(class_declaration name: (_) @name) @class`,
        `(interface_declaration name: (_) @name) @class`,
      ],
      import: [`(import_declaration (scoped_identifier) @source) @import`],
      call: [
        `(method_invocation name: (_) @callee) @call`,
        `(object_creation_expression type: (type_identifier) @callee) @call`,
      ],
    },
  },
  ruby: {
    grammarModule: RubyGrammarModule,
    queries: {
      function: [`(method name: (_) @name) @function`],
      class: [`(class name: (_) @name) @class`],
      import: [
        `(call method: (identifier) @stmt (#eq? @stmt "require") arguments: (argument_list (string) @source)) @import`,
        `(call method: (identifier) @stmt (#eq? @stmt "require_relative") arguments: (argument_list (string) @source)) @import`,
      ],
      call: [`(call method: (identifier) @callee) @call`],
    },
  },
  php: {
    grammarModule:
      getModuleExport(PhpGrammarModule, "php") ?? PhpGrammarModule,
    queries: {
      function: [
        `(function_definition name: (_) @name) @function`,
        `(method_declaration name: (_) @name) @function`,
      ],
      class: [
        `(class_declaration name: (_) @name) @class`,
        `(interface_declaration name: (_) @name) @class`,
      ],
      import: [
        `(namespace_use_clause (name) @source) @import`,
        `(namespace_use_clause (qualified_name) @source) @import`,
      ],
      call: [
        `(function_call_expression function: (name) @callee) @call`,
        `(method_call_expression name: (name) @callee) @call`,
      ],
    },
  },
  csharp: {
    grammarModule: CSharpGrammarModule,
    queries: {
      function: [`(method_declaration name: (_) @name) @function`],
      class: [
        `(class_declaration name: (_) @name) @class`,
        `(interface_declaration name: (_) @name) @class`,
      ],
      import: [`(using_directive (identifier) @source) @import`],
      call: [
        `(invocation_expression function: (identifier) @callee) @call`,
        `(invocation_expression function: (member_access_expression name: (identifier) @callee)) @call`,
        `(object_creation_expression type: (identifier) @callee) @call`,
      ],
    },
  },
  cpp: {
    grammarModule: CppGrammarModule,
    queries: {
      function: [
        `(function_definition declarator: (function_declarator declarator: (_) @name)) @function`,
      ],
      class: [
        `(class_specifier name: (_) @name) @class`,
        `(struct_specifier name: (_) @name) @class`,
      ],
      import: [`(preproc_include path: (_) @source) @import`],
      call: [
        `(call_expression function: (identifier) @callee) @call`,
        `(call_expression function: (field_expression field: (_) @callee)) @call`,
      ],
    },
  },
  swift: {
    grammarModule: SwiftGrammarModule,
    queries: {
      function: [`(function_declaration name: (_) @name) @function`],
      class: [
        `(class_declaration name: (_) @name) @class`,
        `(struct_declaration name: (_) @name) @class`,
        `(protocol_declaration name: (_) @name) @class`,
      ],
      import: [`(import_declaration (_) @source) @import`],
      call: [`(call_expression (simple_identifier) @callee) @call`],
    },
  },
};

export class TreeSitterService {
  private parsers = new Map<string, Parser>();
  private queries = new Map<string, Partial<Record<QueryType, Parser.Query[]>>>();

  constructor() {
    this.initParsers();
  }

  public parseCode(content: string, language: string): Parser.Tree | null {
    const langKey = this.normalizeLanguage(language);
    const parser = this.parsers.get(langKey);
    if (!parser) return null;

    try {
      // node-tree-sitter rejects inputs over its default 32 KB buffer ("Invalid argument"),
      // which silently dropped every large file from graphs and chunking
      return parser.parse(content, undefined, {
        bufferSize: Math.max(32 * 1024, content.length * 2 + 1),
      });
    } catch (error) {
      logger.warn(`[TreeSitter] Failed to parse ${language} content`, { error });
      return null;
    }
  }

  public parse(content: string, language: string): Parser.Tree | null {
    return this.parseCode(content, language);
  }

  public query(
    tree: Parser.Tree,
    language: string,
    queryType: QueryType
  ): Parser.QueryMatch[] {
    const langKey = this.normalizeLanguage(language);
    const queries = this.queries.get(langKey)?.[queryType];
    if (!queries || queries.length === 0) return [];

    try {
      const allMatches: Parser.QueryMatch[] = [];
      for (const query of queries) {
        allMatches.push(...query.matches(tree.rootNode));
      }
      return allMatches;
    } catch (error) {
      logger.warn(`[TreeSitter] Failed to query ${language} AST`, {
        error,
        queryType,
      });
      return [];
    }
  }

  public getFunctions(tree: Parser.Tree, language: string): TreeSitterSymbol[] {
    const langKey = this.normalizeLanguage(language);
    const matches = this.query(tree, language, "function");
    return matches
      .map((match): TreeSitterSymbol | null => {
        const node = this.getCapture(match, "function");
        if (!node) return null;

        const nameNode = this.getCapture(match, "name");
        let name: string | null = nameNode?.text ?? null;

        if (!name && ANONYMOUS_FUNCTION_TYPES.has(node.type)) {
          // Only keep anonymous functions bound to a name (const fn = () => {}).
          // Inline callbacks are not functions anyone can call or depend on.
          name = this.getBoundFunctionName(node);
          if (!name) return null;
        }

        name = name ?? this.inferName(node);
        if (!name) return null;

        return {
          name: this.normalizeText(name),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported: JS_LANGUAGES.has(langKey) ? this.isJsExported(node) : undefined,
        };
      })
      .filter((result): result is TreeSitterSymbol => result !== null);
  }

  public getClasses(tree: Parser.Tree, language: string): TreeSitterSymbol[] {
    const langKey = this.normalizeLanguage(language);
    const matches = this.query(tree, language, "class");
    return matches
      .map((match): TreeSitterSymbol | null => {
        const node = this.getCapture(match, "class");
        if (!node) return null;

        const nameNode = this.getCapture(match, "name");
        return {
          name: this.normalizeText(nameNode?.text ?? this.inferName(node) ?? "Unknown"),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported: JS_LANGUAGES.has(langKey) ? this.isJsExported(node) : undefined,
          isInterface: /interface|protocol|trait/.test(node.type),
        };
      })
      .filter((result): result is TreeSitterSymbol => result !== null);
  }

  public getImports(tree: Parser.Tree, language: string): TreeSitterImport[] {
    const matches = this.query(tree, language, "import");
    return matches
      .map((match): TreeSitterImport | null => {
        const sourceNode = this.getCapture(match, "source");
        if (!sourceNode) return null;

        const importNode = this.getCapture(match, "import");
        const names =
          importNode?.type === "import_from_statement"
            ? this.getPythonImportedNames(importNode)
            : undefined;

        return {
          source: this.normalizeText(sourceNode.text),
          startLine: sourceNode.startPosition.row + 1,
          names,
        };
      })
      .filter((result): result is TreeSitterImport => result !== null);
  }

  /**
   * Name of the variable/property an anonymous function is assigned to, if any
   */
  private getBoundFunctionName(node: Parser.SyntaxNode): string | null {
    const ownName = node.childForFieldName("name");
    if (ownName?.text) return ownName.text;

    const parent = node.parent;
    if (!parent) return null;

    const pickName = (target: Parser.SyntaxNode | null): string | null => {
      if (!target) return null;
      if (target.type === "member_expression") {
        return target.childForFieldName("property")?.text ?? null;
      }
      return /^[A-Za-z_$][\w$]*$/.test(target.text) ? target.text : null;
    };

    switch (parent.type) {
      case "variable_declarator":
        return pickName(parent.childForFieldName("name"));
      case "pair":
        return pickName(parent.childForFieldName("key"));
      case "assignment_expression":
        return pickName(parent.childForFieldName("left"));
      case "public_field_definition":
      case "field_definition":
        return pickName(parent.childForFieldName("name") ?? parent.childForFieldName("property"));
      default:
        return null;
    }
  }

  /**
   * True when a JS/TS declaration is part of an export statement
   */
  private isJsExported(node: Parser.SyntaxNode): boolean {
    const passThrough = new Set(["variable_declarator", "lexical_declaration", "variable_declaration"]);
    let current = node.parent;
    for (let depth = 0; current && depth < 4; depth++) {
      if (current.type === "export_statement") return true;
      if (!passThrough.has(current.type)) return false;
      current = current.parent;
    }
    return false;
  }

  private getPythonImportedNames(importNode: Parser.SyntaxNode): string[] {
    const moduleNode = importNode.childForFieldName("module_name");
    const names: string[] = [];
    for (const child of importNode.namedChildren) {
      if (moduleNode && child.startIndex === moduleNode.startIndex) continue;
      if (child.type === "dotted_name") {
        names.push(child.text);
      } else if (child.type === "aliased_import") {
        const original = child.childForFieldName("name")?.text;
        if (original) names.push(original);
      }
    }
    return names;
  }

  public getCalls(tree: Parser.Tree, language: string): TreeSitterCall[] {
    const matches = this.query(tree, language, "call");
    return matches
      .map((match) => {
        const callNode = this.getCapture(match, "call");
        if (!callNode) return null;

        const calleeNode = this.getCapture(match, "callee");
        const calleeName = this.normalizeText(
          calleeNode?.text ?? this.inferName(callNode) ?? "unknown"
        );

        return {
          callee: calleeName,
          startLine: callNode.startPosition.row + 1,
        };
      })
      .filter((result): result is TreeSitterCall => result !== null);
  }

  public isSupported(language: string): boolean {
    return this.parsers.has(this.normalizeLanguage(language));
  }

  private initParsers(): void {
    for (const [language, config] of Object.entries(LANGUAGE_CONFIGS)) {
      try {
        const grammar = this.selectGrammar(config.grammarModule);
        if (!grammar) {
          logger.warn(`[TreeSitter] No valid grammar candidate for ${language}`);
          continue;
        }

        const parser = new Parser();
        parser.setLanguage(grammar as never);

        const compiledQueries: Partial<Record<QueryType, Parser.Query[]>> = {};
        for (const [queryType, patterns] of Object.entries(config.queries) as Array<
          [QueryType, string[]]
        >) {
          const compiled = this.compileQueries(grammar, patterns);
          if (compiled.length > 0) {
            compiledQueries[queryType] = compiled;
          } else {
            logger.warn(`[TreeSitter] No valid ${queryType} query for ${language}`);
          }
        }

        this.parsers.set(language, parser);
        this.queries.set(language, compiledQueries);
      } catch (error) {
        logger.warn(`[TreeSitter] Failed to initialize ${language} parser`, {
          error,
        });
      }
    }
  }

  private compileQueries(
    grammar: unknown,
    patterns: string[]
  ): Parser.Query[] {
    const compiledQueries: Parser.Query[] = [];
    for (const pattern of patterns) {
      try {
        compiledQueries.push(new Parser.Query(grammar as never, pattern));
      } catch {
        continue;
      }
    }

    return compiledQueries;
  }

  private selectGrammar(grammarModule: unknown): unknown | null {
    for (const candidate of this.getGrammarCandidates(grammarModule)) {
      try {
        const parser = new Parser();
        parser.setLanguage(candidate as never);
        return candidate;
      } catch {
        const normalized = this.normalizeGrammarCandidate(candidate);
        if (normalized && normalized !== candidate) {
          try {
            const parser = new Parser();
            parser.setLanguage(normalized as never);
            return normalized;
          } catch {
            continue;
          }
        }
        continue;
      }
    }

    return null;
  }

  private getGrammarCandidates(grammarModule: unknown): unknown[] {
    const candidates: unknown[] = [];
    const seen = new Set<unknown>();
    const addCandidate = (candidate: unknown) => {
      if (!candidate || seen.has(candidate)) return;
      if (typeof candidate !== "object" && typeof candidate !== "function") return;
      seen.add(candidate);
      candidates.push(candidate);
    };

    addCandidate(grammarModule);

    if (grammarModule && typeof grammarModule === "object") {
      const grammarRecord = grammarModule as Record<string, unknown>;
      addCandidate(grammarRecord.default);
      addCandidate(grammarRecord.language);
      addCandidate(grammarRecord.typescript);
      addCandidate(grammarRecord.tsx);
      addCandidate(grammarRecord.php);
      addCandidate(grammarRecord.php_only);

      for (const value of Object.values(grammarRecord)) {
        addCandidate(value);
      }
    }

    return candidates;
  }

  private normalizeGrammarCandidate(candidate: unknown): unknown | null {
    if (!candidate || (typeof candidate !== "object" && typeof candidate !== "function")) {
      return null;
    }

    if (typeof candidate === "object") {
      const record = candidate as Record<string, unknown>;

      // JS grammars commonly export { language, nodeTypeInfo } while parser expects the pointer.
      if (record.language && (typeof record.language === "object" || typeof record.language === "function")) {
        return record.language;
      }

      // Some grammars expose an internal parser pointer under parser.language.
      if (
        record.parser &&
        typeof record.parser === "object" &&
        (record.parser as Record<string, unknown>).language
      ) {
        const parserLanguage = (record.parser as Record<string, unknown>).language;
        if (typeof parserLanguage === "object" || typeof parserLanguage === "function") {
          return parserLanguage;
        }
      }
    }

    return null;
  }

  private getCapture(
    match: Parser.QueryMatch,
    captureName: string
  ): Parser.SyntaxNode | null {
    const capture = match.captures.find((item) => item.name === captureName);
    return capture?.node ?? null;
  }

  private inferName(node: Parser.SyntaxNode): string | null {
    const fieldNames = ["name", "declarator", "field", "property", "module_name"];
    for (const fieldName of fieldNames) {
      const fieldNode = node.childForFieldName(fieldName);
      if (fieldNode?.text) {
        const normalized = this.normalizeText(fieldNode.text);
        if (normalized) return normalized;
      }
    }

    const identifier = this.findFirstIdentifier(node);
    if (!identifier?.text) return null;
    return this.normalizeText(identifier.text);
  }

  private findFirstIdentifier(
    root: Parser.SyntaxNode
  ): Parser.SyntaxNode | null {
    const stack: Parser.SyntaxNode[] = [root];
    const identifierTokens = [
      "identifier",
      "type_identifier",
      "field_identifier",
      "property_identifier",
      "constant",
      "simple_identifier",
      "name",
    ];

    while (stack.length > 0) {
      const current = stack.shift();
      if (!current) continue;

      if (identifierTokens.some((token) => current.type.includes(token))) {
        return current;
      }

      for (const child of current.namedChildren) {
        stack.push(child);
      }
    }

    return null;
  }

  private normalizeText(value: string): string {
    return value.replace(/^['"`]|['"`]$/g, "").trim();
  }

  private normalizeLanguage(language: string): string {
    const normalized = language.toLowerCase();

    if (normalized === "js" || normalized === "jsx" || normalized === "mjs") {
      return "javascript";
    }
    if (normalized === "ts") return "typescript";
    if (normalized === "tsx") return "tsx";
    if (normalized === "py") return "python";
    if (normalized === "rb") return "ruby";
    if (normalized === "cs" || normalized === "c#") return "csharp";
    if (normalized === "c" || normalized === "c++" || normalized === "cc" || normalized === "cxx") {
      return "cpp";
    }

    return normalized;
  }
}

export const treeSitterService = new TreeSitterService();
