// The saved port is taken by another program (S7): the bridge moves, and the hooks follow.
import { test, expect } from 'vitest';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createBridge, portCandidates, PORT_TRIES, HELLO_PATH } from '../src/main/bridge';
import * as hooks from '../src/main/hooks-install';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'helo-test-'));
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const newBridge = () => createBridge({ token: 'tok', onEvent: () => {}, onPermission: async () => null });

/** Another program on a port of its own. */
async function squatter(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = http.createServer((_req, res) => res.writeHead(200).end('not helo'));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  return {
    port: typeof addr === 'object' && addr ? addr.port : 0,
    close: () => new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }),
  };
}

test('the ports tried: the saved one, the next few, then any free one', () => {
  const list = portCandidates(47615);
  expect(list[0]).toBe(47615);
  expect(list[1]).toBe(47616);
  expect(list.length).toBe(PORT_TRIES + 2);
  expect(list[list.length - 1]).toBe(0);
  expect(portCandidates(65535)).toEqual([65535, 0]);
});

test('a free port is used as it is', async () => {
  const other = await squatter();
  const free = other.port;
  await other.close();
  const bridge = newBridge();
  try {
    expect(await bridge.listenOrFallback(free)).toBe(free);
  } finally {
    await bridge.close();
  }
});

test('a taken port: the bridge moves to another one and works there', async () => {
  const other = await squatter();
  const bridge = newBridge();
  try {
    const port = await bridge.listenOrFallback(other.port);
    expect(port).not.toBe(other.port);
    expect(port).toBeGreaterThan(0);
    const res = await fetch(`http://127.0.0.1:${port}/helo/hook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ hook_event_name: 'Stop' }),
    });
    expect(res.status).toBe(200);
  } finally {
    await bridge.close();
    await other.close();
  }
});

test('hello: says it is Helo without a token, and another program on the port does not', async () => {
  const other = await squatter();
  const bridge = newBridge();
  const port = await bridge.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${port}${HELLO_PATH}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ app: 'helo' });
    // The hook routes still need the token.
    expect((await fetch(`http://127.0.0.1:${port}/helo/hook`, { method: 'POST', body: '{}' })).status).toBe(401);
    expect(await (await fetch(`http://127.0.0.1:${other.port}${HELLO_PATH}`)).text()).toBe('not helo');
  } finally {
    await bridge.close();
    await other.close();
  }
});

test('moving port: connected agents follow, the others are left alone', () => {
  const dir = tmp();
  const files = {
    claude: path.join(dir, 'claude.json'),
    codex: path.join(dir, 'codex.json'),
    gemini: path.join(dir, 'gemini.json'),
    cursor: path.join(dir, 'cursor.json'),
  };
  const from = { port: 47615, token: 'a'.repeat(48) };
  const to = { port: 47616, token: from.token };
  const mine = { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node mine.js' }] }] } };
  fs.writeFileSync(files.claude, JSON.stringify(mine));
  hooks.install(files.claude, { ...from, statusLine: true, map: true });
  hooks.installCursor(files.cursor, from);
  const geminiOwn = { theme: 'Dracula' };
  fs.writeFileSync(files.gemini, JSON.stringify(geminiOwn));

  const result = hooks.movePort(files, from, { ...to, statusLine: true, map: true });
  expect(result).toEqual({ moved: ['claude', 'cursor'], failed: [] });

  const claude = hooks.inspect(files.claude, to);
  expect(claude).toMatchObject({ installed: true, map: true, statusLine: 'ours' });
  expect(hooks.isInstalled(files.claude, from)).toBe(false);
  const text = fs.readFileSync(files.claude, 'utf8');
  expect(text).not.toContain(':47615');
  expect(text).toContain('node mine.js');
  expect(hooks.isCursorInstalled(files.cursor, to)).toBe(true);
  expect(fs.readFileSync(files.cursor, 'utf8')).not.toContain(':47615');
  // Not connected: not created, not changed.
  expect(fs.existsSync(files.codex)).toBe(false);
  expect(read(files.gemini)).toEqual(geminiOwn);
  // Disconnecting still gives back the user's own file.
  hooks.uninstall(files.claude);
  expect(read(files.claude)).toEqual(mine);
});

test('moving port: a file that cannot be read is reported, not overwritten', () => {
  const dir = tmp();
  const files = { claude: path.join(dir, 'c.json'), codex: path.join(dir, 'x.json'), gemini: path.join(dir, 'g.json'), cursor: path.join(dir, 'u.json') };
  const from = { port: 47615, token: 'b'.repeat(48) };
  hooks.installCodex(files.codex, from);
  fs.writeFileSync(files.claude, '{ broken');
  const result = hooks.movePort(files, from, { ...from, port: 50000 });
  expect(result).toEqual({ moved: ['codex'], failed: [] });
  expect(fs.readFileSync(files.claude, 'utf8')).toBe('{ broken');
  expect(hooks.isCodexInstalled(files.codex, { ...from, port: 50000 })).toBe(true);
});

// Uninstalling (B2, R4): the agents' files go back to what the user had.
test('uninstall: hooks leave every agent\'s file, and Helo\'s backups go too', () => {
  const dir = tmp();
  const files = { claude: path.join(dir, 'c.json'), codex: path.join(dir, 'x.json'), gemini: path.join(dir, 'g.json'), cursor: path.join(dir, 'u.json') };
  const opts = { port: 47615, token: 'c'.repeat(48) };
  const mine = { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node mine.js' }] }] } };
  fs.writeFileSync(files.claude, JSON.stringify(mine));
  hooks.install(files.claude, { ...opts, statusLine: true, map: true });
  hooks.installCodex(files.codex, opts);
  hooks.installCursor(files.cursor, opts);
  // Gemini was never connected: the user's own file, byte for byte.
  const geminiText = '{ "theme": "Dracula" }';
  fs.writeFileSync(files.gemini, geminiText);
  expect(fs.existsSync(`${files.claude}.helo-backup`)).toBe(true);

  expect(hooks.removeAll(files)).toEqual({ removed: ['claude', 'codex', 'cursor'], failed: [] });
  expect(read(files.claude)).toEqual(mine);
  expect(read(files.codex)).toEqual({});
  expect(read(files.cursor)).toEqual({ version: 1, hooks: {} });
  expect(fs.readFileSync(files.gemini, 'utf8')).toBe(geminiText);
  for (const file of Object.values(files)) expect(fs.readFileSync(file, 'utf8')).not.toContain('/helo/');
  expect(fs.readdirSync(dir).sort()).toEqual(['c.json', 'g.json', 'u.json', 'x.json']);
  // A second run changes nothing.
  expect(hooks.removeAll(files)).toEqual({ removed: [], failed: [] });
});

test('uninstall: missing files are not created, and a broken one is reported and left alone', () => {
  const dir = tmp();
  const files = { claude: path.join(dir, 'c.json'), codex: path.join(dir, 'nope', 'x.json'), gemini: path.join(dir, 'g.json'), cursor: path.join(dir, 'u.json') };
  fs.writeFileSync(files.claude, '{ broken');
  fs.writeFileSync(`${files.claude}.helo-backup`, '{}');
  expect(hooks.removeAll(files)).toEqual({ removed: [], failed: ['claude'] });
  expect(fs.readFileSync(files.claude, 'utf8')).toBe('{ broken');
  expect(fs.existsSync(`${files.claude}.helo-backup`)).toBe(true);
  expect(fs.readdirSync(dir).sort()).toEqual(['c.json', 'c.json.helo-backup']);
});
