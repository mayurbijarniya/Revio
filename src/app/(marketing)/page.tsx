"use client";

import Link from "next/link";
import {
  Github,
  MessageSquare,
  Shield,
  Users,
  CheckCircle2,
  Target,
  Zap,
  Cpu,
  Eye,
  Brain,
  FileCode,
} from "lucide-react";
import { HeroAnimation } from "@/components/hero-animation";
import { TerminalPreview } from "@/components/terminal-preview";

export default function Home() {
  return (
    <div className="w-full max-w-[1920px] mx-auto border-x border-[var(--code-border)]">
      {/* Announcement Bar */}
      <Link href="/changelog" className="block border-b border-[var(--code-border)] py-2 px-4 sm:px-6 bg-[var(--code-bg)] hover:bg-[var(--code-bg)]/80 transition-colors">
        <p className="font-mono text-[10px] sm:text-xs font-medium text-[var(--foreground)]/60 uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 bg-[var(--primary)] inline-block flex-shrink-0"></span>
          <span className="truncate">[ ANNOUNCEMENT ] : REVIO V3.0 IS NOW LIVE WITH AI CODE INTELLIGENCE</span>
        </p>
      </Link>

      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 min-h-[60vh] lg:min-h-[80vh] border-b border-[var(--code-border)]">
        {/* Left Content */}
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-16 border-b lg:border-b-0 lg:border-r border-[var(--code-border)] relative">
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
            <span className="font-mono text-[10px] sm:text-xs font-medium text-[var(--primary)] bg-[var(--primary-subtle)] px-2 py-1 border border-[var(--primary)]/20 rounded-none">
              [ REPO_INTELLIGENCE_LAYER ]
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tighter mb-6 sm:mb-8 mt-10 sm:mt-12 leading-[0.85] animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-forwards">
            <span className="block [word-spacing:-0.15em]">SHIP CODE</span>
            <span className="text-[var(--primary)] block">WITH</span>
            <span className="text-[var(--primary)] block">CONFIDENCE</span>
          </h1>

          <p className="text-base sm:text-xl text-[var(--foreground)]/70 max-w-lg mb-8 sm:mb-12 font-light leading-relaxed">
            The autonomous code review agent that understands context.
            Catch bugs, security flaws, and logic errors before they merge.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <a href="/login" className="group relative inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-[var(--foreground)] text-[var(--background)] font-mono text-xs sm:text-sm font-bold tracking-wide hover:bg-[var(--primary)] transition-colors whitespace-nowrap">
              <Github className="w-4 h-4 mr-2 sm:mr-3" />
              [ CONNECT_GITHUB ]
            </a>
            <a href="/demo" className="group inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 border border-[var(--code-border)] bg-[var(--background)] text-[var(--foreground)] font-mono text-xs sm:text-sm font-bold tracking-wide hover:bg-[var(--code-bg)] transition-colors whitespace-nowrap">
              VIEW_DEMO
            </a>
          </div>
        </div>

        {/* Right Visual */}
        <div className="relative bg-[var(--code-bg)] overflow-hidden flex items-center justify-center min-h-[350px] sm:min-h-[400px] lg:min-h-[500px] border-l-0 lg:border-l border-[var(--code-border)]">
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
            <span className="font-mono text-[10px] sm:text-xs text-[var(--foreground)]/40">
              [ SYSTEM_VISUALIZATION ]
            </span>
          </div>
          <div className="relative w-full h-full">
            <HeroAnimation />
          </div>

          {/* Overlay Code Elements for styling */}
          <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 font-mono text-[8px] sm:text-[10px] text-[var(--foreground)]/30">
            Process: Analysis_Engine_v2<br />
            Status: Active
          </div>
        </div>
      </section>

      {/* Metrics Bar */}
      <section className="border-b border-[var(--code-border)] bg-[var(--background)]">
        <div className="grid grid-cols-2 md:grid-cols-4">
          <div className="p-4 sm:p-6 lg:p-8 border-r border-b md:border-b-0 border-[var(--code-border)]">
            <div className="font-mono text-[10px] sm:text-xs text-[var(--foreground)]/40 mb-1 sm:mb-2">[ LANGUAGES ]</div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold">14+</div>
          </div>
          <div className="p-4 sm:p-6 lg:p-8 border-b md:border-b-0 md:border-r border-[var(--code-border)]">
            <div className="font-mono text-[10px] sm:text-xs text-[var(--foreground)]/40 mb-1 sm:mb-2">[ AVG_REVIEW_TIME ]</div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold">&lt; 30s</div>
          </div>
          <div className="p-4 sm:p-6 lg:p-8 border-r border-[var(--code-border)]">
            <div className="font-mono text-[10px] sm:text-xs text-[var(--foreground)]/40 mb-1 sm:mb-2">[ CODEBASE_VISIBILITY ]</div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold">100%</div>
          </div>
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="font-mono text-[10px] sm:text-xs text-[var(--foreground)]/40 mb-1 sm:mb-2">[ INITIAL_COST ]</div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold">$0.00</div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview - COMPLETE VISIBILITY */}
      <section className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 border-b border-[var(--code-border)] bg-[var(--code-bg)]/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-forwards">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight max-w-xl">
              COMPLETE VISIBILITY INTO YOUR CODEBASE HEALTH
            </h2>
            <span className="font-mono text-[10px] sm:text-xs text-[var(--foreground)]/50">
              [ INTERFACE_PREVIEW_V3.0.0 ]
            </span>
          </div>

          <div className="relative rounded-sm border border-[var(--code-border)] bg-[var(--background)] shadow-2xl overflow-hidden group hover:border-[var(--primary)] transition-colors duration-500">
            <div className="aspect-[4/3] sm:aspect-[16/10] lg:aspect-[16/9] relative bg-[#0d1117]">
              <TerminalPreview />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid - Now Below Visibility */}
      <section id="features" className="border-b border-[var(--code-border)] scroll-mt-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Target, title: "SMART_CODE_REVIEW", desc: "AI that understands your codebase context. Detects bugs, logic errors, and architectural issues before they merge." },
            { icon: Cpu, title: "GRAPH_BASED_ANALYSIS", desc: "AST-powered code understanding with function relationships, call paths, and dependency mapping for deeper insights." },
            { icon: Brain, title: "CONFIDENCE_SCORING", desc: "1-5 star merge readiness scores with multi-factor analysis including issues, security, and complexity impact." },
            { icon: MessageSquare, title: "INTERACTIVE_BOT", desc: "@revio-bot conversations in PR comments. Explain changes, justify suggestions, or trigger re-reviews naturally." },
            { icon: Eye, title: "BLAST_RADIUS", desc: "Visual impact analysis showing which files and functions are affected by your changes with risk-based visualization." },
            { icon: Zap, title: "LEARNING_SYSTEM", desc: "Adapts to your team's feedback. Auto-suppresses low-value noise and learns from accepted/rejected suggestions." },
            { icon: Shield, title: "SECURITY_SCANNER", desc: "40+ pattern-based detection for SSRF, SQLi, XSS, hardcoded secrets, and vulnerable dependencies." },
            { icon: FileCode, title: "AUTO_DOCSTRINGS", desc: "AI-generated JSDoc and docstring suggestions with one-click apply directly in GitHub PR comments." },
            { icon: Users, title: "TEAM_ANALYTICS", desc: "Track code quality trends, PR velocity, and security debt across your entire organization." }
          ].map((feature, i) => (
            <div key={i} className={`group p-6 sm:p-8 lg:p-10 border-b border-[var(--code-border)] hover:bg-[var(--code-bg)] transition-colors relative overflow-hidden ${i % 2 === 0 ? 'sm:border-r' : ''} ${i % 3 !== 2 ? 'lg:border-r' : 'lg:border-r-0'}`}>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[var(--background)] border border-[var(--code-border)] flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--primary)]" />
              </div>
              <span className="font-mono text-[10px] sm:text-xs font-medium text-[var(--primary)] mb-2 sm:mb-3 block">[ FEATURE_0{i + 1} ]</span>
              <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">{feature.title}</h3>
              <p className="text-[var(--foreground)]/60 text-xs sm:text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works - Split Layout */}
      <section id="how-it-works" className="grid grid-cols-1 lg:grid-cols-12 border-b border-[var(--code-border)] min-h-[auto] lg:min-h-[600px] scroll-mt-24">
        <div className="lg:col-span-5 p-6 sm:p-10 lg:p-16 border-b lg:border-b-0 lg:border-r border-[var(--code-border)] flex flex-col justify-center bg-[var(--background)]">
          <span className="font-mono text-[10px] sm:text-xs font-medium text-[var(--primary)] mb-3 sm:mb-4">[ WORKFLOW ]</span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">ZERO CONFIGURATION REQUIRED</h2>
          <p className="text-sm sm:text-base text-[var(--foreground)]/70 mb-6 sm:mb-8">
            We connect directly to your version control system. No complex CI/CD pipelines to configure.
          </p>
          <div className="space-y-4 sm:space-y-6">
            {[
              "Connect GitHub Repository",
              "Indexing & Vector Embedding",
              "Automatic PR Comments"
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3 sm:gap-4">
                <div className="w-7 h-7 sm:w-8 sm:h-8 border border-[var(--code-border)] flex items-center justify-center font-mono text-xs sm:text-sm bg-[var(--code-bg)] flex-shrink-0">
                  {i + 1}
                </div>
                <span className="font-medium text-sm sm:text-base">{step}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-7 bg-[var(--code-bg)] flex items-center justify-center p-4 sm:p-8 lg:p-12">
          {/* Terminal visual */}
          <div className="w-full max-w-lg bg-[#0d1117] rounded-lg shadow-2xl p-4 sm:p-6 border border-gray-800 font-mono text-[10px] sm:text-xs text-green-400">
            <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500"></div>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500"></div>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="space-y-1.5 sm:space-y-2 overflow-x-auto">
              <p className="whitespace-nowrap"><span className="text-blue-400">➜</span> <span className="text-gray-400">~</span> git push origin feature/new-api</p>
              <p className="text-gray-500 hidden sm:block">Enumerating objects: 15, done.</p>
              <p className="text-gray-500 whitespace-nowrap">Writing objects: 100% (15/15), done.</p>
              <p className="text-gray-500 hidden sm:block">Total 15 (delta 8), reused 0 (delta 0)</p>
              <p className="text-gray-400 whitespace-nowrap">To github.com:org/repo.git</p>
              <br />
              <p className="animate-pulse whitespace-nowrap">⚡ Revio is analyzing your changes...</p>
              <p className="text-blue-400 font-bold whitespace-nowrap">[ANALYSIS_COMPLETE] Found 2 potential bugs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing - Flat Bordered */}
      <section id="pricing" className="py-12 sm:py-16 lg:py-24 border-b border-[var(--code-border)] scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <span className="font-mono text-[10px] sm:text-xs text-[var(--foreground)]/40 uppercase mb-3 sm:mb-4 block">[ PRICING_MODELS ]</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-mono uppercase tracking-tight">Scale with your team</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {/* Free */}
            <div className="border border-[var(--code-border)] p-5 sm:p-6 lg:p-8 hover:border-[var(--primary)] transition-colors flex flex-col h-full">
              <h3 className="font-mono font-bold text-base sm:text-lg mb-2">STARTER</h3>
              <div className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-6">$0<span className="text-sm sm:text-base font-normal text-[var(--foreground)]/50">/mo</span></div>
              <p className="text-xs sm:text-sm text-[var(--foreground)]/60 mb-6 sm:mb-8">For hobby projects and individual developers.</p>
              <ul className="space-y-3 sm:space-y-4 text-xs sm:text-sm mb-6 sm:mb-8 flex-grow">
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> 2 Connected Repos</li>
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> 20 PR Reviews / mo</li>
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> 50 Chat Messages / mo</li>
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> 10 Context Chunks</li>
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> Community Support</li>
              </ul>
              <Link href="/login" className="w-full py-2.5 sm:py-3 border border-[var(--code-border)] font-mono text-xs sm:text-sm font-bold hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors uppercase whitespace-nowrap mt-auto text-center block">
                Start_Free
              </Link>
            </div>

            {/* Pro */}
            <div className="border border-[var(--primary)] p-5 sm:p-6 lg:p-8 bg-[var(--primary-subtle)] relative flex flex-col h-full">
              <div className="absolute top-0 right-0 bg-[var(--primary)] text-white text-[9px] sm:text-[10px] font-bold px-2 py-1 uppercase">Most Popular</div>
              <h3 className="font-mono font-bold text-base sm:text-lg mb-2 text-[var(--primary)]">PRO</h3>
              <div className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-6">$19<span className="text-sm sm:text-base font-normal text-[var(--foreground)]/50">/mo</span></div>
              <p className="text-xs sm:text-sm text-[var(--foreground)]/60 mb-6 sm:mb-8">For professional developers and freelancers.</p>
              <ul className="space-y-3 sm:space-y-4 text-xs sm:text-sm mb-6 sm:mb-8 flex-grow">
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> 10 Connected Repos</li>
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> 200 PR Reviews / mo</li>
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> 500 Chat Messages / mo</li>
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> 15 Context Chunks</li>
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> Custom Review Rules</li>
              </ul>
              <Link href="/dashboard/billing" className="w-full py-2.5 sm:py-3 bg-[var(--primary)] text-white font-mono text-xs sm:text-sm font-bold hover:bg-[var(--primary-hover)] transition-colors uppercase whitespace-nowrap mt-auto text-center block">
                Upgrade_Pro
              </Link>
            </div>

            {/* Team */}
            <div className="border border-[var(--code-border)] p-5 sm:p-6 lg:p-8 hover:border-[var(--primary)] transition-colors flex flex-col h-full">
              <h3 className="font-mono font-bold text-base sm:text-lg mb-2">TEAM</h3>
              <div className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-6">$49<span className="text-sm sm:text-base font-normal text-[var(--foreground)]/50">/mo</span></div>
              <p className="text-xs sm:text-sm text-[var(--foreground)]/60 mb-6 sm:mb-8">For small teams and startups.</p>
              <ul className="space-y-3 sm:space-y-4 text-xs sm:text-sm mb-6 sm:mb-8 flex-grow">
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> Unlimited Repos</li>
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> Unlimited Reviews</li>
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> Unlimited Chat</li>
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> 25 Context Chunks</li>
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> Custom Review Rules</li>
                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)] flex-shrink-0" /> Team Management</li>
              </ul>
              <Link href="/dashboard/billing" className="w-full py-2.5 sm:py-3 border border-[var(--code-border)] font-mono text-xs sm:text-sm font-bold hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors uppercase whitespace-nowrap mt-auto text-center block">
                Contact_Sales
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
