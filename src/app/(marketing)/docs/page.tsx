"use client";

import { useState } from "react";
import Link from "next/link";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  BookOpen,
  Github,
  GitPullRequest,
  MessageSquare,
  FolderGit2,
  Settings,
  Users,
  Shield,
  Zap,
  Search,
  Bot,
  Terminal,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  FileCode,
} from "lucide-react";

type DocSection =
  | "getting-started"
  | "installation"
  | "github-connection"
  | "repository-indexing"
  | "pr-reviews"
  | "chat"
  | "organizations"
  | "custom-rules"
  | "settings"
  | "troubleshooting";

const sections: { id: DocSection; title: string; icon: React.ElementType }[] = [
  { id: "getting-started", title: "Getting Started", icon: BookOpen },
  { id: "installation", title: "Installation", icon: Terminal },
  { id: "github-connection", title: "GitHub Connection", icon: Github },
  { id: "repository-indexing", title: "Repository Indexing", icon: FolderGit2 },
  { id: "pr-reviews", title: "PR Reviews", icon: GitPullRequest },
  { id: "chat", title: "Chat with Codebase", icon: MessageSquare },
  { id: "organizations", title: "Organizations", icon: Users },
  { id: "custom-rules", title: "Custom Review Rules", icon: Shield },
  { id: "settings", title: "Settings", icon: Settings },
  { id: "troubleshooting", title: "Troubleshooting", icon: AlertTriangle },
];

// Language display names
const LANGUAGE_LABELS: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  bash: "Bash",
  json: "JSON",
  http: "HTTP",
  text: "Plain Text",
  url: "URL",
  ts: "TypeScript",
  js: "JavaScript",
};

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLabel = LANGUAGE_LABELS[language] || language.toUpperCase();

  return (
    <div className="relative group my-3 sm:my-4 rounded-lg overflow-hidden border border-[#2d2d2d]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 bg-[#1e1e1e] border-b border-[#2d2d2d]">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <FileCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#808080]" />
          <span className="font-mono text-[10px] sm:text-xs text-[#808080]">{displayLabel}</span>
        </div>
        <button
          onClick={handleCopy}
          className="p-1 sm:p-1.5 rounded hover:bg-[#2d2d2d] transition-colors"
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#808080] hover:text-[#cccccc]" />
          )}
        </button>
      </div>
      {/* Code Content */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language === "http" || language === "url" ? "text" : language}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: "0.75rem",
            fontSize: "0.75rem",
            lineHeight: "1.6",
            background: "#1e1e1e",
            borderRadius: 0,
          }}
          codeTagProps={{
            style: {
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace",
            }
          }}
        >
          {code.trim()}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

function DocHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-xl sm:text-2xl font-bold mt-8 sm:mt-12 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 scroll-mt-24">
      <span className="w-6 sm:w-8 h-[2px] bg-[var(--primary)]"></span>
      {children}
    </h2>
  );
}

function DocSubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base sm:text-lg font-bold mt-6 sm:mt-8 mb-3 sm:mb-4 text-[var(--foreground)]/90">
      {children}
    </h3>
  );
}

function DocParagraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm sm:text-base text-[var(--foreground)]/70 leading-relaxed mb-3 sm:mb-4">
      {children}
    </p>
  );
}

