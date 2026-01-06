import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revio - AI-Powered Code Review",
  description:
    "AI-powered code review platform with codebase intelligence, PR reviews, and natural language code search.",
  keywords: ["code review", "AI", "GitHub", "pull request", "developer tools"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
