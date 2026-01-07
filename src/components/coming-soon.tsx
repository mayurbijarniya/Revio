import Link from "next/link";
import { Construction } from "lucide-react";

export default function ComingSoon() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
            <div className="w-20 h-20 bg-[var(--code-bg)] rounded-2xl flex items-center justify-center mb-8 border border-[var(--code-border)] animate-pulse">
                <Construction className="w-10 h-10 text-[var(--primary)]" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 font-mono">[ COMING_SOON ]</h1>
            <p className="text-xl text-[var(--foreground)]/60 max-w-md mb-10 leading-relaxed">
                We are currently building this resource. Check back later for updates.
            </p>
            <Link
                href="/"
                className="px-8 py-3 bg-[var(--foreground)] text-[var(--background)] font-mono font-bold text-sm tracking-wide hover:bg-[var(--primary)] transition-colors uppercase"
            >
                Return_Home
            </Link>
        </div>
    );
}
