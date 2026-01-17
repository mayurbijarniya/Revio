"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  GitPullRequest,
  MessageSquare,
  FolderGit2,
  Shield,
  Check,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Play,
  Pause,
  Brain,
  Target,
  Eye,
  Zap,
  Star,
} from "lucide-react";

// macOS Window Chrome Component
function MacWindow({
  title,
  children,
  className = "",
  active = true,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <div className={`rounded-lg sm:rounded-xl overflow-hidden shadow-2xl border border-[#3a3a3a] ${className}`}>
      {/* Title Bar */}
      <div className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 ${active ? "bg-[#2d2d2d]" : "bg-[#252525]"}`}>
        {/* Traffic Lights */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${active ? "bg-[#ff5f57]" : "bg-[#4a4a4a]"}`} />
          <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${active ? "bg-[#febc2e]" : "bg-[#4a4a4a]"}`} />
          <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${active ? "bg-[#28c840]" : "bg-[#4a4a4a]"}`} />
        </div>
        {/* Title */}
        <div className="flex-1 text-center">
          <span className="text-xs sm:text-sm text-[#808080] font-medium truncate">{title}</span>
        </div>
        <div className="w-10 sm:w-14" /> {/* Spacer for symmetry */}
      </div>
      {/* Content */}
      <div className="bg-[#1e1e1e]">{children}</div>
    </div>
  );
}

