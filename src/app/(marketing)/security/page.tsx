export default function SecurityPage() {
    return (
        <div className="w-full max-w-[1920px] mx-auto border-x border-[var(--code-border)] flex-1 bg-[var(--background)] flex flex-col">
            <div className="p-8 lg:p-16 flex-1">
                <span className="font-mono text-xs font-medium text-[var(--primary)] mb-4 block">[ INFRASTRUCTURE ]</span>
                <h1 className="text-4xl sm:text-5xl font-bold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 uppercase tracking-tight">Security Posture</h1>

                <div className="max-w-4xl">
                    <p className="text-xl text-[var(--foreground)]/80 leading-relaxed mb-12 font-light">
                        Security is the core of Revio. We don&apos;t just analyze your code for vulnerabilities;
                        we secure your data with enterprise-grade protocols at every layer of the stack.
                        Our AI Code Intelligence combines 40+ pattern-based security checks with learning
                        systems that adapt to your team&apos;s coding standards.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mb-16">
                        <div className="border border-[var(--code-border)] p-8 bg-[var(--code-bg)] hover:border-[var(--primary)]/50 transition-all group">
                            <h3 className="font-mono text-[10px] font-bold mb-4 uppercase text-[var(--primary)]">[ SCANNING_ENGINE ]</h3>
                            <h4 className="text-xl font-bold mb-3">40+ Vulnerability Patterns</h4>
                            <p className="text-sm opacity-60 leading-relaxed mb-4">
                                Our integrated security scanner performs deep pattern analysis on every pull request to detect:
                            </p>
                            <ul className="space-y-2 text-xs font-mono opacity-80">
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[var(--primary)]"></span> SSRF & SQL Injection</li>
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[var(--primary)]"></span> Hardcoded Secrets & API Keys</li>
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[var(--primary)]"></span> XSS & Command Injection</li>
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[var(--primary)]"></span> Weak Cryptographic Protocols</li>
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[var(--primary)]"></span> Authentication & Authorization Issues</li>
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[var(--primary)]"></span> CORS & Configuration Flaws</li>
                            </ul>
                        </div>

                        <div className="border border-[var(--code-border)] p-8 bg-[var(--code-bg)] hover:border-[var(--primary)]/50 transition-all group">
                            <h3 className="font-mono text-[10px] font-bold mb-4 uppercase text-[var(--primary)]">[ CODING_STANDARDS ]</h3>
                            <h4 className="text-xl font-bold mb-3">Auto-Detected Compliance</h4>
                            <p className="text-sm opacity-60 leading-relaxed mb-4">
                                Revio automatically detects and enforces your team&apos;s coding standards from:
                            </p>
                            <ul className="space-y-2 text-xs font-mono opacity-80">
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[var(--primary)]"></span> .claude.md / CLAUDE.md</li>
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[var(--primary)]"></span> .cursorrules</li>
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[var(--primary)]"></span> agents.md / .windsurf.md</li>
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[var(--primary)]"></span> .aider/ and .ai/ directories</li>
                            </ul>
                        </div>

                        <div className="border border-[var(--code-border)] p-8 bg-[var(--code-bg)] hover:border-[var(--primary)]/50 transition-all">
                            <h3 className="font-mono text-[10px] font-bold mb-4 uppercase text-[var(--primary)]">[ ENCRYPTION ]</h3>
                            <h4 className="text-xl font-bold mb-3">AES-256 & TLS 1.3</h4>
                            <p className="text-sm opacity-60 leading-relaxed">
                                All GitHub access tokens are encrypted at rest using AES-256-GCM.
                                Data in transit is protected by TLS 1.3 with Perfect Forward Secrecy.
                                Encryption keys are rotated regularly and managed via isolated KMS.
                            </p>
                        </div>

                        <div className="border border-[var(--code-border)] p-8 bg-[var(--code-bg)] hover:border-[var(--primary)]/50 transition-all">
                            <h3 className="font-mono text-[10px] font-bold mb-4 uppercase text-[var(--primary)]">[ ARCHITECTURE ]</h3>
                            <h4 className="text-xl font-bold mb-3">Serverless Isolation</h4>
                            <p className="text-sm opacity-60 leading-relaxed">
                                Code analysis is performed in stateless, ephemeral environments.
                                No local clones are stored; Revio retrieves only the necessary blobs
                                via the GitHub API and purges all memory immediately after processing.
                            </p>
                        </div>

                        <div className="border border-[var(--code-border)] p-8 bg-[var(--code-bg)] hover:border-[var(--primary)]/50 transition-all">
                            <h3 className="font-mono text-[10px] font-bold mb-4 uppercase text-[var(--primary)]">[ AUTHENTICATION ]</h3>
                            <h4 className="text-xl font-bold mb-3">GitHub App Protocol</h4>
                            <p className="text-sm opacity-60 leading-relaxed">
                                We utilize the GitHub App framework for granular, per-repository permissions.
                                Revio never requests more access than needed, and you can revoke
                                access instantly via the GitHub Dashboard.
                            </p>
                        </div>

                        <div className="border border-[var(--code-border)] p-8 bg-[var(--code-bg)] hover:border-[var(--primary)]/50 transition-all">
                            <h3 className="font-mono text-[10px] font-bold mb-4 uppercase text-[var(--primary)]">[ LEARNING_SECURITY ]</h3>
                            <h4 className="text-xl font-bold mb-3">Adaptive Threat Detection</h4>
                            <p className="text-sm opacity-60 leading-relaxed">
                                Our learning system analyzes your team&apos;s feedback to reduce noise
                                while never suppressing critical security issues. Safety guards ensure
                                vulnerabilities are never auto-suppressed regardless of feedback patterns.
                            </p>
                        </div>
                    </div>

                    {/* Policy Banner */}
                    <div className="border-y border-[var(--code-border)] py-12 flex flex-col md:flex-row items-center gap-8 px-4">
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold mb-2">ZERO-TRUST DATA POLICY</h3>
                            <p className="text-sm opacity-60 max-w-lg">
                                We do not use your source code to train our base AI models.
                                Your proprietary logic remains your own, used only to provide context for your specific reviews.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center px-4 py-3 border border-[var(--code-border)] font-mono text-[10px] font-bold">SOC2_READY</div>
                            <div className="text-center px-4 py-3 border border-[var(--code-border)] font-mono text-[10px] font-bold">GDPR_READY</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
