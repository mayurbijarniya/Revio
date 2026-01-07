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
  deleteChunksByFile,
} from "./qdrant";
import { GitHubService } from "./github";

interface IndexingResult {
  fileCount: number;
  chunkCount: number;
  isIncremental: boolean;
  stats: {
    added: number;
    modified: number;
    deleted: number;
    unchanged: number;
  };
}

/**
 * Index a repository using GitHub API (serverless-compatible)
 * Supports incremental indexing by comparing file hashes
 */
export async function indexRepository(
  repositoryId: string,
  _userId: string,
  fullName: string,
  defaultBranch: string,
  accessToken: string,
  forceFullIndex: boolean = false
): Promise<IndexingResult> {
  const parts = fullName.split("/");
  const owner = parts[0];
  const repo = parts[1];

  if (!owner || !repo) {
    throw new Error("Invalid repository fullName format");
  }

  try {
    // Update status to indexing
    await db.repository.update({
      where: { id: repositoryId },
      data: { indexStatus: "indexing", indexProgress: 0, indexError: null },
    });

    // Initialize GitHub service
    const github = new GitHubService(accessToken);

    // Fetch repository file tree
    await updateProgress(repositoryId, 5);
    const tree = await github.getRepositoryTree(owner, repo, defaultBranch);

    // Filter files based on language and skip patterns
    await updateProgress(repositoryId, 10);
    const filesToIndex = tree.filter((file) => {
      if (file.size > INDEXING_CONFIG.maxFileSize) return false;
      const language = getLanguageFromPath(file.path);
      if (!language) return false;
      if (shouldSkipFile(file.path)) return false;
      return true;
    });

    // Get existing indexed files for incremental comparison
    const existingFiles = await db.indexedFile.findMany({
      where: { repositoryId },
      select: { filePath: true, fileHash: true },
    });

    const existingFileMap = new Map(
      existingFiles.map((f) => [f.filePath, f.fileHash])
    );

    // Determine if we can do incremental indexing
    const hasExistingIndex = existingFiles.length > 0;
    const doIncremental = hasExistingIndex && !forceFullIndex;

    if (!doIncremental) {
      // Full index: delete existing collection and start fresh
      await updateProgress(repositoryId, 15);
      await deleteCollection(repositoryId);
      await createCollection(repositoryId);
    } else {
      // Incremental: ensure collection exists
      await updateProgress(repositoryId, 15);
      await createCollection(repositoryId);
    }

    // Fetch file contents from GitHub API
    await updateProgress(repositoryId, 20);
    const filesWithContent = await github.getFilesContent(
      owner,
      repo,
      filesToIndex.map((f) => ({ path: f.path, sha: f.sha })),
      10
    );

    // Calculate hashes and determine what changed
    const currentFileInfos: FileInfo[] = [];
    const stats = { added: 0, modified: 0, deleted: 0, unchanged: 0 };
    const filesToProcess: FileInfo[] = [];
    const currentFilePaths = new Set<string>();

    for (const file of filesWithContent) {
      if (!file.content.trim()) continue;

      const language = getLanguageFromPath(file.path);
      if (!language) continue;

      const hash = calculateFileHash(file.content);
      const fileInfo: FileInfo = {
        path: file.path,
        content: file.content,
        language,
        hash,
      };

      currentFileInfos.push(fileInfo);
      currentFilePaths.add(file.path);

      if (doIncremental) {
        const existingHash = existingFileMap.get(file.path);
        if (!existingHash) {
          // New file
          stats.added++;
          filesToProcess.push(fileInfo);
        } else if (existingHash !== hash) {
          // Modified file - need to delete old chunks first
          stats.modified++;
          await deleteChunksByFile(repositoryId, file.path);
          filesToProcess.push(fileInfo);
        } else {
          // Unchanged
          stats.unchanged++;
        }
      } else {
        // Full index - process all files
        filesToProcess.push(fileInfo);
      }
    }

    // Handle deleted files (only in incremental mode)
    if (doIncremental) {
      for (const existingPath of existingFileMap.keys()) {
        if (!currentFilePaths.has(existingPath)) {
          stats.deleted++;
          await deleteChunksByFile(repositoryId, existingPath);
        }
      }
    }

    // Process files in parallel batches
    await updateProgress(repositoryId, 25);
    let totalChunks = 0;
    const batchSize = 10; // Files per batch
    const concurrentBatches = 3; // Number of batches to process in parallel
    const totalFiles = filesToProcess.length;

    if (totalFiles > 0) {
      // Create all batches
      const batches: FileInfo[][] = [];
      for (let i = 0; i < filesToProcess.length; i += batchSize) {
        batches.push(filesToProcess.slice(i, i + batchSize));
      }

      // Process batches in parallel groups
      let processedFiles = 0;
      for (let i = 0; i < batches.length; i += concurrentBatches) {
        const currentBatches = batches.slice(i, i + concurrentBatches);

        // Process multiple batches concurrently
        const results = await Promise.all(
          currentBatches.map((batch) => processFileBatch(repositoryId, batch))
        );

        // Sum up chunks from all batches
        totalChunks += results.reduce((sum, count) => sum + count, 0);

        // Update progress (25% to 90%)
        processedFiles += currentBatches.reduce((sum, batch) => sum + batch.length, 0);
        const progress = 25 + Math.floor((processedFiles / totalFiles) * 65);
        await updateProgress(repositoryId, progress);
      }
    } else {
      // No files to process in incremental mode
      await updateProgress(repositoryId, 90);
    }

    // Save indexed files to database
    await updateProgress(repositoryId, 95);
    await saveIndexedFiles(repositoryId, currentFileInfos);

    // Get total chunk count from existing + new
    const existingChunkCount = doIncremental
      ? await getExistingChunkCount(repositoryId, stats)
      : 0;

    // Update final status
    await db.repository.update({
      where: { id: repositoryId },
      data: {
        indexStatus: "indexed",
        indexProgress: 100,
        indexedAt: new Date(),
        fileCount: currentFileInfos.length,
        chunkCount: existingChunkCount + totalChunks,
      },
    });

    return {
      fileCount: currentFileInfos.length,
      chunkCount: existingChunkCount + totalChunks,
      isIncremental: doIncremental,
      stats,
    };
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
  }
}

/**
 * Estimate existing chunk count after deletions
 */
async function getExistingChunkCount(
  repositoryId: string,
  stats: { modified: number; deleted: number }
): Promise<number> {
  const repo = await db.repository.findUnique({
    where: { id: repositoryId },
    select: { chunkCount: true },
  });

  // Rough estimate: subtract chunks from modified/deleted files
  // Assume average of 10 chunks per file
  const removedChunks = (stats.modified + stats.deleted) * 10;
  return Math.max(0, (repo?.chunkCount ?? 0) - removedChunks);
}

async function updateProgress(repositoryId: string, progress: number) {
  await db.repository.update({
    where: { id: repositoryId },
    data: { indexProgress: progress },
  });
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
      chunkCount: 0,
    })),
  });
}
