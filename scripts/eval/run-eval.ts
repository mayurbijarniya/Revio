/**
 * Offline evaluation of Revio's PR review on real benchmark bugs.
 *
 * Each benchmark fix is reversed into a "bug-introducing PR" (base = fixed version, head = buggy
 * version, test files removed). Revio reviews it in two modes using the same shared pipeline as
 * production (src/lib/services/review-core.ts):
 *   - diff: the diff only (no code graph, no security scan, no semantic context)
 *   - full: + PR-aware code graph + security scan (+ local semantic context with --semantic)
 * A bug counts as caught when a reported issue is within --tolerance lines of the fixed lines.
 *
 * Usage:
 *   GOOGLE_AI_API_KEY=... GITHUB_TOKEN=... npx tsx scripts/eval/run-eval.ts \
 *     [--datasets bugsinpy,bugsjs,defects4j] [--per-dataset 20] [--modes diff,full] \
 *     [--semantic] [--tolerance 3] [--manifest eval-results/<run>/bugs.json]
 *
 * GITHUB_TOKEN can be any read-only token (unauthenticated GitHub allows 60 requests/hour).
 * --semantic also needs OPENAI_API_KEY. Results go to eval-results/<timestamp>/.
 * Repository snapshots are downloaded to .eval-work/ and deleted after each bug.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { runReviewCore } from "@/lib/services/review-core";
import { buildCodeGraph, type CodeGraphData } from "@/lib/services/code-graph";
import { buildPrGraphScope } from "@/lib/services/pr-graph";
import { getLanguageFromPath, shouldSkipFile } from "@/lib/services/chunker";
import { DEFAULT_REVIEW_SETTINGS } from "@/types/review";
import { AI_CONFIG } from "@/lib/constants";
import {
  buildAnswerKey,
  formatSummaryMarkdown,
  getPrStats,
  reverseUnifiedDiff,
  scoreReview,
  stripTestFiles,
  summarizeEval,
  type AnswerKeyEntry,
  type EvalRecord,
} from "@/lib/eval/bug-pr";
import {
  downloadSnapshot,
  getCompareDiff,
  getRawFile,
  listFiles,
  loadCandidates,
  readSmallFile,
  type BenchmarkBug,
  type DatasetName,
} from "./sources";
import { buildLocalSemanticContext } from "./local-context";

type Mode = "diff" | "full";

interface Options {
  datasets: DatasetName[];
  perDataset: number;
  modes: Mode[];
  semantic: boolean;
  tolerance: number;
  manifest?: string;
  /** Select bugs and check snapshots/graphs without calling the model */
  dryRun: boolean;
}

interface SelectedBug extends BenchmarkBug {
  prDiff: string;
  answerKey: AnswerKeyEntry[];
  files: number;
  changedLines: number;
}

/** Single-bug PRs only: large fixes are refactors where "the bug's lines" is not well defined */
const MAX_PR_FILES = 5;
const MAX_PR_CHANGED_LINES = 200;

const PROJECT_ROOT = process.cwd();
const WORK_DIR = path.join(PROJECT_ROOT, ".eval-work");

function parseArgs(argv: string[]): Options {
  const get = (name: string) => {
    const index = argv.indexOf(`--${name}`);
    return index === -1 ? undefined : argv[index + 1];
  };
  const datasets = (get("datasets") ?? "bugsinpy,bugsjs,defects4j").split(",") as DatasetName[];
  const modes = (get("modes") ?? "diff,full").split(",") as Mode[];
  for (const d of datasets) {
    if (!["bugsinpy", "bugsjs", "defects4j"].includes(d)) throw new Error(`Unknown dataset: ${d}`);
  }
  for (const m of modes) {
    if (!["diff", "full"].includes(m)) throw new Error(`Unknown mode: ${m}`);
  }
  return {
    datasets,
    modes,
    perDataset: Number(get("per-dataset") ?? 20),
    semantic: argv.includes("--semantic"),
    tolerance: Number(get("tolerance") ?? 3),
    manifest: get("manifest"),
    dryRun: argv.includes("--dry-run"),
  };
}

/**
 * Turn a benchmark bug into a reviewable PR, or explain why it is skipped
 */
