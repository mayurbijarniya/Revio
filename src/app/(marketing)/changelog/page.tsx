"use client";

import { useState } from "react";
import {
  Shield,
  MessageSquare,
  GitPullRequest,
  Users,
  BarChart3,
  Bot,
  Code,
  Search,
  Sparkles,
  Rocket,
  Database,
  ChevronDown,
} from "lucide-react";

interface Release {
  version: string;
  date: string;
  title: string;
  description: string;
  type: "major" | "minor" | "patch";
  icon: React.ElementType;
  changes: {
    category: "added" | "improved" | "fixed" | "security";
    items: string[];
  }[];
}

const releases: Release[] = [
  {
    version: "2.2.0",
    date: "January 14, 2026",
    title: "Team Intelligence & Advanced Security",
    description: "Launch of Team Analytics, enhanced Security Scanner, and Organization activity feeds.",
    type: "minor",
    icon: BarChart3,
    changes: [
      {
        category: "added",
        items: [
          "Team Analytics Dashboard - Insights into PR velocity and code quality",
          "Advanced Security Scanner - Detection for SSRF, SQLi, XSS, and more",
          "Organization Activity Feed - Real-time stream of team events",
          "Usage Tracking & Plan Limits - Granular control for enterprise customers",
        ],
      },
      {
        category: "improved",
        items: [
          "Hero Animation - Optimized for mobile/desktop split paths",
          "Prompt Engineering - Refined Gemini models for lower hallucination",
          "Vercel after() API integration - 100% reliability for long reviews",
        ],
      },
    ],
  },
  {
    version: "2.1.0",
    date: "January 8, 2026",
    title: "Documentation & Interactive Demo",
    description: "Comprehensive documentation, interactive demo, and improved code blocks.",
    type: "minor",
    icon: Code,
    changes: [
      {
        category: "added",
        items: [
          "Full documentation with sidebar navigation",
          "Interactive demo page with macOS window mockup",
          "Premium syntax highlighting using Shiki with Vesper theme",
          "Automatic file path extraction from code comments",
        ],
      },
      {
        category: "improved",
        items: [
          "Code block styling with proper dark theme",
          "Copy button on all code blocks",
          "Language labels and icons for code blocks",
        ],
      },
    ],
  },
  {
    version: "2.0.0",
    date: "January 6, 2026",
    title: "Enterprise Customization & UI Overhaul",
    description: "Top-to-bottom redesign of the review interface and the introduction of the Rule Engine.",
    type: "major",
    icon: Sparkles,
    changes: [
      {
        category: "added",
        items: [
          "Custom Review Rules - Define per-repo linting rules (no-console-log, secrets-check)",
          "Rule Engine with 8 pre-built templates",
          "Feedback Loop - Thumbs up/down on AI reviews",
          "Shareable Links - Unique URLs for every conversation",
          "Review Policies - Severity thresholds and blocking rules",
          "Review/Re-review buttons on detail pages",
        ],
      },
      {
        category: "improved",
        items: [
          "Refined chat interface focused on readability",
          "Multi-repo context retrieval optimization",
          "Repository detail page with equal-height columns",
          "Markdown rendering with vscDarkPlus theme",
        ],
      },
      {
        category: "fixed",
        items: [
          "Webhook signature validation for GitHub App",
          "Auth flow for returning users",
          "Console.log ESLint warnings",
        ],
      },
    ],
  },
  {
    version: "1.8.0",
    date: "December 28, 2025",
    title: "GitHub App Integration",
    description: "Revio Bot can now approve PRs, even your own - powered by GitHub App.",
    type: "minor",
    icon: Bot,
    changes: [
      {
        category: "added",
        items: [
          "Revio Bot GitHub App for enhanced PR reviews",
          "Bot can approve/request changes on any PR",
          "Settings page to manage GitHub App installation",
          "Webhook handling via GitHub App secret",
        ],
      },
      {
        category: "improved",
        items: [
          "Review posting uses bot when available",
          "Fallback to user token if bot not installed",
          "Better error handling for own-PR approval",
        ],
      },
      {
        category: "security",
        items: [
          "HMAC SHA-256 webhook signature verification",
          "Secure token storage with AES-256 encryption",
        ],
      },
    ],
  },
  {
    version: "1.7.0",
    date: "December 20, 2025",
    title: "Team Collaboration",
    description: "Organizations, team analytics, and activity feeds for collaborative code review.",
    type: "minor",
    icon: Users,
    changes: [
      {
        category: "added",
        items: [
          "Organizations with role-based access (owner, admin, member, viewer)",
          "Team member invitations by GitHub username",
          "Shared repository access within organizations",
          "Activity feed for team actions",
          "Team analytics and performance metrics",
          "Review assignment to team members",
        ],
      },
      {
        category: "improved",
        items: [
          "Dashboard navigation with organization switcher",
          "Repository sharing across team members",
        ],
      },
    ],
  },
  {
    version: "1.6.0",
    date: "December 15, 2025",
    title: "Analytics Dashboard",
    description: "Comprehensive analytics for tracking review performance and code quality trends.",
    type: "minor",
    icon: BarChart3,
    changes: [
      {
        category: "added",
        items: [
          "Analytics dashboard with date range picker",
          "Reviews over time visualization",
          "Feedback satisfaction metrics",
          "Repository insights with quality scores",
          "Issue severity and category breakdown",
          "Hotspot detection for problematic files",
          "Export analytics to CSV",
        ],
      },
      {
        category: "improved",
        items: [
          "Progress bar visualizations",
          "Top repositories by review count",
        ],
      },
    ],
  },
  {
    version: "1.5.0",
    date: "December 10, 2025",
    title: "Semantic Search & Vector Indexing",
    description: "Natural language search powered by vector embeddings and Qdrant.",
    type: "minor",
    icon: Search,
    changes: [
      {
        category: "added",
        items: [
          "Vector embedding with OpenAI text-embedding-3-small",
          "Qdrant vector database integration",
          "Hybrid search combining vector and keyword matching",
          "Faceted search filters (file types, code types, paths)",
          "Multi-repository context in chat",
        ],
      },
      {
        category: "improved",
        items: [
          "Search result ranking with diversity penalty",
          "File importance weighting for entry points",
          "Context retrieval for PR reviews",
        ],
      },
    ],
  },
  {
    version: "1.4.0",
    date: "December 5, 2025",
    title: "Security Scanning",
    description: "Automated security vulnerability detection integrated into PR reviews.",
    type: "minor",
    icon: Shield,
    changes: [
      {
        category: "added",
        items: [
          "Pattern-based security scanning",
          "Secrets detection (API keys, tokens, passwords)",
          "SQL injection vulnerability detection",
          "XSS vulnerability detection",
          "Command injection detection",
          "Weak cryptography warnings",
          "Security score calculation (0-100)",
          "CWE and OWASP references",
        ],
      },
      {
        category: "security",
        items: [
          "Critical issues block PR approval by default",
          "Security findings included in AI review context",
        ],
      },
    ],
  },
  {
    version: "1.3.0",
    date: "November 28, 2025",
    title: "Chat Interface Redesign",
    description: "Clean, minimal chat UI with improved markdown rendering and conversation management.",
    type: "minor",
    icon: MessageSquare,
    changes: [
      {
        category: "added",
        items: [
          "Conversation sidebar with history",
          "Multi-repository selector with checkboxes",
          "Export conversation as Markdown",
          "Copy markdown button in status bar",
          "Conversation URLs for direct sharing",
        ],
      },
      {
        category: "improved",
        items: [
          "User messages in white bordered containers",
          "AI responses flow on gray background",
          "Fixed bottom input with status bar",
          "Code blocks with syntax highlighting",
          "Inline code with gray monospace styling",
        ],
      },
    ],
  },
  {
    version: "1.2.0",
    date: "November 20, 2025",
    title: "PR Review Improvements",
    description: "Enhanced PR review workflow with manual triggers and detailed findings.",
    type: "minor",
    icon: GitPullRequest,
    changes: [
      {
        category: "added",
        items: [
          "Manual PR review trigger from dashboard",
          "Open PRs list in repository detail",
          "Review detail page with full findings",
          "Merge verdict calculation (Ready/Changes Required)",
          "Inline comments on GitHub PRs",
          "Risk level assessment (low/medium/high/critical)",
        ],
      },
      {
        category: "improved",
        items: [
          "Serverless-compatible review processing",
          "Immediate review visibility on dashboard",
          "Issues grouped by file in detail view",
        ],
      },
    ],
  },
  {
    version: "1.1.0",
    date: "November 12, 2025",
    title: "Incremental Indexing",
    description: "Smart indexing that only processes changed files for faster updates.",
    type: "minor",
    icon: Database,
    changes: [
      {
        category: "added",
        items: [
          "File hash comparison for change detection",
          "Incremental indexing (add/modify/delete)",
          "Force full index option",
          "Embedding cache with LRU eviction",
          "Background re-indexing via Vercel Cron",
        ],
      },
      {
        category: "improved",
        items: [
          "Parallel file processing (batches of 3)",
          "GitHub API-based indexing (no git binary)",
          "Automatic stale repository detection",
        ],
      },
    ],
  },
  {
    version: "1.0.0",
    date: "November 1, 2025",
    title: "Initial Release",
    description: "Launch of Revio - AI-powered code review platform.",
    type: "major",
    icon: Rocket,
    changes: [
      {
        category: "added",
        items: [
          "GitHub OAuth authentication",
          "Repository connection with webhook",
          "Automatic PR reviews on push",
          "Chat with codebase using natural language",
          "Vector-based code search",
          "Dashboard with stats and activity",
          "Billing page with Free/Pro/Team plans",
          "Settings page with usage tracking",
        ],
      },
      {
        category: "security",
        items: [
          "AES-256 encrypted token storage",
          "JWT session management",
          "CSRF protection for OAuth",
        ],
      },
    ],
  },
];

