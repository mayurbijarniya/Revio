#!/usr/bin/env node

const Parser = require("tree-sitter");

const LANGUAGE_LOADERS = {
  javascript: () => require("tree-sitter-javascript"),
  typescript: () => {
    const mod = require("tree-sitter-typescript");
    return mod.typescript || mod;
  },
  tsx: () => {
    const mod = require("tree-sitter-typescript");
    return mod.tsx || mod.typescript || mod;
  },
  python: () => require("tree-sitter-python"),
  go: () => require("tree-sitter-go"),
  rust: () => require("tree-sitter-rust"),
  java: () => require("tree-sitter-java"),
  ruby: () => require("tree-sitter-ruby"),
  php: () => {
    const mod = require("tree-sitter-php");
    return mod.php || mod.php_only || mod;
  },
  csharp: () => require("tree-sitter-c-sharp"),
  cpp: () => require("tree-sitter-cpp"),
  swift: () => require("tree-sitter-swift"),
};

const SAMPLES = {
  javascript: "function run() { return 1; }",
  typescript: "export function run(a: number): number { return a; }",
  tsx: "export const App = () => <div>Hello</div>;",
  python: "def run():\n  return 1\n",
  go: "package main\nfunc run() int { return 1 }\n",
  rust: "fn run() -> i32 { 1 }\n",
  java: "class Main { int run() { return 1; } }",
  ruby: "def run\n  1\nend\n",
  php: "<?php function run(){ return 1; }",
  csharp: "class Main { int Run() { return 1; } }",
  cpp: "int run() { return 1; }",
  swift: "func run() -> Int { return 1 }",
};

let failed = false;

for (const [language, loadGrammar] of Object.entries(LANGUAGE_LOADERS)) {
  try {
    const grammar = loadGrammar();
    const parser = new Parser();
    parser.setLanguage(grammar);
    const sample = SAMPLES[language] || " ";
    const tree = parser.parse(sample);
    if (!tree || !tree.rootNode) {
      throw new Error("parse returned no root node");
    }
    console.log(`${language}: OK`);
  } catch (error) {
    failed = true;
    console.error(`${language}: FAIL - ${error.message}`);
  }
}

if (failed) {
  process.exit(1);
}
