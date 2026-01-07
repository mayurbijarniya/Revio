export default function ChangelogPage() {
    return (
        <div className="w-full max-w-[1920px] mx-auto border-x border-[var(--code-border)] flex-1 bg-[var(--background)] flex flex-col">
            <div className="p-12 lg:p-16 flex-1">
                <span className="font-mono text-xs font-medium text-[var(--primary)] mb-4 block">[ SYSTEM_UPDATES ]</span>
                <h1 className="text-4xl sm:text-5xl font-bold mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">CHANGELOG</h1>

                <div className="space-y-16 max-w-3xl">
                    {/* Latest Release */}
                    <div className="relative pl-8 border-l border-[var(--code-border)]">
                        <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-[var(--primary)] ring-4 ring-[var(--background)]"></div>
                        <span className="font-mono text-xs text-[var(--foreground)]/50 mb-3 block">JANUARY 6, 2026</span>
                        <div className="inline-block px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-mono font-bold rounded-full mb-4">v2.0.0</div>
                        <h3 className="text-2xl font-bold mb-4">Enterprise Customization & UI Overhaul</h3>
                        <div className="prose prose-invert prose-sm text-[var(--foreground)]/80">
                            <p className="mb-4">
                                Top-to-bottom redesign of the review interface and the introduction of the Rule Engine.
                            </p>
                            <ul className="list-disc pl-4 space-y-2">
                                <li><strong>Custom Review Rules:</strong> Define per-repo linting rules (no-console-log, secrets-check) in `src/types/review.ts`.</li>
                                <li><strong>Refined Interface:</strong> Clean, minimalist chat interface focused on readability and code context.</li>
                                <li><strong>Feedback Loop:</strong> New thumbs-up/down feedback system for AI comments.</li>
                                <li><strong>Shareable Links:</strong> Unique URLs for every conversation, making collaboration easy.</li>
                                <li><strong>Review Policies:</strong> Configure severity thresholds and blocking rules per repository.</li>
                                <li><strong>Performance:</strong> Optimized multi-repo context retrieval.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Previous Release */}
                    <div className="relative pl-8 border-l border-[var(--code-border)]">
                        <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-[var(--code-border)] ring-4 ring-[var(--background)]"></div>
                        <span className="font-mono text-xs text-[var(--foreground)]/50 mb-3 block">DECEMBER 15, 2025</span>
                        <div className="inline-block px-3 py-1 bg-[var(--code-bg)] text-[var(--foreground)]/70 text-xs font-mono font-bold rounded-full mb-4">v1.5.0</div>
                        <h3 className="text-2xl font-bold mb-4">Semantic Search & Vector Indexing</h3>
                        <div className="prose prose-invert prose-sm text-[var(--foreground)]/80">
                            <ul className="list-disc pl-4 space-y-2">
                                <li><strong>Natural Language Search:</strong> Ask questions about your codebase in plain English.</li>
                                <li><strong>Vector Embedding:</strong> Files are now indexed using Qdrant for semantic understanding.</li>
                                <li><strong>Traceability:</strong> AI responses now cite specific file lines and commits.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