const categoryStyles = {
  added: {
    label: "Added",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
  },
  improved: {
    label: "Improved",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  fixed: {
    label: "Fixed",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  security: {
    label: "Security",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
  },
};

function ReleaseCard({ release, isLatest }: { release: Release; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(isLatest);
  const Icon = release.icon;

  return (
    <div className="relative pl-6 sm:pl-8 border-l border-[var(--code-border)]">
      {/* Timeline dot */}
      <div className={`absolute -left-1.5 top-0 w-3 h-3 rounded-full ring-4 ring-[var(--background)] ${
        isLatest ? "bg-[var(--primary)]" : "bg-[var(--code-border)]"
      }`} />

      {/* Date */}
      <span className="font-mono text-[10px] sm:text-xs text-[var(--foreground)]/50 mb-2 sm:mb-3 block">
        {release.date.toUpperCase()}
      </span>

      {/* Version badge */}
      <div className={`inline-block px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-mono font-bold rounded-full mb-3 sm:mb-4 ${
        isLatest
          ? "bg-[var(--primary)]/10 text-[var(--primary)]"
          : "bg-[var(--code-bg)] text-[var(--foreground)]/70"
      }`}>
        v{release.version}
        {release.type === "major" && (
          <span className="ml-1.5 sm:ml-2 text-[9px] sm:text-[10px] opacity-60">MAJOR</span>
        )}
      </div>

      {/* Title and description */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left group"
      >
        <h3 className="text-base sm:text-xl font-bold mb-1.5 sm:mb-2 flex items-center gap-2 sm:gap-3 group-hover:text-[var(--primary)] transition-colors">
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          <span className="flex-1">{release.title}</span>
          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </h3>
        <p className="text-[var(--foreground)]/60 text-xs sm:text-sm mb-3 sm:mb-4">
          {release.description}
        </p>
      </button>

      {/* Changes */}
      {expanded && (
        <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4 animate-in slide-in-from-top-2 duration-200">
          {release.changes.map((change, i) => {
            const style = categoryStyles[change.category];
            return (
              <div key={i}>
                <span className={`inline-block px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-mono font-bold rounded border mb-1.5 sm:mb-2 ${style.color} ${style.bg} ${style.border}`}>
                  {style.label}
                </span>
                <ul className="space-y-1 sm:space-y-1.5">
                  {change.items.map((item, j) => (
                    <li key={j} className="text-[var(--foreground)]/70 text-xs sm:text-sm flex items-start gap-1.5 sm:gap-2">
                      <span className="text-[var(--foreground)]/30 mt-0.5 sm:mt-1">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ChangelogPage() {
  return (
    <div className="w-full max-w-[1920px] mx-auto border-x border-[var(--code-border)] flex-1 bg-[var(--background)] flex flex-col">
      {/* Header */}
      <div className="border-b border-[var(--code-border)] p-4 sm:p-6 lg:p-8">
        <span className="font-mono text-[10px] sm:text-xs font-medium text-[var(--primary)] mb-2 block">[ SYSTEM_UPDATES ]</span>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">CHANGELOG</h1>
        <p className="text-sm sm:text-base text-[var(--foreground)]/60 max-w-2xl">
          All notable changes to Revio. We follow semantic versioning and release updates regularly.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-[var(--code-border)]">
        <div className="p-4 sm:p-6 border-r border-b sm:border-b-0 border-[var(--code-border)]">
          <div className="font-mono text-[10px] sm:text-xs text-[var(--foreground)]/40 mb-1 sm:mb-2">RELEASES</div>
          <div className="text-2xl sm:text-3xl font-bold">{releases.length}</div>
        </div>
        <div className="p-4 sm:p-6 border-b sm:border-b-0 sm:border-r border-[var(--code-border)]">
          <div className="font-mono text-[10px] sm:text-xs text-[var(--foreground)]/40 mb-1 sm:mb-2">LATEST</div>
          <div className="text-2xl sm:text-3xl font-bold">v{releases[0]?.version}</div>
        </div>
        <div className="p-4 sm:p-6 border-r border-[var(--code-border)]">
          <div className="font-mono text-[10px] sm:text-xs text-[var(--foreground)]/40 mb-1 sm:mb-2">MAJOR</div>
          <div className="text-2xl sm:text-3xl font-bold">{releases.filter(r => r.type === "major").length}</div>
        </div>
        <div className="p-4 sm:p-6">
          <div className="font-mono text-[10px] sm:text-xs text-[var(--foreground)]/40 mb-1 sm:mb-2">SINCE</div>
          <div className="text-2xl sm:text-3xl font-bold">Nov &apos;25</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-4 sm:p-6 lg:p-12 flex-1">
        <div className="max-w-3xl space-y-8 sm:space-y-12">
          {releases.map((release, i) => (
            <ReleaseCard key={release.version} release={release} isLatest={i === 0} />
          ))}
        </div>
      </div>
    </div>
  );
}
