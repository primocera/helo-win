// Clipboard history: a capped list of recent text and image clips, stored in
// the user data folder (an index plus one file per image). No Electron imports;
// the caller reads the clipboard, makes thumbnails and supplies the encryption.
//
// On disk: with a codec, the index is `index.bin` and every image file is sealed, so the
// folder holds nothing readable by another Windows account or from a backup. Without one
// (encryption not available) it is `index.json` and plain PNG files, as before. Clips that
// are not pinned are forgotten after `expireMs`.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readJson, writeJson } from './jsonfile';
import type { ClipItem } from '../shared/types';

export const MAX_TEXT_CHARS = 20_000;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGES = 20;

interface StoredClip {
  id: string;
  kind: 'text' | 'image';
  text: string;
  hash: string;
  at: number;
  /** Image file name inside the folder. */
  file?: string;
  thumb?: string;
  /** Pinned clips stay at the top and are never trimmed, cleared or expired. */
  pinned?: boolean;
  /** The image file is encrypted with the codec. */
  sealed?: boolean;
}

/** Encrypts and decrypts what is written to disk (Electron's safeStorage in the app). */
export interface ClipCodec {
  seal(data: Buffer): Buffer;
  open(data: Buffer): Buffer;
}

export interface ClipOptions {
  codec?: ClipCodec | null;
  /** Unpinned clips older than this are removed. 0 = keep until trimmed. */
  expireMs?: number;
}

/** What a text clip looks like, for the filter chips. */
export function clipType(kind: 'text' | 'image', text: string): ClipItem['type'] {
  if (kind === 'image') return 'image';
  const s = text.trim();
  if (/^https?:\/\/\S+$/i.test(s)) return 'link';
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s) || /^(?:rgb|hsl)a?\([\d\s.,%/]+\)$/i.test(s)) return 'color';
  return 'text';
}

export const hashOf = (data: string | Buffer) => crypto.createHash('sha256').update(data).digest('hex');

export class ClipboardHistory {
  private items: StoredClip[];
  private readonly plainIndex: string;
  private readonly sealedIndex: string;
  private readonly codec: ClipCodec | null;
  private expireMs: number;

  constructor(private dir: string, private maxItems = 50, private now: () => number = Date.now, { codec = null, expireMs = 0 }: ClipOptions = {}) {
    fs.mkdirSync(dir, { recursive: true });
    this.plainIndex = path.join(dir, 'index.json');
    this.sealedIndex = path.join(dir, 'index.bin');
    this.codec = codec;
    this.expireMs = expireMs;
    const loaded = this.load();
    this.items = Array.isArray(loaded) ? loaded.filter(isStoredClip) : [];
    this.items = this.items.filter((c) => c.kind === 'text' || (c.file && fs.existsSync(path.join(dir, c.file))));
    // An encrypted image cannot be read back without the codec.
    if (!codec) this.items = this.items.filter((c) => !c.sealed);
    const moved = this.sealOldFiles();
    const expired = this.dropExpired();
    if (moved || expired) this.save();
  }

  /** The saved list: the encrypted index when there is one, otherwise the plain one from before. */
  private load(): unknown {
    if (this.codec && fs.existsSync(this.sealedIndex)) {
      try {
        return JSON.parse(this.codec.open(fs.readFileSync(this.sealedIndex)).toString('utf8'));
      } catch {
        return [];
      }
    }
    return readJson<unknown>(this.plainIndex, []);
  }

  /** Encrypts what an older version left in plain files. Returns true when anything changed. */
  private sealOldFiles(): boolean {
    if (!this.codec) return false;
    let changed = fs.existsSync(this.plainIndex);
    for (const c of this.items) {
      if (c.kind !== 'image' || c.sealed || !c.file) continue;
      try {
        const file = path.join(this.dir, c.file);
        fs.writeFileSync(file, this.codec.seal(fs.readFileSync(file)));
        c.sealed = true;
        changed = true;
      } catch { /* left as it is; it still reads as a plain file */ }
    }
    return changed;
  }

  setMax(maxItems: number) {
    this.maxItems = maxItems;
    this.trim();
    this.save();
  }

  /** Changes how long unpinned clips are kept (0 = no limit) and applies it. Returns true when clips were removed. */
  setExpiry(expireMs: number): boolean {
    this.expireMs = expireMs;
    return this.prune();
  }

  /** Removes unpinned clips that are past their time. Returns true when the list changed. */
  prune(): boolean {
    const changed = this.dropExpired();
    if (changed) this.save();
    return changed;
  }

  private dropExpired(): boolean {
    if (this.expireMs <= 0) return false;
    const oldest = this.now() - this.expireMs;
    const gone = this.items.filter((c) => !c.pinned && c.at < oldest);
    if (!gone.length) return false;
    for (const c of gone) this.deleteFile(c);
    this.items = this.items.filter((c) => !gone.includes(c));
    return true;
  }

