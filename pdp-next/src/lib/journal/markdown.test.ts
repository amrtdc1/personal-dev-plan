import { describe, expect, it } from "vitest";
import { escapeHtml, renderStrictMarkdownToHtml } from "@/lib/journal/markdown";

describe("journal strict markdown renderer", () => {
  it("escapes raw html tags", () => {
    const html = renderStrictMarkdownToHtml("<script>alert('xss')</script>");

    expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("renders headings, paragraphs, and lists", () => {
    const html = renderStrictMarkdownToHtml("# Heading\n\nParagraph\n- one\n- two");

    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("<p>Paragraph</p>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<li>two</li>");
  });

  it("supports strong, emphasis, and inline code", () => {
    const html = renderStrictMarkdownToHtml("**bold** *italic* `code`");

    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<code>code</code>");
  });

  it("allows only safe link protocols", () => {
    const safe = renderStrictMarkdownToHtml("[Docs](https://example.com/docs)");
    const unsafe = renderStrictMarkdownToHtml("[Pwn](javascript:alert(1))");

    expect(safe).toContain("href=\"https://example.com/docs\"");
    expect(unsafe).not.toContain("href=");
    expect(unsafe).toContain("Pwn");
  });

  it("escapes dangerous attribute characters", () => {
    expect(escapeHtml('" onclick="alert(1)')).toBe("&quot; onclick=&quot;alert(1)");
  });
});
