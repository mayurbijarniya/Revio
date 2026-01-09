"use client";

import { useEffect, useState } from "react";
import { GitPullRequest, GitBranch, ShieldCheck, FileText, CheckCircle2 } from "lucide-react";
import Image from "next/image";

// Mobile-optimized simple animation
function MobileAnimation() {
    return (
        <div className="flex flex-col items-center justify-center gap-6 p-6">
            {/* Input Cards */}
            <div className="flex gap-4 w-full max-w-xs">
                <div className="flex-1 flex items-center gap-2 bg-[var(--background)] px-3 py-2 rounded-lg border border-[var(--code-border)] text-xs">
                    <div className="p-1 bg-[var(--info-subtle)] rounded text-[var(--info)]">
                        <GitPullRequest className="w-3 h-3" />
                    </div>
                    <span className="font-bold">PR #421</span>
                </div>
                <div className="flex-1 flex items-center gap-2 bg-[var(--background)] px-3 py-2 rounded-lg border border-[var(--code-border)] text-xs">
                    <div className="p-1 bg-[var(--warning-subtle)] rounded text-[var(--warning)]">
                        <GitBranch className="w-3 h-3" />
                    </div>
                    <span className="font-bold">main</span>
                </div>
            </div>

            {/* Animated Lines */}
            <div className="flex flex-col items-center gap-1">
                <div className="w-0.5 h-6 bg-gradient-to-b from-[var(--info)] to-[var(--primary)] animate-pulse"></div>
            </div>

            {/* Center Engine */}
            <div className="relative">
                <div className="absolute inset-[-12px] bg-[var(--primary)]/10 rounded-full animate-pulse"></div>
                <div className="relative w-20 h-20 bg-[var(--background)] border-2 border-[var(--primary)] rounded-full flex flex-col items-center justify-center shadow-lg">
                    <Image src="/logo.svg" alt="Revio" width={32} height={32} className="object-contain mb-1" />
                    <span className="text-[8px] font-bold text-[var(--primary)]">ENGINE</span>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[var(--background)] border border-[var(--success)] rounded-full flex items-center gap-1">
                    <div className="w-1 h-1 bg-[var(--success)] rounded-full animate-pulse"></div>
                    <span className="text-[7px] font-bold text-[var(--success)]">ACTIVE</span>
                </div>
            </div>

            {/* Animated Lines */}
            <div className="flex flex-col items-center gap-1">
                <div className="w-0.5 h-6 bg-gradient-to-b from-[var(--primary)] to-[var(--success)] animate-pulse"></div>
            </div>

            {/* Output Cards */}
            <div className="flex flex-wrap gap-2 justify-center w-full max-w-xs">
                <div className="flex items-center gap-2 bg-[var(--background)] px-3 py-2 rounded-lg border border-[var(--code-border)] text-xs">
                    <ShieldCheck className="w-3 h-3 text-[var(--error)]" />
                    <span className="font-medium">Security</span>
                </div>
                <div className="flex items-center gap-2 bg-[var(--background)] px-3 py-2 rounded-lg border border-[var(--code-border)] text-xs">
                    <CheckCircle2 className="w-3 h-3 text-[var(--success)]" />
                    <span className="font-medium">Quality</span>
                </div>
                <div className="flex items-center gap-2 bg-[var(--background)] px-3 py-2 rounded-lg border border-[var(--code-border)] text-xs">
                    <FileText className="w-3 h-3 text-[var(--info)]" />
                    <span className="font-medium">Insights</span>
                </div>
            </div>
        </div>
    );
}

