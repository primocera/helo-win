// The work map: the board built from hook events, the drawing, the hooks it needs.
import { test, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WorkMap, MAP_EVENTS } from '../src/main/workmap';
import { createBridge } from '../src/main/bridge';
import * as hooks from '../src/main/hooks-install';
import { classify } from '../src/shared/map/classify';
import { drawMap } from '../src/shared/map/draw';
import { foldRows, nowParts } from '../src/shared/map/feed';
import { MAP_SETUP } from '../src/shared/workmap';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'helo-test-'));

function mapAt(start = 1_000_000) {
  const clock = { t: start };
  const map = new WorkMap(MAP_SETUP, () => clock.t);
  const send = (event: string, extra: Record<string, unknown> = {}, session = 's1') => {
    clock.t += 100;
    return map.record({ hook_event_name: event, session_id: session, cwd: 'C:\\code\\shop-api', ...extra });
  };
  const rows = () => map.view()!.board.entries.map((e) => `${e.station}:${e.label}:${e.status}`);
  return { map, clock, send, rows };
}

test('classify: tools land on the stations the map shows', () => {
  expect(classify('Read', { file_path: 'C:\\code\\shop-api\\src\\cart.ts' }, MAP_SETUP).station).toBe('files');
  expect(classify('Bash', { command: 'npm test' }, MAP_SETUP).station).toBe('shell');
  expect(classify('PowerShell', { command: 'Get-ChildItem' }, MAP_SETUP).station).toBe('files');
  expect(classify('WebFetch', { url: 'https://example.com/a' }, MAP_SETUP)).toEqual({ station: 'web', label: 'example.com' });
  expect(classify('mcp__memory__search_nodes', {}, MAP_SETUP).station).toBe('memory');
  expect(classify('Agent', { description: 'look around' }, MAP_SETUP).station).toBe('agents');
});

test('workmap: a turn becomes a message, model steps, tool calls and an answer', () => {
  const { map, send, rows } = mapAt();
  expect(map.view()).toBeNull();
  expect(send('UserPromptSubmit', { prompt: 'fix the cart' })).toBe(true);
  expect(map.status({ session_id: 's1', model: { id: 'claude-opus-5-5' }, context_window: { used_percentage: 12.4 } })).toBe(true);
  expect(rows()).toEqual(['you:new message:ok', 'model:step 1:run']);

  send('PreToolUse', { tool_name: 'Read', tool_use_id: 't1', tool_input: { file_path: 'C:\\code\\shop-api\\src\\cart.ts' } });
  send('PreToolUse', { tool_name: 'Bash', tool_use_id: 't2', tool_input: { command: 'npm test' } });
  expect(rows().slice(1)).toEqual(['model:step 1:ok', 'files:src/cart.ts:run', 'shell:npm:run']);

  send('PostToolUse', { tool_name: 'Read', tool_use_id: 't1', tool_response: {} });
  // The second call of the step has not answered yet: the model is not working again.
  expect(rows().filter((r) => r.startsWith('model'))).toEqual(['model:step 1:ok']);
  send('PostToolUseFailure', { tool_name: 'Bash', tool_use_id: 't2', error: 'exit 1' });
  expect(rows().slice(-2)).toEqual(['shell:npm:err', 'model:opus 5.5 · step 2:run']);

  send('Stop');
  const board = map.view()!.board;
  expect(rows().slice(-2)).toEqual(['model:opus 5.5 · step 2:ok', 'you:answer ready:ok']);
  expect(board.entries.some((e) => e.status === 'run')).toBe(false);
  expect(board.counts).toEqual({ you: 2, model: 2, files: 1, shell: 1 });
  expect(board.faults).toEqual({ shell: 1 });
  expect(board.model).toBe('claude-opus-5-5');
  expect(board.context).toBe(12.4);
  expect(board.step).toBe(2);
  expect(map.view()!.project).toBe('shop-api');

  // A new message clears the faults and starts counting steps again.
  send('UserPromptSubmit', { prompt: 'again' });
  expect(map.view()!.board.faults).toEqual({});
  expect(rows().slice(-1)).toEqual(['model:opus 5.5 · step 1:run']);
});

