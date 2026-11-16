// The log file and "Copy diagnostics" (T1): what is kept, and what must never be in either.
import { test, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LogFile, redact, diagnosticsText, MAX_LINE } from '../src/main/logfile';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'helo-test-'));
const TOKEN = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4';

test('redact: tokens, bearer headers, keys and the home folder are hidden', () => {
  expect(redact(`curl failed: -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:47615/helo/hook`, [TOKEN]))
    .toBe('curl failed: -H "Authorization: Bearer [hidden]" http://127.0.0.1:47615/helo/hook');
  // A token nobody listed is still caught: after "Bearer", and as a long random run.
  expect(redact('Bearer shortsecret')).toBe('Bearer [hidden]');
  expect(redact(`token=${TOKEN}`)).toBe('token=[hidden]');
  expect(redact('key 38b1460a-5104-4067-a91d-77b872934d51 rejected')).toBe('key [hidden] rejected');
  expect(redact('ENOENT: C:\\Users\\Ana\\.claude\\settings.json', [], 'C:\\Users\\Ana')).toBe('ENOENT: ~\\.claude\\settings.json');
  expect(redact('open c:/users/ana/Downloads/a.zip', [], 'C:\\Users\\Ana')).toBe('open ~/Downloads/a.zip');
  expect(redact('helper failed: exit 1')).toBe('helper failed: exit 1');
  // A short "secret" is not used, or it would chew up ordinary words.
  expect(redact('port busy', ['port'])).toBe('port busy');
});

test('log file: lines are dated, cleaned and kept on one line', () => {
  const file = path.join(tmp(), 'data', 'helo.log');
  const log = new LogFile(file, { secrets: () => [TOKEN], home: 'C:\\Users\\Ana', now: () => new Date('2026-11-16T08:00:00Z') });
  log.write(`hooks update failed: EPERM C:\\Users\\Ana\\.claude\\settings.json ${TOKEN}`);
  log.write('uncaught: Error: boom\n    at a (x.js:1)\n    at b (y.js:2)');
  log.write('x'.repeat(MAX_LINE + 50));
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  expect(lines[0]).toBe('2026-11-16T08:00:00.000Z hooks update failed: EPERM ~\\.claude\\settings.json [hidden]');
  expect(lines[1]).toBe('2026-11-16T08:00:00.000Z uncaught: Error: boom | at a (x.js:1) | at b (y.js:2)');
  expect(lines.length).toBe(3);
  expect(lines[2].length).toBeLessThan(MAX_LINE + 40);
  expect(fs.readFileSync(file, 'utf8')).not.toContain(TOKEN);
});

test('log file: it rolls over into one older file and never grows past the limit', () => {
  const file = path.join(tmp(), 'helo.log');
  const log = new LogFile(file, { maxBytes: 2000 });
  for (let i = 0; i < 200; i++) log.write(`line ${i} ${'.'.repeat(40)}`);
  expect(fs.statSync(file).size).toBeLessThanOrEqual(2000);
  expect(fs.statSync(`${file}.1`).size).toBeLessThanOrEqual(2000);
  expect(fs.readdirSync(path.dirname(file)).sort()).toEqual(['helo.log', 'helo.log.1']);
  const tail = log.tail(5);
  expect(tail.length).toBe(5);
  expect(tail[4]).toContain('line 199 ');
  expect(tail[0]).toContain('line 195 ');
  // The tail reaches into the older file when the new one has just started.
  expect(log.tail(40).length).toBe(40);
  // A second run of the app carries on in the same file.
  const again = new LogFile(file, { maxBytes: 2000 });
  again.write('after restart');
  expect(again.tail(1)[0]).toContain('after restart');
  expect(again.tail(2)[0]).toContain('line 199 ');
});

test('log file: a folder that cannot be written does not throw', () => {
  const dir = tmp();
  const blocker = path.join(dir, 'file');
  fs.writeFileSync(blocker, 'x');
  const log = new LogFile(path.join(blocker, 'helo.log'));
  expect(() => log.write('hello')).not.toThrow();
  expect(log.tail(10)).toEqual([]);
});

test('diagnostics: states and the end of the log, in plain text', () => {
  const text = diagnosticsText({
    appName: 'Helo',
    version: '0.1.0',
    packaged: true,
    electron: '45.3.1',
    windows: '10.0.19045',
    port: 47616,
    bridgeError: '',
    helper: 'running',
    license: 'trial, 9 days left',
    displays: 2,
    features: { agents: true, clipboard: false, map: true },
    agents: { claude: { connected: true, note: '' }, codex: { connected: false, note: 'Codex CLI does not seem to be installed (no ~/.codex folder).' } },
    notificationApps: 3,
    log: ['2026-11-16T08:00:00.000Z helper running'],
  });
  expect(text).toContain('Helo 0.1.0\n');
  expect(text).toContain('Windows 10.0.19045 · Electron 45.3.1');
  expect(text).toContain('Local port: 47616');
  expect(text).toContain('Features on: agents, map');
  expect(text).toContain('Features off: clipboard');
  expect(text).toContain('  claude: connected\n');
  expect(text).toContain('  codex: not connected · Codex CLI does not seem');
  expect(text).toContain('Apps with a notification switch: 3');
  expect(text).toContain('  2026-11-16T08:00:00.000Z helper running');
  const broken = diagnosticsText({
    appName: 'Helo', version: '0.1.0', packaged: false, electron: '45', windows: '10', port: 0, bridgeError: 'listen EACCES', helper: 'failed',
    license: 'expired', displays: 1, features: {}, agents: {}, notificationApps: 0, log: [],
  });
  expect(broken).toContain('Helo 0.1.0 (development build)');
  expect(broken).toContain('Local port: not open (listen EACCES)');
  expect(broken).toContain('  (empty)');
});
