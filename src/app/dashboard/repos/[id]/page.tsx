import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { RepoDetail } from "./repo-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RepoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Get the repository with related data
  const repository = await db.repository.findFirst({
    where: {
      id,
      userId: session.userId,
    },
    include: {
      indexedFiles: {
        select: {
          id: true,
          filePath: true,
          language: true,
          indexedAt: true,
        },
        orderBy: { filePath: "asc" },
        take: 50,
      },
      prReviews: {
        select: {
          id: true,
          prNumber: true,
          prTitle: true,
          prAuthor: true,
          prUrl: true,
          status: true,
          summary: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      codingStandards: {
        select: {
          id: true,
          source: true,
          filePath: true,
          parsedRules: true,
          enabled: true,
          detectedAt: true,
          updatedAt: true,
        },
        orderBy: { detectedAt: "desc" },
      },
      _count: {
        select: {
          indexedFiles: true,
          prReviews: true,
          conversations: true,
        },
      },
    },
  });

  if (!repository) {
    redirect("/dashboard/repos");
  }

  return (
    <RepoDetail
      repository={{
        id: repository.id,
        name: repository.name,
        fullName: repository.fullName,
        private: repository.private,
        defaultBranch: repository.defaultBranch,
        language: repository.language,
        indexStatus: repository.indexStatus as "pending" | "indexing" | "indexed" | "failed" | "stale",
        indexProgress: repository.indexProgress,
        indexedAt: repository.indexedAt,
        indexError: repository.indexError,
        fileCount: repository.fileCount,
        chunkCount: repository.chunkCount,
        autoReview: repository.autoReview,
        webhookId: repository.webhookId,
        ignoredPaths: repository.ignoredPaths,
        reviewRules: repository.reviewRules as Record<string, unknown>,
        createdAt: repository.createdAt,
      }}
      indexedFiles={repository.indexedFiles}
      prReviews={repository.prReviews}
      codingStandards={repository.codingStandards.map((s) => ({
        id: s.id,
        source: s.source,
        filePath: s.filePath,
        rulesCount: Array.isArray(s.parsedRules) ? s.parsedRules.length : 0,
        enabled: s.enabled,
        detectedAt: s.detectedAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        parsedRules: s.parsedRules as Array<{
          category: string;
          rule: string;
          severity?: "critical" | "warning" | "suggestion";
        }>,
      }))}
      counts={repository._count}
    />
  );
}
