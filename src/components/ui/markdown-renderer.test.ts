import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));

import { MarkdownRenderer } from "./markdown-renderer";

function render(content: string, isStreaming = false): string {
  return renderToStaticMarkup(createElement(MarkdownRenderer, { content, isStreaming }));
}

describe("MarkdownRenderer code blocks", () => {
  it("renders a one-line fenced block as a code block with a copy button", () => {
    const html = render("```bash\nnpm i\n```");
    expect(html).toContain("Copy code to clipboard");
    expect(html).toContain("npm i");
  });

  it("renders a fenced block without a language as a code block", () => {
    const html = render("```\nline one\nline two\n```");
    expect(html).toContain("Copy code to clipboard");
    expect(html).toContain("line one\nline two");
  });

  it("keeps inline code inline", () => {
    const html = render("Use `npm i` here");
    expect(html).not.toContain("Copy code to clipboard");
    expect(html).toContain("<code");
  });

  it("renders a plain block while streaming", () => {
    const html = render("```ts\nconst a = 1;\n```", true);
    expect(html).not.toContain("Copy code to clipboard");
    expect(html).toContain("const a = 1;");
  });
});
