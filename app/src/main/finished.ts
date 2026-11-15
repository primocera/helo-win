// "Finished" alerts: the decision logic behind
//   1. browser downloads (a partial file in Downloads turns into a finished file),
//   2. Steam downloads/updates (appmanifest_*.acf state flags),
//   3. watching an app until it closes or stops being busy (CPU heuristic).
// Pure functions and small state machines only; the watchers that feed them
// live in finished-watch.ts.

// ---------------------------------------------------------------------------
// Downloads

/** Partial-download names: Chrome/Edge .crdownload, Firefox .part, Opera .opdownload, Safari-style .download, others .partial. */
export const PARTIAL = /\.(crdownload|part|partial|opdownload|download)$/i;

export function isPartial(name: string): boolean {
  return PARTIAL.test(name);
}

/** "movie.mkv.part" -> "movie.mkv"; "Unconfirmed 1234.crdownload" -> null (the final name is unknown). */
export function partialTarget(name: string): string | null {
  if (!isPartial(name)) return null;
  const base = name.replace(PARTIAL, '');
  return /^Unconfirmed \d+$/i.test(base) || !base ? null : base;
}

export interface DownloadSnapshot {
  names: Set<string>;
  partials: Set<string>;
}

export function snapshot(names: string[]): DownloadSnapshot {
  return {
    names: new Set(names.filter((n) => !isPartial(n))),
    partials: new Set(names.filter(isPartial)),
  };
}

/**
 * Compares two directory listings. A file counts as a finished download when a
 * partial file disappeared and either (a) the partial's own target name exists
 * (Firefox writes the target next to the .part), or (b) a new, non-partial file
 * appeared in the same change (Chrome renames "Unconfirmed N.crdownload" or
 * "name.crdownload" to the final name). The caller still checks the size is
 * non-zero and stable before announcing it.
 */
export function finishedDownloads(prev: DownloadSnapshot, nextNames: string[]): { candidates: string[]; next: DownloadSnapshot } {
  const next = snapshot(nextNames);
  const vanished = [...prev.partials].filter((p) => !next.partials.has(p));
  const candidates = new Set<string>();
  let unmatched = 0;
  for (const p of vanished) {
    const target = partialTarget(p);
    if (target && next.names.has(target)) candidates.add(target);
    else unmatched++;
  }
  // Renames to a name we cannot predict: one new file per vanished partial.
  if (unmatched) {
    for (const n of next.names) {
      if (!unmatched) break;
      if (prev.names.has(n) || candidates.has(n)) continue;
      candidates.add(n);
      unmatched--;
    }
  }
  return { candidates: [...candidates], next };
}

// ---------------------------------------------------------------------------
// Steam (Valve KeyValues text: libraryfolders.vdf, appmanifest_*.acf)

export type Vdf = { [key: string]: string | Vdf };

/** Parses Valve's text KeyValues format ("key" "value" and "key" { ... }). */
export function parseVdf(text: string): Vdf {
  const tokens: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|([{}])|\/\/[^\n]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) tokens.push(`s${m[1].replace(/\\(.)/g, (_x, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c))}`);
    else if (m[2]) tokens.push(m[2]);
  }
  let i = 0;
  const parseObject = (): Vdf => {
    const obj: Vdf = {};
    while (i < tokens.length) {
      const t = tokens[i++];
      if (t === '}') return obj;
      if (!t.startsWith('s')) continue;
      const key = t.slice(1);
      const v = tokens[i++];
      if (v === '{') obj[key] = parseObject();
      else if (v && v.startsWith('s')) obj[key] = v.slice(1);
    }
    return obj;
  };
  return parseObject();
}

const sub = (v: string | Vdf | undefined): Vdf | null => (v && typeof v === 'object' ? v : null);

/** Library folder paths from libraryfolders.vdf. */
export function steamLibraries(vdfText: string): string[] {
  const root = sub(parseVdf(vdfText).libraryfolders) ?? sub(parseVdf(vdfText).LibraryFolders);
  if (!root) return [];
  const out: string[] = [];
  for (const v of Object.values(root)) {
    if (typeof v === 'string') {
      if (/^[a-z]:\\/i.test(v)) out.push(v); // old format: "1" "D:\\Games"
    } else if (typeof v.path === 'string') out.push(v.path);
  }
  return [...new Set(out)];
}