// Animated typing text
function TypingText({ text, speed = 50 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timer = setTimeout(() => {
        setDisplayed((prev) => prev + text[index]);
        setIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [index, text, speed]);

  return (
    <span>
      {displayed}
      {index < text.length && <span className="animate-pulse">|</span>}
    </span>
  );
}

// Demo screens
type DemoScreen = "dashboard" | "review" | "chat" | "indexing";

const demoScreens: { id: DemoScreen; title: string; icon: React.ElementType }[] = [
  { id: "dashboard", title: "Dashboard", icon: FolderGit2 },
  { id: "review", title: "PR Review", icon: GitPullRequest },
  { id: "chat", title: "Code Chat", icon: MessageSquare },
  { id: "indexing", title: "Indexing", icon: Shield },
];

// Dashboard Demo Content
function DashboardDemo() {
  return (
    <div className="p-4">
      {/* Nav */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2d2d2d]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded overflow-hidden">
            <Image src="/logo.svg" alt="Revio" width={20} height={20} className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-white text-sm">Revio</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-[#808080]">
          <span className="text-white">Repositories</span>
          <span>Chat</span>
          <span>Reviews</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[#252525] border border-[#333] rounded-lg p-3">
          <div className="text-[10px] text-[#808080] mb-1">TEAM_VELOCITY</div>
          <div className="text-xl font-bold text-white">+24%</div>
        </div>
        <div className="bg-[#252525] border border-[#333] rounded-lg p-3">
          <div className="text-[10px] text-[#808080] mb-1">HEALTH_SCORE</div>
          <div className="text-xl font-bold text-green-400">92/100</div>
        </div>
        <div className="bg-[#252525] border border-[#333] rounded-lg p-3">
          <div className="text-[10px] text-[#808080] mb-1">SECURITY_DEBT</div>
          <div className="text-xl font-bold text-amber-400">Low</div>
        </div>
      </div>

      {/* Repo List */}
      <div className="space-y-2">
        <div className="text-xs text-[#808080] mb-2 uppercase font-mono">[ ACTIVE_REPOSITORIES ]</div>
        {[
          { name: "revio/frontend", lang: "TypeScript", status: "indexed" },
          { name: "revio/api-server", lang: "Go", status: "indexed" },
          { name: "revio/shared-ui", lang: "React", status: "indexed" },
        ].map((repo) => (
          <div key={repo.name} className="flex items-center justify-between bg-[#252525] border border-[#333] rounded-lg p-2.5">
            <div className="flex items-center gap-3">
              <FolderGit2 className="w-4 h-4 text-[#808080]" />
              <div>
                <div className="text-xs text-white font-medium">{repo.name}</div>
                <div className="text-[10px] text-[#808080]">{repo.lang}</div>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded ${repo.status === "indexed"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}>
              {repo.status.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// PR Review Demo Content
function PRReviewDemo() {
  const [showIssues, setShowIssues] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowIssues(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-4">
      {/* PR Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2d2d2d]">
        <div className="flex items-center gap-3">
          <GitPullRequest className="w-5 h-5 text-[var(--primary)]" />
          <div>
            <div className="text-white font-medium">Add user authentication</div>
            <div className="text-xs text-[#808080]">#42 by @developer</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Confidence Score */}
          <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/30 rounded px-2 py-1">
            <Star className="w-3 h-3 text-green-400 fill-green-400" />
            <Star className="w-3 h-3 text-green-400 fill-green-400" />
            <Star className="w-3 h-3 text-green-400 fill-green-400" />
            <Star className="w-3 h-3 text-green-400 fill-green-400" />
            <Star className="w-3 h-3 text-green-400" />
            <span className="text-[10px] text-green-400 ml-1">4/5</span>
          </div>
          <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
            Ready to Merge
          </span>
        </div>
      </div>

      {/* Blast Radius */}
      <div className="bg-[#1e3a5f] border border-[#2d5a87] rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-blue-400 uppercase">[ BLAST_RADIUS ]</span>
        </div>
        <div className="text-xs text-[#cccccc]">
          <span className="text-amber-400 font-bold">3 functions</span> directly affected,{" "}
          <span className="text-amber-400 font-bold">12 indirect</span> callers traced.{" "}
          <span className="text-green-400 font-bold">Low impact</span> - changes are isolated.
        </div>
      </div>

      {/* Summary */}
      <div className="bg-[#252525] rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-[#808080]">AI Summary</div>
          <div className="flex items-center gap-1">
            <Brain className="w-3 h-3 text-[var(--primary)]" />
            <span className="text-[10px] text-[var(--primary)]">Graph Analysis</span>
          </div>
        </div>
        <div className="text-sm text-[#cccccc] leading-relaxed">
          <TypingText text="Well-structured authentication using JWT tokens. Function relationships mapped: auth.ts:42 calls validateToken() which depends on cryptoUtils.ts:15. Minor improvements suggested for error handling." />
        </div>
      </div>

      {/* Issues */}
      {showIssues && (
        <div className="space-y-2 animate-in slide-in-from-bottom-2 duration-300">
          <div className="text-[10px] text-[#808080] mb-2 uppercase font-mono">[ DETECTED_ISSUES ]</div>
          <div className="bg-[#252525] border-l-2 border-red-500 p-2.5 rounded shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3 h-3 text-red-500" />
              <span className="text-[10px] font-bold text-red-500 uppercase">Security</span>
              <span className="text-[10px] text-[#808080] font-mono">api.ts:89</span>
            </div>
            <div className="text-xs text-[#cccccc]">Potential SSRF via unsanitized redirect URL. Use a safelist for the redirect parameter.</div>
          </div>
          <div className="bg-[#252525] border-l-2 border-amber-500 p-2.5 rounded shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-bold text-amber-500 uppercase">Warning</span>
              <span className="text-[10px] text-[#808080] font-mono">auth.ts:12</span>
            </div>
            <div className="text-xs text-[#cccccc]">Session token entropy is low. Recommend 32+ bytes for security.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Chat Demo Content
function ChatDemo() {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "user", text: "How does authentication work in this codebase?" },
  ]);
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "The authentication system uses JWT tokens stored in HTTP-only cookies. The flow is:\n\n1. User logs in via /api/auth/login\n2. Server validates credentials and generates JWT\n3. Token is set as httpOnly cookie\n4. Subsequent requests are validated via middleware\n\nKey files: src/lib/auth.ts, src/middleware.ts",
        },
      ]);
      setTyping(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col h-[300px]">
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-3 border-b border-[#2d2d2d]">
        <MessageSquare className="w-4 h-4 text-[var(--primary)]" />
        <span className="text-sm text-white font-medium">Chat with acme/frontend</span>
      </div>

      {/* Messages */}
      <div className="flex-1 p-3 space-y-3 overflow-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === "user"
              ? "bg-[var(--primary)] text-white"
              : "bg-[#252525] text-[#cccccc]"
              }`}>
              <pre className="whitespace-pre-wrap font-sans">{msg.text}</pre>
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-[#252525] rounded-lg p-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-[#808080] animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#808080] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#808080] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#2d2d2d]">
        <div className="flex items-center gap-2 bg-[#252525] rounded-lg px-3 py-2">
          <input
            type="text"
            placeholder="Ask about your code..."
            className="flex-1 bg-transparent text-sm text-white placeholder-[#808080] focus:outline-none"
            disabled
          />
          <ArrowRight className="w-4 h-4 text-[var(--primary)]" />
        </div>
      </div>
    </div>
  );
}

// Indexing Demo Content
function IndexingDemo() {
  const [progress, setProgress] = useState(0);
  const [files, setFiles] = useState([
    { name: "src/lib/auth.ts", status: "done" },
    { name: "src/lib/db.ts", status: "done" },
    { name: "src/components/Header.tsx", status: "processing" },
    { name: "src/app/page.tsx", status: "pending" },
    { name: "src/types/index.ts", status: "pending" },
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setFiles((prev) => {
      const updated = [...prev];

      if (progress > 40 && updated[2]?.status === "processing") {
        updated[2] = { ...updated[2], status: "done" };
      }
      if (progress > 60 && updated[3]?.status === "pending") {
        updated[3] = { ...updated[3], status: "processing" };
      }
      if (progress > 80 && updated[3]?.status === "processing") {
        updated[3] = { ...updated[3], status: "done" };
        if (updated[4]) {
          updated[4] = { ...updated[4], status: "processing" };
        }
      }
      if (progress >= 100) {
        return updated.map((f) => ({ ...f, status: "done" }));
      }

      return updated;
    });
  }, [progress]);

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-5 h-5 text-[var(--primary)]" />
        <div>
          <div className="text-white font-medium">Indexing acme/frontend</div>
          <div className="text-xs text-[#808080]">Creating vector embeddings...</div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-[#808080] mb-2">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-[#252525] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--primary)] transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Files */}
      <div className="space-y-2">
        <div className="text-xs text-[#808080] mb-2">Processing Files</div>
        {files.map((file) => (
          <div key={file.name} className="flex items-center justify-between bg-[#252525] rounded-lg p-2">
            <span className="text-sm text-[#cccccc] font-mono">{file.name}</span>
            {file.status === "done" && <Check className="w-4 h-4 text-green-400" />}
            {file.status === "processing" && (
              <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            )}
            {file.status === "pending" && <div className="w-4 h-4 rounded-full bg-[#3a3a3a]" />}
          </div>
        ))}
      </div>

      {/* Stats */}
      {progress >= 100 && (
        <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/30 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-green-400">
            <Check className="w-4 h-4" />
            <span className="text-sm font-medium">Indexing Complete</span>
          </div>
          <div className="text-xs text-[#808080] mt-1">156 files indexed, 1,234 code chunks created</div>
        </div>
      )}
    </div>
  );
}

export default function DemoPage() {
  const [activeScreen, setActiveScreen] = useState<DemoScreen>("dashboard");
  const [autoPlay, setAutoPlay] = useState(true);

  // Auto-rotate screens
  useEffect(() => {
    if (!autoPlay) return;

    const timer = setInterval(() => {
      setActiveScreen((prev) => {
        const currentIndex = demoScreens.findIndex((s) => s.id === prev);
        const nextIndex = (currentIndex + 1) % demoScreens.length;
        return demoScreens[nextIndex]?.id ?? "dashboard";
      });
    }, 8000);

    return () => clearInterval(timer);
  }, [autoPlay]);

  const renderContent = () => {
    switch (activeScreen) {
      case "dashboard":
        return <DashboardDemo />;
      case "review":
        return <PRReviewDemo />;
      case "chat":
        return <ChatDemo />;
      case "indexing":
        return <IndexingDemo />;
    }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto border-x border-[var(--code-border)] flex-1 bg-[var(--background)]">
      {/* Header */}
      <div className="border-b border-[var(--code-border)] p-4 sm:p-6 lg:p-8">
        <span className="font-mono text-[10px] sm:text-xs font-medium text-[var(--primary)] mb-2 block">[ LIVE_DEMO ]</span>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">INTERACTIVE DEMO</h1>
        <p className="text-sm sm:text-base text-[var(--foreground)]/60 max-w-2xl">
          Experience Revio&apos;s features without signing up. This interactive demo shows how the platform looks and feels in action.
        </p>
      </div>

      {/* Demo Section */}
      <div className="p-4 sm:p-6 lg:p-12">
        <div className="max-w-5xl mx-auto">
          {/* Screen Selector */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {demoScreens.map((screen) => {
                const Icon = screen.icon;
                const isActive = activeScreen === screen.id;
                return (
                  <button
                    key={screen.id}
                    onClick={() => {
                      setActiveScreen(screen.id);
                      setAutoPlay(false);
                    }}
                    className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${isActive
                      ? "bg-[var(--primary)] text-white"
                      : "text-[var(--foreground)]/60 hover:text-[var(--foreground)] hover:bg-[var(--code-bg)]"
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline sm:inline">{screen.title}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setAutoPlay(!autoPlay)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-xs sm:text-sm transition-colors ${autoPlay
                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                : "text-[var(--foreground)]/40 hover:text-[var(--foreground)]"
                }`}
            >
              {autoPlay ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              {autoPlay ? "Auto-playing" : "Paused"}
            </button>
          </div>

          {/* macOS Window */}
          <div className="flex justify-center">
            <MacWindow
              title={`Revio — ${demoScreens.find((s) => s.id === activeScreen)?.title}`}
              className="w-full max-w-2xl"
            >
              {renderContent()}
            </MacWindow>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-8 sm:mt-12">
            {[
              {
                icon: Brain,
                title: "Graph Analysis",
                description: "AST-powered code understanding",
              },
              {
                icon: Target,
                title: "Confidence Score",
                description: "1-5 star merge readiness",
              },
              {
                icon: Zap,
                title: "Learning System",
                description: "Adapts to your team's feedback",
              },
              {
                icon: Eye,
                title: "Blast Radius",
                description: "Visual impact analysis",
              },
              {
                icon: MessageSquare,
                title: "Interactive Bot",
                description: "@revio-bot in PR comments",
              },
              {
                icon: Shield,
                title: "Security Scan",
                description: "40+ vulnerability patterns",
              },
              {
                icon: GitPullRequest,
                title: "Auto Reviews",
                description: "AI analyzes every PR",
              },
              {
                icon: FolderGit2,
                title: "Full Indexing",
                description: "Understand entire codebase",
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="p-3 sm:p-4 border border-[var(--code-border)] rounded-lg hover:border-[var(--primary)]/50 transition-colors">
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--primary)] mb-2 sm:mb-3" />
                  <h3 className="font-bold text-sm sm:text-base text-[var(--foreground)] mb-1">{feature.title}</h3>
                  <p className="text-xs sm:text-sm text-[var(--foreground)]/60">{feature.description}</p>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="mt-8 sm:mt-12 text-center">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Ready to try it yourself?</h3>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-[var(--primary)] text-white text-sm sm:text-base font-medium rounded-lg hover:bg-[var(--primary)]/90 transition-colors"
            >
              Get Started Free
              <ChevronRight className="w-4 h-4" />
            </Link>
            <p className="text-xs sm:text-sm text-[var(--foreground)]/40 mt-2 sm:mt-3">
              No credit card required. Free tier includes 50 PR reviews/month.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
