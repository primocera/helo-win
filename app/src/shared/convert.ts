// What the shelf can convert a document to, by its file name. Shared by the main process
// (which does it) and the island (which offers the buttons).

export type DocFormat = 'html' | 'pdf';

const TARGETS: Record<string, DocFormat[]> = {
  md: ['html', 'pdf'],
  markdown: ['html', 'pdf'],
  docx: ['html', 'pdf'],
  html: ['pdf'],
  htm: ['pdf'],
  txt: ['pdf'],
};

/** The lower-case extension of a file name, without the dot. */
export function extOf(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

/** The formats a file with this name can be converted to. Empty for anything that is not a document. */
export function docTargets(name: string): DocFormat[] {
  const ext = extOf(name);
  return Object.hasOwn(TARGETS, ext) ? TARGETS[ext] : [];
}