async function prepareBug(bug: BenchmarkBug): Promise<SelectedBug | string> {
  const fixDiff = await getCompareDiff(bug.repo, bug.buggyRef, bug.fixedRef);
  if (!fixDiff) return "fix diff unavailable";

  const prDiff = stripTestFiles(reverseUnifiedDiff(fixDiff));
  const stats = getPrStats(prDiff);
  if (stats.files === 0) return "only test files changed";
  if (stats.files > MAX_PR_FILES || stats.changedLines > MAX_PR_CHANGED_LINES) {
    return `too large (${stats.files} files, ${stats.changedLines} lines)`;
  }

  const answerKey = buildAnswerKey(prDiff);
  if (answerKey.length === 0) return "no bug lines in source files";
  if (!answerKey.some((entry) => getLanguageFromPath(entry.file))) return "no supported source language";

  return { ...bug, prDiff, answerKey, files: stats.files, changedLines: stats.changedLines };
}

async function selectBugs(dataset: DatasetName, count: number): Promise<SelectedBug[]> {
  console.log(`\n[${dataset}] loading candidates...`);
  const candidates = await loadCandidates(dataset);
  const selected: SelectedBug[] = [];
  for (const bug of candidates) {
    if (selected.length >= count) break;
    const prepared = await prepareBug(bug).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      // Rate limits stop the run; anything else only skips this bug
      if (message.includes("rate limit")) throw error;
      return `request failed (${message})`;
    });
    if (typeof prepared === "string") {
      console.log(`  skip ${bug.id}: ${prepared}`);
    } else {
      console.log(`  use  ${bug.id} (${prepared.files} files, ${prepared.changedLines} lines)`);
      selected.push(prepared);
    }
  }
  if (selected.length < count) {
    console.log(`  only ${selected.length}/${count} usable bugs found for ${dataset}`);
  }
  return selected;
}

/**
 * Base-branch (fixed version) code graph and file contents, from a temporary snapshot
 */
async function loadBaseRepository(bug: SelectedBug): Promise<{ graph: CodeGraphData; content: Map<string, string> }> {
  const snapshotDir = path.join(WORK_DIR, `${bug.dataset}-${bug.id}`.replace(/[^\w.-]/g, "_"));
  try {
    await downloadSnapshot(bug.repo, bug.fixedRef, snapshotDir);
    const content = new Map<string, string>();
    const files: Array<{ path: string; content: string; language: string }> = [];
    for (const filePath of await listFiles(snapshotDir)) {
      const language = getLanguageFromPath(filePath);
      if (!language || shouldSkipFile(filePath)) continue;
      const text = await readSmallFile(snapshotDir, filePath);
      if (text === null) continue;
      content.set(filePath, text);
      files.push({ path: filePath, content: text, language });
    }
    const graph = await buildCodeGraph(`eval-${bug.id}`, files);
    return { graph, content };
  } finally {
    await rm(snapshotDir, { recursive: true, force: true });
  }
}

function prTitle(bug: SelectedBug): string {
  // Neutral title: never hint that the PR contains a bug
  const names = bug.answerKey.map((entry) => entry.file.split("/").pop()).join(", ");
  return `Update ${names}`;
}

