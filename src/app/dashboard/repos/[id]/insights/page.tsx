import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import RepoInsights from "./repo-insights";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RepoInsightsPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const repo = await db.repository.findFirst({
    where: { id, userId: session.userId },
    select: { id: true, name: true, fullName: true },
  });

  if (!repo) {
    redirect("/dashboard/repos");
  }

  return <RepoInsights repoId={repo.id} repoName={repo.name} repoFullName={repo.fullName} />;
}

