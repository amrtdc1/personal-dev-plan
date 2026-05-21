const INLINE_CODE_PATTERN = /`([^`]+)`/g;
const STRONG_PATTERN = /\*\*([^*]+)\*\*/g;
const EMPHASIS_PATTERN = /\*([^*]+)\*/g;
const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

export function renderStrictMarkdownToHtml(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return "";
  }

  const lines = normalized.split("\n");
  const blocks: string[] = [];
  let listItems: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushListItems(blocks, listItems);
      listItems = [];
      continue;
    }

    if (line.startsWith("- ")) {
      listItems.push(`<li>${renderInlineMarkdown(line.slice(2).trim())}</li>`);
      continue;
    }

    flushListItems(blocks, listItems);
    listItems = [];

    if (line.startsWith("### ")) {
      blocks.push(`<h3>${renderInlineMarkdown(line.slice(4).trim())}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(`<h2>${renderInlineMarkdown(line.slice(3).trim())}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(`<h1>${renderInlineMarkdown(line.slice(2).trim())}</h1>`);
      continue;
    }

    blocks.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  flushListItems(blocks, listItems);
  return blocks.join("\n");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineMarkdown(input: string): string {
  let html = escapeHtml(input);

  html = html.replace(INLINE_CODE_PATTERN, (_match, codeText) => {
    return `<code>${escapeHtml(codeText)}</code>`;
  });

  html = html.replace(STRONG_PATTERN, (_match, strongText) => {
    return `<strong>${escapeHtml(strongText)}</strong>`;
  });

  html = html.replace(EMPHASIS_PATTERN, (_match, emphasisText) => {
    return `<em>${escapeHtml(emphasisText)}</em>`;
  });

  html = html.replace(LINK_PATTERN, (_match, linkText, rawUrl) => {
    const safeUrl = sanitizeLinkUrl(rawUrl);
    const safeText = escapeHtml(linkText);

    if (!safeUrl) {
      return safeText;
    }

    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer nofollow">${safeText}</a>`;
  });

  return html;
}

function sanitizeLinkUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();

  try {
    const parsed = new URL(trimmed, "https://example.test");
    const protocol = parsed.protocol.toLowerCase();

    if (protocol !== "http:" && protocol !== "https:" && protocol !== "mailto:") {
      return null;
    }

    if (trimmed.startsWith("/")) {
      return null;
    }

    return escapeHtml(parsed.toString());
  } catch {
    return null;
  }
}

function flushListItems(blocks: string[], listItems: string[]) {
  if (listItems.length === 0) {
    return;
  }

  blocks.push(`<ul>\n${listItems.join("\n")}\n</ul>`);
}
