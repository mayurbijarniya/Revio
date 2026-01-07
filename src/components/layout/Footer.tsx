import Link from "next/link";
import Image from "next/image";
import { Github, Globe } from "lucide-react";

export function Footer() {
    return (
        <footer className="py-12 px-6 bg-[var(--code-bg)] border-t border-[var(--code-border)]">
            <div className="w-full max-w-[1920px] mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <div className="relative w-6 h-6">
                                <Image src="/logo.svg" alt="Revio" fill className="object-contain grayscale" />
                            </div>
                            <span className="font-bold tracking-tight">REVIO</span>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-mono text-xs font-medium text-[var(--foreground)]/40 mb-4">[ PRODUCT ]</h4>
                        <ul className="space-y-2 text-sm text-[var(--foreground)]/70">
                            <li><Link href="/#features" className="hover:text-[var(--primary)]">Features</Link></li>
                            <li><Link href="/integrations" className="hover:text-[var(--primary)]">Integrations</Link></li>
                            <li><Link href="/#pricing" className="hover:text-[var(--primary)]">Pricing</Link></li>
                            <li><Link href="/changelog" className="hover:text-[var(--primary)]">Changelog</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-mono text-xs font-medium text-[var(--foreground)]/40 mb-4">[ RESOURCES ]</h4>
                        <ul className="space-y-2 text-sm text-[var(--foreground)]/70">
                            {/* Documentation removed as requested */}
                            <li><Link href="/api-reference" className="hover:text-[var(--primary)]">API Reference</Link></li>
                            <li><Link href="/community" className="hover:text-[var(--primary)]">Community</Link></li>
                            <li><Link href="/docs" className="hover:text-[var(--primary)]">Documentation</Link></li>
                            <li><Link href="/demo" className="hover:text-[var(--primary)]">Live Demo</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-mono text-xs font-medium text-[var(--foreground)]/40 mb-4">[ LEGAL ]</h4>
                        <ul className="space-y-2 text-sm text-[var(--foreground)]/70">
                            <li><Link href="/privacy" className="hover:text-[var(--primary)]">Privacy</Link></li>
                            <li><Link href="/terms" className="hover:text-[var(--primary)]">Terms</Link></li>
                            <li><Link href="/security" className="hover:text-[var(--primary)]">Security</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="border-t border-[var(--code-border)] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-[var(--foreground)]/40 font-mono">
                        © {new Date().getFullYear()} REVIO INC. ALL SYSTEMS NOMINAL.
                    </p>
                    <div className="flex gap-4">
                        <a href="#" className="opacity-40 hover:opacity-100 transition-opacity"><Github className="w-5 h-5" /></a>
                        <a href="#" className="opacity-40 hover:opacity-100 transition-opacity"><Globe className="w-5 h-5" /></a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
