/**
 * Benchmark sources for the offline evaluation. Bug lists are read from each benchmark's own
 * GitHub repository at run time; nothing is hard-coded except which projects to sample.
 *
 * - BugsInPy:  soarsmu/BugsInPy  projects/<p>/project.info + bugs/<n>/bug.info
 * - Defects4J: rjust/defects4j   framework/projects/<P>/active-bugs.csv (commits mirrored on GitHub)
 * - BugsJS:    BugsJS/<project>  tags Bug-<n>-original (buggy) and Bug-<n>-fix (source fix only)
 */
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DatasetName = "bugsinpy" | "bugsjs" | "defects4j";

export interface BenchmarkBug {
  dataset: DatasetName;
  id: string;
  /** GitHub "owner/name" */
  repo: string;
  /** Commit or tag with the bug */
  buggyRef: string;
  /** Commit or tag with the fix */
  fixedRef: string;
}

const BUGSINPY_PROJECTS = ["black", "cookiecutter", "httpie", "thefuck", "tqdm", "sanic", "fastapi", "tornado", "luigi", "youtube-dl"];
const BUGSJS_PROJECTS = ["express", "bower", "hexo", "karma", "node-redis", "shields", "hessian.js", "pencilblue", "mongoose", "eslint"];
/** Defects4J project -> GitHub mirror holding the same commit ids */
const DEFECTS4J_PROJECTS: Record<string, string> = {
  Lang: "apache/commons-lang",
  Cli: "apache/commons-cli",
  Csv: "apache/commons-csv",
  Codec: "apache/commons-codec",
  Jsoup: "jhy/jsoup",
  Gson: "google/gson",
  JacksonCore: "FasterXML/jackson-core",
};

const MAX_BUGS_PER_PROJECT = 12;

// ---------------------------------------------------------------- GitHub access