export interface SteamApp {
  appid: string;
  name: string;
  flags: number;
  bytesToDownload: number;
  bytesDownloaded: number;
}

export function parseAcf(text: string): SteamApp | null {
  const st = sub(parseVdf(text).AppState);
  if (!st || typeof st.appid !== 'string') return null;
  const n = (v: unknown) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : 0);
  return {
    appid: st.appid,
    name: typeof st.name === 'string' && st.name ? st.name : `App ${st.appid}`,
    flags: n(st.StateFlags),
    bytesToDownload: n(st.BytesToDownload),
    bytesDownloaded: n(st.BytesDownloaded),
  };
}

export const STEAM = {
  FullyInstalled: 4,
  UpdateRequired: 2,
  Uninstalling: 2048,
  // Flags that mean "work in progress".
  busy: 2 | 256 | 1024 | 131072 | 262144 | 524288 | 1048576 | 2097152 | 4194304,
};

/** True when the app was downloading/updating before and is now installed and idle. */
export function steamBecameReady(prev: SteamApp | undefined, next: SteamApp): boolean {
  if (!prev) return false;
  const wasBusy = (prev.flags & STEAM.busy) !== 0 || (prev.bytesToDownload > 0 && prev.bytesDownloaded < prev.bytesToDownload && (prev.flags & STEAM.UpdateRequired) !== 0);
  const ready = (next.flags & STEAM.FullyInstalled) !== 0 && (next.flags & (STEAM.busy | STEAM.Uninstalling)) === 0;
  return wasBusy && ready;
}

// ---------------------------------------------------------------------------
// Watch an app: "when it closes" or "when it stops being busy"

export interface BusySample {
  /** Epoch ms. */
  t: number;
  /** Total CPU time of the process and its children, ms. */
  cpuMs: number;
  alive: boolean;
}

export interface BusyOptions {
  /** Percent of one CPU core that counts as busy. */
  busyPct: number;
  /** Below this percent of one core counts as quiet. */
  quietPct: number;
  /** It must be busy this long before quiet can count. */
  busyForMs: number;
  /** Quiet this long after being busy = "done". */
  quietForMs: number;
}

export const DEFAULT_BUSY: BusyOptions = { busyPct: 30, quietPct: 8, busyForMs: 4000, quietForMs: 15_000 };

export type WatchPhase = 'waiting' | 'busy' | 'settling';

/**
 * Estimates "finished loading": the process tree was busy (CPU) for a while and
 * then stayed quiet. This is a heuristic, not a signal from the app.
 */
export class BusyIdleDetector {
  private last: BusySample | null = null;
  private busyMs = 0;
  private quietMs = 0;
  private wasBusy = false;

  constructor(private opts: BusyOptions = DEFAULT_BUSY) {}

  get phase(): WatchPhase {
    if (!this.wasBusy) return 'waiting';
    return this.quietMs > 0 ? 'settling' : 'busy';
  }

  get quietForMs(): number {
    return this.quietMs;
  }

  /** Feeds one sample; returns 'closed', 'idle' or null. */
  push(s: BusySample): 'closed' | 'idle' | null {
    if (!s.alive) return 'closed';
    const prev = this.last;
    this.last = s;
    if (!prev) return null;
    const dt = s.t - prev.t;
    if (dt <= 0) return null;
    const pct = (Math.max(0, s.cpuMs - prev.cpuMs) / dt) * 100;
    if (pct >= this.opts.busyPct) {
      this.busyMs += dt;
      this.quietMs = 0;
      if (this.busyMs >= this.opts.busyForMs) this.wasBusy = true;
    } else if (pct < this.opts.quietPct) {
      if (this.wasBusy) {
        this.quietMs += dt;
        if (this.quietMs >= this.opts.quietForMs) return 'idle';
      } else this.busyMs = 0;
    } else {
      this.quietMs = 0; // in between: still doing something
    }
    return null;
  }
}