test('workmap: subagents, background tasks, refusals, compaction and a model switch', () => {
  const { map, send, rows } = mapAt();
  send('UserPromptSubmit', { prompt: 'go' });
  send('PreToolUse', { tool_name: 'Agent', tool_use_id: 'a1', tool_input: { description: 'look around', prompt: 'x' } });
  send('SubagentStart', { agent_id: 'sub1', agent_type: 'Explore' });
  expect(map.view()!.board.agents).toEqual(['sub1']);
  send('PreToolUse', { tool_name: 'Grep', tool_use_id: 'g1', agent_id: 'sub1', tool_input: { pattern: 'x' } });
  const grep = map.view()!.board.entries.at(-1)!;
  expect([grep.from, grep.agentId, grep.status]).toEqual(['agents', 'sub1', 'run']);
  // A subagent's calls do not make the main model step.
  send('PostToolUse', { tool_name: 'Grep', tool_use_id: 'g1', agent_id: 'sub1', tool_response: {} });
  expect(rows().filter((r) => r.startsWith('model')).length).toBe(1);
  send('SubagentStop', { agent_id: 'sub1' });
  expect(map.view()!.board.agents).toEqual([]);
  send('PostToolUse', { tool_name: 'Agent', tool_use_id: 'a1', tool_response: { status: 'completed' } });
  expect(rows().slice(-1)).toEqual(['model:step 2:run']);

  // A command sent to the background keeps its row open until its notification comes.
  send('PreToolUse', { tool_name: 'Bash', tool_use_id: 'b1', tool_input: { command: 'npm run dev' } });
  send('PostToolUse', { tool_name: 'Bash', tool_use_id: 'b1', tool_response: { backgroundTaskId: 'bg-1' } });
  send('Stop');
  const open = map.view()!.board.entries.filter((e) => e.status === 'run');
  expect(open.map((e) => e.task)).toEqual(['bg-1']);
  send('UserPromptSubmit', { prompt: '<task-notification><task-id>bg-1</task-id><status>failed</status></task-notification>' });
  expect(map.view()!.board.entries.find((e) => e.task === 'bg-1')!.status).toBe('err');
  expect(rows().filter((r) => r === 'you:new message:ok').length).toBe(1);

  // Denied from the island: the call reads as blocked, and the model goes on.
  send('UserPromptSubmit', { prompt: 'delete it' });
  send('PreToolUse', { tool_name: 'Bash', tool_use_id: 'b2', tool_input: { command: 'rm -rf build' } });
  expect(map.refuse('s1', 'Bash')).toBe(true);
  expect(rows().slice(-2)).toEqual(['files:rm:block', 'model:step 2:run']);

  send('PreCompact');
  expect(rows().slice(-1)).toEqual(['model:compacting context:run']);
  send('Notification');
  expect(rows().slice(-1)).toEqual(['model:compacting context:ok']);

  map.status({ session_id: 's1', model: { id: 'claude-opus-5-5' } });
  expect(map.status({ session_id: 's1', model: { id: 'claude-fable-5-2' } })).toBe(true);
  const last = map.view()!.board.entries.at(-1)!;
  expect([last.label, last.mark]).toEqual(['opus 5.5 → fable 5.2', 'switch']);
  expect(map.status({ session_id: 'unknown', model: { id: 'x' } })).toBe(false);
});

test('workmap: shows the session the user last wrote to, and keeps the newest 80 rows', () => {
  const { map, send, clock } = mapAt();
  send('UserPromptSubmit', { prompt: 'a' }, 'one');
  // Another session working in the background does not take the map over.
  expect(send('PreToolUse', { tool_name: 'Grep', tool_use_id: 'x', cwd: 'C:\\code\\other' }, 'two')).toBe(false);
  expect(map.view()!.project).toBe('shop-api');
  // It does once the shown one has been quiet for a while.
  clock.t += 60_000;
  expect(send('PostToolUse', { tool_name: 'Grep', tool_use_id: 'x', cwd: 'C:\\code\\other' }, 'two')).toBe(true);
  expect(map.view()!.project).toBe('other');

  for (let i = 0; i < 120; i++) {
    send('PreToolUse', { tool_name: 'Glob', tool_use_id: `t${i}` }, 'two');
    send('PostToolUse', { tool_name: 'Glob', tool_use_id: `t${i}` }, 'two');
  }
  expect(map.view()!.board.entries.length).toBe(80);
  map.clear();
  expect(map.view()).toBeNull();
});

