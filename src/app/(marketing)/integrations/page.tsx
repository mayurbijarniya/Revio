import { Github, Brain, MessageSquare, Target, Zap } from "lucide-react";

// Standard Brand SVGs (Colored)
const GitlabIcon = () => (
    <svg role="img" viewBox="0 0 24 24" className="w-8 h-8">
        <path fill="#FC6D26" d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
        <path fill="#E24329" d="M2.24 9.68h19.52l-2.44 7.51L12 22.13 4.68 17.19l-2.44-7.51z" />
        <path fill="#FC6D26" d="M2.24 9.68h4.63l2.44-7.51L2.24 9.68zm14.89 0h4.63l-2.44-7.51-2.19 7.51z" />
    </svg>
);

const SlackIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="w-8 h-8">
        <path fill="#E01E5A" d="M53.841 161.32c0 14.832-11.987 26.82-26.819 26.82S.203 176.152.203 161.32c0-14.831 11.987-26.818 26.82-26.818H53.84zm13.41 0c0-14.831 11.987-26.818 26.819-26.818s26.819 11.987 26.819 26.819v67.047c0 14.832-11.987 26.82-26.82 26.82c-14.83 0-26.818-11.988-26.818-26.82z" />
        <path fill="#36C5F0" d="M94.07 53.638c-14.832 0-26.82-11.987-26.82-26.819S79.239 0 94.07 0s26.819 11.987 26.819 26.819v26.82zm0 13.613c14.832 0 26.819 11.987 26.819 26.819s-11.987 26.819-26.82 26.819H26.82C11.987 120.889 0 108.902 0 94.069c0-14.83 11.987-26.818 26.819-26.818z" />
        <path fill="#2EB67D" d="M201.55 94.07c0-14.832 11.987-26.82 26.818-26.82s26.82 11.988 26.82 26.82s-11.988 26.819-26.82 26.819H201.55zm-13.41 0c0 14.832-11.988 26.819-26.82 26.819c-14.831 0-26.818-11.987-26.818-26.82V26.82C134.502 11.987 146.489 0 161.32 0s26.819 11.987 26.819 26.819z" />
        <path fill="#ECB22E" d="M161.32 201.55c14.832 0 26.82 11.987 26.82 26.818s-11.988 26.82-26.82 26.82c-14.831 0-26.818-11.988-26.818-26.82V201.55zm0-13.41c-14.831 0-26.818-11.988-26.818-26.82c0-14.831 11.987-26.818 26.819-26.818h67.25c14.832 0 26.82 11.987 26.82 26.819s-11.988 26.819-26.82 26.819z" />
    </svg>
);



