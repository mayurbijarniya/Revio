import Link from "next/link";
import Image from "next/image";
import { Github, Globe } from "lucide-react";

export function Footer() {
    return (
        <footer className="py-8 sm:py-12 px-4 sm:px-6 bg-[var(--code-bg)] border-t border-[var(--code-border)]">
            <div className="w-full max-w-[1920px] mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-12">
                    <div className="col-span-2 md:col-span-1 mb-4 md:mb-0">
                        <div className="flex items-center gap-2 mb-4 sm:mb-6">
                            <div className="relative w-5 h-5 sm:w-6 sm:h-6">
                                <Image src="/logo.svg" alt="Revio" fill className="object-contain grayscale" />
                            </div>
                            <span className="font-bold tracking-tight text-sm sm:text-base">REVIO</span>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-mono text-[10px] sm:text-xs font-medium text-[var(--foreground)]/40 mb-3 sm:mb-4">[ PRODUCT ]</h4>
                        <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-[var(--foreground)]/70">
                            <li><Link href="/#features" className="hover:text-[var(--primary)]">Features</Link></li>
                            <li><Link href="/integrations" className="hover:text-[var(--primary)]">Integrations</Link></li>
                            <li><Link href="/#pricing" className="hover:text-[var(--primary)]">Pricing</Link></li>
                            <li><Link href="/changelog" className="hover:text-[var(--primary)]">Changelog</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-mono text-[10px] sm:text-xs font-medium text-[var(--foreground)]/40 mb-3 sm:mb-4">[ RESOURCES ]</h4>
                        <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-[var(--foreground)]/70">
                            <li><Link href="/about" className="hover:text-[var(--primary)]">About</Link></li>
                            <li><Link href="/docs" className="hover:text-[var(--primary)]">Documentation</Link></li>
                            <li><Link href="/community" className="hover:text-[var(--primary)]">Community</Link></li>
                            <li><Link href="/demo" className="hover:text-[var(--primary)]">Live Demo</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-mono text-[10px] sm:text-xs font-medium text-[var(--foreground)]/40 mb-3 sm:mb-4">[ LEGAL ]</h4>
                        <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-[var(--foreground)]/70">
                            <li><Link href="/privacy" className="hover:text-[var(--primary)]">Privacy</Link></li>
                            <li><Link href="/terms" className="hover:text-[var(--primary)]">Terms</Link></li>
                            <li><Link href="/security" className="hover:text-[var(--primary)]">Security</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="border-t border-[var(--code-border)] pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
                    <p className="text-[10px] sm:text-xs text-[var(--foreground)]/40 font-mono text-center md:text-left">
                        © {new Date().getFullYear()} REVIO INC. ALL SYSTEMS NOMINAL.
                    </p>
                    <div className="flex gap-4">
                        <a href="#" className="opacity-40 hover:opacity-100 transition-opacity"><Github className="w-4 h-4 sm:w-5 sm:h-5" /></a>
                        <a href="#" className="opacity-40 hover:opacity-100 transition-opacity"><Globe className="w-4 h-4 sm:w-5 sm:h-5" /></a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
