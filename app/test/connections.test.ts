// Gemini CLI and Cursor: the hooks Helo writes, what their events become, and what the bridge answers.
import { test, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createBridge } from '../src/main/bridge';
import * as hooks from '../src/main/hooks-install';
import { createNormalizer } from '../src/main/agent-events';
import { AgentTracker } from '../src/main/agents';
import { eventBanner } from '../src/main/format';

const TOKEN = 'test-token';
const opts = { port: 47615, token: 'xyz' };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'helo-test-'));
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));

test('gemini hooks: added beside the user\'s own, found again, and removed without a trace', () => {
  const file = path.join(tmp(), 'settings.json');
  const original = { theme: 'Dracula', hooks: { AfterAgent: [{ hooks: [{ name: 'mine', type: 'command', command: 'node notify.js' }] }] } };
  fs.writeFileSync(file, JSON.stringify(original));
  hooks.installGemini(file, opts);
  const s = read(file);
  expect(s.theme).toBe('Dracula');
  expect(s.hooks.AfterAgent.length).toBe(2);
  expect(Object.keys(s.hooks).sort()).toEqual(['AfterAgent', 'AfterTool', 'BeforeAgent', 'Notification']);
  const hook = s.hooks.BeforeAgent[0].hooks[0];
  expect(hook).toMatchObject({ name: 'helo', type: 'command', timeout: 5000 });
  expect(hook.command).toContain('"http://127.0.0.1:47615/helo/hook?agent=gemini"');
  expect(hook.command).toContain('Bearer xyz');
  expect(s.hooks.AfterTool[0].matcher).toBe('*');
  expect(hooks.isGeminiInstalled(file, opts)).toBe(true);
  expect(hooks.isGeminiInstalled(file, { ...opts, token: 'other' })).toBe(false);
  hooks.installGemini(file, opts);
  expect(read(file).hooks.AfterAgent.length).toBe(2);
  hooks.uninstallGemini(file);
  expect(read(file)).toEqual(original);
  expect(read(`${file}.helo-backup`)).toEqual(original);
});

test('cursor hooks: a flat list per event, added beside the user\'s own and removed again', () => {
  const file = path.join(tmp(), 'hooks.json');
  const original = { version: 1, hooks: { stop: [{ command: './hooks/done.ps1' }], afterFileEdit: [{ command: './hooks/format.ps1' }] } };
  fs.writeFileSync(file, JSON.stringify(original));
  hooks.installCursor(file, opts);
  const s = read(file);
  expect(s.version).toBe(1);
  expect(s.hooks.stop.length).toBe(2);
  expect(s.hooks.afterFileEdit).toEqual(original.hooks.afterFileEdit);
  expect(s.hooks.beforeSubmitPrompt).toEqual([{ command: hooks.cursorCommand(opts), timeout: 5 }]);
  expect(s.hooks.afterAgentResponse.length).toBe(1);
  expect(hooks.cursorCommand(opts)).toContain('"http://127.0.0.1:47615/helo/hook?agent=cursor"');
  expect(hooks.isCursorInstalled(file, opts)).toBe(true);
  expect(hooks.isCursorInstalled(file, { ...opts, port: 1 })).toBe(false);
  hooks.installCursor(file, opts);
  expect(read(file).hooks.stop.length).toBe(2);
  hooks.uninstallCursor(file);
  expect(read(file)).toEqual(original);
});

test('cursor hooks: a missing file gets the version number Cursor requires', () => {
  const file = path.join(tmp(), 'cursor', 'hooks.json');
  hooks.installCursor(file, opts);
  expect(read(file).version).toBe(1);
  expect(hooks.isCursorInstalled(file, opts)).toBe(true);
  hooks.uninstallCursor(file);
  expect(read(file)).toEqual({ version: 1, hooks: {} });
});

test('the hook installers leave each other alone in a shared file', () => {
  const file = path.join(tmp(), 'settings.json');
  hooks.installGemini(file, opts);
  expect(hooks.isCodexInstalled(file, opts)).toBe(false);
  expect(hooks.isInstalled(file, opts)).toBe(false);
  expect(hooks.stripHooks(read(file))).toEqual(read(file));
  expect(hooks.stripCodexHooks(read(file))).toEqual(read(file));
});

