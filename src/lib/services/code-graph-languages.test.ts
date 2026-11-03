import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { buildCodeGraph, findCallers } from "./code-graph";

describe("cross-file call linking beyond TS/JS and Python", () => {
  it("links Java calls through imports and within a package", async () => {
    const graph = await buildCodeGraph("repo", [
      {
        path: "src/main/java/com/app/util/Helper.java",
        language: "java",
        content: "package com.app.util;\npublic class Helper {\n  public static int go() { return 1; }\n}\n",
      },
      {
        path: "src/main/java/com/app/Service.java",
        language: "java",
        content: "package com.app;\nimport com.app.util.Helper;\npublic class Service {\n  int run() { return Helper.go() + Local.twice(); }\n}\n",
      },
      {
        path: "src/main/java/com/app/Local.java",
        language: "java",
        content: "package com.app;\npublic class Local {\n  static int twice() { return 2; }\n}\n",
      },
    ]);

    expect(findCallers(graph, "function:src/main/java/com/app/util/Helper.java:Helper.go").map((n) => n.id)).toEqual([
      "function:src/main/java/com/app/Service.java:Service.run",
    ]);
    // Same package, no import needed
    expect(findCallers(graph, "function:src/main/java/com/app/Local.java:Local.twice").map((n) => n.id)).toEqual([
      "function:src/main/java/com/app/Service.java:Service.run",
    ]);
  });

  it("links Rust calls through use declarations", async () => {
    const graph = await buildCodeGraph("repo", [
      { path: "src/util/helper.rs", language: "rust", content: "pub fn helper() -> i32 { 1 }\n" },
      { path: "src/main.rs", language: "rust", content: "use crate::util::helper::helper;\nfn main() { helper(); }\n" },
    ]);

    expect(findCallers(graph, "function:src/util/helper.rs:helper").map((n) => n.id)).toEqual([
      "function:src/main.rs:main",
    ]);
  });

  it("links C/C++ calls through quoted includes", async () => {
    const graph = await buildCodeGraph("repo", [
      { path: "src/util/helper.cpp", language: "cpp", content: "int helper() { return 1; }\n" },
      { path: "src/util/helper.h", language: "cpp", content: "int helper();\n" },
      {
        path: "src/main.cpp",
        language: "cpp",
        content: '#include "util/helper.h"\n#include <vector>\nint main() { return helper(); }\n',
      },
    ]);

    // Declaration-only headers have no function body; the include still resolves to the header file
    const importsHeader = graph.edges.some(
      (e) => e.type === "imports" && e.from.startsWith("import:src/main.cpp") && e.to === "file:src/util/helper.h"
    );
    expect(importsHeader).toBe(true);
  });

  it("links unresolved calls to a unique, distinctive definition only", async () => {
    const graph = await buildCodeGraph("repo", [
      // Re-exported through an index the resolver cannot follow
      { path: "src/billing/invoice.ts", language: "typescript", content: "export function computeInvoiceTotal() { return 1; }\nexport function save() { return 2; }\n" },
      { path: "src/orders/save.ts", language: "typescript", content: "export function save() { return 3; }\n" },
      {
        path: "src/app/checkout.ts",
        language: "typescript",
        content: 'import { billing } from "some-barrel";\nexport function checkout() {\n  billing.computeInvoiceTotal();\n  billing.save();\n}\n',
      },
    ]);

    expect(findCallers(graph, "function:src/billing/invoice.ts:computeInvoiceTotal").map((n) => n.id)).toEqual([
      "function:src/app/checkout.ts:checkout",
    ]);
    // "save" is common (and defined twice): never guessed
    expect(findCallers(graph, "function:src/billing/invoice.ts:save")).toEqual([]);
    expect(findCallers(graph, "function:src/orders/save.ts:save")).toEqual([]);
  });

  it("parses files larger than tree-sitter's default 32 KB buffer", async () => {
    const filler = "def filler_function():\n    return 1\n\n".repeat(2000); // ~70 KB
    const graph = await buildCodeGraph("repo", [
      { path: "app/big.py", language: "python", content: `${filler}def target_function():\n    return 2\n` },
      { path: "app/use.py", language: "python", content: "from app.big import target_function\n\ndef run_it():\n    return target_function()\n" },
    ]);

    expect(findCallers(graph, "function:app/big.py:target_function").map((n) => n.id)).toEqual([
      "function:app/use.py:run_it",
    ]);
  });

  it("treats JSX usage and `new` as calls, and keeps interfaces out of entry points", async () => {
    const graph = await buildCodeGraph("repo", [
      {
        path: "src/components/ChatLayout.tsx",
        language: "tsx",
        content: "export interface ChatLayoutProps { title: string }\nexport function ChatLayout(props: ChatLayoutProps) {\n  return <div>{props.title}</div>;\n}\n",
      },
      {
        path: "src/app/chat/page.tsx",
        language: "tsx",
        content: 'import { ChatLayout } from "../../components/ChatLayout";\nexport default function ChatPage() {\n  return <ChatLayout title="hi" />;\n}\n',
      },
      { path: "src/lib/store.ts", language: "typescript", content: "export class Store {\n  get() { return 1; }\n}\n" },
      {
        path: "src/lib/use-store.ts",
        language: "typescript",
        content: 'import { Store } from "./store";\nexport function makeStore() {\n  return new Store();\n}\n',
      },
      {
        path: "src/main/java/app/Repo.java",
        language: "java",
        content: "package app;\npublic interface Repo {\n  int load();\n}\n",
      },
    ]);

    expect(findCallers(graph, "function:src/components/ChatLayout.tsx:ChatLayout").map((n) => n.id)).toEqual([
      "function:src/app/chat/page.tsx:ChatPage",
    ]);
    expect(findCallers(graph, "class:src/lib/store.ts:Store").map((n) => n.id)).toEqual([
      "function:src/lib/use-store.ts:makeStore",
    ]);
    // TS interfaces are types: no node at all
    expect(graph.nodes.some((n) => n.name === "ChatLayoutProps")).toBe(false);
    // Components used elsewhere and interfaces are not entry points
    expect(graph.metadata.entryPoints).not.toContain("function:src/components/ChatLayout.tsx:ChatLayout");
    expect(graph.metadata.entryPoints).not.toContain("class:src/main/java/app/Repo.java:Repo");
    expect(graph.metadata.entryPoints).toContain("function:src/app/chat/page.tsx:ChatPage");
  });

  it("does not link files from different languages in the same folder", async () => {
    const graph = await buildCodeGraph("repo", [
      { path: "pkg/a.go", language: "go", content: "package pkg\nfunc Shared() int { return 1 }\n" },
      { path: "pkg/B.java", language: "java", content: "class B { int run() { return Shared(); } }\n" },
    ]);

    expect(findCallers(graph, "function:pkg/a.go:Shared")).toEqual([]);
  });
});
