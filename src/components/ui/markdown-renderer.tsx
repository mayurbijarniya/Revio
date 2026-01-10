import { ComponentPropsWithoutRef, ReactNode, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { createHighlighter } from "shiki";
import remarkGfm from "remark-gfm";
import { Check, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";


interface CodeBlockProps {
  code: string;
  language: string;
}


// singleton highlighter promise to avoid recreation
let highlighterPromise: ReturnType<typeof createHighlighter> | null = null;

function extractFilePath(code: string): string | null {
  // Try to extract file path from the first line comment
  const filePathMatch = code.match(/^\/\/\s*(?:file:|path:)?\s*(.+?\.(?:ts|tsx|js|jsx|py|go|rs|java|cpp|c|h|hpp|php|rb|swift|scala|css|scss|html|json|yaml|yml|md|sql|sh|bash))(?:\s*|$)/i);
  if (filePathMatch && filePathMatch[1]) {
    return filePathMatch[1];
  }
  return null;
}

// Language icon definitions - using a map for better maintainability
const LANGUAGE_ICONS: Record<string, { bg: string; content: ReactNode }> = {
  typescript: {
    bg: "#3178C6",
    content: (
      <>
        <path d="M14.5 12v7h-2v-5.5H10V12h4.5z" fill="white" />
        <path d="M17.5 14c0-.5.5-1 1.5-1s1.5.5 1.5 1-.5 1-1.5 1.5C18 16 17 17 17 18s1 1.5 2.5 1.5c1 0 2-.5 2-1.5h-1.5c0 .5-.5.5-1 .5s-1-.5-1-1 .5-1 1.5-1.5c1.5-.5 2-1.5 2-2s-1-1.5-2-1.5c-1.5 0-2.5.5-2.5 1.5h1z" fill="white" />
      </>
    ),
  },
  javascript: {
    bg: "#F7DF1E",
    content: (
      <>
        <path d="M7 18l1-1.5c.5.5 1 1 2 1s1.5-.5 1.5-1.5V10h2v6c0 2-1 3-3 3-1.5 0-2.5-.5-3.5-1z" fill="#323330" />
        <path d="M15 18l1-1.5c.5.5 1.5 1 2.5 1s1.5-.5 1.5-1-.5-1-1.5-1.5c-1.5-.5-3-1-3-3s1.5-2.5 3.5-2.5c1.5 0 2.5.5 3 1.5l-1 1.5c-.5-.5-1-1-2-1s-1.5.5-1.5 1 .5 1 1.5 1.5c1.5.5 3 1 3 3s-1.5 2.5-3.5 2.5c-2 0-3-.5-3.5-1.5z" fill="#323330" />
      </>
    ),
  },
  python: {
    bg: "transparent",
    content: (
      <>
        <path d="M12 2C9.5 2 8 3 8 5v2h4v1H6c-2 0-3 1.5-3 4s1 4 3 4h2v-2c0-1.5 1-3 3-3h4c1.5 0 2-1 2-2V5c0-2-1.5-3-4-3zm-1.5 2a.75.75 0 110 1.5.75.75 0 010-1.5z" fill="#3776AB" />
        <path d="M12 22c2.5 0 4-1 4-3v-2h-4v-1h6c2 0 3-1.5 3-4s-1-4-3-4h-2v2c0 1.5-1 3-3 3H9c-1.5 0-2 1-2 2v3c0 2 1.5 3 4 3h1zm1.5-2a.75.75 0 110-1.5.75.75 0 010 1.5z" fill="#FFD43B" />
      </>
    ),
  },
  go: {
    bg: "transparent",
    content: (
      <>
        <circle cx="12" cy="12" r="10" fill="#00ADD8" />
        <text x="6" y="16" fontSize="10" fill="white" fontWeight="bold">Go</text>
      </>
    ),
  },
  rust: { bg: "#DEA584", content: <text x="6" y="16" fontSize="10" fill="black" fontWeight="bold">Rs</text> },
  java: { bg: "#EA2D2E", content: <text x="4" y="16" fontSize="8" fill="white" fontWeight="bold">Java</text> },
  css: { bg: "#264DE4", content: <text x="4" y="16" fontSize="9" fill="white" fontWeight="bold">CSS</text> },
  html: { bg: "#E34F26", content: <text x="2" y="16" fontSize="8" fill="white" fontWeight="bold">HTML</text> },
  json: { bg: "#F7DF1E", content: <text x="2" y="16" fontSize="8" fill="#323330" fontWeight="bold">JSON</text> },
  sql: { bg: "#00758F", content: <text x="3" y="16" fontSize="9" fill="white" fontWeight="bold">SQL</text> },
  bash: { bg: "#4EAA25", content: <text x="7" y="16" fontSize="10" fill="white" fontWeight="bold">$</text> },
  c: { bg: "#00599C", content: <text x="5" y="17" fontSize="12" fill="white" fontWeight="bold">C</text> },
  cpp: { bg: "#00599C", content: <text x="3" y="16" fontSize="9" fill="white" fontWeight="bold">C++</text> },
  ruby: { bg: "#CC342D", content: <text x="4" y="16" fontSize="8" fill="white" fontWeight="bold">Ruby</text> },
  php: { bg: "#777BB4", content: <text x="3" y="16" fontSize="8" fill="white" fontWeight="bold">PHP</text> },
  swift: { bg: "#F05138", content: <text x="2" y="16" fontSize="7" fill="white" fontWeight="bold">Swift</text> },
  kotlin: { bg: "#7F52FF", content: <text x="4" y="16" fontSize="7" fill="white" fontWeight="bold">Kt</text> },
  yaml: { bg: "#CB171E", content: <text x="2" y="16" fontSize="7" fill="white" fontWeight="bold">YAML</text> },
  markdown: { bg: "#083FA1", content: <text x="4" y="16" fontSize="8" fill="white" fontWeight="bold">MD</text> },
};

// Language alias mapping
const LANGUAGE_ALIASES: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  golang: "go",
  rs: "rust",
  scss: "css",
  sass: "css",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  "c++": "cpp",
  rb: "ruby",
  yml: "yaml",
  md: "markdown",
};

function getLanguageIcon(language: string): ReactNode {
  const lang = language.toLowerCase();
  const normalizedLang = LANGUAGE_ALIASES[lang] || lang;
  const iconConfig = LANGUAGE_ICONS[normalizedLang];

  if (iconConfig) {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
        {iconConfig.bg !== "transparent" && (
          <rect width="24" height="24" rx="2" fill={iconConfig.bg} />
        )}
        {iconConfig.content}
      </svg>
    );
  }

  // Default file icon
  return <FileCode className="w-3.5 h-3.5 text-[#666666]" />;
}

const CopyIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 18 18"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g fill="#737373">
      <path
        d="M14.25 5.25H7.25C6.14543 5.25 5.25 6.14543 5.25 7.25V14.25C5.25 15.3546 6.14543 16.25 7.25 16.25H14.25C15.3546 16.25 16.25 15.3546 16.25 14.25V7.25C16.25 6.14543 15.3546 5.25 14.25 5.25Z"
        fill="#737373"
        fillOpacity="0.3"
        stroke="none"
      />

      <path
        d="M14.25 5.25H7.25C6.14543 5.25 5.25 6.14543 5.25 7.25V14.25C5.25 15.3546 6.14543 16.25 7.25 16.25H14.25C15.3546 16.25 16.25 15.3546 16.25 14.25V7.25C16.25 6.14543 15.3546 5.25 14.25 5.25Z"
        fill="none"
        stroke="#737373"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <path
        d="M2.801 11.998L1.772 5.07397C1.61 3.98097 2.364 2.96397 3.456 2.80197L10.38 1.77297C11.313 1.63397 12.19 2.16297 12.528 3.00097"
        fill="none"
        stroke="#737373"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </g>
  </svg>
);

function getHighlighterInstance() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['vesper'],
      langs: [
        'typescript', 'javascript', 'python', 'go', 'rust', 'java', 'css',
        'html', 'json', 'sql', 'bash', 'c', 'cpp', 'ruby', 'php',
        'swift', 'kotlin', 'yaml', 'markdown', 'tsx', 'jsx'
      ]
    });
  }
  return highlighterPromise;
}

