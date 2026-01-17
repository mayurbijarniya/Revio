export default function AboutPage() {
    return (
        <div className="w-full max-w-[1920px] mx-auto border-x border-[var(--code-border)] flex-1 bg-[var(--background)] flex flex-col">
            <div className="p-12 lg:p-16 flex-1">
                <span className="font-mono text-xs font-medium text-[var(--primary)] mb-4 block">[ ABOUT_US ]</span>
                <h1 className="text-4xl sm:text-5xl font-bold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">ABOUT REVIO</h1>
                <div className="prose prose-invert max-w-3xl text-[var(--foreground)]/80 text-lg leading-relaxed">
                    <p>
                        Revio is building the intelligence layer for modern software development.
                        We believe code review should be autonomous, context-aware, and instant.
                    </p>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        We&apos;re building the future of code review.
                    </p>

                    <h2 className="text-2xl font-bold mt-12 mb-6 text-[var(--foreground)]">Our Technology</h2>
                    <p>
                        Revio v3.0 introduces AI Code Intelligence with graph-based code understanding.
                        Using AST parsing and vector embeddings, we map your entire codebase to understand
                        function relationships, call paths, and dependencies. This enables:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 mt-4">
                        <li><strong>Confidence Scoring (1-5)</strong> - Multi-factor merge readiness with issues, security, and complexity analysis</li>
                        <li><strong>Blast Radius Analysis</strong> - Visual impact analysis showing which functions and files are affected</li>
                        <li><strong>Interactive @revio-bot</strong> - Natural language conversations directly in PR comments</li>
                        <li><strong>Learning System</strong> - Auto-adapts to your team&apos;s feedback patterns</li>
                        <li><strong>Auto Docstrings</strong> - AI-generated documentation with one-click apply</li>
                    </ul>

                    <h2 className="text-2xl font-bold mt-12 mb-6 text-[var(--foreground)]">Enterprise Ready</h2>
                    <p>
                        Revio supports organizations with role-based access control, team analytics,
                        and custom review rules. Our GitHub App integration ensures secure, granular
                        permissions with bot-powered reviews that can approve PRs even from the author.
                    </p>

                    <h2 className="text-2xl font-bold mt-12 mb-6 text-[var(--foreground)]">Security First</h2>
                    <p>
                        With 40+ pattern-based security vulnerability detections, Revio catches
                        SSRF, SQLi, XSS, hardcoded secrets, and more before they reach production.
                        All code is processed in ephemeral, serverless environments with AES-256
                        encryption at rest.
                    </p>
                </div>
            </div>
        </div>
    );
}
