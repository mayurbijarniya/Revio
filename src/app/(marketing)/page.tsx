"use client";

import Link from "next/link";
import {
  Github,
  GitPullRequest,
  MessageSquare,
  Shield,
  Users,
  CheckCircle2,
  Brain,
  FileCode,
} from "lucide-react";
import { HeroAnimation } from "@/components/hero-animation";
import { TerminalPreview } from "@/components/terminal-preview";

export default function Home() {
  return (
    <div className="w-full max-w-[1920px] mx-auto border-x border-[var(--code-border)]">
      {/* Announcement Bar */}
      <Link href="/changelog" className="block border-b border-[var(--code-border)] py-2 px-6 bg-[var(--code-bg)] hover:bg-[var(--code-bg)]/80 transition-colors">
        <p className="font-mono text-xs font-medium text-[var(--foreground)]/60 uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 bg-[var(--primary)] inline-block"></span>
          [ ANNOUNCEMENT ] : REVIO V2.0 IS NOW LIVE WITH MULTI-LANGUAGE SUPPORT
        </p>
      </Link>

      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 min-h-[80vh] border-b border-[var(--code-border)]">
        {/* Left Content */}
        <div className="flex flex-col justify-center p-8 lg:p-16 border-b lg:border-b-0 lg:border-r border-[var(--code-border)] relative">
          <div className="absolute top-6 left-6">
            <span className="font-mono text-xs font-medium text-[var(--primary)] bg-[var(--primary-subtle)] px-2 py-1 border border-[var(--primary)]/20 rounded-none">
              [ REPO_INTELLIGENCE_LAYER ]
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-8 mt-12 leading-[0.9] animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-forwards">
            SHIP CODE <br />
            <span className="text-[var(--primary)]">WITH CONFIDENCE.</span>
          </h1>

          <p className="text-xl text-[var(--foreground)]/70 max-w-lg mb-12 font-light leading-relaxed">
            The autonomous code review agent that understands context.
            Catch bugs, security flaws, and logic errors before they merge.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <a href="/api/auth/github" className="group relative inline-flex items-center justify-center px-8 py-4 bg-[var(--foreground)] text-[var(--background)] font-mono text-sm font-bold tracking-wide hover:bg-[var(--primary)] transition-colors whitespace-nowrap">
              <Github className="w-4 h-4 mr-3" />
              [ CONNECT_GITHUB ]
            </a>
            <a href="/demo" className="group inline-flex items-center justify-center px-8 py-4 border border-[var(--code-border)] bg-[var(--background)] text-[var(--foreground)] font-mono text-sm font-bold tracking-wide hover:bg-[var(--code-bg)] transition-colors whitespace-nowrap">
              VIEW_DEMO
            </a>
          </div>
        </div>

        {/* Right Visual */}
        <div className="relative bg-[var(--code-bg)] overflow-hidden flex items-center justify-center min-h-[500px] border-l border-[var(--code-border)]">
          <div className="absolute top-6 right-6 z-10">
            <span className="font-mono text-xs text-[var(--foreground)]/40">
              [ SYSTEM_VISUALIZATION ]
            </span>
          </div>
          <div className="relative w-full h-full">
            <HeroAnimation />
          </div>

          {/* Overlay Code Elements for styling */}
          <div className="absolute bottom-4 left-4 font-mono text-[10px] text-[var(--foreground)]/30">
            Process: Analysis_Engine_v2<br />
            Status: Active
          </div>
        </div>
      </section>

      {/* Metrics Bar */}
      <section className="border-b border-[var(--code-border)] bg-[var(--background)]">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--code-border)]">
          <div className="p-8">
            <div className="font-mono text-xs text-[var(--foreground)]/40 mb-2">[ LANGUAGES ]</div>
            <div className="text-4xl font-bold">11+</div>
          </div>
          <div className="p-8">
            <div className="font-mono text-xs text-[var(--foreground)]/40 mb-2">[ AVG_REVIEW_TIME ]</div>
            <div className="text-4xl font-bold">&lt; 30s</div>
          </div>
          <div className="p-8">
            <div className="font-mono text-xs text-[var(--foreground)]/40 mb-2">[ CONTEXT_WINDOW ]</div>
            <div className="text-4xl font-bold">100%</div>
          </div>
          <div className="p-8">
            <div className="font-mono text-xs text-[var(--foreground)]/40 mb-2">[ INITIAL_COST ]</div>
            <div className="text-4xl font-bold">$0.00</div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview - COMPLETE VISIBILITY */}
      <section className="py-24 px-6 border-b border-[var(--code-border)] bg-[var(--code-bg)]/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-forwards">
            <h2 className="text-3xl font-bold tracking-tight max-w-xl">
              COMPLETE VISIBILITY INTO YOUR CODEBASE HEALTH
            </h2>
            <span className="font-mono text-xs text-[var(--foreground)]/50 hidden md:block">
              [ INTERFACE_PREVIEW_V1.0 ]
            </span>
          </div>

          <div className="relative rounded-sm border border-[var(--code-border)] bg-[var(--background)] shadow-2xl overflow-hidden group hover:border-[var(--primary)] transition-colors duration-500">
            <div className="aspect-[16/9] relative bg-[#0d1117]">
              <TerminalPreview />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid - Now Below Visibility */}
      <section id="features" className="border-b border-[var(--code-border)] scroll-mt-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: GitPullRequest, title: "AUTO_PR_REVIEW", desc: "Instant feedback on every pull request. We catch bugs before your users do." },
            { icon: MessageSquare, title: "CONTEXT_CHAT", desc: "Chat with your codebase. Ask complex architectural questions and get cited answers." },
            { icon: Shield, title: "SECURITY_SCAN", desc: "Vulnerability detection logic that goes beyond simple pattern matching regex." },
            { icon: Brain, title: "SEMANTIC_UNDERSTANDING", desc: "Vector-based code indexing allows the AI to understand dependencies across files." },
            { icon: FileCode, title: "MULTI_LANGUAGE", desc: "Native support for TS, Python, Go, Rust, Java, and C++. One tool for your whole stack." },
            { icon: Users, title: "TEAM_GOVERNANCE", desc: "Enforce review policies and coding standards automatically across your org." }
          ].map((feature, i) => (
            <div key={i} className="group p-10 border-b border-[var(--code-border)] md:border-r hover:bg-[var(--code-bg)] transition-colors relative overflow-hidden">
              <div className="w-12 h-12 bg-[var(--background)] border border-[var(--code-border)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 text-[var(--foreground)]" />
              </div>
              <span className="font-mono text-xs font-medium text-[var(--primary)] mb-3 block">[ FEATURE_0{i + 1} ]</span>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-[var(--foreground)]/60 text-sm leading-relaxed max-w-xs">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works - Split Layout */}
      <section id="how-it-works" className="grid grid-cols-1 lg:grid-cols-12 border-b border-[var(--code-border)] min-h-[600px] scroll-mt-24">
        <div className="lg:col-span-5 p-12 lg:p-16 border-b lg:border-b-0 lg:border-r border-[var(--code-border)] flex flex-col justify-center bg-[var(--background)]">
          <span className="font-mono text-xs font-medium text-[var(--primary)] mb-4">[ WORKFLOW ]</span>
          <h2 className="text-4xl font-bold mb-6">ZERO CONFIGURATION REQUIRED</h2>
          <p className="text-[var(--foreground)]/70 mb-8">
            We connect directly to your version control system. No complex CI/CD pipelines to configure.
          </p>
          <div className="space-y-6">
            {[
              "Connect GitHub Repository",
              "Indexing & Vector Embedding",
              "Automatic PR Comments"
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-8 h-8 border border-[var(--code-border)] flex items-center justify-center font-mono text-sm bg-[var(--code-bg)]">
                  {i + 1}
                </div>
                <span className="font-medium">{step}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-7 bg-[var(--code-bg)] flex items-center justify-center p-12">
          {/* Terminal visual */}
          <div className="w-full max-w-lg bg-[#0d1117] rounded-lg shadow-2xl p-6 border border-gray-800 font-mono text-xs text-green-400">
            <div className="flex gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="space-y-2">
              <p><span className="text-blue-400">➜</span> <span className="text-gray-400">~</span> git push origin feature/new-api</p>
              <p className="text-gray-500">Enumerating objects: 15, done.</p>
              <p className="text-gray-500">Writing objects: 100% (15/15), 1.24 MiB/s, done.</p>
              <p className="text-gray-500">Total 15 (delta 8), reused 0 (delta 0), pack-reused 0</p>
              <p className="text-gray-400">To github.com:org/repo.git</p>
              <br />
              <p className="animate-pulse">⚡ Revio is analyzing your changes...</p>
              <p className="text-blue-400 font-bold">[ANALYSIS_COMPLETE] Found 2 potential bugs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing - Flat Bordered */}
      <section id="pricing" className="py-24 border-b border-[var(--code-border)] scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="font-mono text-xs text-[var(--foreground)]/40 uppercase mb-4 block">[ PRICING_MODELS ]</span>
            <h2 className="text-4xl font-bold font-mono uppercase tracking-tight">Scale with your team</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Free */}
            <div className="border border-[var(--code-border)] p-8 hover:border-[var(--primary)] transition-colors flex flex-col h-full">
              <h3 className="font-mono font-bold text-lg mb-2">STARTER</h3>
              <div className="text-4xl font-bold mb-6">$0<span className="text-base font-normal text-[var(--foreground)]/50">/mo</span></div>
              <p className="text-sm text-[var(--foreground)]/60 mb-8 h-10">For hobby projects and individual developers.</p>
              <ul className="space-y-4 text-sm mb-8 flex-grow">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> 2 Connected Repos</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> 20 PR Reviews / mo</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> 50 Chat Messages / mo</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> 10 Context Chunks</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> Community Support</li>
              </ul>
              <button className="w-full py-3 border border-[var(--code-border)] font-mono text-sm font-bold hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors uppercase whitespace-nowrap mt-auto">
                Start_Free
              </button>
            </div>

            {/* Pro */}
            <div className="border border-[var(--primary)] p-8 bg-[var(--primary-subtle)] relative flex flex-col h-full">
              <div className="absolute top-0 right-0 bg-[var(--primary)] text-white text-[10px] font-bold px-2 py-1 uppercase">Most Popular</div>
              <h3 className="font-mono font-bold text-lg mb-2 text-[var(--primary)]">PRO</h3>
              <div className="text-4xl font-bold mb-6">$19<span className="text-base font-normal text-[var(--foreground)]/50">/mo</span></div>
              <p className="text-sm text-[var(--foreground)]/60 mb-8 h-10">For professional developers and freelancers.</p>
              <ul className="space-y-4 text-sm mb-8 flex-grow">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> 10 Connected Repos</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> 200 PR Reviews / mo</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> 500 Chat Messages / mo</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> 15 Context Chunks</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> Custom Review Rules</li>
              </ul>
              <button className="w-full py-3 bg-[var(--primary)] text-white font-mono text-sm font-bold hover:bg-[var(--primary-hover)] transition-colors uppercase whitespace-nowrap mt-auto">
                Upgrade_Pro
              </button>
            </div>

            {/* Team */}
            <div className="border border-[var(--code-border)] p-8 hover:border-[var(--primary)] transition-colors flex flex-col h-full">
              <h3 className="font-mono font-bold text-lg mb-2">TEAM</h3>
              <div className="text-4xl font-bold mb-6">$49<span className="text-base font-normal text-[var(--foreground)]/50">/mo</span></div>
              <p className="text-sm text-[var(--foreground)]/60 mb-8 h-10">For small teams and startups.</p>
              <ul className="space-y-4 text-sm mb-8 flex-grow">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> Unlimited Repos</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> Unlimited Reviews</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> Unlimited Chat</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> 25 Context Chunks</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> Custom Review Rules</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-[var(--primary)]" /> Team Management</li>
              </ul>
              <button className="w-full py-3 border border-[var(--code-border)] font-mono text-sm font-bold hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors uppercase whitespace-nowrap mt-auto">
                Contact_Sales
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