function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function highlight() {
      try {
        const highlighter = await getHighlighterInstance();
        // Load language if not loaded? 
        // Shiki createHighlighter loads specified langs. 
        // If language isn't in our list, fallback to text or load it?
        // simple fallback for now.
        const loadedLangs = highlighter.getLoadedLanguages();
        const lang = loadedLangs.includes(language as any) ? language : 'markdown'; // fallback

        const html = highlighter.codeToHtml(code, {
          lang,
          theme: 'vesper'
        });

        if (mounted) {
          setHighlightedHtml(html);
        }
      } catch (e) {
        console.error("Shiki highlight error:", e);
      }
    }

    highlight();

    return () => {
      mounted = false;
    };
  }, [code, language]);


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
  // If we have a file path from the first line comment, strip it from the code
  const displayCode = filePath
    ? code.replace(/^\/\/.*\n?/, '')
    : code;
  const displayName = filePath || language;

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-[#282c34] bg-[#101010]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#101010] border-b border-[#282c34]">
        <div className="flex items-center gap-2">
          {getLanguageIcon(language)}
          <span className="font-mono text-xs text-gray-400 font-medium">
            {displayName}
          </span>
        </div>

        <button
          onClick={copyToClipboard}
          className="relative p-1.5 rounded hover:bg-[#282c34] transition-colors"
          title={copied ? "Copied!" : "Copy code"}
          aria-label={copied ? "Copied to clipboard" : "Copy code to clipboard"}
        >
          {copied && (
            <span className="absolute -left-12 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              Copied
            </span>
          )}
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <CopyIcon className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="overflow-auto max-h-[500px] text-sm font-mono">
        {highlightedHtml ? (
          <div
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            className="[&>pre]:!bg-[#101010] [&>pre]:!p-4 [&>pre]:!m-0 [&>pre]:!font-mono [&>pre]:!text-sm [&>pre]:!leading-relaxed"
          />
        ) : (
          <pre className="p-4 m-0 font-mono text-sm leading-relaxed text-gray-300 bg-[#101010]">
            {displayCode}
          </pre>
        )}
      </div>
    </div>
  );
}

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

            // Inline code - use globals.css variables by removing specific color classes,
            // or use explicit dark mode overrides if you prefer Tailwind classes over CSS vars.
            // Since globals.css has .markdown-renderer code styles, we can trust them OR explicitly match them.
            // Let's rely on globals.css but ensure base styles don't conflict.
            return (
              <code
                className="font-mono px-1.5 py-0.5 rounded text-[0.875em] bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-200"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
          p({ children }) {
            return <p className="mb-3 leading-7 text-gray-800 dark:text-gray-300">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="font-bold text-lg mb-4 mt-6 text-gray-900 dark:text-gray-100">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="font-semibold text-base mb-3 mt-5 text-gray-900 dark:text-gray-200">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="font-medium text-sm mb-2 mt-4 text-gray-900 dark:text-gray-200">{children}</h3>;
          },
          ul({ children }) {
            return <ul className="mb-3 ml-5 space-y-1.5 list-disc marker:text-gray-400 text-gray-800 dark:text-gray-300">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="mb-3 ml-5 space-y-1.5 list-decimal marker:text-gray-500 text-gray-800 dark:text-gray-300">{children}</ol>;
          },
          li({ children }) {
            return <li className="pl-1 leading-relaxed">{children}</li>;
          },
          blockquote({ children }) {
            // Updated blockquote colors
            return <blockquote className="border-l-4 pl-4 py-1 my-4 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">{children}</blockquote>;
          },
          hr({ }) {
            return <hr className="my-6 border-t border-gray-200 dark:border-gray-700" />;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-indigo-600 dark:text-indigo-400"
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






