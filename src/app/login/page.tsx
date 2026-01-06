import { redirect } from "next/navigation";
import Link from "next/link";
import { Github, AlertCircle } from "lucide-react";
import { getSession } from "@/lib/session";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Redirect if already logged in
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const error = params.error;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">Welcome to Revio</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Sign in to access your code review dashboard
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-700 dark:text-red-400">
                  {decodeURIComponent(error).replace(/_/g, " ")}
                </p>
              </div>
            </div>
          )}

          <a
            href="/api/auth/github"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <Github className="w-5 h-5" />
            Sign in with GitHub
          </a>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
            By signing in, you agree to grant Revio access to your GitHub
            repositories for code review and analysis.
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          <Link href="/" className="hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
