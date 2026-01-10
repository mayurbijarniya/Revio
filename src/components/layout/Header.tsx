"use client";

import Link from "next/link";
import Image from "next/image";
import { Github } from "lucide-react";
import { ThemeSwitcher } from "@/components/ui/shadcn-io/theme-switcher";


interface HeaderProps {
    user?: {
        githubUsername?: string | null;
        image?: string | null;
    } | null;
}

export function Header({ user }: HeaderProps) {
    const isAuthenticated = !!user;

    return (
        <header className="sticky top-0 z-50 bg-[var(--background)]/90 backdrop-blur-sm border-b border-[var(--code-border)]">
            <div className="grid grid-cols-12 h-16 w-full max-w-[1920px] mx-auto border-x border-[var(--code-border)]">
                <div className="col-span-3 lg:col-span-2 flex items-center px-6 border-r border-[var(--code-border)]">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="relative w-8 h-8">
                            <Image src="/logo.svg" alt="Revio" fill className="object-contain" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">Revio</span>
                    </Link>
                </div>

                <div className="col-span-6 lg:col-span-8 flex items-center px-6 border-r border-[var(--code-border)] hidden md:flex justify-between">
                    <nav className="flex items-center gap-8">
                        <Link href="/#features" className="text-xs font-mono font-medium text-[var(--foreground)]/60 hover:text-[var(--primary)] transition-colors uppercase tracking-wider">[ Features ]</Link>
                        <Link href="/#how-it-works" className="text-xs font-mono font-medium text-[var(--foreground)]/60 hover:text-[var(--primary)] transition-colors uppercase tracking-wider">[ How_it_Works ]</Link>
                        <Link href="/#pricing" className="text-xs font-mono font-medium text-[var(--foreground)]/60 hover:text-[var(--primary)] transition-colors uppercase tracking-wider">[ Pricing ]</Link>
                    </nav>
                    <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-[var(--foreground)]/40">
                        <span>SYSTEM_STATUS: ONLINE</span>
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    </div>
                </div>

                <div className="col-span-9 md:col-span-3 lg:col-span-2 flex items-center justify-end px-6 gap-3">
                    <ThemeSwitcher />
                    {isAuthenticated ? (
                        <Link
                            href="/dashboard"
                            className="text-sm font-bold bg-[var(--foreground)] text-[var(--background)] px-4 py-2 hover:opacity-90 transition-opacity"
                        >
                            DASHBOARD
                        </Link>
                    ) : (
                        <Link
                            href="/login"
                            className="flex items-center gap-2 text-sm font-bold bg-[var(--foreground)] text-[var(--background)] px-4 py-2 hover:opacity-90 transition-opacity"
                        >
                            <Github className="w-4 h-4" />
                            <span>LOGIN</span>
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