function githubHeaders(accept: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: accept, "User-Agent": "revio-eval" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

const REQUEST_TIMEOUT_MS = 30_000;
const SNAPSHOT_TIMEOUT_MS = 180_000;

async function fetchText(url: string, accept = "text/plain"): Promise<string | null> {
  const res = await fetch(url, { headers: githubHeaders(accept), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (res.status === 403 || res.status === 429) {
    throw new Error(`GitHub rate limit or access denied for ${url} (set GITHUB_TOKEN)`);
  }
  if (!res.ok) return null;
  return res.text();
}

/** Unified diff from base to head (head must descend from base) */
export async function getCompareDiff(repo: string, base: string, head: string): Promise<string | null> {
  return fetchText(
    `https://api.github.com/repos/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
    "application/vnd.github.v3.diff"
  );
}

export async function getRawFile(repo: string, ref: string, filePath: string): Promise<string | null> {
  return fetchText(`https://raw.githubusercontent.com/${repo}/${encodeURIComponent(ref)}/${filePath}`);
}

/**
 * Download and extract a repository snapshot into targetDir (the caller deletes it afterwards)
 */
export async function downloadSnapshot(repo: string, ref: string, targetDir: string): Promise<void> {
  const res = await fetch(`https://codeload.github.com/${repo}/tar.gz/${encodeURIComponent(ref)}`, {
    headers: githubHeaders("application/octet-stream"),
    signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Snapshot download failed for ${repo}@${ref}: ${res.status}`);

  await mkdir(targetDir, { recursive: true });
  const archive = `${targetDir}.tar.gz`;
  try {
    await writeFile(archive, Buffer.from(await res.arrayBuffer()));
    await execFileAsync("tar", ["-xzf", archive, "-C", targetDir, "--strip-components=1"]);
  } finally {
    await rm(archive, { force: true });
  }
}

const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", "vendor", "dist", "build", "target", "__pycache__", ".venv", "venv"]);

/**
 * Source files of a snapshot, as repository-relative paths
 */
export async function listFiles(root: string, maxFiles = 6000): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    if (files.length >= maxFiles) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (files.length >= maxFiles) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) await walk(full);
      } else if (entry.isFile()) {
        files.push(path.relative(root, full).split(path.sep).join("/"));
      }
    }
  }
  await walk(root);
  return files;
}

export async function readSmallFile(root: string, relativePath: string, maxBytes = 300_000): Promise<string | null> {
  const full = path.join(root, relativePath);
  const info = await stat(full);
  if (info.size > maxBytes) return null;
  return readFile(full, "utf8");
}

// ---------------------------------------------------------------- bug lists

function parseInfoFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match?.[1]) result[match[1]] = match[2] ?? "";
  }
  return result;
}

async function* bugsInPyCandidates(): AsyncGenerator<BenchmarkBug[]> {
  for (const project of BUGSINPY_PROJECTS) {
    const base = "https://raw.githubusercontent.com/soarsmu/BugsInPy/master/projects";
    const projectInfo = await fetchText(`${base}/${project}/project.info`);
    const repoUrl = projectInfo ? parseInfoFile(projectInfo).github_url : undefined;
    const repo = repoUrl?.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
    if (!repo) continue;

    const numbers = Array.from({ length: MAX_BUGS_PER_PROJECT }, (_, i) => i + 1);
    const infos = await Promise.all(
      numbers.map((n) => fetchText(`${base}/${project}/bugs/${n}/bug.info`).catch(() => null))
    );

    const bugs: BenchmarkBug[] = [];
    for (const [index, bugInfo] of infos.entries()) {
      const n = index + 1;
      if (!bugInfo) break;
      const info = parseInfoFile(bugInfo);
      if (info.buggy_commit_id && info.fixed_commit_id) {
        bugs.push({ dataset: "bugsinpy", id: `${project}-${n}`, repo, buggyRef: info.buggy_commit_id, fixedRef: info.fixed_commit_id });
      }
    }
    yield bugs;
  }
}

async function* defects4jCandidates(): AsyncGenerator<BenchmarkBug[]> {
  for (const [project, repo] of Object.entries(DEFECTS4J_PROJECTS)) {
    const csv = await fetchText(
      `https://raw.githubusercontent.com/rjust/defects4j/master/framework/projects/${project}/active-bugs.csv`
    );
    if (!csv) continue;
    const bugs = csv
      .split("\n")
      .slice(1)
      .map((row) => row.split(","))
      .filter((cols) => cols[0] && cols[1] && cols[2])
      .slice(0, MAX_BUGS_PER_PROJECT)
      .map((cols) => ({
        dataset: "defects4j" as const,
        id: `${project}-${cols[0]}`,
        repo,
        buggyRef: cols[1]!.trim(),
        fixedRef: cols[2]!.trim(),
      }));
    yield bugs;
  }
}

async function* bugsJsCandidates(): AsyncGenerator<BenchmarkBug[]> {
  for (const project of BUGSJS_PROJECTS) {
    const bugs: BenchmarkBug[] = [];
    for (let n = 1; n <= MAX_BUGS_PER_PROJECT; n++) {
      bugs.push({
        dataset: "bugsjs",
        id: `${project}-${n}`,
        repo: `BugsJS/${project}`,
        buggyRef: `Bug-${n}-original`,
        fixedRef: `Bug-${n}-fix`,
      });
    }
    yield bugs;
  }
}

/**
 * Candidate bugs interleaved across projects (project A bug 1, project B bug 1, ...), so a
 * sample of N bugs covers as many projects as possible.
 */
export async function loadCandidates(dataset: DatasetName): Promise<BenchmarkBug[]> {
  const source =
    dataset === "bugsinpy" ? bugsInPyCandidates() : dataset === "defects4j" ? defects4jCandidates() : bugsJsCandidates();

  const perProject: BenchmarkBug[][] = [];
  for await (const bugs of source) perProject.push(bugs);

  const interleaved: BenchmarkBug[] = [];
  const longest = Math.max(0, ...perProject.map((b) => b.length));
  for (let i = 0; i < longest; i++) {
    for (const bugs of perProject) {
      const bug = bugs[i];
      if (bug) interleaved.push(bug);
    }
  }
  return interleaved;
}
