export default function PrivacyPage() {
    return (
        <div className="w-full max-w-[1920px] mx-auto border-x border-[var(--code-border)] flex-1 bg-[var(--background)] flex flex-col">
            <div className="p-12 lg:p-16 flex-1">
                <span className="font-mono text-xs font-medium text-[var(--primary)] mb-4 block">[ LEGAL_DOCS ]</span>
                <h1 className="text-4xl sm:text-5xl font-bold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">PRIVACY POLICY</h1>
                <div className="prose prose-invert max-w-3xl text-[var(--foreground)]/80">
                    <p className="font-mono text-sm text-[var(--foreground)]/50 mb-8">LAST_UPDATED: 2026-01-01</p>
                    <p className="mt-4">
                        At Revio, we take your privacy seriously. This policy describes how we collect, use, and protect your data.
                    </p>
                    <h3 className="text-xl font-bold mt-8 mb-4">1. Data Collection</h3>
                    <p>
                        We collect information necessary to provide our code review services, including repository metadata and code snippets for analysis.
                    </p>
                    <h3 className="text-xl font-bold mt-8 mb-4">2. Code Security</h3>
                    <p>
                        Your code is processed in ephemeral environments and is never used to train our models without explicit consent.
                    </p>
                </div>
            </div>
        </div>
    );
}
