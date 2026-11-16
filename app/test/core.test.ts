// Ported from the original test/app.test.js (bridge, hooks, license, format),
// plus tests for what was added since (Codex hooks, status line, Always allow).
import { test, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBridge, type BridgeHandlers } from '../src/main/bridge';
import * as hooks from '../src/main/hooks-install';
import { createLicense } from '../src/main/license';
import { permissionView, eventBanner, alwaysAllowSuggestion, buildAnswers, diffLines } from '../src/main/format';

const TOKEN = 'test-token';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'helo-test-'));

type Post = (body: unknown, token?: string, signal?: AbortSignal, route?: string) => Promise<Response>;

async function withBridge(handlers: Partial<BridgeHandlers>, fn: (post: Post) => Promise<void>) {
  const bridge = createBridge({ token: TOKEN, onEvent: () => {}, onPermission: async () => null, ...handlers });
  const port = await bridge.listen(0);
  const post: Post = (body, token = TOKEN, signal, route = '/helo/hook') => fetch(`http://127.0.0.1:${port}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  });
  try {
    await fn(post);
  } finally {
    await bridge.close();
  }
}

const permission = { hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'ls' } };

test('bridge: allow and deny return the PermissionRequest decision format', async () => {
  for (const behavior of ['allow', 'deny'] as const) {
    await withBridge({ onPermission: async () => behavior }, async (post) => {
      const res = await post(permission);
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.hookSpecificOutput.hookEventName).toBe('PermissionRequest');
      expect(json.hookSpecificOutput.decision.behavior).toBe(behavior);
      expect('message' in json.hookSpecificOutput.decision).toBe(behavior === 'deny');
    });
  }
});

test('bridge: no decision returns an empty 200 so Claude Code asks in the terminal', async () => {
  await withBridge({ onPermission: async () => null }, async (post) => {
    const res = await post(permission);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });
});

test('bridge: rejects a wrong token and never asks the user', async () => {
  let asked = false;
  await withBridge({ onPermission: async () => { asked = true; return 'allow'; } }, async (post) => {
    const res = await post(permission, 'wrong');
    expect(res.status).toBe(401);
    expect(asked).toBe(false);
    const status = await post({}, 'wrong', undefined, '/helo/status');
    expect(status.status).toBe(401);
  });
});

test('bridge: listens on 127.0.0.1 only', async () => {
  const bridge = createBridge({ token: TOKEN, onEvent: () => {}, onPermission: async () => null });
  const port = await bridge.listen(0);
  try {
    // A non-loopback address of this machine must not reach the bridge.
    const external = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
    if (external) {
      await expect(fetch(`http://${external.address}:${port}/helo/hook`, { method: 'POST', signal: AbortSignal.timeout(2000) })).rejects.toThrow();
    }
  } finally {
    await bridge.close();
  }
});

test('bridge: for Codex, question tools pass through and raise a NeedsInput event', async () => {
  const events: Record<string, unknown>[] = [];
  let asked = false;
  await withBridge({ onEvent: (e) => events.push(e), onPermission: async () => { asked = true; return 'allow'; } }, async (post) => {
    const res = await post({ ...permission, tool_name: 'AskUserQuestion' }, TOKEN, undefined, '/helo/hook?agent=codex');
    expect(await res.text()).toBe('');
    expect(asked).toBe(false);
    expect(events[0].hook_event_name).toBe('NeedsInput');
  });
});