test('workmap: the drawing and the rows are made from the board, and a label cannot break out of the picture', () => {
  const { map, send, clock } = mapAt();
  send('UserPromptSubmit', { prompt: 'a' });
  map.status({ session_id: 's1', model: { id: 'claude-opus-5-5' }, context_window: { used_percentage: 40 } });
  send('PreToolUse', { tool_name: 'Read', tool_use_id: 't1', tool_input: { file_path: 'C:\\x\\</text><script>alert(1)</script>.ts' } });
  const board = map.view()!.board;
  const svg = drawMap(board, clock.t, MAP_SETUP);
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  expect(svg).toContain('CLAUDE');
  expect(svg).toContain('opus 5.5');
  expect(svg).toContain('40%');
  expect(svg).toContain('<animate');
  expect(svg).not.toContain('<script');
  // Helo draws on its own black island: no ground, no light-theme rules.
  expect(svg).not.toContain('<style>');
  expect(foldRows(board.entries, 12).length).toBe(3);
  expect(nowParts(board, MAP_SETUP.t).what.startsWith('Files: ')).toBe(true);
});

test('hooks: the map events are added on request, and an older connection is seen as lacking them', () => {
  const file = path.join(tmp(), 'settings.json');
  const original = { model: 'opus', hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }] } };
  fs.writeFileSync(file, JSON.stringify(original));
  const opts = { port: 47615, token: 'abc' };

  hooks.install(file, opts);
  expect(hooks.inspect(file, opts)).toMatchObject({ installed: true, map: false });
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).hooks.PreToolUse.length).toBe(1);

  hooks.install(file, { ...opts, map: true });
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(hooks.inspect(file, opts)).toMatchObject({ installed: true, map: true });
  for (const event of MAP_EVENTS) {
    const ours = s.hooks[event].at(-1).hooks[0];
    expect([ours.type, ours.url, ours.timeout]).toEqual(['http', 'http://127.0.0.1:47615/helo/hook', 3]);
  }
  expect(s.hooks.PreToolUse[0]).toEqual(original.hooks.PreToolUse[0]);
  // B1: the backup stays the file as it was before Helo, however often Helo writes.
  expect(JSON.parse(fs.readFileSync(`${file}.helo-backup`, 'utf8'))).toEqual(original);

  hooks.install(file, opts);
  expect(hooks.inspect(file, opts)).toMatchObject({ installed: true, map: false });
  hooks.uninstall(file);
  expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(original);
  expect(JSON.parse(fs.readFileSync(`${file}.helo-backup`, 'utf8'))).toEqual(original);
});

test('bridge: tool events are answered at once with no decision, however large', async () => {
  const seen: string[] = [];
  const bridge = createBridge({ token: 'tok', onPermission: async () => null, onEvent: (i) => { seen.push(String(i.hook_event_name)); } });
  const port = await bridge.listen(0);
  const post = (body: unknown) => fetch(`http://127.0.0.1:${port}/helo/hook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
    body: JSON.stringify(body),
  });
  try {
    const res = await post({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } });
    expect([res.status, await res.text()]).toEqual([200, '']);
    // 2 MB of tool output: over the old limit, still taken.
    const big = await post({ hook_event_name: 'PostToolUse', tool_response: { stdout: 'x'.repeat(2_000_000) } });
    expect(big.status).toBe(200);
    expect(seen).toEqual(['PreToolUse', 'PostToolUse']);
    // Past the limit the hook still gets "no decision", never an error the agent would show.
    const huge = await post({ hook_event_name: 'PostToolUse', tool_response: { stdout: 'x'.repeat(9_000_000) } }).then((r) => r.status, () => 0);
    expect([200, 0]).toContain(huge);
    expect(seen.length).toBe(2);
  } finally {
    await bridge.close();
  }
});
