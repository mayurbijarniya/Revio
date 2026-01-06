"use client";

import { ComponentPropsWithoutRef, ReactNode, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { Copy, Check, FileCode, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("markdown-renderer", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: ComponentPropsWithoutRef<"code"> & { inline?: boolean; children?: ReactNode }) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            const codeString = String(children).replace(/\n$/, "");

            // Check if this is a block code (has language) vs inline code
            const isBlockCode = language && (inline === false || codeString.includes("\n"));

            if (isBlockCode) {
              return <CodeBlock code={codeString} language={language} />;
            }

            // Inline code - use global CSS styling
            return <code className={className} {...props}>{children}</code>;
          },
          pre({ children }) {
            return <>{children}</>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

interface CodeBlockProps {
  code: string;
  language: string;
}

function extractFilePath(code: string): string | null {
  // Try to extract file path from the first line comment
  const filePathMatch = code.match(/^\/\/\s*(?:file:|path:)?\s*(.+?\.(?:ts|tsx|js|jsx|py|go|rs|java|cpp|c|h|hpp|php|rb|swift|scala))(?:\s*|$)/i);
  if (filePathMatch && filePathMatch[1]) {
    return filePathMatch[1];
  }
  return null;
}

function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const filePath = extractFilePath(code);
  const hasFilePath = filePath !== null;
  const lineCount = code.split("\n").length;
  const showLineNumbers = lineCount > 1;

  return (
    <div className="relative my-4 rounded-lg overflow-hidden border border-[#d0d7de] dark:border-[#30363d]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#f6f8fa] dark:bg-[#1e2128] border-b border-[#d0d7de] dark:border-[#30363d]">
        <div className="flex items-center gap-2 min-w-0">
          {/* Mac-style window controls */}
          <div className="flex gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-[#d0d7de] dark:bg-[#30363d] mx-2 shrink-0" />

          {/* File path or language */}
          {hasFilePath ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <FileCode className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-sm text-[#24292f] dark:text-[#c9d1d9] font-mono truncate" title={filePath!}>
                {filePath}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-[#57606a]" />
              <span className="text-xs text-[#57606a] uppercase font-medium tracking-wider">
                {language}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {showLineNumbers && (
            <span className="text-xs text-[#57606a] px-2 py-0.5 bg-[#d0d7de33] rounded">
              {lineCount} lines
            </span>
          )}
          <button
            onClick={copyToClipboard}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all duration-200",
              copied
                ? "bg-green-100 text-green-700 border border-green-300"
                : "bg-[#d0d7de33] text-[#57606a] hover:bg-[#d0d7de66] border border-[#d0d7de]"
            )}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code */}
      <div className="relative overflow-auto max-h-[600px] bg-[#f6f8fa] dark:bg-[#1e2128]">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: "1rem 0.75rem",
            fontSize: "0.875rem",
            lineHeight: "1.5",
            background: "transparent",
            fontFamily: "'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace",
          }}
          showLineNumbers={showLineNumbers}
          lineNumberStyle={{
            minWidth: "2.25em",
            paddingRight: "1em",
            paddingLeft: "0.75em",
            color: "#6e7781",
            textAlign: "right",
            userSelect: "none",
            fontSize: "0.8125rem",
          }}
          lineNumberContainerStyle={{
            float: "left",
            paddingRight: "1rem",
            borderRight: "1px solid #3f3f46",
          }}
          wrapLines={true}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