function DocList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 sm:gap-3 text-sm sm:text-base text-[var(--foreground)]/70">
          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 sm:mt-1 text-[var(--primary)] flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DocNote({ type = "info", children }: { type?: "info" | "warning" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "border-[var(--primary)] bg-[var(--primary)]/5",
    warning: "border-amber-500 bg-amber-500/5",
    success: "border-green-500 bg-green-500/5",
  };

  const icons = {
    info: <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--primary)] flex-shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 flex-shrink-0" />,
    success: <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />,
  };

  return (
    <div className={`border-l-4 ${styles[type]} p-3 sm:p-4 my-4 sm:my-6`}>
      <div className="flex items-start gap-2 sm:gap-3">
        {icons[type]}
        <div className="text-[var(--foreground)]/80 text-xs sm:text-sm">{children}</div>
      </div>
    </div>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<DocSection>("getting-started");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="w-full max-w-[1920px] mx-auto border-x border-[var(--code-border)] flex-1 bg-[var(--background)]">
      {/* Header */}
      <div className="border-b border-[var(--code-border)] p-4 sm:p-6 lg:p-8">
        <span className="font-mono text-[10px] sm:text-xs font-medium text-[var(--primary)] mb-2 block">[ DOCUMENTATION ]</span>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">REVIO DOCS</h1>
        <p className="text-sm sm:text-base text-[var(--foreground)]/60 mt-2 max-w-2xl">
          Complete documentation for Revio - the AI-powered code review platform.
          Learn how to set up, configure, and get the most out of your code reviews.
        </p>
      </div>

      {/* Mobile Nav Toggle */}
      <div className="lg:hidden border-b border-[var(--code-border)] p-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-full flex items-center justify-between px-3 py-2 bg-[var(--code-bg)] text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            {sections.find(s => s.id === activeSection)?.title || "Navigation"}
          </span>
          <ChevronRight className={`w-4 h-4 transition-transform ${sidebarOpen ? "rotate-90" : ""}`} />
        </button>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className={`lg:w-72 border-b lg:border-b-0 lg:border-r border-[var(--code-border)] lg:min-h-[calc(100vh-200px)] lg:sticky lg:top-16 ${sidebarOpen ? "block" : "hidden lg:block"}`}>
          <nav className="p-3 sm:p-4">
            <div className="font-mono text-[10px] sm:text-xs text-[var(--foreground)]/40 mb-3 sm:mb-4 px-2 sm:px-3">[ NAVIGATION ]</div>
            <ul className="space-y-0.5 sm:space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <li key={section.id}>
                    <button
                      onClick={() => {
                        setActiveSection(section.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors text-left ${
                        isActive
                          ? "bg-[var(--primary)] text-[var(--background)]"
                          : "text-[var(--foreground)]/70 hover:bg-[var(--code-bg)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      {section.title}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Quick Links */}
            <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-[var(--code-border)]">
              <div className="font-mono text-[10px] sm:text-xs text-[var(--foreground)]/40 mb-3 sm:mb-4 px-2 sm:px-3">[ QUICK_LINKS ]</div>
              <ul className="space-y-0.5 sm:space-y-1">
                <li>
                  <a
                    href="https://github.com/apps/revio-bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-[var(--foreground)]/70 hover:text-[var(--primary)] transition-colors"
                  >
                    <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Install Revio Bot
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>
                </li>
                <li>
                  <Link
                    href="/changelog"
                    className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-[var(--foreground)]/70 hover:text-[var(--primary)] transition-colors"
                  >
                    <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Changelog
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-12 max-w-4xl">
          {/* Getting Started */}
          {activeSection === "getting-started" && (
            <div>
              <DocHeading id="getting-started">Getting Started</DocHeading>
              <DocParagraph>
                Revio is an AI-powered code review platform that connects to your GitHub repositories,
                indexes your entire codebase using vector embeddings, and provides intelligent pull request
                reviews, bug detection, and natural language code search.
              </DocParagraph>

              <DocSubHeading>What is Revio?</DocSubHeading>
              <DocParagraph>
                Revio combines the power of large language models with deep codebase understanding to
                deliver context-aware code reviews. Unlike traditional linters, Revio understands your
                entire codebase and can identify issues that span multiple files.
              </DocParagraph>

              <DocSubHeading>Key Features</DocSubHeading>
              <DocList items={[
                "Automated PR Reviews - Get instant, AI-powered feedback on every pull request",
                "Codebase Indexing - Vector embeddings for semantic code search",
                "Natural Language Chat - Ask questions about your code in plain English",
                "Custom Review Rules - Define your own patterns and standards",
                "Team Collaboration - Organizations with role-based access control",
                "Security Scanning - Detect vulnerabilities and security issues",
              ]} />

              <DocNote type="info">
                Revio works best with repositories that have clear structure and good documentation.
                The AI learns from your existing code patterns.
              </DocNote>

              <DocSubHeading>Quick Start</DocSubHeading>
              <DocParagraph>
                Get up and running in less than 5 minutes:
              </DocParagraph>
              <DocList items={[
                "Sign in with your GitHub account",
                "Install the Revio Bot on your repositories",
                "Connect a repository from your dashboard",
                "Wait for indexing to complete",
                "Open a pull request and watch the magic happen!",
              ]} />
            </div>
          )}

          {/* Installation */}
          {activeSection === "installation" && (
            <div>
              <DocHeading id="installation">Installation</DocHeading>
              <DocParagraph>
                Revio is a cloud-hosted SaaS platform - there&apos;s nothing to install locally.
                However, you need to install the Revio Bot GitHub App to enable automated reviews.
              </DocParagraph>

              <DocSubHeading>Step 1: Sign In</DocSubHeading>
              <DocParagraph>
                Visit the Revio website and click &quot;Login with GitHub&quot;. You&apos;ll be redirected to
                GitHub to authorize the application.
              </DocParagraph>
              <CodeBlock code="https://revio.mayur.app/login" language="url" />

              <DocSubHeading>Step 2: Install the GitHub App</DocSubHeading>
              <DocParagraph>
                After signing in, you&apos;ll be prompted to install the Revio Bot GitHub App.
                This allows Revio to:
              </DocParagraph>
              <DocList items={[
                "Read repository contents for indexing",
                "Receive webhook events for PR updates",
                "Post review comments on pull requests",
                "Approve or request changes on PRs",
              ]} />

              <DocNote type="warning">
                The Revio Bot posts reviews as &quot;revio-bot[bot]&quot; - this allows it to approve
                your own PRs, which GitHub normally doesn&apos;t allow.
              </DocNote>

              <DocSubHeading>Step 3: Select Repositories</DocSubHeading>
              <DocParagraph>
                Choose which repositories you want Revio to access. You can select all repositories
                or choose specific ones. You can always change this later in GitHub settings.
              </DocParagraph>

              <DocSubHeading>Permissions Required</DocSubHeading>
              <DocList items={[
                "Repository contents (read) - For indexing code",
                "Pull requests (read/write) - For posting reviews",
                "Webhooks (read) - For receiving PR events",
                "Metadata (read) - For repository information",
              ]} />
            </div>
          )}

          {/* GitHub Connection */}
          {activeSection === "github-connection" && (
            <div>
              <DocHeading id="github-connection">GitHub Connection</DocHeading>
              <DocParagraph>
                Revio connects to GitHub using a GitHub App for enhanced security and functionality.
                This section covers how to manage your GitHub connection.
              </DocParagraph>

              <DocSubHeading>Connecting a Repository</DocSubHeading>
              <DocParagraph>
                From your dashboard, navigate to &quot;Repositories&quot; and click &quot;Connect Repository&quot;.
                You&apos;ll see a list of all repositories where the Revio Bot is installed.
              </DocParagraph>
              <DocList items={[
                "Click 'Connect' next to any repository",
                "Revio will automatically start indexing the codebase",
                "A webhook is created to receive PR events",
                "Once indexed, automatic reviews are enabled",
              ]} />

              <DocSubHeading>Managing Installations</DocSubHeading>
              <DocParagraph>
                You can manage your GitHub App installation at any time:
              </DocParagraph>
              <CodeBlock
                code="https://github.com/settings/installations"
                language="url"
              />

              <DocSubHeading>Disconnecting a Repository</DocSubHeading>
              <DocParagraph>
                To disconnect a repository:
              </DocParagraph>
              <DocList items={[
                "Go to Dashboard → Repositories → Select Repository",
                "Click the 'Disconnect' button",
                "Confirm the action",
                "All indexed data and reviews will be deleted",
              ]} />

              <DocNote type="warning">
                Disconnecting a repository permanently deletes all indexed files, embeddings,
                and PR reviews. This action cannot be undone.
              </DocNote>
            </div>
          )}

          {/* Repository Indexing */}
          {activeSection === "repository-indexing" && (
            <div>
              <DocHeading id="repository-indexing">Repository Indexing</DocHeading>
              <DocParagraph>
                Revio indexes your entire codebase to understand context and provide intelligent reviews.
                This process creates vector embeddings for semantic code search.
              </DocParagraph>

              <DocSubHeading>How Indexing Works</DocSubHeading>
              <DocList items={[
                "Revio fetches all files from your repository via GitHub API",
                "Code is chunked into logical segments (functions, classes, etc.)",
                "Each chunk is converted to vector embeddings using OpenAI",
                "Embeddings are stored in Qdrant vector database",
                "File hashes are tracked for incremental updates",
              ]} />

              <DocSubHeading>Supported Languages</DocSubHeading>
              <DocParagraph>
                Revio supports all major programming languages:
              </DocParagraph>
              <DocList items={[
                "TypeScript / JavaScript",
                "Python",
                "Go",
                "Rust",
                "Java / Kotlin",
                "C / C++",
                "Ruby",
                "PHP",
                "Swift",
                "And many more...",
              ]} />

              <DocSubHeading>Index Status</DocSubHeading>
              <DocParagraph>
                Each repository has an index status:
              </DocParagraph>
              <DocList items={[
                "Pending - Waiting to be indexed",
                "Indexing - Currently processing files",
                "Indexed - Ready for reviews and chat",
                "Stale - Needs re-indexing (older than 7 days)",
                "Failed - Indexing encountered an error",
              ]} />

              <DocSubHeading>Re-indexing</DocSubHeading>
              <DocParagraph>
                You can manually trigger a re-index at any time from the repository detail page.
                Revio also automatically re-indexes stale repositories daily.
              </DocParagraph>
              <CodeBlock
                code={`// Automatic re-indexing runs daily at 3 AM UTC
// Triggered via Vercel Cron: /api/cron/reindex`}
                language="javascript"
              />

              <DocNote type="info">
                Incremental indexing only processes changed files, making subsequent indexes much faster.
              </DocNote>
            </div>
          )}

          {/* PR Reviews */}
          {activeSection === "pr-reviews" && (
            <div>
              <DocHeading id="pr-reviews">PR Reviews</DocHeading>
              <DocParagraph>
                Revio automatically reviews pull requests using AI that understands your entire codebase.
                Reviews are posted as comments on GitHub and tracked in your dashboard.
              </DocParagraph>

              <DocSubHeading>Automatic Reviews</DocSubHeading>
              <DocParagraph>
                When a PR is opened or updated, Revio automatically:
              </DocParagraph>
              <DocList items={[
                "Fetches the PR diff from GitHub",
                "Retrieves relevant codebase context from vector DB",
                "Runs security scanning on changed files",
                "Generates a comprehensive review using Gemini AI",
                "Posts the review as a GitHub comment",
              ]} />

              <DocSubHeading>Review Contents</DocSubHeading>
              <DocParagraph>
                Each review includes:
              </DocParagraph>
              <DocList items={[
                "Summary - Overall assessment of the PR",
                "Issues - Bugs, security flaws, and problems found",
                "Positives - Good practices observed in the code",
                "Suggestions - Recommendations for improvement",
                "Risk Level - Low, Medium, High, or Critical",
                "Recommendation - Approve, Comment, or Request Changes",
              ]} />

              <DocSubHeading>Manual Reviews</DocSubHeading>
              <DocParagraph>
                You can also trigger reviews manually:
              </DocParagraph>
              <DocList items={[
                "From Dashboard → Repos → [Repo] → Open PRs → Click 'Review'",
                "From Dashboard → Reviews → Click 'Re-review' on any PR",
                "From Review Detail page → Click 'Re-review' button",
              ]} />

              <DocSubHeading>Review Feedback</DocSubHeading>
              <DocParagraph>
                Help improve Revio by providing feedback on reviews:
              </DocParagraph>
              <DocList items={[
                "Thumbs up - The review was helpful",
                "Thumbs down - The review was not helpful",
                "Feedback is used to improve future reviews",
              ]} />

              <DocNote type="success">
                The Revio Bot can approve PRs even if you&apos;re the author - something GitHub
                doesn&apos;t normally allow with personal accounts.
              </DocNote>
            </div>
          )}

          {/* Chat */}
          {activeSection === "chat" && (
            <div>
              <DocHeading id="chat">Chat with Codebase</DocHeading>
              <DocParagraph>
                Ask questions about your code in natural language. Revio uses semantic search
                to find relevant code and provides context-aware answers.
              </DocParagraph>

              <DocSubHeading>Starting a Conversation</DocSubHeading>
              <DocList items={[
                "Go to Dashboard → Chat",
                "Select one or more repositories for context",
                "Type your question and press Enter",
                "Revio will search your codebase and respond",
              ]} />

              <DocSubHeading>Example Questions</DocSubHeading>
              <CodeBlock
                code={`// Find implementations
"Where is user authentication handled?"

// Understand architecture
"How does the API routing work?"

// Debug issues
"What could cause a null pointer in the checkout flow?"

// Learn codebase
"Explain how the payment processing works"`}
                language="text"
              />

              <DocSubHeading>Multi-Repository Context</DocSubHeading>
              <DocParagraph>
                Select multiple repositories to search across your entire codebase.
                This is useful for monorepos or microservices architectures.
              </DocParagraph>

              <DocSubHeading>Conversation Features</DocSubHeading>
              <DocList items={[
                "Markdown rendering with syntax highlighting",
                "Code blocks with copy button",
                "Conversation history saved automatically",
                "Export conversations as Markdown",
                "Share conversations via URL",
              ]} />

              <DocNote type="info">
                Chat uses the same vector embeddings as PR reviews, so it understands
                your code at the same deep level.
              </DocNote>
            </div>
          )}

          {/* Organizations */}
          {activeSection === "organizations" && (
            <div>
              <DocHeading id="organizations">Organizations</DocHeading>
              <DocParagraph>
                Create organizations to collaborate with your team. Share repositories,
                track activity, and manage access with role-based permissions.
              </DocParagraph>

              <DocSubHeading>Creating an Organization</DocSubHeading>
              <DocList items={[
                "Go to Dashboard → Organizations → Create Organization",
                "Enter a name and optional description",
                "You become the owner automatically",
                "Invite team members by GitHub username",
              ]} />

              <DocSubHeading>Member Roles</DocSubHeading>
              <DocList items={[
                "Owner - Full access, can delete organization",
                "Admin - Can manage members and repositories",
                "Member - Can view and review repositories",
                "Viewer - Read-only access",
              ]} />

              <DocSubHeading>Shared Repositories</DocSubHeading>
              <DocParagraph>
                Add repositories to your organization to share access with all members:
              </DocParagraph>
              <CodeBlock
                code={`// From organization page:
1. Click "Add Repository"
2. Select from connected repositories
3. All members can now view and review PRs`}
                language="text"
              />

              <DocSubHeading>Activity Feed</DocSubHeading>
              <DocParagraph>
                Track all organization activity:
              </DocParagraph>
              <DocList items={[
                "Repository additions and removals",
                "Member joins and role changes",
                "PR reviews completed",
                "Settings changes",
              ]} />
            </div>
          )}

          {/* Custom Rules */}
          {activeSection === "custom-rules" && (
            <div>
              <DocHeading id="custom-rules">Custom Review Rules</DocHeading>
              <DocParagraph>
                Define custom rules to enforce your team&apos;s coding standards.
                Rules can use regex patterns and are applied during every review.
              </DocParagraph>

              <DocSubHeading>Accessing Review Rules</DocSubHeading>
              <DocList items={[
                "Go to Dashboard → Repos → [Repository]",
                "Scroll to 'Review Settings'",
                "Click 'Advanced Review Rules'",
              ]} />

              <DocSubHeading>Rule Templates</DocSubHeading>
              <DocParagraph>
                Revio includes pre-built rule templates:
              </DocParagraph>
              <DocList items={[
                "No Console Logs - Flag console.log statements",
                "No TODO Comments - Detect unresolved TODOs",
                "No Hardcoded Secrets - Find API keys and passwords",
                "SQL Injection Prevention - Detect vulnerable queries",
                "Avoid var - Enforce let/const usage",
                "No Magic Numbers - Flag unexplained numeric literals",
                "Max Function Length - Limit function size",
                "Require Error Handling - Ensure try-catch blocks",
              ]} />

              <DocSubHeading>Creating Custom Rules</DocSubHeading>
              <CodeBlock
                code={`{
  "name": "No Hardcoded URLs",
  "description": "URLs should be in config files",
  "pattern": "https?://[^\\s]+",
  "category": "style",
  "severity": "warning",
  "message": "Move this URL to a configuration file"
}`}
                language="json"
              />

              <DocSubHeading>Severity Thresholds</DocSubHeading>
              <DocList items={[
                "Critical - Block merge, requires immediate fix",
                "Warning - Should be fixed before merge",
                "Suggestion - Nice to have improvements",
                "Info - Informational notes",
              ]} />

              <DocSubHeading>Focus Areas</DocSubHeading>
              <DocParagraph>
                Enable or disable review categories:
              </DocParagraph>
              <DocList items={[
                "Bug Detection",
                "Security Vulnerabilities",
                "Performance Issues",
                "Code Style",
                "Logic Errors",
                "Error Handling",
                "Testing Coverage",
                "Documentation",
              ]} />
            </div>
          )}

          {/* Settings */}
          {activeSection === "settings" && (
            <div>
              <DocHeading id="settings">Settings</DocHeading>
              <DocParagraph>
                Manage your account, subscription, and preferences from the Settings page.
              </DocParagraph>

              <DocSubHeading>Account Settings</DocSubHeading>
              <DocList items={[
                "View connected GitHub account",
                "Manage Revio Bot installation",
                "View account creation date",
              ]} />

              <DocSubHeading>Revio Bot Management</DocSubHeading>
              <DocParagraph>
                From Settings, you can:
              </DocParagraph>
              <DocList items={[
                "Install or update the Revio Bot on new repositories",
                "Open GitHub App settings to manage permissions",
                "View installation status",
              ]} />

              <DocSubHeading>Plan & Usage</DocSubHeading>
              <DocParagraph>
                View your current plan and usage statistics:
              </DocParagraph>
              <DocList items={[
                "Current plan (Free, Pro, Team)",
                "Repositories connected",
                "PR reviews this month",
                "Chat messages this month",
                "Usage limits and progress",
              ]} />

              <DocSubHeading>Repository Settings</DocSubHeading>
              <DocParagraph>
                Each repository has individual settings:
              </DocParagraph>
              <DocList items={[
                "Auto Review PRs - Toggle automatic reviews",
                "Ignored Paths - Skip certain files/folders",
                "Custom Review Rules - Define team standards",
                "Webhook Status - View connection health",
              ]} />
            </div>
          )}

          {/* Troubleshooting */}
          {activeSection === "troubleshooting" && (
            <div>
              <DocHeading id="troubleshooting">Troubleshooting</DocHeading>
              <DocParagraph>
                Common issues and their solutions.
              </DocParagraph>

              <DocSubHeading>Reviews Not Appearing</DocSubHeading>
              <DocList items={[
                "Check if the repository is connected in Dashboard → Repos",
                "Verify the webhook is active (should show 'Connected')",
                "Ensure the Revio Bot is installed on the repository",
                "Check if Auto Review is enabled in repository settings",
              ]} />

              <DocSubHeading>Indexing Failed</DocSubHeading>
              <DocList items={[
                "Repository may be too large - try excluding large folders",
                "Check if the repository has any content",
                "Try triggering a manual re-index",
                "Ensure the bot has read access to the repository",
              ]} />

              <DocSubHeading>Chat Not Finding Code</DocSubHeading>
              <DocList items={[
                "Ensure the repository is fully indexed (status: 'Indexed')",
                "Try more specific queries",
                "Check if you've selected the correct repositories",
                "Re-index if the code was recently changed",
              ]} />

              <DocSubHeading>Webhook Errors</DocSubHeading>
              <DocParagraph>
                If you see 401 or signature errors:
              </DocParagraph>
              <DocList items={[
                "The webhook secret may be misconfigured",
                "Check if there are duplicate webhooks in GitHub",
                "Remove old webhooks from repository settings",
                "Reinstall the Revio Bot",
              ]} />

              <DocSubHeading>Bot Can&apos;t Approve PRs</DocSubHeading>
              <DocList items={[
                "Ensure the Revio Bot is the latest version",
                "Check GitHub App permissions include 'Pull requests: Read & write'",
                "The bot should be able to approve any PR, including your own",
              ]} />

              <DocNote type="warning">
                If you continue to experience issues, check the browser console for errors
                or contact support with details about your repository and the issue.
              </DocNote>

              <DocSubHeading>Getting Help</DocSubHeading>
              <DocList items={[
                "GitHub Issues: Report bugs and feature requests",
                "Documentation: Check this guide for answers",
                "Community: Join discussions with other users",
              ]} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
