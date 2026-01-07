export default function TermsPage() {
    return (
        <div className="w-full max-w-[1920px] mx-auto border-x border-[var(--code-border)] flex-1 bg-[var(--background)] flex flex-col">
            <div className="p-12 lg:p-16 flex-1">
                <span className="font-mono text-xs font-medium text-[var(--primary)] mb-4 block">[ LEGAL_DOCS ]</span>
                <h1 className="text-4xl sm:text-5xl font-bold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">TERMS OF SERVICE</h1>
                <div className="prose prose-invert max-w-3xl text-[var(--foreground)]/80">
                    <p className="font-mono text-sm text-[var(--foreground)]/50 mb-8">LAST_UPDATED: 2026-01-01</p>
                    <p className="mb-4">
                        The code, design, and content are protected by copyright. You may not reproduce our &quot;look and feel&quot; without written permission.
                    </p>
                    <h3 className="text-xl font-bold mt-8 mb-4">1. Usage Limits</h3>
                    <p>
                        Usage of the platform is subject to the limits of your selected plan (Starter, Pro, or Enterprise).
                    </p>
                    <h3 className="text-xl font-bold mt-8 mb-4">2. Liability</h3>
                    <p>
                        Revio is provided &quot;as is&quot;. We are not liable for any damages arising from the use of our automated code reviews.
                    </p>
                </div>
            </div>
        </div>
    );
}
