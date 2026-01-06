import { Github, ArrowRight, GitPullRequest, MessageSquare, Shield } from "lucide-react";
import { getSession } from "@/lib/session";
import Link from "next/link";

export default async function Home() {
  const session = await getSession();
  const isAuthenticated = !!session;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <span className="text-xl font-bold">Revio</span>
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                  Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  >
                    Sign in
                  </Link>
                  <a
                    href="/api/auth/github"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                  >
                    <Github className="w-4 h-4" />
                    Get Started
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="flex flex-col items-center gap-8 text-center max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            AI-Powered Code Review
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl">
            Connect your GitHub repositories, get instant AI-powered code reviews,
            and chat with your codebase using natural language.
          </p>

          {!isAuthenticated && (
            <div className="flex gap-4 mt-4">
              <a
                href="/api/auth/github"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-lg"
              >
                <Github className="w-5 h-5" />
                Sign in with GitHub
              </a>
            </div>
          )}

          {/* Features */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left w-full">
            <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg w-fit mb-4">
                <GitPullRequest className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">PR Reviews</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Automated code reviews with full codebase context. Catch bugs before they reach production.
              </p>
            </div>

            <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg w-fit mb-4">
                <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Chat with Code</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Ask questions about your codebase in natural language. Get instant answers with code references.
              </p>
            </div>

            <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg w-fit mb-4">
                <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Security Scanning</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Identify security vulnerabilities and get actionable fixes before merging.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Revio - AI-Powered Code Review Platform
        </div>
      </footer>
    </div>
  );
}