test('bridge: a question is answered with updatedInput; a bare allow is no decision', async () => {
  const questions = [{ question: 'Which framework?', header: 'Framework', multiSelect: false, options: [{ label: 'React' }, { label: 'Vue' }] }];
  const ask = { ...permission, tool_name: 'AskUserQuestion', tool_input: { questions } };
  await withBridge({ onPermission: async (input) => ({ behavior: 'allow', updatedInput: { ...(input.tool_input as object), answers: { 'Which framework?': 'Vue' } } }) }, async (post) => {
    const json = (await (await post(ask)).json()) as any;
    expect(json.hookSpecificOutput.decision).toEqual({ behavior: 'allow', updatedInput: { questions, answers: { 'Which framework?': 'Vue' } } });
  });
  await withBridge({ onPermission: async () => 'allow' }, async (post) => {
    expect(await (await post(ask)).text()).toBe('');
  });
  await withBridge({ onPermission: async () => ({ behavior: 'allow' }) }, async (post) => {
    expect(await (await post({ ...permission, tool_name: 'ExitPlanMode' })).text()).toBe('');
  });
  await withBridge({ onPermission: async () => ({ behavior: 'deny', message: 'Not this plan.' }) }, async (post) => {
    const json = (await (await post({ ...permission, tool_name: 'ExitPlanMode' })).json()) as any;
    expect(json.hookSpecificOutput.decision).toEqual({ behavior: 'deny', message: 'Not this plan.' });
  });
});

test('cards: question, plan and edit views', () => {
  const questions = [
    { question: 'Which framework?', header: 'Framework', multiSelect: false, options: [{ label: 'React', description: 'Components' }, { label: 'Vue' }] },
    { question: 'Which checks?', multiSelect: true, options: [{ label: 'Lint' }, { label: 'Tests' }] },
  ];
  const q = permissionView('1', { tool_name: 'AskUserQuestion', tool_input: { questions } });
  expect(q.kind).toBe('question');
  expect(q.questions?.[1].multi).toBe(true);
  expect(buildAnswers(q.questions!, [['Vue'], ['Tests', 'Lint']])).toEqual({ 'Which framework?': 'Vue', 'Which checks?': 'Tests, Lint' });
  expect(buildAnswers(q.questions!, [['Vue', 'React'], ['Lint']])).toBeNull(); // two picks on a single-choice question
  expect(buildAnswers(q.questions!, [['Svelte'], ['Lint']])).toBeNull(); // not one of the options
  expect(buildAnswers(q.questions!, [['Vue'], []])).toBeNull();
  expect(buildAnswers(q.questions!, [['Vue']])).toBeNull();
  // Not in the documented shape: an ordinary card, which the bridge never turns into an approval.
  expect(permissionView('2', { tool_name: 'AskUserQuestion', tool_input: {} }).kind).toBe('tool');
  expect(permissionView('3', { tool_name: 'AskUserQuestion', tool_input: { questions } }, 'codex').kind).toBe('tool');

  const plan = permissionView('4', { tool_name: 'ExitPlanMode', tool_input: { plan: '# Plan\n1. Step' } });
  expect(plan.kind).toBe('plan');
  expect(plan.plan).toBe('# Plan\n1. Step');

  const edit = permissionView('5', { tool_name: 'Edit', tool_input: { file_path: 'C:\\code\\a.ts', old_string: 'a\nb\nc\nd\ne', new_string: 'a\nb\nX\nd\ne' } });
  expect(edit.diff).toEqual({
    file: 'a.ts', added: 1, removed: 1, more: 0,
    lines: [{ kind: 'same', text: 'b' }, { kind: 'del', text: 'c' }, { kind: 'add', text: 'X' }, { kind: 'same', text: 'd' }],
  });
  const write = permissionView('6', { tool_name: 'Write', tool_input: { file_path: '/code/new.txt', content: 'one\ntwo' } }, 'claude', 0, () => 'one');
  expect(write.diff?.lines).toEqual([{ kind: 'same', text: 'one' }, { kind: 'add', text: 'two' }]);
  expect(permissionView('7', { tool_name: 'Edit', tool_input: { file_path: 'a', old_string: 'x', new_string: 'x' } }).diff).toBeUndefined();
  expect(diffLines('', 'a\nb').map((l) => l.kind)).toEqual(['add', 'add']);
});

test('bridge: Stop events reach onEvent', async () => {
  const events: Record<string, unknown>[] = [];
  await withBridge({ onEvent: (e) => events.push(e) }, async (post) => {
    await post({ hook_event_name: 'Stop', cwd: 'C:\\code\\demo', last_assistant_message: 'Done.' });
    expect(events.length).toBe(1);
    expect(eventBanner(events[0])).toEqual({ kind: 'done', title: 'Finished in demo', text: 'Done.' });
  });
});

