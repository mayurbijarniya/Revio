"use client";

import { useEffect, useState } from "react";
import { GitPullRequest, GitBranch, ShieldCheck, FileText, CheckCircle2 } from "lucide-react";
import Image from "next/image";

function MobileAnimation() {
    // Same ~56px gap as desktop (card edge → engine edge)
    // Input cards: bottom=102, engine top=158 → gap=56px
    // Output cards: top=354, engine exit=298 → gap=56px
    const inBottom = 102, engineTop = 158, engineExit = 298, outTop = 354;
    const cx1 = 91, cx2 = 269;
    const ox1 = 60, ox2 = 176, ox3 = 292;

    const pathPR   = `M ${cx1} ${inBottom} C ${cx1} 130, 180 130, 180 ${engineTop}`;
    const pathMain = `M ${cx2} ${inBottom} C ${cx2} 130, 180 130, 180 ${engineTop}`;
    const pathSec  = `M 180 ${engineExit} C 180 326, ${ox1} 326, ${ox1} ${outTop}`;
    const pathQual = `M 180 ${engineExit} L ${ox2} ${outTop}`;
    const pathIns  = `M 180 ${engineExit} C 180 326, ${ox3} 326, ${ox3} ${outTop}`;

    return (
        <div className="relative w-[360px] h-[420px]">
            <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-[var(--code-border)]" viewBox="0 0 360 420">
                <path d={pathPR}   fill="none" strokeWidth="1" className="opacity-50" />
                <path d={pathMain} fill="none" strokeWidth="1" className="opacity-50" />
                <path d={pathSec}  fill="none" strokeWidth="1" className="opacity-50" />
                <path d={pathQual} fill="none" strokeWidth="1" className="opacity-50" />
                <path d={pathIns}  fill="none" strokeWidth="1" className="opacity-50" />

                <circle r="3" fill="#60a5fa">
                    <animateMotion dur="2.5s" repeatCount="indefinite" path={pathPR} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <circle r="3" fill="#f59e0b">
                    <animateMotion dur="2.5s" begin="1.2s" repeatCount="indefinite" path={pathMain} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" begin="1.2s" repeatCount="indefinite" />
                </circle>
                <circle r="2.5" fill="#ef4444">
                    <animateMotion dur="2s" begin="0.5s" repeatCount="indefinite" path={pathSec} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2s" begin="0.5s" repeatCount="indefinite" />
                </circle>
                <circle r="2.5" fill="#22c55e">
                    <animateMotion dur="2s" begin="1s" repeatCount="indefinite" path={pathQual} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2s" begin="1s" repeatCount="indefinite" />
                </circle>
                <circle r="2.5" fill="#60a5fa">
                    <animateMotion dur="2s" begin="1.5s" repeatCount="indefinite" path={pathIns} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2s" begin="1.5s" repeatCount="indefinite" />
                </circle>
            </svg>

            <div className="absolute left-[10px] top-[52px] w-[162px] h-[50px] font-mono text-xs z-20">
                <div className="absolute bottom-[-3px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--code-border)] rounded-full z-10" />
                <div className="w-full h-full flex items-center gap-3 bg-[var(--background)] px-3 rounded-lg border border-[var(--code-border)] shadow-sm relative z-20">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded shrink-0">
                        <GitPullRequest className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <div>
                        <div className="font-bold text-[var(--foreground)]">PR #421</div>
                        <div className="text-[9px] text-[var(--foreground)]/50">feat/auth-flow</div>
                    </div>
                </div>
            </div>

            <div className="absolute left-[188px] top-[52px] w-[162px] h-[50px] font-mono text-xs z-20">
                <div className="absolute bottom-[-3px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--code-border)] rounded-full z-10" />
                <div className="w-full h-full flex items-center gap-3 bg-[var(--background)] px-3 rounded-lg border border-[var(--code-border)] shadow-sm relative z-20">
                    <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded shrink-0">
                        <GitBranch className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div>
                        <div className="font-bold text-[var(--foreground)]">main</div>
                        <div className="text-[9px] text-[var(--foreground)]/50">Production Branch</div>
                    </div>
                </div>
            </div>

            <div className="absolute left-[116px] top-[158px] w-[128px] h-[128px] flex items-center justify-center z-30 font-mono">
                <div className="absolute inset-[-20px] bg-[#4F46E5]/5 rounded-full animate-pulse" />
                <div className="absolute inset-[-40px] border border-[#4F46E5]/10 rounded-full animate-spin" style={{ animationDuration: '20s' }} />
                <div className="relative w-full h-full bg-[var(--background)] border-2 border-[#4F46E5] rounded-full flex flex-col items-center justify-center shadow-xl shadow-[#4F46E5]/10 z-20">
                    <Image src="/logo.svg" alt="Revio" width={40} height={40} className="object-contain mb-1" />
                    <span className="text-[10px] font-bold text-[#4F46E5] tracking-wider">ENGINE</span>
                    <div className="absolute -bottom-3 px-2.5 py-0.5 bg-[var(--background)] border border-green-500 rounded-full flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[8px] font-bold text-green-600 dark:text-green-400">ACTIVE</span>
                    </div>
                </div>
            </div>

            <div className="absolute left-[8px] top-[354px] w-[104px] h-[40px] flex items-center font-mono text-xs z-20">
                <div className="absolute top-[-3px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--code-border)] rounded-full z-10" />
                <div className="w-full h-full flex items-center gap-2 bg-[var(--background)] px-3 rounded-lg border border-[var(--code-border)] shadow-sm z-20">
                    <ShieldCheck className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="font-medium text-[var(--foreground)]">Security</span>
                </div>
            </div>

            <div className="absolute left-[124px] top-[354px] w-[104px] h-[40px] flex items-center font-mono text-xs z-20">
                <div className="absolute top-[-3px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--code-border)] rounded-full z-10" />
                <div className="w-full h-full flex items-center gap-2 bg-[var(--background)] px-3 rounded-lg border border-[var(--code-border)] shadow-sm z-20">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    <span className="font-medium text-[var(--foreground)]">Quality</span>
                </div>
            </div>

            <div className="absolute left-[240px] top-[354px] w-[104px] h-[40px] flex items-center font-mono text-xs z-20">
                <div className="absolute top-[-3px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--code-border)] rounded-full z-10" />
                <div className="w-full h-full flex items-center gap-2 bg-[var(--background)] px-3 rounded-lg border border-[var(--code-border)] shadow-sm z-20">
                    <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="font-medium text-[var(--foreground)]">Insights</span>
                </div>
            </div>
        </div>
    );
}

