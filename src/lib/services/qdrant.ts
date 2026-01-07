import { QdrantClient } from "@qdrant/js-client-rest";
import { AI_CONFIG } from "@/lib/constants";
import type { EmbeddedChunk } from "./embeddings";

const getQdrantClient = () => {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (!url || !apiKey) {
    throw new Error("Qdrant configuration missing");
  }

  return new QdrantClient({ url, apiKey });
};

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

  try {
    await client.delete(collectionName, {
      filter: {
        must: [
          {
            key: "filePath",
            match: { value: filePath },
          },
        ],
      },
    });
  } catch (error) {
    // Collection might not exist yet, which is fine
    console.warn(`Failed to delete chunks for ${filePath}:`, error);
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