async function reviewBug(bug: SelectedBug, mode: Mode, options: Options, base: Awaited<ReturnType<typeof loadBaseRepository>> | null) {
  const core = await runReviewCore(
    { title: prTitle(bug), body: null, diff: bug.prDiff, ignoredPaths: [], settings: DEFAULT_REVIEW_SETTINGS },
    mode === "diff" || !base
      ? {}
      : {
          loadGraphScope: (files) =>
            buildPrGraphScope({
              baseGraph: base.graph,
              files,
              loadHeadFile: (filePath) => getRawFile(bug.repo, bug.buggyRef, filePath),
            }),
          loadSemanticContext: options.semantic
            ? (files) => buildLocalSemanticContext({ files, graph: base.graph, repoContent: base.content })
            : undefined,
        },
    { securityScan: mode === "full" }
  );
  if (!core) throw new Error("model response could not be parsed");
  return core;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!options.dryRun && !process.env.GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY is required");
  if (!options.dryRun && options.semantic && !process.env.OPENAI_API_KEY) {
    throw new Error("--semantic needs OPENAI_API_KEY");
  }
  if (!process.env.GITHUB_TOKEN) console.warn("GITHUB_TOKEN not set: GitHub allows only 60 API requests per hour");

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(PROJECT_ROOT, "eval-results", runId);
  await mkdir(outDir, { recursive: true });

  const cleanup = async () => rm(WORK_DIR, { recursive: true, force: true });
  process.on("SIGINT", () => {
    void cleanup().finally(() => process.exit(130));
  });

  try {
    let bugs: SelectedBug[];
    if (options.manifest) {
      bugs = JSON.parse(await readFile(options.manifest, "utf8")) as SelectedBug[];
      bugs = bugs.filter((b) => options.datasets.includes(b.dataset));
    } else {
      bugs = [];
      for (const dataset of options.datasets) bugs.push(...(await selectBugs(dataset, options.perDataset)));
    }
    await writeFile(path.join(outDir, "bugs.json"), JSON.stringify(bugs, null, 2));

    if (options.dryRun) {
      // Check snapshot download and graph building once per dataset
      for (const dataset of options.datasets) {
        const first = bugs.find((b) => b.dataset === dataset);
        if (!first) continue;
        const base = await loadBaseRepository(first);
        console.log(`\n[dry run] ${first.id}: graph ${base.graph.nodes.length} nodes, ${base.graph.edges.length} edges`);
      }
      console.log(`\n[dry run] ${bugs.length} bugs selected; list saved to ${path.relative(PROJECT_ROOT, outDir)}/bugs.json`);
      return;
    }

    const records: EvalRecord[] = [];
    const details: unknown[] = [];

    for (const [index, bug] of bugs.entries()) {
      console.log(`\n(${index + 1}/${bugs.length}) ${bug.dataset} ${bug.id}`);
      let base: Awaited<ReturnType<typeof loadBaseRepository>> | null = null;
      if (options.modes.includes("full")) {
        try {
          base = await loadBaseRepository(bug);
          console.log(`  graph: ${base.graph.nodes.length} nodes, ${base.graph.edges.length} edges`);
        } catch (error) {
          console.log(`  graph unavailable: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      for (const mode of options.modes) {
        try {
          const core = await reviewBug(bug, mode, options, base);
          const score = scoreReview(core.review, bug.answerKey, options.tolerance);
          records.push({ dataset: bug.dataset, bugId: bug.id, mode, score, tokensUsed: core.tokensUsed });
          details.push({
            dataset: bug.dataset,
            bugId: bug.id,
            mode,
            score,
            answerKey: bug.answerKey,
            recommendation: core.review.recommendation,
            riskLevel: core.review.riskLevel,
            issues: core.review.issues,
            graphImpact: core.blastRadius?.riskLevel ?? null,
            tokensUsed: core.tokensUsed,
          });
          console.log(
            `  ${mode.padEnd(4)} caught=${score.caught} blocking=${score.caughtBlocking} ` +
              `issues=${score.totalIssues} unmatched=${score.unmatchedIssues} verdict=${core.review.recommendation}`
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          records.push({ dataset: bug.dataset, bugId: bug.id, mode, error: message });
          console.log(`  ${mode.padEnd(4)} error: ${message}`);
        }
      }

      // Save after every bug so an interrupted run keeps its results
      await writeFile(path.join(outDir, "results.json"), JSON.stringify(details, null, 2));
    }

    const summary = summarizeEval(records);
    const markdown = [
      `# Revio evaluation (${new Date().toISOString().slice(0, 10)})`,
      "",
      `- Model: \`${AI_CONFIG.review.model}\` (complex: \`${AI_CONFIG.review.complexModel}\`)`,
      `- Datasets: ${options.datasets.join(", ")}; up to ${options.perDataset} bugs each (single-bug PRs: <= ${MAX_PR_FILES} files, <= ${MAX_PR_CHANGED_LINES} changed lines)`,
      `- Method: fix commit reversed into a bug-introducing PR, test files removed; caught = an issue within ${options.tolerance} lines of the fixed lines`,
      `- Modes: diff = diff only; full = + PR-aware code graph + security scan${options.semantic ? " + semantic context (changed files and graph neighbours)" : ""}`,
      "- Unmatched issues are false-positive candidates: spot-check them, some may be real problems the benchmark does not list",
      "",
      formatSummaryMarkdown(summary),
      "",
    ].join("\n");
    await writeFile(path.join(outDir, "summary.md"), markdown);
    await writeFile(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));

    console.log(`\n${markdown}`);
    console.log(`Results written to ${path.relative(PROJECT_ROOT, outDir)}/`);
  } finally {
    await cleanup();
  }
}

// Exit explicitly: shared app modules keep timers (caches) alive that would hold the process open
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