function DesktopAnimation() {
    return (
        <div className="relative w-[700px] h-[400px]">
            <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-[var(--code-border)]" viewBox="0 0 700 400">
                <path d="M 230 100 C 258 100, 258 200, 286 200" fill="none" strokeWidth="1" className="opacity-50" />
                <path d="M 230 300 C 258 300, 258 200, 286 200" fill="none" strokeWidth="1" className="opacity-50" />
                <path d="M 414 200 C 442 200, 442 100, 470 100" fill="none" strokeWidth="1" className="opacity-50" />
                <path d="M 414 200 L 470 200" fill="none" strokeWidth="1" className="opacity-50" />
                <path d="M 414 200 C 442 200, 442 300, 470 300" fill="none" strokeWidth="1" className="opacity-50" />

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
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (!mounted) return null;

    return (
        <div className="relative w-full h-full min-h-[350px] md:min-h-[450px] flex items-center justify-center bg-[var(--code-bg)] overflow-hidden font-mono text-xs select-none">
            <div
                className="absolute inset-0 opacity-20"
                style={{
                    backgroundImage: `linear-gradient(to right, var(--code-border) 1px, transparent 1px), linear-gradient(to bottom, var(--code-border) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}
            />

            <div className="relative z-10 w-full flex items-center justify-center">
                {isMobile ? (
                    <div className="scale-[0.7] sm:scale-[0.85] md:scale-[0.95] origin-center">
                        <MobileAnimation />
                    </div>
                ) : (
                    <div className="scale-[0.75] xl:scale-[0.95] 2xl:scale-100 origin-center">
                        <DesktopAnimation />
                    </div>
                )}
            </div>
        </div>
    );
}
