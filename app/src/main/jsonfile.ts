// Small helpers for JSON files in the user data folder.
import fs from 'node:fs';
import path from 'node:path';

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/** Writes through a temp file and a rename so a crash never leaves half a file. */
export function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

/** Collapses many writes into one, `ms` after the last call. */
export function debounced(fn: () => void, ms: number): { (): void; flush(): void } {
  let timer: NodeJS.Timeout | null = null;
  const run = () => {
    timer = null;
    fn();
  };
  const call = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, ms);
  };
  call.flush = () => {
    if (timer) {
      clearTimeout(timer);
      run();
    }
  };
  return call;
}
