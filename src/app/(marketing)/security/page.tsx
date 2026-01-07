export default function SecurityPage() {
    return (
        <div className="w-full max-w-[1920px] mx-auto border-x border-[var(--code-border)] flex-1 bg-[var(--background)] flex flex-col">
            <div className="p-12 lg:p-16 flex-1">
                <span className="font-mono text-xs font-medium text-[var(--primary)] mb-4 block">[ INFRASTRUCTURE ]</span>
                <h1 className="text-4xl sm:text-5xl font-bold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">SECURITY POSTURE</h1>
                <div className="max-w-4xl">
                    <p className="text-xl text-[var(--foreground)]/80 leading-relaxed mb-12">
                        Security is not an afterthought at Revio; it is the core of our business.
                        We utilize state-of-the-art encryption and isolation techniques.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="border border-[var(--code-border)] p-8 bg-[var(--code-bg)] hover:border-[var(--primary)] transition-colors">
                            <h3 className="font-mono text-sm font-bold mb-3 uppercase">[ COMPLIANCE ]</h3>
                            <h4 className="text-xl font-bold mb-2">SOC 2 Type II</h4>
                            <p className="text-sm opacity-70 leading-relaxed">We are currently undergoing our SOC 2 Type II audit to ensure we meet the highest standards of data security.</p>
                        </div>
                        <div className="border border-[var(--code-border)] p-8 bg-[var(--code-bg)] hover:border-[var(--primary)] transition-colors">
                            <h3 className="font-mono text-sm font-bold mb-3 uppercase">[ ENCRYPTION ]</h3>
                            <h4 className="text-xl font-bold mb-2">AES-256 & TLS 1.3</h4>
                            <p className="text-sm opacity-70 leading-relaxed">All data is encrypted at rest using AES-256 and in transit using TLS 1.3. Keys are managed via AWS KMS.</p>
                        </div>
                        <div className="border border-[var(--code-border)] p-8 bg-[var(--code-bg)] hover:border-[var(--primary)] transition-colors">
                            <h3 className="font-mono text-sm font-bold mb-3 uppercase">[ ARCHITECTURE ]</h3>
                            <h4 className="text-xl font-bold mb-2">Ephemeral Sandboxes</h4>
                            <p className="text-sm opacity-70 leading-relaxed">Code analysis occurs in isolated, stateless Firecracker microVMs that are destroyed immediately after processing.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
