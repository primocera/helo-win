// Document conversion for the shelf: Markdown, Word (.docx), HTML and plain text to HTML or PDF.
// Everything is done on this PC. This file turns a document into one self-contained HTML page;
// the PDF is then printed from that page by a hidden window (see printPdf in index.ts), which
// runs no scripts and may load nothing but pictures and styles from the document's own folder.
// No Electron imports, so it can be tested with plain Node.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { marked } from 'marked';
import mammoth from 'mammoth';
import { docTargets, extOf, type DocFormat } from '../shared/convert';

export const MAX_DOC_BYTES = 20 * 1024 * 1024;

/** What a converted page may load: no scripts, no network; pictures, styles and fonts from disk or inline. */
export const DOC_CSP = "default-src 'none'; img-src file: data:; style-src file: 'unsafe-inline'; font-src file: data:";

const PAGE_STYLE = `
  body { margin: 0 auto; max-width: 46em; padding: 2em 1.5em; font: 11.5pt/1.55 "Segoe UI", system-ui, sans-serif; color: #1c1c1e; background: #fff; }
  h1, h2, h3, h4 { line-height: 1.25; margin: 1.4em 0 0.5em; }
  h1 { font-size: 1.9em; } h2 { font-size: 1.45em; } h3 { font-size: 1.2em; }
  p, ul, ol, blockquote, pre, table { margin: 0 0 0.9em; }
  a { color: #1a5fd0; }
  img { max-width: 100%; }
  code, pre { font-family: "Cascadia Mono", Consolas, monospace; font-size: 0.92em; }
  code { background: #f1f1f3; padding: 0.1em 0.3em; border-radius: 3px; }
  pre { background: #f1f1f3; padding: 0.8em 1em; border-radius: 6px; white-space: pre-wrap; overflow-wrap: anywhere; }
  pre code { background: none; padding: 0; }
  blockquote { margin-left: 0; padding-left: 1em; border-left: 3px solid #d0d0d6; color: #55555c; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #d0d0d6; padding: 0.35em 0.7em; text-align: left; }
  hr { border: 0; border-top: 1px solid #d0d0d6; margin: 1.6em 0; }
  @media print { body { max-width: none; padding: 0; } }
`;

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** A whole page around `body`. `baseDir`: relative pictures are looked for there (left out when the page is saved beside its source). */
export function wrapPage(body: string, title: string, baseDir?: string): string {
  const base = baseDir ? `<base href="${escapeHtml(pathToFileURL(path.join(baseDir, path.sep)).href)}">` : '';
  return `<!doctype html>\n<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${DOC_CSP}">${base}<title>${escapeHtml(title)}</title><style>${PAGE_STYLE}</style></head>\n<body>\n${body}\n</body></html>\n`;
}

/**
 * An HTML file of the user's, made safe to print: the rules above are put first (the first
 * policy in a page cannot be loosened by a later one), and relative links point at its folder.
 */
export function guardPage(html: string, baseDir: string): string {
  const head = `<meta http-equiv="Content-Security-Policy" content="${DOC_CSP}"><base href="${escapeHtml(pathToFileURL(path.join(baseDir, path.sep)).href)}">`;
  // A byte-order mark or a doctype may come first; everything else goes after our lines.
  const m = /^﻿?\s*(<!doctype[^>]*>)?/i.exec(html);
  const at = m ? m[0].length : 0;
  return `${html.slice(0, at)}${head}${html.slice(at)}`;
}

export interface DocPage {
  /** The page to print, with relative links pointing at the source's folder. */
  print: string;
  /** The page to save as .html beside the source. Null when the source is already HTML. */
  save: string | null;
}

/** Reads a document and turns it into a page. Throws with a sentence for the user when it cannot. */
export async function documentPage(source: string): Promise<DocPage> {
  const ext = extOf(source);
  if (!docTargets(source).length) throw new Error('Only Markdown, Word (.docx), HTML and text files can be converted.');
  const size = fs.statSync(source).size;
  if (size > MAX_DOC_BYTES) throw new Error('That document is too large (over 20 MB).');
  const dir = path.dirname(source);
  const title = path.basename(source, path.extname(source));
  if (ext === 'html' || ext === 'htm') return { print: guardPage(fs.readFileSync(source, 'utf8'), dir), save: null };
  let body: string;
  if (ext === 'docx') {
    const result = await mammoth.convertToHtml({ path: source });
    body = result.value;
    if (!body.trim()) throw new Error('That Word file has no text in it.');
  } else {
    const text = fs.readFileSync(source, 'utf8').replace(/^﻿/, '');
    body = ext === 'txt' ? `<pre>${escapeHtml(text)}</pre>` : await marked.parse(text, { gfm: true });
  }
  return { print: wrapPage(body, title, dir), save: wrapPage(body, title) };
}

export { docTargets, type DocFormat };
