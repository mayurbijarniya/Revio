import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { RepoList } from "./repo-list";

export default async function ReposPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <a href="/dashboard" className="text-xl font-bold">
                Revio
              </a>
              <span className="text-gray-400">/</span>
              <span className="text-gray-600 dark:text-gray-400">Repositories</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Repositories</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Connect your GitHub repositories to enable AI-powered code reviews
          </p>
        </div>

        <RepoList />
      </main>
    </div>
  );
}
