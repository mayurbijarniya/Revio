import { QdrantClient } from "@qdrant/js-client-rest";
import { AI_CONFIG } from "@/lib/constants";
import type { EmbeddedChunk } from "./embeddings";
import { requireEnv } from "@/lib/env";

const getQdrantClient = () => {
  const url = requireEnv("QDRANT_URL");
  const apiKey = requireEnv("QDRANT_API_KEY");
  return new QdrantClient({ url, apiKey });
};

type QdrantPointId = string | number;

function getQdrantErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown Qdrant error";
  }
}

async function ensureFilePathPayloadIndex(
  client: QdrantClient,
  collectionName: string
): Promise<void> {
  try {
    await client.createPayloadIndex(collectionName, {
      wait: true,
      field_name: "filePath",
      field_schema: "keyword",
    });
  } catch (error) {
    const message = getQdrantErrorMessage(error).toLowerCase();
    if (message.includes("already") && message.includes("index")) {
      return;
    }
    console.warn(
      `Failed to ensure filePath payload index for ${collectionName}: ${getQdrantErrorMessage(
        error
      )}`
    );
  }
}

/**
 * Collection name for a repository
 */
export function getCollectionName(repositoryId: string): string {
  return `repo_${repositoryId.replace(/-/g, "_")}`;
}

/**
 * Create a collection for a repository
 */
export async function createCollection(repositoryId: string): Promise<void> {
  const client = getQdrantClient();
  const collectionName = getCollectionName(repositoryId);

  // Check if collection exists
  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === collectionName);

  if (!exists) {
    await client.createCollection(collectionName, {
      vectors: {
        size: AI_CONFIG.embedding.dimensions,
        distance: "Cosine",
      },
      optimizers_config: {
        indexing_threshold: 0,
      },
    });
  }

  await ensureFilePathPayloadIndex(client, collectionName);
}

/**
 * Delete a collection for a repository
 */
export async function deleteCollection(repositoryId: string): Promise<void> {
  const client = getQdrantClient();
  const collectionName = getCollectionName(repositoryId);

  try {
    await client.deleteCollection(collectionName);
  } catch {
    // Collection might not exist
  }
}

/**
 * Upsert embedded chunks to Qdrant
 */
export async function upsertChunks(
  repositoryId: string,
  chunks: EmbeddedChunk[]
): Promise<void> {
  if (chunks.length === 0) return;

  const client = getQdrantClient();
  const collectionName = getCollectionName(repositoryId);

  // Batch upsert (Qdrant recommends batches of 100-1000)
  const batchSize = 100;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    await client.upsert(collectionName, {
      wait: true,
      points: batch.map((chunk) => ({
        id: chunk.id,
        vector: chunk.embedding,
        payload: {
          filePath: chunk.filePath,
          content: chunk.content,
          language: chunk.language,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          type: chunk.type,
          name: chunk.name ?? null,
          metadata: chunk.metadata ?? {},
        },
      })),
    });
  }
}

/**
 * Search result from Qdrant
 */
export interface SearchResult {
  id: string;
  score: number;
  filePath: string;
  content: string;
  language: string;
  startLine: number;
  endLine: number;
  type: string;
  name: string | null;
}

/**
 * Search for similar chunks
 */
export async function searchChunks(
  repositoryId: string,
  queryEmbedding: number[],
  limit: number = 10,
  scoreThreshold: number = 0.5
): Promise<SearchResult[]> {
  const client = getQdrantClient();
  const collectionName = getCollectionName(repositoryId);

  const results = await client.search(collectionName, {
    vector: queryEmbedding,
    limit,
    score_threshold: scoreThreshold,
    with_payload: true,
  });

  return results.map((r) => ({
    id: r.id as string,
    score: r.score,
    filePath: r.payload?.filePath as string,
    content: r.payload?.content as string,
    language: r.payload?.language as string,
    startLine: r.payload?.startLine as number,
    endLine: r.payload?.endLine as number,
    type: r.payload?.type as string,
    name: r.payload?.name as string | null,
  }));
}

/**
 * Delete chunks by file path
 */
export async function deleteChunksByFile(
  repositoryId: string,
  filePath: string
): Promise<void> {
  const client = getQdrantClient();
  const collectionName = getCollectionName(repositoryId);
  const filter = {
    must: [
      {
        key: "filePath",
        match: { value: filePath },
      },
    ],
  };

  try {
    await ensureFilePathPayloadIndex(client, collectionName);
    await client.delete(collectionName, {
      wait: true,
      filter,
    });
    return;
  } catch (filterDeleteError) {
    console.warn(
      `Filter delete failed for ${filePath}, falling back to id delete: ${getQdrantErrorMessage(
        filterDeleteError
      )}`
    );
  }

  try {
    const pointIds: QdrantPointId[] = [];
    let offset: QdrantPointId | undefined;

    while (true) {
      const page = await client.scroll(collectionName, {
        filter,
        limit: 256,
        offset,
        with_payload: false,
        with_vector: false,
      });

      for (const point of page.points ?? []) {
        if (typeof point.id === "string" || typeof point.id === "number") {
          pointIds.push(point.id);
        }
      }

      const nextOffset = page.next_page_offset;
      if (typeof nextOffset === "string" || typeof nextOffset === "number") {
        offset = nextOffset;
        continue;
      }
      break;
    }

    if (pointIds.length === 0) {
      return;
    }

    const batchSize = 256;
    for (let i = 0; i < pointIds.length; i += batchSize) {
      const batch = pointIds.slice(i, i + batchSize);
      await client.delete(collectionName, {
        wait: true,
        points: batch,
      });
    }
  } catch (fallbackError) {
    console.warn(
      `Fallback delete failed for ${filePath}: ${getQdrantErrorMessage(
        fallbackError
      )}`
    );
  }
}

/**
 * Get collection info
 */
export async function getCollectionInfo(
  repositoryId: string
): Promise<{ vectorCount: number } | null> {
  const client = getQdrantClient();
  const collectionName = getCollectionName(repositoryId);

  try {
    const info = await client.getCollection(collectionName);
    return {
      vectorCount: info.points_count ?? 0,
    };
  } catch {
    return null;
  }
}
