// Lists the apps that start when the user signs in to Windows, and switches
// them on or off the same way Task Manager does: the app's own entry stays in
// place and a flag under "StartupApproved" says whether Windows may run it.
// No Electron imports; `reg.exe` and the Startup folder are injectable for tests.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { StartupApp } from '../shared/types';

const CV = 'Software\\Microsoft\\Windows\\CurrentVersion';
const CV32 = 'Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion';

type Source = 'user' | 'folder' | 'machine' | 'machine32';

/** Where each kind of entry lives, where its on/off flag lives, and whether we may change it. */
const SOURCES: Record<Source, { runKey?: string; approvedKey: string; canChange: boolean }> = {
  user: { runKey: `HKCU\\${CV}\\Run`, approvedKey: `HKCU\\${CV}\\Explorer\\StartupApproved\\Run`, canChange: true },
  folder: { approvedKey: `HKCU\\${CV}\\Explorer\\StartupApproved\\StartupFolder`, canChange: true },
  // Entries for all users need administrator rights to change, so they are shown read-only.
  machine: { runKey: `HKLM\\${CV}\\Run`, approvedKey: `HKLM\\${CV}\\Explorer\\StartupApproved\\Run`, canChange: false },
  machine32: { runKey: `HKLM\\${CV32}\\Run`, approvedKey: `HKLM\\${CV}\\Explorer\\StartupApproved\\Run32`, canChange: false },
};

export interface RegValue {
  name: string;
  type: string;
  data: string;
}

/** Runs reg.exe with the given arguments and resolves to its stdout ('' when the key is missing). */
export type RegRunner = (args: string[]) => Promise<string>;

export const runReg: RegRunner = (args) =>
  new Promise((resolve) => {
    const exe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');
    execFile(exe, args, { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => resolve(err ? '' : String(stdout)));
  });

/** Parses `reg query <key>` output: value lines are indented by four spaces and use four spaces between fields. */
export function parseRegQuery(output: string): RegValue[] {
  const values: RegValue[] = [];
  for (const line of output.split(/\r?\n/)) {
    const m = /^ {4}(.+?) {4}(REG_[A-Z_]+)(?: {4}(.*))?$/.exec(line);
    if (m) values.push({ name: m[1], type: m[2], data: m[3] ?? '' });
  }
  return values;
}

/** A missing flag means "on". Otherwise the first byte decides: even = on (02, 06), odd = off (03, 07). */
export function isApproved(flagHex: string | undefined): boolean {
  if (!flagHex || !/^[0-9a-f]{2}/i.test(flagHex)) return true;
  return parseInt(flagHex.slice(0, 2), 16) % 2 === 0;
}

/** The 12-byte flag Windows expects: state, three zero bytes, then a timestamp (zero is accepted). */
export function approvalFlag(enabled: boolean): string {
  return (enabled ? '02' : '03') + '00'.repeat(11);
}

/** The program a startup command runs, for showing its icon. */
export function programPath(command: string): string {
  const expanded = command.replace(/%([^%]+)%/g, (whole, name: string) => process.env[name] ?? whole).trim();
  const quoted = /^"([^"]+)"/.exec(expanded);
  if (quoted) return quoted[1];
  const exe = /^(.+?\.exe)(?:\s|$)/i.exec(expanded);
  return exe ? exe[1] : expanded.split(/\s+/)[0];
}

/** A readable name: no ".lnk", and no long id that some apps append (e.g. Edge's auto-launch entry). */
export function displayName(name: string): string {
  return name.replace(/\.lnk$/i, '').replace(/_[0-9A-F]{16,}$/i, '').replace(/^MicrosoftEdgeAutoLaunch$/, 'Microsoft Edge');
}

const SKIP_IN_FOLDER = new Set(['desktop.ini', 'thumbs.db']);

export interface StartupOptions {
  run?: RegRunner;
  /** The user's Startup folder (…\Start Menu\Programs\Startup). */
  folder: string;
}

export interface StartupEntry extends StartupApp {
  /** File whose icon represents the app ('' when unknown). */
  iconPath: string;
}

export async function listStartupApps({ run = runReg, folder }: StartupOptions): Promise<StartupEntry[]> {
  const entries: StartupEntry[] = [];
  for (const source of Object.keys(SOURCES) as Source[]) {
    const { runKey, approvedKey, canChange } = SOURCES[source];
    const flags = new Map(parseRegQuery(await run(['query', approvedKey])).map((v) => [v.name.toLowerCase(), v.data]));
    const add = (name: string, detail: string, iconPath: string) =>
      entries.push({ id: `${source}:${name}`, name: displayName(name), detail, enabled: isApproved(flags.get(name.toLowerCase())), canChange, iconPath });

    if (runKey) {
      for (const v of parseRegQuery(await run(['query', runKey]))) {
        if (v.name === '(Default)' || !v.type.endsWith('SZ') || !v.data.trim()) continue;
        add(v.name, v.data, programPath(v.data));
      }
    } else {
      let files: string[] = [];
      try {
        files = fs.readdirSync(folder);
      } catch { /* no Startup folder */ }
      for (const file of files) {
        if (SKIP_IN_FOLDER.has(file.toLowerCase())) continue;
        add(file, 'Startup folder', path.join(folder, file));
      }
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/** Turns one startup app on or off. Only entries we listed, and only the user's own. */
export async function setStartupApp(id: string, enabled: boolean, opts: StartupOptions): Promise<void> {
  const run = opts.run ?? runReg;
  const entry = (await listStartupApps(opts)).find((e) => e.id === id);
  if (!entry) throw new Error('That app is no longer in the startup list.');
  if (!entry.canChange) throw new Error('This app starts for every user of this PC. Change it in Task Manager.');
  const source = id.slice(0, id.indexOf(':')) as Source;
  const name = id.slice(id.indexOf(':') + 1);
  await run(['add', SOURCES[source].approvedKey, '/v', name, '/t', 'REG_BINARY', '/d', approvalFlag(enabled), '/f']);
  const after = (await listStartupApps(opts)).find((e) => e.id === id);
  if (!after || after.enabled !== enabled) throw new Error('Windows did not accept the change.');
}
