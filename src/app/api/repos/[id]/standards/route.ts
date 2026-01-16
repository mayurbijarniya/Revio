import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { StandardsDetector } from "@/lib/services/standards-detector";
import { decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/repos/[id]/standards
 * Get detected coding standards for a repository
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_ERROR", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;

    // Get repository
    const repository = await db.repository.findFirst({
      where: {
        id,
        userId: session.userId,
      },
      include: {
        codingStandards: {
          orderBy: {
            detectedAt: "desc",
          },
        },
      },
    });

    if (!repository) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Repository not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        standards: repository.codingStandards.map((s) => ({
          id: s.id,
          source: s.source,
          filePath: s.filePath,
          rulesCount: (s.parsedRules as Array<unknown>).length,
          parsedRules: s.parsedRules as Array<unknown>,
          enabled: s.enabled,
          detectedAt: s.detectedAt,
          updatedAt: s.updatedAt,
        })),
      },
    });
  } catch (error) {
    logger.error("Failed to fetch coding standards", error as Error, {
      repositoryId: (await params).id,
    });
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch standards" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/repos/[id]/standards
 * Trigger coding standards detection for a repository
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_ERROR", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;

    // Get repository and user token
    const repository = await db.repository.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    });

    if (!repository) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Repository not found" } },
        { status: 404 }
      );
    }

    // Get user's access token
    const userRecord = await db.user.findUnique({
      where: { id: session.userId },
      select: { accessToken: true },
    });

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const accessToken = decrypt(userRecord.accessToken);
    const parts = repository.fullName.split("/");
    const owner = parts[0];
    const repo = parts[1];

    if (!owner || !repo) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REPO", message: "Invalid repository name" } },
        { status: 400 }
      );
    }

    // Detect standards
    logger.info("Starting coding standards detection", {
      repositoryId: id,
      owner,
      repo,
    });

    const detector = new StandardsDetector(accessToken);
    const standards = await detector.detectStandards(owner, repo, id);

    // Save to database
    await detector.saveStandards(id, standards);

    logger.info("Coding standards detection completed", {
      repositoryId: id,
      standardsFound: standards.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        standardsDetected: standards.length,
        standards: standards.map((s) => ({
          source: s.source,
          filePath: s.filePath,
          rulesCount: s.parsedRules.length,
        })),
      },
    });
  } catch (error) {
    logger.error("Failed to detect coding standards", error as Error, {
      repositoryId: (await params).id,
    });
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to detect standards" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/repos/[id]/standards
 * Enable/disable a coding standard
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_ERROR", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { standardId, enabled } = body;

    if (!standardId || typeof enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Invalid input" } },
        { status: 400 }
      );
    }

    // Verify repository ownership
    const repository = await db.repository.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    });

    if (!repository) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Repository not found" } },
        { status: 404 }
      );
    }

    // Update standard scoped to repository ownership
    const updateResult = await db.codingStandards.updateMany({
      where: {
        id: standardId,
        repositoryId: id,
      },
      data: {
        enabled,
      },
    });

    if (updateResult.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Standard not found" } },
        { status: 404 }
      );
    }

    logger.info(`Coding standard ${enabled ? "enabled" : "disabled"}`, {
      repositoryId: id,
      standardId,
    });

    return NextResponse.json({
      success: true,
      data: { enabled },
    });
  } catch (error) {
    logger.error("Failed to update coding standard", error as Error, {
      repositoryId: (await params).id,
    });
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update standard" } },
      { status: 500 }
    );
  }
}
