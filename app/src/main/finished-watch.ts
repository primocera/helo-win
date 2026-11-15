// File-system watchers for "Finished" alerts. They use fs.watch (Windows
// ReadDirectoryChangesW), so nothing is polled while nothing changes.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { finishedDownloads, snapshot, steamLibraries, parseAcf, steamBecameReady, type DownloadSnapshot, type SteamApp } from './finished';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Watches one Downloads folder and reports files that finished downloading. */
export class DownloadWatcher {
  private watcher: fs.FSWatcher | null = null;
  private snap: DownloadSnapshot = snapshot([]);
  private timer: NodeJS.Timeout | null = null;
  private reported = new Map<string, number>();

  constructor(private dir: string, private onFinished: (file: string) => void, private log: (m: string) => void = () => {}) {}

  start() {
    if (this.watcher) return;
    try {
      this.snap = snapshot(fs.readdirSync(this.dir));
      this.watcher = fs.watch(this.dir, { persistent: false }, () => this.schedule());
      this.watcher.on('error', (err) => {
        this.log(`downloads watcher: ${err.message}`);
        this.stop();
      });
    } catch (err) {
      this.log(`downloads watcher could not start: ${(err as Error).message}`);
      this.watcher = null;
    }
  }

  stop() {
    this.watcher?.close();
    this.watcher = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  get running() {
    return this.watcher !== null;
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.scan(), 700);
  }

  private async scan() {
    let names: string[];
    try {
      names = fs.readdirSync(this.dir);
    } catch {
      return;
    }
    const { candidates, next } = finishedDownloads(this.snap, names);
    this.snap = next;
    for (const name of candidates) void this.confirm(path.join(this.dir, name));
  }

  /** Announces a file once it has a size and the size stops changing. */
  private async confirm(file: string) {
    let last = -1;
    for (let i = 0; i < 10; i++) {
      let size = -1;
      try {
        const st = fs.statSync(file);
        if (!st.isFile()) return;
        size = st.size;
      } catch {
        return;
      }
      if (size > 0 && size === last) {
        const key = file.toLowerCase();
        if (Date.now() - (this.reported.get(key) ?? 0) < 60_000) return;
        this.reported.set(key, Date.now());
        this.onFinished(file);
        return;
      }
      last = size;
      await wait(1000);
    }
  }
}

const IMAGE = /\.(png|jpe?g)$/i;

/** New image names in a folder listing, compared with the names seen before. */
export function newImages(seen: Set<string>, names: string[]): string[] {
  return names.filter((n) => IMAGE.test(n) && !seen.has(n));
}

/** Watches the Screenshots folder (Win+PrtScn, Snipping Tool autosave) and reports each new image once it is fully written. */
export class ScreenshotWatcher {
  private watcher: fs.FSWatcher | null = null;
  private seen = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private dir: string, private onShot: (file: string) => void, private log: (m: string) => void = () => {}) {}

  start() {
    if (this.watcher) return;
    try {
      this.seen = new Set(fs.readdirSync(this.dir));
      this.watcher = fs.watch(this.dir, { persistent: false }, () => {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.scan(), 400);
      });
      this.watcher.on('error', (err) => {
        this.log(`screenshots watcher: ${err.message}`);
        this.stop();
      });
    } catch {
      this.watcher = null; // no Screenshots folder yet
    }
  }

  stop() {
    this.watcher?.close();
    this.watcher = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  get running() {
    return this.watcher !== null;
  }

  private async scan() {
    let names: string[];
    try {
      names = fs.readdirSync(this.dir);
    } catch {
      return;
    }
    const fresh = newImages(this.seen, names);
    this.seen = new Set(names);
    for (const name of fresh) {
      const file = path.join(this.dir, name);
      let last = -1;
      for (let i = 0; i < 10; i++) {
        let size = -1;
        try {
          size = fs.statSync(file).size;
        } catch {
          break;
        }
        if (size > 0 && size === last) {
          this.onShot(file);
          break;
        }
        last = size;
        await wait(300);
      }
    }
  }
}

/** Steam's install folder from the registry (HKCU\Software\Valve\Steam\SteamPath), or null. */
export function findSteamPath(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      const m = !err && /SteamPath\s+REG_SZ\s+(.+)/i.exec(stdout);
      const p = m ? path.normalize(m[1].trim()) : null;
      resolve(p && fs.existsSync(p) ? p : null);
    });
  });
}

/** Watches every Steam library's appmanifest_*.acf files for finished downloads/updates. */
export class SteamWatcher {
  private watchers: fs.FSWatcher[] = [];
  private apps = new Map<string, SteamApp>();
  private timers = new Map<string, NodeJS.Timeout>();
  libraries: string[] = [];
  steamPath: string | null = null;

  /** `libraries` overrides discovery (used by the self-test with a temporary library). */
  constructor(private onReady: (app: SteamApp) => void, private log: (m: string) => void = () => {}, private libraryOverride?: string[]) {}

  async start(): Promise<boolean> {
    if (this.watchers.length) return true;
    let libs: string[];
    if (this.libraryOverride) libs = this.libraryOverride;
    else {
      this.steamPath = await findSteamPath();
      if (!this.steamPath) return false;
      libs = [this.steamPath];
      try {
        libs = steamLibraries(fs.readFileSync(path.join(this.steamPath, 'steamapps', 'libraryfolders.vdf'), 'utf8'));
        if (!libs.length) libs = [this.steamPath];
      } catch { /* single default library */ }
    }
    this.libraries = libs;
    for (const lib of libs) {
      const dir = path.join(lib, 'steamapps');
      try {
        for (const f of fs.readdirSync(dir)) if (/^appmanifest_\d+\.acf$/i.test(f)) this.read(path.join(dir, f), false);
        const w = fs.watch(dir, { persistent: false }, (_ev, name) => {
          const f = name ? String(name) : '';
          if (!/^appmanifest_\d+\.acf$/i.test(f)) return;
          const file = path.join(dir, f);
          const t = this.timers.get(file);
          if (t) clearTimeout(t);
          this.timers.set(file, setTimeout(() => this.read(file, true), 1500));
        });
        w.on('error', (err) => this.log(`steam watcher ${dir}: ${err.message}`));
        this.watchers.push(w);
      } catch (err) {
        this.log(`steam library ${dir}: ${(err as Error).message}`);
      }
    }
    return this.watchers.length > 0;
  }

  stop() {
    for (const w of this.watchers) w.close();
    this.watchers = [];
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  get running() {
    return this.watchers.length > 0;
  }

  get appCount() {
    return this.apps.size;
  }

  private read(file: string, announce: boolean) {
    let app: SteamApp | null = null;
    try {
      app = parseAcf(fs.readFileSync(file, 'utf8'));
    } catch {
      return; // being rewritten or deleted; the next change event re-reads it
    }
    if (!app) return;
    const prev = this.apps.get(app.appid);
    this.apps.set(app.appid, app);
    if (announce && steamBecameReady(prev, app)) this.onReady(app);
  }
}