test('gemini events become the events Helo knows', () => {
  const n = createNormalizer();
  const base = { session_id: 's1', cwd: 'C:\\code\\shop', transcript_path: 'x', timestamp: 't' };
  expect(n('gemini', { ...base, hook_event_name: 'BeforeAgent', prompt: 'hi' })).toEqual({ session_id: 's1', cwd: 'C:\\code\\shop', hook_event_name: 'UserPromptSubmit' });
  expect(n('gemini', { ...base, hook_event_name: 'AfterAgent', prompt: 'hi', prompt_response: 'All done.' }))
    .toEqual({ session_id: 's1', cwd: 'C:\\code\\shop', hook_event_name: 'Stop', last_assistant_message: 'All done.' });
  expect(n('gemini', { ...base, hook_event_name: 'Notification', notification_type: 'ToolPermission', message: 'm' })?.hook_event_name).toBe('NeedsInput');
  expect(n('gemini', { ...base, hook_event_name: 'Notification', notification_type: 'Other' })).toBe(null);
  expect(n('gemini', { ...base, hook_event_name: 'AfterTool', tool_name: 'run_shell_command' })?.hook_event_name).toBe('PermissionResolved');
  expect(n('gemini', { ...base, hook_event_name: 'SessionStart' })).toBe(null);
});

test('cursor events: the last answer is kept for the finished banner, per conversation', () => {
  const n = createNormalizer();
  const a = { conversation_id: 'a', workspace_roots: ['C:/code/shop'] };
  const b = { conversation_id: 'b', workspace_roots: ['C:/code/blog'] };
  expect(n('cursor', { ...a, hook_event_name: 'beforeSubmitPrompt', prompt: 'hi' })).toEqual({ session_id: 'a', cwd: 'C:/code/shop', hook_event_name: 'UserPromptSubmit' });
  expect(n('cursor', { ...a, hook_event_name: 'afterAgentResponse', text: 'Fixed the cart.' })).toBe(null);
  expect(n('cursor', { ...b, hook_event_name: 'afterAgentResponse', text: 'Wrote the post.' })).toBe(null);
  expect(n('cursor', { ...a, hook_event_name: 'stop', status: 'completed', loop_count: 0 }))
    .toEqual({ session_id: 'a', cwd: 'C:/code/shop', hook_event_name: 'Stop', last_assistant_message: 'Fixed the cart.' });
  // Used once: the next run of the same conversation does not repeat it.
  expect(n('cursor', { ...a, hook_event_name: 'stop', status: 'completed' })?.last_assistant_message).toBe('');
  expect(n('cursor', { ...b, hook_event_name: 'stop', status: 'aborted' })?.hook_event_name).toBe('Aborted');
  expect(n('cursor', { ...b, hook_event_name: 'stop', status: 'error' })?.hook_event_name).toBe('Failed');
  expect(n('cursor', { ...a, hook_event_name: 'afterFileEdit' })).toBe(null);
});

test('other agents pass through the normalizer unchanged', () => {
  const input = { hook_event_name: 'Stop', session_id: 'x' };
  expect(createNormalizer()('claude', input)).toBe(input);
});

test('tracker and banners: a Gemini session goes working, waiting, working, done; a cancelled Cursor run is idle', () => {
  const n = createNormalizer();
  const t = new AgentTracker();
  const g = { session_id: 's', cwd: 'C:\\code\\shop' };
  t.record(n('gemini', { ...g, hook_event_name: 'BeforeAgent' })!, 'gemini');
  expect(t.list()[0]).toMatchObject({ agent: 'gemini', project: 'shop', mood: 'working' });
  const ask = n('gemini', { ...g, hook_event_name: 'Notification', notification_type: 'ToolPermission' })!;
  t.record(ask, 'gemini');
  expect(t.mood()).toBe('waiting');
  expect(eventBanner(ask, 'gemini')).toMatchObject({ kind: 'input', title: 'Gemini needs your answer' });
  t.record(n('gemini', { ...g, hook_event_name: 'AfterTool' })!, 'gemini');
  expect(t.mood()).toBe('working');
  const done = n('gemini', { ...g, hook_event_name: 'AfterAgent', prompt_response: 'Tests pass.' })!;
  t.record(done, 'gemini');
  expect(t.mood()).toBe('done');
  expect(eventBanner(done, 'gemini')).toEqual({ kind: 'done', title: 'Finished in shop', text: 'Tests pass.' });

  const c = { conversation_id: 'c', workspace_roots: ['C:/code/blog'] };
  t.record(n('cursor', { ...c, hook_event_name: 'beforeSubmitPrompt' })!, 'cursor');
  const aborted = n('cursor', { ...c, hook_event_name: 'stop', status: 'aborted' })!;
  t.record(aborted, 'cursor');
  expect(t.list().find((s) => s.agent === 'cursor')).toMatchObject({ project: 'blog', mood: 'idle' });
  expect(eventBanner(aborted, 'cursor')).toBe(null);
  expect(eventBanner(n('cursor', { ...c, hook_event_name: 'stop', status: 'error' })!, 'cursor')).toMatchObject({ kind: 'warn', title: 'Cursor stopped in blog' });
});

