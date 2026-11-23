// Tests for the browser-chat feature: the extension's messages, the bridge's
// web route, and the extension's own files.
import { test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createBridge } from '../src/main/bridge';
import { AgentTracker } from '../src/main/agents';
import { parseWebMessage, chatTitle, trackerEvent, webBanner, pairingCode, chromePath, WEB_SOURCE } from '../src/main/webchat';

const HOOK_TOKEN = 'h'.repeat(48);
const WEB_TOKEN = 'a'.repeat(48);

test('webchat: valid messages are accepted and anything else is dropped', () => {
  expect(parseWebMessage({ site: 'claude', state: 'working', id: '12', title: 'Trip plan - Claude', focused: true }))
    .toEqual({ site: 'claude', state: 'working', id: '12', title: 'Trip plan', focused: true });
  expect(parseWebMessage({ site: 'chatgpt', state: 'done', id: '7', title: 42 })?.title).toBe('');
  expect(parseWebMessage({ site: 'gemini', state: 'done', id: '1' })).toBeNull();
  expect(parseWebMessage({ site: 'claude', state: 'exploding', id: '1' })).toBeNull();
  expect(parseWebMessage({ site: 'claude', state: 'done', id: '../x' })).toBeNull();
  expect(parseWebMessage(null)).toBeNull();
});

test('webchat: the site name is removed from the chat title', () => {
  expect(chatTitle('Budget ideas - Claude', 'claude')).toBe('Budget ideas');
  expect(chatTitle('Budget ideas | ChatGPT', 'chatgpt')).toBe('Budget ideas');
  expect(chatTitle('Claude', 'claude')).toBe('');
  expect(chatTitle('ChatGPT', 'chatgpt')).toBe('');
});

test('webchat: a banner appears only when the answer finished while the user looked elsewhere', () => {
  const done = { site: 'chatgpt' as const, state: 'done' as const, id: '3', title: 'Recipe', focused: false };
  expect(webBanner(done)).toEqual({ kind: 'done', title: 'ChatGPT finished answering', text: 'Recipe' });
  expect(webBanner({ ...done, focused: true })).toBeNull();
  expect(webBanner({ ...done, state: 'working' })).toBeNull();
  expect(webBanner({ ...done, state: 'gone' })).toBeNull();
});

test('webchat: chats show up in the session list as working, then done', () => {
  const tracker = new AgentTracker();
  const msg = { site: 'claude' as const, state: 'working' as const, id: '5', title: 'Trip plan', focused: true };
  expect(tracker.record(trackerEvent(msg), WEB_SOURCE.claude)).toBe(true);
  expect(tracker.list()[0]).toMatchObject({ agent: 'claude-web', project: 'Trip plan', mood: 'working' });
  expect(tracker.mood()).toBe('working');
  tracker.record(trackerEvent({ ...msg, state: 'done' }), WEB_SOURCE.claude);
  expect(tracker.list()).toHaveLength(1);
  expect(tracker.mood()).toBe('done');
  // An untitled chat still gets a readable name.
  tracker.record(trackerEvent({ ...msg, site: 'chatgpt', id: '6', title: '' }), WEB_SOURCE.chatgpt);
  expect(tracker.list().some((s) => s.project === 'ChatGPT chat')).toBe(true);
});