test('bridge: aborts the pending request when the caller disconnects', async () => {
  let aborted!: () => void;
  const gotAbort = new Promise<void>((resolve) => { aborted = resolve; });
  const onPermission: BridgeHandlers['onPermission'] = (_input, signal) => new Promise((resolve) => {
    signal.addEventListener('abort', () => { aborted(); resolve(null); });
  });
  await withBridge({ onPermission }, async (post) => {
    const ac = new AbortController();
    const req = post(permission, TOKEN, ac.signal).catch(() => {});
    await new Promise((r) => setTimeout(r, 100));
    ac.abort();
    await req;
    await gotAbort;
  });
});

test('bridge: requests tagged ?agent=codex are reported as Codex', async () => {
  const agents: string[] = [];
  const bridge = createBridge({ token: TOKEN, onEvent: () => {}, onPermission: async (_i, _s, agent) => { agents.push(agent); return 'deny'; } });
  const port = await bridge.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/helo/hook?agent=codex`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(permission),
    });
    const json = (await res.json()) as any;
    expect(json.hookSpecificOutput.decision).toEqual({ behavior: 'deny', message: 'Denied from Helo.' });
    expect(agents).toEqual(['codex']);
  } finally {
    await bridge.close();
  }
});

test('bridge: "always" echoes Claude Code\'s allow-rule suggestion as updatedPermissions', async () => {
  const suggestion = { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test' }], behavior: 'allow', destination: 'localSettings' };
  const input = { ...permission, permission_suggestions: [{ type: 'setMode', mode: 'acceptEdits', destination: 'session' }, suggestion] };
  await withBridge({ onPermission: async () => 'always' }, async (post) => {
    const json = (await (await post(input)).json()) as any;
    expect(json.hookSpecificOutput.decision).toEqual({ behavior: 'allow', updatedPermissions: [suggestion] });
  });
  // Without a suggestion it is a plain allow.
  await withBridge({ onPermission: async () => 'always' }, async (post) => {
    const json = (await (await post(permission)).json()) as any;
    expect(json.hookSpecificOutput.decision).toEqual({ behavior: 'allow' });
  });
});

test('bridge: status route answers with the status line text', async () => {
  let got: Record<string, unknown> | null = null;
  await withBridge({ onStatus: (i) => { got = i; return '5h 23%'; } }, async (post) => {
    const res = await post({ rate_limits: {} }, TOKEN, undefined, '/helo/status');
    expect(await res.text()).toBe('5h 23%');
    expect(got).toEqual({ rate_limits: {} });
  });
});

test('hooks: install keeps existing settings and hooks, uninstall restores them', () => {
  const file = path.join(tmp(), 'settings.json');
  const original = {
    model: 'opus',
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo hi' }] }] },
  };
  fs.writeFileSync(file, JSON.stringify(original));
  const opts = { port: 47615, token: 'abc' };

  hooks.install(file, opts);
  const installed = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(installed.model).toBe('opus');
  expect(installed.hooks.Stop.length).toBe(2);
  expect(installed.hooks.PermissionRequest[0].hooks[0].url).toBe('http://127.0.0.1:47615/helo/hook');
  expect(installed.hooks.PermissionRequest[0].hooks[0].headers.Authorization).toBe('Bearer abc');
  expect(installed.hooks.UserPromptSubmit[0].hooks[0].type).toBe('http');
  expect(hooks.isInstalled(file, opts)).toBe(true);
  expect(hooks.isInstalled(file, { port: 47615, token: 'other' })).toBe(false);
  expect(JSON.parse(fs.readFileSync(`${file}.helo-backup`, 'utf8'))).toEqual(original);

  hooks.install(file, opts); // installing twice must not duplicate
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).hooks.Stop.length).toBe(2);

  hooks.uninstall(file);
  expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(original);
});

test('hooks: a settings file that is not valid JSON is left untouched', () => {
  const file = path.join(tmp(), 'settings.json');
  fs.writeFileSync(file, '{ broken');
  expect(() => hooks.install(file, { port: 1, token: 't' })).toThrow();
  expect(fs.readFileSync(file, 'utf8')).toBe('{ broken');
});

test('hooks: install works when settings.json does not exist yet', () => {
  const file = path.join(tmp(), 'nested', 'settings.json');
  hooks.install(file, { port: 5, token: 't' });
  expect(hooks.isInstalled(file, { port: 5, token: 't' })).toBe(true);
});

test('hooks: the status line is added only when the user has none, and removed on uninstall', () => {
  const opts = { port: 47615, token: 'abc', statusLine: true };
  const empty = path.join(tmp(), 'settings.json');
  fs.writeFileSync(empty, '{}');
  expect(hooks.install(empty, opts).statusLine).toBe('ours');
  const sl = JSON.parse(fs.readFileSync(empty, 'utf8')).statusLine;
  expect(sl.type).toBe('command');
  expect(sl.command).toContain('http://127.0.0.1:47615/helo/status');
  expect(sl.command).toContain('Bearer abc');
  hooks.uninstall(empty);
  expect(JSON.parse(fs.readFileSync(empty, 'utf8'))).toEqual({});

  const own = path.join(tmp(), 'settings.json');
  const mine = { statusLine: { type: 'command', command: 'bash ~/my-line.sh' } };
  fs.writeFileSync(own, JSON.stringify(mine));
  expect(hooks.install(own, opts).statusLine).toBe('other');
  expect(JSON.parse(fs.readFileSync(own, 'utf8')).statusLine).toEqual(mine.statusLine);
  hooks.uninstall(own);
  expect(JSON.parse(fs.readFileSync(own, 'utf8'))).toEqual(mine);
});

test('hooks: Codex hooks.json gets curl command hooks and keeps other hooks', () => {
  const file = path.join(tmp(), 'hooks.json');
  const original = { description: 'mine', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'python3 notify.py' }] }] } };
  fs.writeFileSync(file, JSON.stringify(original));
  const opts = { port: 47615, token: 'xyz' };
  hooks.installCodex(file, opts);
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(s.description).toBe('mine');
  expect(s.hooks.Stop.length).toBe(2);
  const perm = s.hooks.PermissionRequest[0].hooks[0];
  expect(perm.type).toBe('command');
  expect(perm.command).toBe(perm.commandWindows);
  expect(perm.command).toContain('"http://127.0.0.1:47615/helo/hook?agent=codex"');
  expect(perm.command).toContain('Bearer xyz');
  expect(perm.timeout).toBe(300);
  expect(hooks.isCodexInstalled(file, opts)).toBe(true);
  hooks.installCodex(file, opts);
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).hooks.Stop.length).toBe(2);
  hooks.uninstallCodex(file);
  expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(original);
});

function fakeStore(responses: Record<string, unknown>) {
  const calls: { action: string; params: Record<string, string> }[] = [];
  const fetchImpl = async (url: string, init: { body: string }) => {
    const action = url.split('/').pop()!;
    calls.push({ action, params: Object.fromEntries(new URLSearchParams(init.body)) });
    const response = responses[action];
    if (response instanceof Error) throw response;
    return { json: async () => response };
  };
  return { calls, fetchImpl };
}

test('license: trial counts down and then expires', () => {
  let now = 1_000_000;
  const license = createLicense({ file: path.join(tmp(), 'l.json'), trialDays: 7, now: () => now });
  expect(license.status()).toEqual({ state: 'trial', daysLeft: 7 });
  now += 6.5 * 86_400_000;
  expect(license.status()).toEqual({ state: 'trial', daysLeft: 1 });
  now += 86_400_000;
  expect(license.status()).toEqual({ state: 'expired' });
});

test('license: activation is saved and survives a restart', async () => {
  const file = path.join(tmp(), 'l.json');
  const store = fakeStore({ activate: { activated: true, instance: { id: 'inst-1' }, meta: { store_id: 1, product_id: 2 } } });
  const license = createLicense({ file, store: { storeId: 1, productId: 2 }, fetchImpl: store.fetchImpl });
  await license.activate('  KEY-1  ');
  expect(store.calls[0].params.license_key).toBe('KEY-1');
  expect(license.status()).toEqual({ state: 'licensed' });
  expect(createLicense({ file, fetchImpl: store.fetchImpl }).status()).toEqual({ state: 'licensed' });
});

test('license: shows the store error, e.g. when all 3 PCs are used', async () => {
  const store = fakeStore({ activate: { activated: false, error: 'This license key has reached the activation limit.' } });
  const license = createLicense({ file: path.join(tmp(), 'l.json'), fetchImpl: store.fetchImpl });
  await expect(license.activate('KEY')).rejects.toThrow(/activation limit/);
  expect(license.status().state).toBe('trial');
});

test('license: a key from another product is refused and its activation released', async () => {
  const store = fakeStore({
    activate: { activated: true, instance: { id: 'inst-9' }, meta: { store_id: 1, product_id: 999 } },
    deactivate: { deactivated: true },
  });
  const license = createLicense({ file: path.join(tmp(), 'l.json'), store: { storeId: 1, productId: 2 }, fetchImpl: store.fetchImpl });
  await expect(license.activate('KEY')).rejects.toThrow(/different product/);
  expect(store.calls.map((c) => c.action)).toEqual(['activate', 'deactivate']);
  expect(license.status().state).toBe('trial');
});

test('license: revalidation removes a revoked key but tolerates being offline', async () => {
  let now = 0;
  const file = path.join(tmp(), 'l.json');
  const responses: Record<string, unknown> = { activate: { activated: true, instance: { id: 'i' }, meta: {} }, validate: new Error('offline') };
  const store = fakeStore(responses);
  const license = createLicense({ file, fetchImpl: store.fetchImpl, now: () => now });
  await license.activate('KEY');
  now += 8 * 86_400_000;
  await license.revalidate();
  expect(license.status().state).toBe('licensed');
  responses.validate = { valid: false };
  await license.revalidate();
  expect(license.status().state).not.toBe('licensed');
});
test('format: permission card shows the command exactly as sent, and the project folder', () => {
  const view = permissionView('1', { tool_name: 'Bash', cwd: 'C:\\code\\shop', tool_input: { command: 'npm  test' } }, 'claude', 5);
  expect(view).toEqual({ id: '1', kind: 'tool', agent: 'claude', tool: 'Bash', summary: 'npm  test', project: 'shop', always: null, receivedAt: 5 });
});

test('format: Always allow is offered only for allow-rule suggestions, and never for Codex', () => {
  const input = {
    tool_name: 'Bash',
    tool_input: { command: 'npm test' },
    permission_suggestions: [
      { type: 'setMode', mode: 'bypassPermissions', destination: 'session' },
      { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test' }], behavior: 'allow', destination: 'localSettings' },
    ],
  };
  expect(permissionView('1', input, 'claude').always).toBe('Bash(npm test)');
  expect(permissionView('1', input, 'codex').always).toBe(null);
  expect(alwaysAllowSuggestion({ permission_suggestions: [{ type: 'addRules', rules: [{ toolName: 'Bash' }], behavior: 'deny', destination: 'session' }] })).toBe(null);
  expect(alwaysAllowSuggestion({ permission_suggestions: [{ type: 'addRules', rules: [{ toolName: 'X' }], behavior: 'allow', destination: '/etc/evil' }] })).toBe(null);
});

test('format: "waiting for your input" notifications become a needs-you banner', () => {
  const banner = eventBanner({ hook_event_name: 'Notification', notification_type: 'idle_prompt', message: 'Claude is waiting for your input', cwd: 'C:\\code\\shop' });
  expect(banner).toEqual({ kind: 'input', title: 'Claude is waiting for you', text: 'Open the terminal for shop' });
  expect(eventBanner({ hook_event_name: 'Notification', message: 'hello' })?.kind).toBe('info');
});
