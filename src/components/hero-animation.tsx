"use client";

import { useEffect, useState } from "react";
import { GitPullRequest, GitBranch, ShieldCheck, FileText, CheckCircle2 } from "lucide-react";
import Image from "next/image";

export function HeroAnimation() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div className="relative w-full h-full min-h-[450px] flex items-center justify-center bg-[var(--code-bg)] overflow-hidden font-mono text-xs select-none">

            {/* Background Grid */}
            <div
                className="absolute inset-0 opacity-20"
                style={{
                    backgroundImage: `linear-gradient(to right, var(--code-border) 1px, transparent 1px), linear-gradient(to bottom, var(--code-border) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}
            />

            {/* Container for the Flow Diagram - Compacted to 700px */}
            <div className="relative z-10 w-[700px] h-[400px]">

                {/* SVG Layer for Connections */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-[var(--code-border)]" viewBox="0 0 700 400">
                    <defs>
                        <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="var(--code-border)" stopOpacity="0.2" />
                            <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.5" />
                            <stop offset="100%" stopColor="var(--code-border)" stopOpacity="0.2" />
                        </linearGradient>
                    </defs>

                    {/* 
                         COMPACT COORDINATE MAP (Total Width 700px):
                         Left Inputs Right Edge: x=230 (Start 30, Width 200)
                                - Top (PR): y=100
                                - Bottom (Main): y=300
                         
                         Center Engine: Center=(350, 200), Radius=64 -> Left Edge x=286, Right Edge x=414
                         
                         Right Outputs Left Edge: x=470 (Width 180, End 650)
                                - Top (Security): y=100
                                - Mid (Quality): y=200
                                - Bottom (Insights): y=300
                    */}

                    {/* PATHS: LEFT -> CENTER */}
                    {/* Path 1: Top Left (230,100) -> Engine Left (286, 200) */}
                    <path d="M 230 100 C 258 100, 258 200, 286 200" fill="none" strokeWidth="1" className="opacity-50" />

                    {/* Path 2: Bottom Left (230,300) -> Engine Left (286, 200) */}
                    <path d="M 230 300 C 258 300, 258 200, 286 200" fill="none" strokeWidth="1" className="opacity-50" />

                    {/* PATHS: CENTER -> RIGHT */}
                    {/* Path 3: Engine Right (414, 200) -> Top Right (470, 100) */}
                    <path d="M 414 200 C 442 200, 442 100, 470 100" fill="none" strokeWidth="1" className="opacity-50" />

                    {/* Path 4: Engine Right (414, 200) -> Mid Right (470, 200) */}
                    <path d="M 414 200 L 470 200" fill="none" strokeWidth="1" className="opacity-50" />

                    {/* Path 5: Engine Right (414, 200) -> Bottom Right (470, 300) */}
                    <path d="M 414 200 C 442 200, 442 300, 470 300" fill="none" strokeWidth="1" className="opacity-50" />

                    {/* --- ANIMATED PARTICLES (SVG) --- */}

                    {/* Particle 1: Top Left -> Center */}
                    <circle r="3" fill="var(--info)">
                        <animateMotion dur="3s" repeatCount="indefinite" path="M 230 100 C 258 100, 258 200, 286 200" keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="3s" repeatCount="indefinite" />
                    </circle>

                    {/* Particle 2: Bottom Left -> Center */}
                    <circle r="3" fill="var(--warning)">
                        <animateMotion dur="3s" begin="1.5s" repeatCount="indefinite" path="M 230 300 C 258 300, 258 200, 286 200" keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="3s" begin="1.5s" repeatCount="indefinite" />
                    </circle>

                    {/* Particle 3: Center -> Top Right (Security) */}
                    <circle r="2.5" fill="var(--error)">
                        <animateMotion dur="2s" begin="0.8s" repeatCount="indefinite" path="M 414 200 C 442 200, 442 100, 470 100" keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2s" begin="0.8s" repeatCount="indefinite" />
                    </circle>

                    {/* Particle 4: Center -> Mid Right (Quality) */}
                    <circle r="2.5" fill="var(--success)">
                        <animateMotion dur="2s" begin="1.2s" repeatCount="indefinite" path="M 414 200 L 470 200" keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2s" begin="1.2s" repeatCount="indefinite" />
                    </circle>

                    {/* Particle 5: Center -> Bottom Right (Insights) */}
                    <circle r="2.5" fill="var(--info)">
                        <animateMotion dur="2s" begin="1.6s" repeatCount="indefinite" path="M 414 200 C 442 200, 442 300, 470 300" keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2s" begin="1.6s" repeatCount="indefinite" />
                    </circle>
                </svg>

                {/* --- LEFT SIDE: INPUTS (Absolute) --- */}

                {/* Input 1: Top Left (PR) */}
                <div className="absolute left-[30px] top-[70px] w-[200px] h-[60px] group">
                    {/* Connector Dot */}
                    <div className="absolute right-[-2px] top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--code-border)] rounded-full z-10"></div>
                    {/* Card */}
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

                {/* Input 2: Bottom Left (Branch) */}
                <div className="absolute left-[30px] top-[270px] w-[200px] h-[60px] group">
                    {/* Connector Dot */}
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

                {/* --- CENTER: PROCESS ENGINE (Absolute) --- */}
                {/* Center Point: 350, 200. Size: 128x128 (w-32) - Left=286 */}
                <div className="absolute left-[286px] top-[136px] w-32 h-32 flex items-center justify-center z-30">
                    <div className="absolute inset-[-20px] bg-[var(--primary)]/5 rounded-full animate-pulse"></div>
                    <div className="absolute inset-[-40px] border border-[var(--primary)]/10 rounded-full animate-spin-slow" style={{ animationDuration: '20s' }}></div>

                    <div className="relative w-full h-full bg-[var(--background)] border-2 border-[var(--primary)] rounded-full flex flex-col items-center justify-center shadow-xl shadow-[var(--primary)]/10 z-20">
                        <Image src="/logo.svg" alt="Revio Core" width={48} height={48} className="object-contain mb-2" />
                        <span className="text-[10px] font-bold text-[var(--primary)] tracking-wider">ENGINE</span>

                        <div className="absolute -bottom-3 px-3 py-1 bg-[var(--background)] border border-[var(--success)] rounded-full flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-[var(--success)] rounded-full animate-pulse"></div>
                            <span className="text-[9px] font-bold text-[var(--success)]">ACTIVE</span>
                        </div>
                    </div>
                </div>

                {/* --- RIGHT SIDE: OUTPUTS (Absolute) --- */}

                {/* Output 1: Security (Top) - Left=470 */}
                <div className="absolute left-[470px] top-[80px] w-[180px] h-[40px] flex items-center">
                    <div className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--code-border)] rounded-full z-10"></div>
                    <div className="w-full h-full flex items-center gap-3 bg-[var(--background)] px-4 rounded-lg border border-[var(--code-border)] shadow-sm opacity-90 z-20">
                        <ShieldCheck className="w-4 h-4 text-[var(--error)]" />
                        <span className="font-medium">Security_Scan</span>
                    </div>
                </div>

                {/* Output 2: Quality (Mid) */}
                <div className="absolute left-[470px] top-[180px] w-[180px] h-[40px] flex items-center">
                    <div className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--code-border)] rounded-full z-10"></div>
                    <div className="w-full h-full flex items-center gap-3 bg-[var(--background)] px-4 rounded-lg border border-[var(--code-border)] shadow-sm opacity-90 z-20">
                        <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                        <span className="font-medium">Code_Quality</span>
                    </div>
                </div>

                {/* Output 3: Insights (Bottom) */}
                <div className="absolute left-[470px] top-[280px] w-[180px] h-[40px] flex items-center">
                    <div className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--code-border)] rounded-full z-10"></div>
                    <div className="w-full h-full flex items-center gap-3 bg-[var(--background)] px-4 rounded-lg border border-[var(--code-border)] shadow-sm opacity-90 z-20">
                        <FileText className="w-4 h-4 text-[var(--info)]" />
                        <span className="font-medium">Review_Insights</span>
                    </div>
                </div>
            </div>

            <style jsx>{`
                /* No CSS animations needed for particles anymore! SVG animateMotion handles it all. */
            `}</style>
        </div>
    );
}
