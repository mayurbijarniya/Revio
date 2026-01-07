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
                </div>
            </div>
        </div>
    );
}