async function withBridge(fn: (post: (route: string, token: string, body: unknown) => Promise<Response>, seen: { web: unknown[]; events: unknown[] }) => Promise<void>) {
  const seen = { web: [] as unknown[], events: [] as unknown[] };
  const bridge = createBridge({
    token: HOOK_TOKEN,
    webToken: WEB_TOKEN,
    onPermission: async () => 'allow',
    onEvent: (e) => seen.events.push(e),
    onWeb: (b) => seen.web.push(b),
  });
  const port = await bridge.listen(0);
  const post = (route: string, token: string, body: unknown) => fetch(`http://127.0.0.1:${port}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  try {
    await fn(post, seen);
  } finally {
    await bridge.close();
  }
}

test('bridge: the web route takes the extension token, passes messages on, and answers pings', async () => {
  await withBridge(async (post, seen) => {
    expect((await post('/helo/web', WEB_TOKEN, { state: 'ping' })).status).toBe(200);
    expect(seen.web).toHaveLength(0);
    expect((await post('/helo/web', WEB_TOKEN, { site: 'claude', state: 'working', id: '1' })).status).toBe(200);
    expect(seen.web).toEqual([{ site: 'claude', state: 'working', id: '1' }]);
  });
});

test('bridge: the extension token cannot answer agent requests, and the hook token cannot use the web route', async () => {
  await withBridge(async (post, seen) => {
    const permission = { hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'ls' } };
    expect((await post('/helo/hook', WEB_TOKEN, permission)).status).toBe(401);
    expect((await post('/helo/hook', WEB_TOKEN, { hook_event_name: 'Stop' })).status).toBe(401);
    expect((await post('/helo/web', HOOK_TOKEN, { site: 'claude', state: 'done', id: '1' })).status).toBe(401);
    expect((await post('/helo/web', 'wrong', { state: 'ping' })).status).toBe(401);
    expect(seen.web).toHaveLength(0);
    expect(seen.events).toHaveLength(0);
  });
});

test('extension: the pairing code Helo shows is one the extension accepts', () => {
  const background = fs.readFileSync(path.join(__dirname, '..', 'extension', 'background.js'), 'utf8');
  const pattern = /const m = (\/.+\/i)\.exec/.exec(background);
  expect(pattern).not.toBeNull();
  const regex = new RegExp(pattern![1].slice(1, -2), 'i');
  expect(regex.test(pairingCode(47615, WEB_TOKEN))).toBe(true);
  expect(regex.test('not-a-code')).toBe(false);
});

test('extension: the manifest is valid and only reaches the chat sites and this PC', () => {
  const dir = path.join(__dirname, '..', 'extension');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.host_permissions).toEqual(['http://127.0.0.1/*']);
  expect(manifest.permissions).toEqual(['storage']);
  expect(manifest.content_scripts[0].matches).toEqual(['https://claude.ai/*', 'https://chatgpt.com/*', 'https://chat.openai.com/*']);
  for (const file of [manifest.background.service_worker, manifest.action.default_popup, ...manifest.content_scripts[0].js, 'popup.js']) {
    expect(fs.existsSync(path.join(dir, file))).toBe(true);
  }
});

test('bridge: the pairing code goes only to an extension, and only while Settings is waiting for one', async () => {
  let open = true;
  let seen = 0;
  const bridge = createBridge({
    token: HOOK_TOKEN,
    webToken: WEB_TOKEN,
    onPermission: async () => 'allow',
    onEvent: () => {},
    webPairCode: () => (open ? pairingCode(47615, WEB_TOKEN) : null),
    onWebSeen: () => { seen++; },
  });
  const port = await bridge.listen(0);
  const ask = (origin?: string) => fetch(`http://127.0.0.1:${port}/helo/pair`, { headers: origin ? { Origin: origin } : {} });
  try {
    const ext = 'chrome-extension://' + 'abcdefghijklmnopabcdefghijklmnop';
    const res = await ask(ext);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: pairingCode(47615, WEB_TOKEN) });
    expect(seen).toBe(1);
    expect((await ask('extension://' + 'p'.repeat(32))).status).toBe(200); // Edge's spelling
    expect((await ask('https://claude.ai')).status).toBe(403);
    expect((await ask('chrome-extension://short')).status).toBe(403);
    expect((await ask()).status).toBe(403);
    open = false;
    expect((await ask(ext)).status).toBe(403);
  } finally {
    await bridge.close();
  }
});

test('webchat: Chrome is found per machine or per user', () => {
  const env = { ProgramFiles: 'C:\PF', 'ProgramFiles(x86)': 'C:\PF86', LOCALAPPDATA: 'C:\U\AppData\Local' };
  expect(chromePath(env, (p) => p.startsWith('C:\U'))).toBe('C:\U\AppData\Local\Google\Chrome\Application\chrome.exe');
  expect(chromePath(env, () => false)).toBeNull();
});
