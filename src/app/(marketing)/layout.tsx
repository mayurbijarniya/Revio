import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getSession } from "@/lib/session";

export default async function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();

    return (
        <div className="flex flex-col min-h-screen">
            {/* Background Grid Pattern - Local to Marketing Pages */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]"
                style={{
                    backgroundImage: `linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)`,
                    backgroundSize: '40px 40px'
                }}
            />

            <Header user={session ? {
                githubUsername: session.githubUsername,
                image: session.avatarUrl
            } : null} />

            <div className="flex-1 flex flex-col z-10">
                {children}
            </div>

            <Footer />
        </div>
    );
}