async function withBridge(fn: (port: number, events: { name: unknown; agent: string }[], asked: string[]) => Promise<void>) {
  const events: { name: unknown; agent: string }[] = [];
  const asked: string[] = [];
  const bridge = createBridge({
    token: TOKEN,
    onEvent: (input, agent) => { events.push({ name: input.hook_event_name, agent }); },
    onPermission: async (_i, _s, agent) => { asked.push(agent); return 'deny'; },
  });
  const port = await bridge.listen(0);
  try {
    await fn(port, events, asked);
  } finally {
    await bridge.close();
  }
}

const postTo = (port: number, agent: string, body: string | Buffer) => fetch(`http://127.0.0.1:${port}/helo/hook?agent=${agent}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}` },
  body,
});

test('bridge: Gemini and Cursor hooks are answered at once with JSON that changes nothing', async () => {
  await withBridge(async (port, events, asked) => {
    const g = await postTo(port, 'gemini', JSON.stringify({ hook_event_name: 'BeforeAgent', session_id: 's', cwd: 'C:\\x' }));
    expect(await g.text()).toBe('{}');
    const c = await postTo(port, 'cursor', JSON.stringify({ hook_event_name: 'beforeSubmitPrompt', conversation_id: 'c', prompt: 'hi' }));
    expect(await c.json()).toEqual({ continue: true });
    const stop = await postTo(port, 'cursor', JSON.stringify({ hook_event_name: 'stop', conversation_id: 'c', status: 'completed' }));
    expect(await stop.text()).toBe('{}');
    // An event Helo has no use for is still answered, and reported to nobody.
    const other = await postTo(port, 'gemini', JSON.stringify({ hook_event_name: 'BeforeModel' }));
    expect(await other.text()).toBe('{}');
    expect(events).toEqual([{ name: 'UserPromptSubmit', agent: 'gemini' }, { name: 'UserPromptSubmit', agent: 'cursor' }, { name: 'Stop', agent: 'cursor' }]);
  });
});

test('bridge: a watch-only agent can never open an Allow/Deny card', async () => {
  await withBridge(async (port, _events, asked) => {
    const res = await postTo(port, 'gemini', JSON.stringify({ hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }));
    expect(await res.text()).toBe('{}');
    expect(asked).toEqual([]);
  });
});

test('bridge: a byte-order mark before the JSON is accepted (PowerShell can add one)', async () => {
  await withBridge(async (port, events) => {
    const body = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify({ hook_event_name: 'stop', conversation_id: 'c', status: 'completed' }))]);
    const res = await postTo(port, 'cursor', body);
    expect(res.status).toBe(200);
    expect(events).toEqual([{ name: 'Stop', agent: 'cursor' }]);
  });
});

function run(file: string, args: string[], stdin: string): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsVerbatimArguments: file === 'cmd.exe' });
    let stdout = '';
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout }));
    child.stdin.end(stdin);
  });
}

// The real commands written to the agents' files, run the two ways Windows can run them.
test.runIf(process.platform === 'win32')('the hook commands work through cmd.exe and PowerShell', async () => {
  await withBridge(async (port, events) => {
    const o = { port, token: TOKEN };
    const prompt = JSON.stringify({ hook_event_name: 'beforeSubmitPrompt', conversation_id: 'c', workspace_roots: ['C:/code/shop'], prompt: 'hi' });
    const viaPs = await run('powershell.exe', ['-NoProfile', '-Command', hooks.cursorCommand(o)], prompt);
    expect(viaPs.code).toBe(0);
    expect(JSON.parse(viaPs.stdout)).toEqual({ continue: true });
    const turn = JSON.stringify({ hook_event_name: 'AfterAgent', session_id: 's', cwd: 'C:\\code\\shop', prompt_response: 'ok' });
    const viaCmd = await run('cmd.exe', ['/d', '/s', '/c', `"${hooks.geminiCommand(o)}"`], turn);
    expect(viaCmd.code).toBe(0);
    expect(viaCmd.stdout.trim()).toBe('{}');
    const viaPs2 = await run('powershell.exe', ['-NoProfile', '-Command', hooks.geminiCommand(o)], turn);
    expect(viaPs2.stdout.trim()).toBe('{}');
    expect(events).toEqual([{ name: 'UserPromptSubmit', agent: 'cursor' }, { name: 'Stop', agent: 'gemini' }, { name: 'Stop', agent: 'gemini' }]);
  });
}, 30_000);
