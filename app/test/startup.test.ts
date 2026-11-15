// Tests for the startup-apps list and its on/off switch, against a fake registry.
import { test, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { displayName, parseRegQuery, isApproved, approvalFlag, programPath, listStartupApps, setStartupApp, type RegRunner } from '../src/main/startup-apps';

const CV = 'Software\\Microsoft\\Windows\\CurrentVersion';
const USER_RUN = `HKCU\\${CV}\\Run`;
const USER_FLAGS = `HKCU\\${CV}\\Explorer\\StartupApproved\\Run`;
const FOLDER_FLAGS = `HKCU\\${CV}\\Explorer\\StartupApproved\\StartupFolder`;
const MACHINE_RUN = `HKLM\\${CV}\\Run`;

/** A tiny in-memory registry that answers `reg query` and `reg add` like reg.exe prints them. */
function fakeRegistry(keys: Record<string, Record<string, [string, string]>>) {
  const calls: string[][] = [];
  const run: RegRunner = async (args) => {
    calls.push(args);
    const [verb, key] = args;
    if (verb === 'query') {
      const values = keys[key];
      if (!values) return '';
      return `\r\n${key}\r\n${Object.entries(values).map(([n, [t, d]]) => `    ${n}    ${t}    ${d}`).join('\r\n')}\r\n\r\n`;
    }
    if (verb === 'add') {
      const name = args[args.indexOf('/v') + 1];
      (keys[key] ??= {})[name] = [args[args.indexOf('/t') + 1], args[args.indexOf('/d') + 1].toUpperCase()];
    }
    return '';
  };
  return { run, calls, keys };
}

function startupFolder(files: string[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'helo-startup-'));
  for (const f of files) fs.writeFileSync(path.join(dir, f), '');
  return dir;
}

test('startup: reg query output is parsed, including names with spaces and empty data', () => {
  const out = '\r\nHKEY_CURRENT_USER\\Software\\X\r\n    My App    REG_SZ    "C:\\Program Files\\My App\\app.exe" --hidden\r\n    Empty    REG_SZ\r\n    Flag    REG_BINARY    0300000012AB\r\n';
  expect(parseRegQuery(out)).toEqual([
    { name: 'My App', type: 'REG_SZ', data: '"C:\\Program Files\\My App\\app.exe" --hidden' },
    { name: 'Empty', type: 'REG_SZ', data: '' },
    { name: 'Flag', type: 'REG_BINARY', data: '0300000012AB' },
  ]);
});

test('startup: flag bytes follow Task Manager (missing or even = on, odd = off)', () => {
  expect(isApproved(undefined)).toBe(true);
  expect(isApproved('020000000000000000000000')).toBe(true);
  expect(isApproved('0600000000')).toBe(true);
  expect(isApproved('030000005A7E')).toBe(false);
  expect(isApproved('07')).toBe(false);
  expect(approvalFlag(false)).toBe('030000000000000000000000');
  expect(isApproved(approvalFlag(true))).toBe(true);
});

test('startup: the program is found in quoted, unquoted and bare commands', () => {
  expect(programPath('"C:\\Program Files\\A\\a.exe" --min')).toBe('C:\\Program Files\\A\\a.exe');
  expect(programPath('C:\\Program Files\\B\\b.exe /background')).toBe('C:\\Program Files\\B\\b.exe');
  expect(programPath('C:\\Tools\\c.exe')).toBe('C:\\Tools\\c.exe');
});

test('startup: names are shown without .lnk or appended ids', () => {
  expect(displayName('Notes.lnk')).toBe('Notes');
  expect(displayName('MicrosoftEdgeAutoLaunch_91B0C76AE6D4AEE017BAC2F6FB67B5EF')).toBe('Microsoft Edge');
  expect(displayName('Steam')).toBe('Steam');
});

test('startup: lists the user, folder and all-users entries with their state', async () => {
  const reg = fakeRegistry({
    [USER_RUN]: { Discord: ['REG_SZ', '"C:\\Apps\\Discord\\Update.exe" --processStart Discord.exe'], Steam: ['REG_SZ', '"C:\\Steam\\steam.exe" -silent'] },
    [USER_FLAGS]: { Steam: ['REG_BINARY', '030000001122334455667788'] },
    [FOLDER_FLAGS]: { 'Notes.lnk': ['REG_BINARY', '030000000000000000000000'] },
    [MACHINE_RUN]: { SecurityHealth: ['REG_EXPAND_SZ', '%windir%\\system32\\SecurityHealthSystray.exe'] },
  });
  const folder = startupFolder(['Notes.lnk', 'desktop.ini']);
  const apps = await listStartupApps({ run: reg.run, folder });
  expect(apps.map((a) => [a.id, a.name, a.enabled, a.canChange])).toEqual([
    ['user:Discord', 'Discord', true, true],
    ['folder:Notes.lnk', 'Notes', false, true],
    ['machine:SecurityHealth', 'SecurityHealth', true, false],
    ['user:Steam', 'Steam', false, true],
  ]);
  expect(apps[0].iconPath).toBe('C:\\Apps\\Discord\\Update.exe');
});

test('startup: switching an app off and on writes only its flag, never the app entry', async () => {
  const reg = fakeRegistry({ [USER_RUN]: { Discord: ['REG_SZ', '"C:\\Apps\\Discord\\Update.exe"'] } });
  const opts = { run: reg.run, folder: startupFolder(['Notes.lnk']) };

  await setStartupApp('user:Discord', false, opts);
  expect(reg.keys[USER_FLAGS].Discord[1]).toBe('030000000000000000000000');
  expect(reg.keys[USER_RUN].Discord[1]).toBe('"C:\\Apps\\Discord\\Update.exe"');
  expect((await listStartupApps(opts)).find((a) => a.id === 'user:Discord')?.enabled).toBe(false);

  await setStartupApp('user:Discord', true, opts);
  expect((await listStartupApps(opts)).find((a) => a.id === 'user:Discord')?.enabled).toBe(true);

  await setStartupApp('folder:Notes.lnk', false, opts);
  expect(reg.keys[FOLDER_FLAGS]['Notes.lnk'][1]).toBe('030000000000000000000000');
  expect(reg.calls.filter((c) => c[0] === 'add').every((c) => c[1].includes('StartupApproved'))).toBe(true);
});

test('startup: all-users entries and unknown ids are refused without writing', async () => {
  const reg = fakeRegistry({ [MACHINE_RUN]: { Driver: ['REG_SZ', 'C:\\Drv\\d.exe'] } });
  const opts = { run: reg.run, folder: startupFolder([]) };
  await expect(setStartupApp('machine:Driver', false, opts)).rejects.toThrow(/Task Manager/);
  await expect(setStartupApp('user:Nope', false, opts)).rejects.toThrow(/no longer/);
  expect(reg.calls.some((c) => c[0] === 'add')).toBe(false);
});