export default function IntegrationsPage() {
    return (
        <div className="w-full max-w-[1920px] mx-auto border-x border-[var(--code-border)] flex-1 bg-[var(--background)] flex flex-col">
            <div className="p-12 lg:p-16 flex-1">
                <span className="font-mono text-xs font-medium text-[var(--primary)] mb-4 block">[ CONNECTIVITY ]</span>
                <h1 className="text-4xl sm:text-5xl font-bold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">INTEGRATIONS</h1>
                <div className="max-w-4xl">
                    <p className="text-xl text-[var(--foreground)]/80 leading-relaxed mb-12">
                        Revio connects seamlessly with your existing workflow tools. Our AI Code Intelligence integrates natively with GitHub for powerful code review automation.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                        <div className="border border-[var(--code-border)] p-8 hover:border-[var(--primary)] transition-colors cursor-pointer group bg-[var(--background)]">
                            <div className="w-16 h-16 bg-[var(--code-bg)] rounded-lg mb-6 flex items-center justify-center border border-[var(--code-border)]">
                                <Github className="w-8 h-8 text-[var(--foreground)]" />
                            </div>
                            <h3 className="font-bold mb-2 group-hover:text-[var(--primary)] text-lg">GitHub</h3>
                            <p className="text-sm opacity-70">Native integration for PR comments, checks, and @revio-bot conversations.</p>
                        </div>
                        <div className="border border-[var(--code-border)] p-8 hover:border-[var(--primary)] transition-colors cursor-pointer group bg-[var(--background)]">
                            <div className="w-16 h-16 bg-[var(--code-bg)] rounded-lg mb-6 flex items-center justify-center border border-[var(--code-border)]">
                                <GitlabIcon />
                            </div>
                            <h3 className="font-bold mb-2 group-hover:text-[var(--primary)] text-lg">GitLab (Planned)</h3>
                            <p className="text-sm opacity-70">On roadmap. Core product support today is GitHub-first.</p>
                        </div>
                        <div className="border border-[var(--code-border)] p-8 hover:border-[var(--primary)] transition-colors cursor-pointer group bg-[var(--background)]">
                            <div className="w-16 h-16 bg-[var(--code-bg)] rounded-lg mb-6 flex items-center justify-center border border-[var(--code-border)]">
                                <SlackIcon />
                            </div>
                            <h3 className="font-bold mb-2 group-hover:text-[var(--primary)] text-lg">Slack (Planned)</h3>
                            <p className="text-sm opacity-70">Planned notifications workflow for review completion and critical findings.</p>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold mb-6 mt-16">[ AI_CODE_INTELLIGENCE ]</h2>
                    <p className="text-lg text-[var(--foreground)]/70 mb-8">
                        Revio v3.0 brings intelligent code understanding directly into your review workflow.
                    </p>

                    <h2 className="text-2xl font-bold mb-6 mt-12">[ RELIABILITY_UPDATES ]</h2>
                    <p className="text-lg text-[var(--foreground)]/70 mb-8">
                        v3.0.1 improved runtime reliability with stronger indexing cleanup, safer queue dispatch IDs,
                        and live indexing progress updates in dashboard views.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="border border-[var(--code-border)] p-6 bg-[var(--code-bg)] hover:border-[var(--primary)]/50 transition-colors">
                            <div className="flex items-center gap-3 mb-4">
                                <Brain className="w-6 h-6 text-[var(--primary)]" />
                                <h3 className="font-bold text-lg">Graph-Based Analysis</h3>
                            </div>
                            <p className="text-sm opacity-70 mb-3">
                                AST-powered code understanding that maps function relationships, call paths, and dependencies across your entire codebase.
                            </p>
                            <ul className="text-xs font-mono opacity-60 space-y-1">
                                <li>- Function call mapping</li>
                                <li>- Impact analysis</li>
                                <li>- Entry point detection</li>
                            </ul>
                        </div>

                        <div className="border border-[var(--code-border)] p-6 bg-[var(--code-bg)] hover:border-[var(--primary)]/50 transition-colors">
                            <div className="flex items-center gap-3 mb-4">
                                <Target className="w-6 h-6 text-[var(--primary)]" />
                                <h3 className="font-bold text-lg">Confidence Scoring</h3>
                            </div>
                            <p className="text-sm opacity-70 mb-3">
                                1-5 star merge readiness scores with multi-factor analysis including issues, security, and complexity impact.
                            </p>
                            <ul className="text-xs font-mono opacity-60 space-y-1">
                                <li>- Risk level assessment</li>
                                <li>- Security score (0-100)</li>
                                <li>- Quality metrics</li>
                            </ul>
                        </div>

                        <div className="border border-[var(--code-border)] p-6 bg-[var(--code-bg)] hover:border-[var(--primary)]/50 transition-colors">
                            <div className="flex items-center gap-3 mb-4">
                                <MessageSquare className="w-6 h-6 text-[var(--primary)]" />
                                <h3 className="font-bold text-lg">Interactive Bot</h3>
                            </div>
                            <p className="text-sm opacity-70 mb-3">
                                @revio-bot conversations in PR comments. Ask questions, get explanations, or trigger re-reviews naturally.
                            </p>
                            <ul className="text-xs font-mono opacity-60 space-y-1">
                                <li>- &quot;Explain this&quot;</li>
                                <li>- &quot;Why did you suggest X?&quot;</li>
                                <li>- &quot;Re-review&quot;</li>
                            </ul>
                        </div>

                        <div className="border border-[var(--code-border)] p-6 bg-[var(--code-bg)] hover:border-[var(--primary)]/50 transition-colors">
                            <div className="flex items-center gap-3 mb-4">
                                <Zap className="w-6 h-6 text-[var(--primary)]" />
                                <h3 className="font-bold text-lg">Learning System</h3>
                            </div>
                            <p className="text-sm opacity-70 mb-3">
                                Adapts to your team&apos;s feedback. Auto-suppresses low-value noise and learns from accepted/rejected suggestions.
                            </p>
                            <ul className="text-xs font-mono opacity-60 space-y-1">
                                <li>- Feedback-driven suppression</li>
                                <li>- Team preference profiles</li>
                                <li>- Adoption tracking</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
