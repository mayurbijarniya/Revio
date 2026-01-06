import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { z } from "zod";

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens"),
});

/**
 * GET /api/orgs
 * List all organizations the user is a member of
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  try {
    const organizations = await db.organization.findMany({
      where: {
        OR: [
          { ownerId: session.userId },
          { members: { some: { userId: session.userId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            githubUsername: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            members: true,
            repositories: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonSuccess({ organizations }, 200);
  } catch (error) {
    console.error("Failed to list organizations:", error);
    return jsonError("INTERNAL_001", "Failed to list organizations", 500);
  }
}

/**
 * POST /api/orgs
 * Create a new organization
 */
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  try {
    const body = await request.json();
    const parsed = CreateOrgSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_001", "Invalid request parameters", 400, {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, slug } = parsed.data;

    // Check if slug is already taken
    const existing = await db.organization.findUnique({
      where: { slug },
    });

    if (existing) {
      return jsonError("ORG_001", "Organization slug already exists", 409);
    }

    // Create organization with user as owner
    const org = await db.organization.create({
      data: {
        name,
        slug,
        ownerId: session.userId,
        plan: "team",
        members: {
          create: {
            userId: session.userId,
            role: "owner",
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            githubUsername: true,
          },
        },
      },
    });

    return jsonSuccess({ organization: org }, 201);
  } catch (error) {
    console.error("Failed to create organization:", error);
    return jsonError("INTERNAL_001", "Failed to create organization", 500);
  }
}
