import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { explainCode, generateArchitectureDoc } from "@/lib/services/explainer";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const explainSchema = z.object({
  code: z.string().optional(),
  filePath: z.string().optional(),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
  question: z.string().optional(),
  depth: z.enum(["brief", "detailed", "comprehensive"]).optional().default("detailed"),
});

/**
 * POST /api/repos/[id]/explain
 * Explain code from a repository
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    // Parse request body
    const body = await request.json();
    const data = explainSchema.parse(body);

    // Validate that at least code or filePath is provided
    if (!data.code && !data.filePath) {
      return jsonError("VALIDATION_001", "Either code or filePath is required", 400);
    }

    // Check repository access
    const repo = await db.repository.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    });

    if (!repo) {
      return jsonError("REPO_001", "Repository not found", 404);
    }

    // Generate explanation
    const result = await explainCode({
      repositoryId: id,
      code: data.code,
      filePath: data.filePath,
      startLine: data.startLine,
      endLine: data.endLine,
      question: data.question,
      depth: data.depth,
    });

    return jsonSuccess(result);
  } catch (error) {
    console.error("Failed to explain code:", error);
    return jsonError("INTERNAL_001", "Failed to explain code", 500);
  }
}

/**
 * GET /api/repos/[id]/explain/architecture
 * Generate architecture documentation for a repository
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    // Check repository access
    const repo = await db.repository.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    });

    if (!repo) {
      return jsonError("REPO_001", "Repository not found", 404);
    }

    if (action === "architecture") {
      // Generate architecture documentation
      const doc = await generateArchitectureDoc(id);
      return jsonSuccess({ documentation: doc });
    }

    // Default: return indexed files for code exploration
    const files = await db.indexedFile.findMany({
      where: { repositoryId: id },
      select: {
        filePath: true,
        language: true,
        chunkCount: true,
      },
      orderBy: { filePath: "asc" },
    });

    return jsonSuccess({
      files,
      totalFiles: files.length,
    });
  } catch (error) {
    console.error("Failed to get code info:", error);
    return jsonError("INTERNAL_001", "Failed to get code info", 500);
  }
}
