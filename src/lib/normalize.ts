import * as cheerio from "cheerio";

export type CanonicalPassage = {
  sectionKey: string;
  passageIndex: number;
  text: string;
  html: string;
  charStart: number;
  charEnd: number;
};

export function normalizeWhitespace(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function stripBoilerplate(text: string): string {
  const startMarker = "*** START OF THE PROJECT GUTENBERG EBOOK";
  const endMarker = "*** END OF THE PROJECT GUTENBERG EBOOK";
  const start = text.toUpperCase().indexOf(startMarker);
  const end = text.toUpperCase().indexOf(endMarker);
  if (start >= 0 && end > start) {
    const firstLineBreak = text.indexOf("\n", start);
    return text.slice(firstLineBreak + 1, end).trim();
  }
  return text;
}

export function htmlToParagraphs(rawHtml: string): string[] {
  const $ = cheerio.load(rawHtml);
  const paragraphs = $("p")
    .map((_, p) => normalizeWhitespace($(p).text()))
    .get()
    .filter((p) => p.length > 40);
  if (paragraphs.length > 0) return paragraphs;
  const plain = normalizeWhitespace($.text());
  return textToParagraphs(plain);
}

export function textToParagraphs(rawText: string): string[] {
  return normalizeWhitespace(rawText)
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter((x) => x.length > 40);
}

export function segmentCanonicalPassages(paragraphs: string[]): CanonicalPassage[] {
  let cursor = 0;
  return paragraphs.map((text, idx) => {
    const charStart = cursor;
    const charEnd = cursor + text.length;
    cursor = charEnd + 2;
    return {
      sectionKey: `sec-${Math.floor(idx / 25) + 1}`,
      passageIndex: idx,
      text,
      html: `<p>${escapeHtml(text)}</p>`,
      charStart,
      charEnd,
    };
  });
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildSelector(
  passageText: string,
  startOffset: number,
  endOffset: number,
): { exact: string; prefix: string; suffix: string } {
  const exact = passageText.slice(startOffset, endOffset);
  const prefix = passageText.slice(Math.max(0, startOffset - 32), startOffset);
  const suffix = passageText.slice(endOffset, Math.min(passageText.length, endOffset + 32));
  return { exact, prefix, suffix };
}
