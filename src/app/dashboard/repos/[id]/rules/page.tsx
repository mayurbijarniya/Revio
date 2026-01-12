import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { RulesPage } from "./rules-page";
import { parseReviewSettings } from "@/types/review";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RepositoryRulesPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getCurrentUser();

  if (!session) {
    return notFound();
  }

  // Get repository with review rules
  const repository = await db.repository.findFirst({
    where: {
      id,
      userId: session.id,
    },
    select: {
      id: true,
      name: true,
      fullName: true,
      reviewRules: true,
    },
  });

  if (!repository) {
    return notFound();
  }

  // Parse review settings
  const reviewSettings = parseReviewSettings(repository.reviewRules);

  return (
    <RulesPage
      repositoryId={repository.id}
      repositoryName={repository.fullName}
      initialSettings={reviewSettings}
    />
  );
}
