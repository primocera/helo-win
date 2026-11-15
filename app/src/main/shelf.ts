// File shelf: files parked on the island by drag and drop. The shelf keeps
// references (paths), not copies, and remembers them across restarts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readJson, writeJson } from './jsonfile';
import type { ShelfItem } from '../shared/types';

export const MAX_SHELF = 30;

interface Stored {
  id: string;
  path: string;
}

export class Shelf {
  private items: Stored[];

  constructor(private file: string) {
    const loaded = readJson<unknown>(file, []);
    this.items = Array.isArray(loaded)
      ? loaded.filter((x): x is Stored => Boolean(x) && typeof x.id === 'string' && typeof x.path === 'string')
      : [];
  }

  /** Adds absolute paths that exist. Returns how many were added. */
  add(paths: unknown[]): number {
    let added = 0;
    for (const p of paths) {
      if (typeof p !== 'string' || !path.isAbsolute(p) || !fs.existsSync(p)) continue;
      const resolved = path.resolve(p);
      if (this.items.some((i) => i.path.toLowerCase() === resolved.toLowerCase())) continue;
      this.items.unshift({ id: crypto.randomUUID(), path: resolved });
      added++;
    }
    this.items = this.items.slice(0, MAX_SHELF);
    if (added) this.save();
    return added;
  }

  remove(id: string) {
    this.items = this.items.filter((i) => i.id !== id);
    this.save();
  }

  clear() {
    this.items = [];
    this.save();
  }

  pathOf(id: string): string | null {
    return this.items.find((i) => i.id === id)?.path ?? null;
  }

  list(icons: Map<string, string | null> = new Map()): ShelfItem[] {
    return this.items.map(({ id, path: p }) => {
      let size = 0;
      let isDirectory = false;
      let missing = false;
      try {
        const st = fs.statSync(p);
        size = st.size;
        isDirectory = st.isDirectory();
      } catch {
        missing = true;
      }
      return { id, path: p, name: path.basename(p), size, isDirectory, missing, icon: icons.get(p) ?? null };
    });
  }

  private save() {
    writeJson(this.file, this.items);
  }
}

/** A free file name next to `source` with the new extension: photo.png -> photo.webp, photo (2).webp, ... */
export function convertedName(source: string, ext: string, exists: (p: string) => boolean = fs.existsSync): string {
  const dir = path.dirname(source);
  const base = path.basename(source, path.extname(source));
  let candidate = path.join(dir, `${base}.${ext}`);
  for (let n = 2; exists(candidate) && n < 1000; n++) candidate = path.join(dir, `${base} (${n}).${ext}`);
  return candidate;
}

export const CONVERTIBLE = /\.(png|jpe?g|webp|gif|bmp)$/i;