// Desktop full animation
function DesktopAnimation() {
    return (
        <div className="relative w-[700px] h-[400px]">
            {/* SVG Layer for Connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-[var(--code-border)]" viewBox="0 0 700 400">
                <defs>
                    <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="var(--code-border)" stopOpacity="0.2" />
                        <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="var(--code-border)" stopOpacity="0.2" />
                    </linearGradient>
                </defs>

                {/* PATHS: LEFT -> CENTER */}
                <path d="M 230 100 C 258 100, 258 200, 286 200" fill="none" strokeWidth="1" className="opacity-50" />
                <path d="M 230 300 C 258 300, 258 200, 286 200" fill="none" strokeWidth="1" className="opacity-50" />

                {/* PATHS: CENTER -> RIGHT */}
                <path d="M 414 200 C 442 200, 442 100, 470 100" fill="none" strokeWidth="1" className="opacity-50" />
                <path d="M 414 200 L 470 200" fill="none" strokeWidth="1" className="opacity-50" />
                <path d="M 414 200 C 442 200, 442 300, 470 300" fill="none" strokeWidth="1" className="opacity-50" />

                {/* Animated Particles */}
                <circle r="3" fill="var(--info)">
                    <animateMotion dur="3s" repeatCount="indefinite" path="M 230 100 C 258 100, 258 200, 286 200" keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="3s" repeatCount="indefinite" />
                </circle>

                <circle r="3" fill="var(--warning)">
                    <animateMotion dur="3s" begin="1.5s" repeatCount="indefinite" path="M 230 300 C 258 300, 258 200, 286 200" keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="3s" begin="1.5s" repeatCount="indefinite" />
                </circle>

                <circle r="2.5" fill="var(--error)">
                    <animateMotion dur="2s" begin="0.8s" repeatCount="indefinite" path="M 414 200 C 442 200, 442 100, 470 100" keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2s" begin="0.8s" repeatCount="indefinite" />
                </circle>

                <circle r="2.5" fill="var(--success)">
                    <animateMotion dur="2s" begin="1.2s" repeatCount="indefinite" path="M 414 200 L 470 200" keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2s" begin="1.2s" repeatCount="indefinite" />
                </circle>

                <circle r="2.5" fill="var(--info)">
                    <animateMotion dur="2s" begin="1.6s" repeatCount="indefinite" path="M 414 200 C 442 200, 442 300, 470 300" keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2s" begin="1.6s" repeatCount="indefinite" />
                </circle>
            </svg>

            {/* LEFT SIDE: INPUTS */}
            <div className="absolute left-[30px] top-[70px] w-[200px] h-[60px] group font-mono text-xs">
                <div className="absolute right-[-2px] top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--code-border)] rounded-full z-10"></div>
                <div className="w-full h-full flex items-center gap-3 bg-[var(--background)] px-4 rounded-lg border border-[var(--code-border)] shadow-sm hover:border-[var(--info)] transition-colors z-20 relative">
                    <div className="p-1.5 bg-[var(--info-subtle)] rounded text-[var(--info)]">
                        <GitPullRequest className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-[var(--foreground)]">PR #421</span>
                        <span className="text-[10px] text-[var(--foreground)]/50">feat/auth-flow</span>
                    </div>
                </div>
            </div>

            <div className="absolute left-[30px] top-[270px] w-[200px] h-[60px] group font-mono text-xs">
                <div className="absolute right-[-2px] top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--code-border)] rounded-full z-10"></div>
                <div className="w-full h-full flex items-center gap-3 bg-[var(--background)] px-4 rounded-lg border border-[var(--code-border)] shadow-sm hover:border-[var(--warning)] transition-colors z-20 relative">
                    <div className="p-1.5 bg-[var(--warning-subtle)] rounded text-[var(--warning)]">
                        <GitBranch className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-[var(--foreground)]">main</span>
                        <span className="text-[10px] text-[var(--foreground)]/50">Production Branch</span>
                    </div>
                </div>
            </div>

            {/* CENTER: ENGINE */}
            <div className="absolute left-[286px] top-[136px] w-32 h-32 flex items-center justify-center z-30 font-mono">
                <div className="absolute inset-[-20px] bg-[var(--primary)]/5 rounded-full animate-pulse"></div>
                <div className="absolute inset-[-40px] border border-[var(--primary)]/10 rounded-full animate-spin" style={{ animationDuration: '20s' }}></div>

                <div className="relative w-full h-full bg-[var(--background)] border-2 border-[var(--primary)] rounded-full flex flex-col items-center justify-center shadow-xl shadow-[var(--primary)]/10 z-20">
                    <Image src="/logo.svg" alt="Revio Core" width={48} height={48} className="object-contain mb-2" />
                    <span className="text-[10px] font-bold text-[var(--primary)] tracking-wider">ENGINE</span>

                    <div className="absolute -bottom-3 px-3 py-1 bg-[var(--background)] border border-[var(--success)] rounded-full flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-[var(--success)] rounded-full animate-pulse"></div>
                        <span className="text-[9px] font-bold text-[var(--success)]">ACTIVE</span>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE: OUTPUTS */}
            <div className="absolute left-[470px] top-[80px] w-[180px] h-[40px] flex items-center font-mono text-xs">
                <div className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--code-border)] rounded-full z-10"></div>
                <div className="w-full h-full flex items-center gap-3 bg-[var(--background)] px-4 rounded-lg border border-[var(--code-border)] shadow-sm opacity-90 z-20">
                    <ShieldCheck className="w-4 h-4 text-[var(--error)]" />
                    <span className="font-medium">Security_Scan</span>
                </div>
            </div>

            <div className="absolute left-[470px] top-[180px] w-[180px] h-[40px] flex items-center font-mono text-xs">
                <div className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--code-border)] rounded-full z-10"></div>
                <div className="w-full h-full flex items-center gap-3 bg-[var(--background)] px-4 rounded-lg border border-[var(--code-border)] shadow-sm opacity-90 z-20">
                    <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                    <span className="font-medium">Code_Quality</span>
                </div>
            </div>

            <div className="absolute left-[470px] top-[280px] w-[180px] h-[40px] flex items-center font-mono text-xs">
                <div className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--code-border)] rounded-full z-10"></div>
                <div className="w-full h-full flex items-center gap-3 bg-[var(--background)] px-4 rounded-lg border border-[var(--code-border)] shadow-sm opacity-90 z-20">
                    <FileText className="w-4 h-4 text-[var(--info)]" />
                    <span className="font-medium">Review_Insights</span>
                </div>
            </div>
        </div>
    );
}

export function HeroAnimation() {
    const [mounted, setMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        setMounted(true);
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (!mounted) return null;

    return (
        <div className="relative w-full h-full min-h-[350px] md:min-h-[450px] flex items-center justify-center bg-[var(--code-bg)] overflow-hidden font-mono text-xs select-none">
            {/* Background Grid */}
            <div
                className="absolute inset-0 opacity-20"
                style={{
                    backgroundImage: `linear-gradient(to right, var(--code-border) 1px, transparent 1px), linear-gradient(to bottom, var(--code-border) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}
            />

            {/* Responsive Animation */}
            <div className="relative z-10">
                {isMobile ? <MobileAnimation /> : <DesktopAnimation />}
            </div>
        </div>
    );
}
