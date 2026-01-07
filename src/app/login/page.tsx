import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Github, AlertCircle, ArrowLeft } from "lucide-react";
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white dark:bg-[#0A0A0A] relative overflow-hidden">
      {/* Background Grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(circle at center, black, transparent 80%)"
        }}
      />

      {/* Dark mode grid adjustment */}
      <div
        className="absolute inset-0 pointer-events-none hidden dark:block"
        style={{
          backgroundImage: "linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(circle at center, black, transparent 80%)"
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-mono text-xs tracking-wider uppercase">Back to Home</span>
        </Link>

        {/* Main Card */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#333] rounded-xl shadow-lg shadow-gray-200/50 dark:shadow-none p-8 md:p-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-12 h-12 bg-black dark:bg-white rounded-lg flex items-center justify-center mb-6">
              <Image
                src="/logo.svg"
                alt="Revio Logo"
                width={24}
                height={24}
                className="w-6 h-6"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
              Welcome back
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              [ SIGN_IN_TO_CONTINUE ]
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-800 dark:text-red-300">Authentication Error</h4>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {decodeURIComponent(error).replace(/_/g, " ")}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <a
              href="/api/auth/github"
              className="group w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-[#171717] hover:bg-black text-white rounded-lg transition-all duration-200 dark:bg-white dark:hover:bg-gray-100 dark:text-black font-medium border border-transparent hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-none relative overflow-hidden"
            >
              <Github className="w-5 h-5" />
              <span>Sign in with GitHub</span>

              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            </a>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100 dark:border-gray-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wider font-mono">
                <span className="bg-white dark:bg-[#0A0A0A] px-2 text-gray-400">Secure Access</span>
              </div>
            </div>

            <p className="text-xs text-center text-gray-500 dark:text-gray-500 leading-relaxed max-w-xs mx-auto">
              By continuing, you authorize Revio to access your repositories for automated code analysis.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-600 font-mono">
            REVIO.AI / SYSTEM_ID_{Math.floor(Math.random() * 10000)}
          </p>
        </div>
      </div>
    </div>
  );
}
