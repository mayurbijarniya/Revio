import { redirect } from "next/navigation";
import { IBM_Plex_Sans } from "next/font/google";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { DashboardNav } from "./dashboard-nav";
import { ErrorBoundary } from "@/components/ui/error-boundary";

const dashboardFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      githubUsername: true,
      avatarUrl: true,
      plan: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className={`${dashboardFont.className} min-h-screen bg-gray-50 dark:bg-gray-900`}>
      <DashboardNav
        user={{
          username: user.githubUsername,
          avatarUrl: user.avatarUrl,
          plan: user.plan,
        }}
      />
      <ErrorBoundary>
        <main>{children}</main>
      </ErrorBoundary>
    </div>
  );
}
