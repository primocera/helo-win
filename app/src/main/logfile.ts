// The log file in the data folder, and the text behind "Copy diagnostics" in Settings.
// What must never reach either: the bridge tokens, licence keys, clipboard text and the text
// of other apps' notifications. Callers do not log those; `redact` is the second line of
// defence for secrets that end up inside an error message. No Electron imports.
import fs from 'node:fs';
import path from 'node:path';

/** One line is cut to this length. */
export const MAX_LINE = 600;

/**
 * Removes secrets from a line: the known ones, anything after "Bearer", long random strings
 * (tokens and keys look like that), and the user's home folder, which holds their name.
 */
export function redact(text: string, secrets: string[] = [], home = ''): string {
  let out = String(text);
  for (const secret of secrets) {
    if (secret && secret.length >= 8) out = out.split(secret).join('[hidden]');
  }
  out = out.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [hidden]');
  // UUID-style licence keys, then hex or base64-like runs of 32 or more characters.
  out = out.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[hidden]');
  out = out.replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[hidden]');
  if (home && home.length > 3) {
    for (const form of new Set([home, home.replace(/\\/g, '/'), home.replace(/\\/g, '\\\\')])) {
      // Windows paths come back in either case.
      const lower = form.toLowerCase();
      let at = out.toLowerCase().indexOf(lower);
      while (at !== -1) {
        out = `${out.slice(0, at)}~${out.slice(at + form.length)}`;
        at = out.toLowerCase().indexOf(lower, at + 1);
      }
    }
  }
  return out;
}

export interface LogOptions {
  /** The file is renamed to `<file>.1` when it passes this size, so two files at most exist. */
  maxBytes?: number;
  /** Values that are hidden wherever they appear. Can change while the app runs. */
  secrets?: () => string[];
  home?: string;
  now?: () => Date;
}

export class LogFile {
  private size = -1;
  private readonly maxBytes: number;
  private readonly secrets: () => string[];
  private readonly home: string;
  private readonly now: () => Date;

  constructor(readonly file: string, { maxBytes = 200_000, secrets = () => [], home = '', now = () => new Date() }: LogOptions = {}) {
    this.maxBytes = maxBytes;
    this.secrets = secrets;
    this.home = home;
    this.now = now;
  }

  /** Appends one line. Never throws: a full disk must not take the app down. */
  write(message: string): void {
    try {
      const clean = redact(message, this.secrets(), this.home).replace(/\s*[\r\n]+\s*/g, ' | ');
      const line = `${this.now().toISOString()} ${clean.length > MAX_LINE ? `${clean.slice(0, MAX_LINE)}…` : clean}\n`;
      if (this.size < 0) {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        this.size = fs.existsSync(this.file) ? fs.statSync(this.file).size : 0;
      }
      if (this.size + Buffer.byteLength(line) > this.maxBytes && this.size > 0) {
        fs.renameSync(this.file, `${this.file}.1`);
        this.size = 0;
      }
      fs.appendFileSync(this.file, line);
      this.size += Buffer.byteLength(line);
    } catch { /* nowhere left to report it */ }
  }

  /** The newest lines, oldest first, reaching into the previous file when the current one is short. */
  tail(count: number): string[] {
    const read = (file: string) => {
      try {
        return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
      } catch {
        return [];
      }
    };
    let lines = read(this.file);
    if (lines.length < count) lines = [...read(`${this.file}.1`), ...lines];
    return lines.slice(-count);
  }
}

export interface DiagnosticsInput {
  appName: string;
  version: string;
  packaged: boolean;
  electron: string;
  windows: string;
  /** The port the bridge listens on, or 0 when it could not start. */
  port: number;
  bridgeError: string;
  helper: string;
  license: string;
  displays: number;
  /** Feature switches, by name. */
  features: Record<string, boolean>;
  agents: Record<string, { connected: boolean; note: string }>;
  /** Other apps with a notification switch: how many, never which. */
  notificationApps: number;
  log: string[];
}

/** The text the user pastes into a support email. Holds no tokens, keys, clipboard or notification text. */
export function diagnosticsText(d: DiagnosticsInput): string {
  const on = Object.entries(d.features).filter(([, v]) => v).map(([k]) => k);
  const off = Object.entries(d.features).filter(([, v]) => !v).map(([k]) => k);
  const lines = [
    `${d.appName} ${d.version}${d.packaged ? '' : ' (development build)'}`,
    `Windows ${d.windows} · Electron ${d.electron}`,
    `Local port: ${d.port ? d.port : `not open${d.bridgeError ? ` (${d.bridgeError})` : ''}`}`,
    `Windows helper: ${d.helper}`,
    `License: ${d.license}`,
    `Displays: ${d.displays}`,
    `Features on: ${on.join(', ') || 'none'}`,
    `Features off: ${off.join(', ') || 'none'}`,
    `Apps with a notification switch: ${d.notificationApps}`,
    '',
    'Agents',
    ...Object.entries(d.agents).map(([name, a]) => `  ${name}: ${a.connected ? 'connected' : 'not connected'}${a.note ? ` · ${a.note}` : ''}`),
    '',
    `Log (last ${d.log.length} lines)`,
    ...(d.log.length ? d.log.map((l) => `  ${l}`) : ['  (empty)']),
  ];
  return `${lines.join('\n')}\n`;
}