  /** Adds text. Returns false when it was empty, too long or the same as the newest clip. */
  addText(raw: string): boolean {
    if (typeof raw !== 'string' || !raw.trim() || raw.length > MAX_TEXT_CHARS) return false;
    const hash = hashOf(`t:${raw}`);
    if (!this.promote(hash)) {
      this.items.unshift({ id: crypto.randomUUID(), kind: 'text', text: raw, hash, at: this.now() });
    }
    this.trim();
    this.save();
    return true;
  }

  /** Adds a PNG. `thumb` is a small data: URL preview, `label` e.g. "Image 800×600". */
  addImage(png: Buffer, thumb: string, label: string): boolean {
    if (!png.length || png.length > MAX_IMAGE_BYTES) return false;
    const hash = hashOf(png);
    if (!this.promote(hash)) {
      const id = crypto.randomUUID();
      const file = `${id}.png`;
      fs.writeFileSync(path.join(this.dir, file), this.codec ? this.codec.seal(png) : png);
      this.items.unshift({ id, kind: 'image', text: label, hash, at: this.now(), file, thumb, ...(this.codec ? { sealed: true } : {}) });
    }
    this.trim();
    this.save();
    return true;
  }

  /** Moves an existing clip with this hash to the top. */
  private promote(hash: string): boolean {
    const i = this.items.findIndex((c) => c.hash === hash);
    if (i < 0) return false;
    const [item] = this.items.splice(i, 1);
    item.at = this.now();
    this.items.unshift(item);
    return true;
  }

  get(id: string): { kind: 'text'; text: string } | { kind: 'image'; png: Buffer } | null {
    const c = this.items.find((x) => x.id === id);
    if (!c) return null;
    if (c.kind === 'text') return { kind: 'text', text: c.text };
    try {
      const data = fs.readFileSync(path.join(this.dir, c.file!));
      if (c.sealed && !this.codec) return null;
      return { kind: 'image', png: c.sealed ? this.codec!.open(data) : data };
    } catch {
      return null;
    }
  }

  /** True when this content is already the newest clip (used to ignore our own copy-back). */
  isNewest(hash: string): boolean {
    return this.items[0]?.hash === hash;
  }

  remove(id: string) {
    const i = this.items.findIndex((c) => c.id === id);
    if (i < 0) return;
    const [c] = this.items.splice(i, 1);
    this.deleteFile(c);
    this.save();
  }

  /** Removes everything except pinned clips. */
  clear() {
    for (const c of this.items) if (!c.pinned) this.deleteFile(c);
    this.items = this.items.filter((c) => c.pinned);
    this.save();
  }

  /** Pins or unpins a clip. */
  togglePin(id: string) {
    const c = this.items.find((x) => x.id === id);
    if (!c) return;
    c.pinned = !c.pinned;
    this.trim();
    this.save();
  }

  list(): ClipItem[] {
    // Pinned first; the sort is stable, so each group stays newest-first.
    const ordered = [...this.items].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
    return ordered.map(({ id, kind, text, at, thumb, pinned }) => ({
      id,
      kind,
      type: clipType(kind, text),
      pinned: Boolean(pinned),
      // The list shows a preview; copying back uses the full text.
      text: kind === 'text' && text.length > 500 ? `${text.slice(0, 500)}…` : text,
      at,
      ...(thumb ? { thumb } : {}),
    }));
  }

  private trim() {
    let images = 0;
    const kept: StoredClip[] = [];
    for (const c of this.items) {
      const over = !c.pinned && (kept.length >= this.maxItems || (c.kind === 'image' && images >= MAX_IMAGES));
      if (over) {
        this.deleteFile(c);
        continue;
      }
      if (c.kind === 'image') images++;
      kept.push(c);
    }
    this.items = kept;
  }

  private deleteFile(c: StoredClip) {
    if (c.file) fs.rmSync(path.join(this.dir, c.file), { force: true });
  }

  private save() {
    if (!this.codec) {
      writeJson(this.plainIndex, this.items);
      return;
    }
    const tmp = `${this.sealedIndex}.tmp`;
    fs.writeFileSync(tmp, this.codec.seal(Buffer.from(JSON.stringify(this.items), 'utf8')));
    fs.renameSync(tmp, this.sealedIndex);
    // The plain list from an older version must not stay behind.
    fs.rmSync(this.plainIndex, { force: true });
  }
}

function isStoredClip(v: unknown): v is StoredClip {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return typeof c.id === 'string' && (c.kind === 'text' || c.kind === 'image') && typeof c.text === 'string'
    && typeof c.hash === 'string' && typeof c.at === 'number'
    && (c.kind === 'text' || (typeof c.file === 'string' && /^[\w-]+\.png$/.test(c.file)))
    && (c.sealed === undefined || typeof c.sealed === 'boolean');
}
