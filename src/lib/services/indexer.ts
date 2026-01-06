import simpleGit from "simple-git";
import { glob } from "glob";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { db } from "@/lib/db";
import { INDEXING_CONFIG } from "@/lib/constants";
import {
  getLanguageFromPath,
  shouldSkipFile,
  calculateFileHash,
  chunkCode,
  type FileInfo,
} from "./chunker";
import { embedCodeChunks, type CodeChunk } from "./embeddings";
import {
  createCollection,
  upsertChunks,
  deleteCollection,
} from "./qdrant";

/**
 * Index a repository
 */
export async function indexRepository(
  repositoryId: string,
  _userId: string,
  fullName: string,
  defaultBranch: string,
  accessToken: string
): Promise<{ fileCount: number; chunkCount: number }> {
  const parts = fullName.split("/");
  const owner = parts[0];
  const repo = parts[1];

  if (!owner || !repo) {
    throw new Error("Invalid repository fullName format");
  }

  const tempDir = path.join(os.tmpdir(), `revio-${repositoryId}`);

  try {
    // Update status to indexing
    await db.repository.update({
      where: { id: repositoryId },
      data: { indexStatus: "indexing", indexProgress: 0, indexError: null },
    });

    // Clone repository
    await updateProgress(repositoryId, 5);
    await cloneRepository(owner, repo, defaultBranch, accessToken, tempDir);

    // Discover files
    await updateProgress(repositoryId, 15);
    const files = await discoverFiles(tempDir);

    // Filter and read files
    await updateProgress(repositoryId, 20);
    const fileInfos = await readFiles(tempDir, files);

    // Create Qdrant collection
    await updateProgress(repositoryId, 25);
    await deleteCollection(repositoryId); // Clean up any existing
    await createCollection(repositoryId);

    // Process files in batches
    let totalChunks = 0;
    const batchSize = 10;
    const totalFiles = fileInfos.length;

    for (let i = 0; i < fileInfos.length; i += batchSize) {
      const batch = fileInfos.slice(i, i + batchSize);
      const chunks = await processFileBatch(repositoryId, batch);
      totalChunks += chunks;

      // Update progress (25% to 90%)
      const progress = 25 + Math.floor(((i + batch.length) / totalFiles) * 65);
      await updateProgress(repositoryId, progress);
    }

    // Save indexed files to database
    await updateProgress(repositoryId, 95);
    await saveIndexedFiles(repositoryId, fileInfos);

    // Update final status
    await db.repository.update({
      where: { id: repositoryId },
      data: {
        indexStatus: "indexed",
        indexProgress: 100,
        indexedAt: new Date(),
        fileCount: fileInfos.length,
        chunkCount: totalChunks,
      },
    });

    return { fileCount: fileInfos.length, chunkCount: totalChunks };
  } catch (error) {
    console.error("Indexing failed:", error);

    await db.repository.update({
      where: { id: repositoryId },
      data: {
        indexStatus: "failed",
        indexError: error instanceof Error ? error.message : "Unknown error",
      },
    });

    throw error;
  } finally {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function updateProgress(repositoryId: string, progress: number) {
  await db.repository.update({
    where: { id: repositoryId },
    data: { indexProgress: progress },
  });
}

async function cloneRepository(
  owner: string,
  repo: string,
  branch: string,
  accessToken: string,
  destPath: string
): Promise<void> {
  // Ensure temp dir exists
  await fs.mkdir(destPath, { recursive: true });

  const git = simpleGit();
  const cloneUrl = `https://x-access-token:${accessToken}@github.com/${owner}/${repo}.git`;

  await git.clone(cloneUrl, destPath, [
    "--depth",
    "1",
    "--branch",
    branch,
    "--single-branch",
  ]);
}

async function discoverFiles(repoPath: string): Promise<string[]> {
  const pattern = "**/*";
  const files = await glob(pattern, {
    cwd: repoPath,
    nodir: true,
    dot: false,
    ignore: [...INDEXING_CONFIG.skipPatterns],
  });

  return files.filter((file) => {
    const language = getLanguageFromPath(file);
    return language !== null && !shouldSkipFile(file);
  });
}

async function readFiles(
  repoPath: string,
  files: string[]
): Promise<FileInfo[]> {
  const fileInfos: FileInfo[] = [];

  for (const file of files) {
    const filePath = path.join(repoPath, file);
    const stats = await fs.stat(filePath);

    // Skip large files
    if (stats.size > INDEXING_CONFIG.maxFileSize) {
      continue;
    }

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const language = getLanguageFromPath(file);

      if (language && content.trim().length > 0) {
        fileInfos.push({
          path: file,
          content,
          language,
          hash: calculateFileHash(content),
        });
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return fileInfos;
}

async function processFileBatch(
  repositoryId: string,
  files: FileInfo[]
): Promise<number> {
  const allChunks: CodeChunk[] = [];

  for (const file of files) {
    const chunks = chunkCode(
      repositoryId,
      file.path,
      file.content,
      file.language
    );
    allChunks.push(...chunks);
  }

  if (allChunks.length === 0) {
    return 0;
  }

  // Generate embeddings
  const embeddedChunks = await embedCodeChunks(allChunks);

  // Store in Qdrant
  await upsertChunks(repositoryId, embeddedChunks);

  return embeddedChunks.length;
}

async function saveIndexedFiles(
  repositoryId: string,
  files: FileInfo[]
): Promise<void> {
  // Delete existing indexed files
  await db.indexedFile.deleteMany({
    where: { repositoryId },
  });

  // Insert new records
  await db.indexedFile.createMany({
    data: files.map((file) => ({
      repositoryId,
      filePath: file.path,
      fileHash: file.hash,
      language: file.language,
      chunkCount: 0, // Updated separately if needed
    })),
  });
}
