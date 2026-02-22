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
import { StandardsDetector } from "./standards-detector";
import { buildCodeGraph, saveCodeGraph } from "./code-graph";

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
    await db.repository.update({
      where: { id: repositoryId },
      data: {
        indexStatus: "indexing",
        indexProgress: 0,
        indexError: null,
        indexStartedAt: new Date(),
        indexHeartbeatAt: new Date(),
      },
    });

    const github = new GitHubService(accessToken);

    await updateProgress(repositoryId, 5);
    const tree = await github.getRepositoryTree(owner, repo, defaultBranch);

    await updateProgress(repositoryId, 10);
    const filesToIndex = tree.filter((file) => {
      if (file.size > INDEXING_CONFIG.maxFileSize) return false;
      const language = getLanguageFromPath(file.path);
      if (!language) return false;
      if (shouldSkipFile(file.path)) return false;
      return true;
    });

    const existingFiles = await db.indexedFile.findMany({
      where: { repositoryId },
      select: { filePath: true, fileHash: true },
    });

    const existingFileMap = new Map(
      existingFiles.map((f) => [f.filePath, f.fileHash])
    );

    const hasExistingIndex = existingFiles.length > 0;
    const doIncremental = hasExistingIndex && !forceFullIndex;

    if (!doIncremental) {
      await updateProgress(repositoryId, 15);
      await deleteCollection(repositoryId);
      await createCollection(repositoryId);
    } else {
      await updateProgress(repositoryId, 15);
      await createCollection(repositoryId);
    }

    await updateProgress(repositoryId, 20);
    const filesWithContent = await github.getFilesContent(
      owner,
      repo,
      filesToIndex.map((f) => ({ path: f.path, sha: f.sha })),
      10
    );

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
          stats.added++;
          filesToProcess.push(fileInfo);
        } else if (existingHash !== hash) {
          stats.modified++;
          await deleteChunksByFile(repositoryId, file.path);
          filesToProcess.push(fileInfo);
        } else {
          stats.unchanged++;
        }
      } else {
        filesToProcess.push(fileInfo);
      }
    }

    if (doIncremental) {
      for (const existingPath of existingFileMap.keys()) {
        if (!currentFilePaths.has(existingPath)) {
          stats.deleted++;
          await deleteChunksByFile(repositoryId, existingPath);
        }
      }
    }

    await updateProgress(repositoryId, 25);
    let totalChunks = 0;
    const batchSize = 10;
    const concurrentBatches = 3;
    const totalFiles = filesToProcess.length;

    if (totalFiles > 0) {
      const batches: FileInfo[][] = [];
      for (let i = 0; i < filesToProcess.length; i += batchSize) {
        batches.push(filesToProcess.slice(i, i + batchSize));
      }

      let processedFiles = 0;
      for (let i = 0; i < batches.length; i += concurrentBatches) {
        const currentBatches = batches.slice(i, i + concurrentBatches);

        const results = await Promise.all(
          currentBatches.map((batch) => processFileBatch(repositoryId, batch))
        );

        totalChunks += results.reduce((sum, count) => sum + count, 0);

        processedFiles += currentBatches.reduce((sum, batch) => sum + batch.length, 0);
        const progress = 25 + Math.floor((processedFiles / totalFiles) * 65);
        await updateProgress(repositoryId, progress);
      }
    } else {
      await updateProgress(repositoryId, 90);
    }

    await updateProgress(repositoryId, 95);
    await saveIndexedFiles(repositoryId, currentFileInfos);

    const existingChunkCount = doIncremental
      ? await getExistingChunkCount(repositoryId, stats)
      : 0;

    await db.repository.update({
      where: { id: repositoryId },
      data: {
        indexStatus: "indexed",
        indexProgress: 100,
        indexedAt: new Date(),
        indexQueuedAt: null,
        indexStartedAt: null,
        indexHeartbeatAt: null,
        indexJobId: null,
        fileCount: currentFileInfos.length,
        chunkCount: existingChunkCount + totalChunks,
      },
    });

    try {
      console.warn(`[Indexer] Auto-detecting coding standards for ${fullName}`);
      const detector = new StandardsDetector(accessToken);
      const standards = await detector.detectStandards(
        owner,
        repo,
        repositoryId,
        defaultBranch
      );
      if (standards.length > 0) {
        await detector.saveStandards(repositoryId, standards);
        console.warn(
          `[Indexer] Detected ${standards.length} coding standards files for ${fullName}`
        );
      }
    } catch (standardsError) {
      console.error("[Indexer] Failed to detect coding standards:", standardsError);
    }

    try {
      console.warn(`[Indexer] Building code graph for ${fullName}`);
      const filesForGraph = currentFileInfos.map((f) => ({
        path: f.path,
        content: f.content,
        language: f.language,
      }));

      const graphData = await buildCodeGraph(repositoryId, filesForGraph);
      await saveCodeGraph(repositoryId, graphData);

      console.warn(
        `[Indexer] Code graph built: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`
      );
    } catch (graphError) {
      console.error("[Indexer] Failed to build code graph:", graphError);
    }

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
        indexQueuedAt: null,
        indexStartedAt: null,
        indexHeartbeatAt: null,
        indexJobId: null,
      },
    });

    throw error;
  }
}

async function getExistingChunkCount(
  repositoryId: string,
  stats: { modified: number; deleted: number }
): Promise<number> {
  const repo = await db.repository.findUnique({
    where: { id: repositoryId },
    select: { chunkCount: true },
  });

  const removedChunks = (stats.modified + stats.deleted) * 10;
  return Math.max(0, (repo?.chunkCount ?? 0) - removedChunks);
}

async function updateProgress(repositoryId: string, progress: number) {
  await db.repository.update({
    where: { id: repositoryId },
    data: {
      indexProgress: progress,
      indexHeartbeatAt: new Date(),
    },
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

  const embeddedChunks = await embedCodeChunks(allChunks);

  await upsertChunks(repositoryId, embeddedChunks);

  return embeddedChunks.length;
}

async function saveIndexedFiles(
  repositoryId: string,
  files: FileInfo[]
): Promise<void> {
  await db.indexedFile.deleteMany({
    where: { repositoryId },
  });

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
