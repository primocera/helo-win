// Document conversion on the shelf: which files, and the page they become.
import { test, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { docTargets, extOf } from '../src/shared/convert';
import { documentPage, wrapPage, guardPage, escapeHtml, DOC_CSP } from '../src/main/documents';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'helo-docs-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const file = (name: string, text: string) => {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, text);
  return p;
};

test('documents: what each kind of file can become', () => {
  expect(docTargets('notes.md')).toEqual(['html', 'pdf']);
  expect(docTargets('README.MARKDOWN')).toEqual(['html', 'pdf']);
  expect(docTargets('letter.docx')).toEqual(['html', 'pdf']);
  expect(docTargets('page.html')).toEqual(['pdf']);
  expect(docTargets('page.htm')).toEqual(['pdf']);
  expect(docTargets('log.txt')).toEqual(['pdf']);
  expect(docTargets('photo.png')).toEqual([]);
  expect(docTargets('old.doc')).toEqual([]);
  expect(docTargets('report.pdf')).toEqual([]);
  expect(docTargets('constructor')).toEqual([]);
  expect(docTargets('noext')).toEqual([]);
  expect(extOf('a.b.Md')).toBe('md');
});

test('documents: Markdown becomes a page with headings, lists, code and tables', async () => {
  const page = await documentPage(file('plan.md', '# Plan\n\n- one\n- two\n\n`code` and **bold**\n\n| a | b |\n|---|---|\n| 1 | 2 |\n'));
  expect(page.save).toContain('<h1>Plan</h1>');
  expect(page.save).toContain('<li>one</li>');
  expect(page.save).toContain('<code>code</code>');
  expect(page.save).toContain('<strong>bold</strong>');
  expect(page.save).toContain('<table>');
  expect(page.save).toContain('<title>plan</title>');
  // The saved page sits beside its source, so it needs no base; the printed one does.
  expect(page.save).not.toContain('<base');
  expect(page.print).toContain('<base href="file:///');
});

test('documents: every page forbids scripts and the network', async () => {
  expect(DOC_CSP).toContain("default-src 'none'");
  expect(DOC_CSP).not.toContain('script');
  expect(DOC_CSP).not.toContain('http');
  const md = await documentPage(file('x.md', 'hello <script>alert(1)</script>'));
  expect(md.print.indexOf('Content-Security-Policy')).toBeGreaterThan(0);
  expect(md.print.indexOf('Content-Security-Policy')).toBeLessThan(md.print.indexOf('<body>'));
  const html = await documentPage(file('x.html', '<!DOCTYPE html>\n<html><head><meta http-equiv="Content-Security-Policy" content="default-src *"><script src="https://example.com/x.js"></script></head><body>Hi</body></html>'));
  expect(html.save).toBe(null);
  // Our policy comes before anything the file says, straight after the doctype.
  expect(html.print.startsWith('<!DOCTYPE html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'')).toBe(true);
  expect(guardPage('<p>no doctype</p>', tmp).startsWith('<meta http-equiv="Content-Security-Policy"')).toBe(true);
});

test('documents: plain text is shown as it is, never as markup', async () => {
  const page = await documentPage(file('log.txt', '﻿a < b && c > d\n<img src=x onerror=alert(1)>'));
  expect(page.print).toContain('<pre>a &lt; b &amp;&amp; c &gt; d\n&lt;img src=x onerror=alert(1)&gt;</pre>');
  expect(escapeHtml(`"it's"`)).toBe('&quot;it&#39;s&quot;');
  expect(wrapPage('<p>x</p>', '<b>t</b>')).toContain('<title>&lt;b&gt;t&lt;/b&gt;</title>');
});

test('documents: other files and broken Word files are refused with a sentence', async () => {
  await expect(documentPage(file('photo.png', 'x'))).rejects.toThrow('Only Markdown');
  await expect(documentPage(file('broken.docx', 'this is not a zip file'))).rejects.toThrow();
  await expect(documentPage(path.join(tmp, 'missing.md'))).rejects.toThrow();
});
