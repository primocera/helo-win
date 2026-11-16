// Adds and removes Helo's hooks in the agents' own config files:
//   Claude Code: HTTP hooks + an optional status line in ~/.claude/settings.json
//   Codex CLI:   command hooks (curl to the same local endpoint) in ~/.codex/hooks.json
//   Gemini CLI:  command hooks in ~/.gemini/settings.json (watch only)
//   Cursor:      command hooks in ~/.cursor/hooks.json (watch only)
// Other hooks and settings are always kept. Every write leaves a .helo-backup copy.
import fs from 'node:fs';
import path from 'node:path';
import { HOOK_PATH, STATUS_PATH } from './bridge';
import { MAP_EVENTS } from './workmap';

type Json = Record<string, unknown>;
type Hook = Json & { type?: unknown; url?: unknown; command?: unknown; headers?: Json };
type Group = Json & { hooks?: Hook[] };

export interface BridgeOpts {
  port: number;
  token: string;
}

// ---------------------------------------------------------------------------
// Shared helpers

/** Returns a copy of settings without hooks matching `isOurs`. Other hooks are kept. */
function stripMatching(settings: Json, isOurs: (h: Hook) => boolean): Json {
  const next = structuredClone(settings) as Json & { hooks?: Record<string, unknown> };
  if (!next.hooks || typeof next.hooks !== 'object') return next;
  for (const event of Object.keys(next.hooks)) {
    const groups = next.hooks[event];
    if (!Array.isArray(groups)) continue;
    const kept: unknown[] = [];
    for (const group of groups as Group[]) {
      if (!group || !Array.isArray(group.hooks) || !group.hooks.some(isOurs)) {
        kept.push(group);
        continue;
      }
      const others = group.hooks.filter((h) => !isOurs(h));
      if (others.length) kept.push({ ...group, hooks: others });
    }
    if (kept.length) next.hooks[event] = kept;
    else delete next.hooks[event];
  }
  if (!Object.keys(next.hooks).length) delete next.hooks;
  return next;
}

function addGroups(settings: Json, events: Record<string, Hook>): Json {
  const next = settings as Json & { hooks?: Record<string, unknown[]> };
  if (!next.hooks || typeof next.hooks !== 'object') next.hooks = {};
  for (const [event, hook] of Object.entries(events)) {
    if (!Array.isArray(next.hooks[event])) next.hooks[event] = [];
    next.hooks[event].push({ hooks: [hook] });
  }
  return next;
}

function hasAll(settings: Json, events: string[], matches: (h: Hook) => boolean): boolean {
  const hooks = (settings.hooks || {}) as Record<string, unknown>;
  return events.every((event) => {
    const groups = hooks[event];
    return Array.isArray(groups) && (groups as Group[]).some((g) => g && Array.isArray(g.hooks) && g.hooks.some(matches));
  });
}

// A missing file is an empty object. A file that is not valid JSON throws,
// so we never overwrite something we could not read.
export function readSettings(file: string): Json {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
  if (!text.trim()) return {};
  const parsed: unknown = JSON.parse(text.replace(/^﻿/, ''));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${path.basename(file)} is not a JSON object`);
  }
  return parsed as Json;
}

export function writeSettings(file: string, settings: Json): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // The backup is the file as it was before Helo touched it: a later write must not replace it with a file that already has Helo's hooks.
  if (fs.existsSync(file)) {
    const backup = `${file}.helo-backup`;
    if (!fs.existsSync(backup) || !fs.readFileSync(file, 'utf8').includes('/helo/hook')) fs.copyFileSync(file, backup);
  }
  const tmp = `${file}.helo-tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

// ---------------------------------------------------------------------------
// Claude Code

const OUR_URL = /^http:\/\/127\.0\.0\.1:\d+\/helo\/hook$/;
const OUR_STATUS = /127\.0\.0\.1:\d+\/helo\/status/;

// Seconds Claude Code waits for each hook. The permission hook stays open
// while the user decides; the bridge gives up a little earlier (280 s).
const EVENTS: Record<string, number> = { PermissionRequest: 300, Notification: 5, Stop: 5, UserPromptSubmit: 5 };
// The work map's extra events. Helo answers them at once and never decides anything, so the wait is short.
const MAP_TIMEOUT = 3;

function isOurs(hook: Hook): boolean {
  return Boolean(hook) && hook.type === 'http' && typeof hook.url === 'string' && OUR_URL.test(hook.url);
}

export function hookUrl(port: number): string {
  return `http://127.0.0.1:${port}${HOOK_PATH}`;
}

/**
 * The status line command. Claude Code pipes its status JSON (which includes the
 * documented rate_limits object) to curl, curl posts it to Helo and prints the
 * line Helo answers with. curl.exe ships with Windows 10 1803+ and Git for Windows.
 */
export function statusLineCommand({ port, token }: BridgeOpts): string {
  return `curl.exe -s -m 2 -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" --data-binary "@-" http://127.0.0.1:${port}${STATUS_PATH}`;
}

function isOurStatusLine(sl: unknown): boolean {
  return Boolean(sl) && typeof sl === 'object' && typeof (sl as Json).command === 'string' && OUR_STATUS.test((sl as Json).command as string);
}

export type StatusLineState = 'ours' | 'other' | 'none';

export function statusLineState(settings: Json): StatusLineState {
  if (!settings.statusLine) return 'none';
  return isOurStatusLine(settings.statusLine) ? 'ours' : 'other';
}

/** Returns a copy of settings without any Helo hooks or Helo status line. */
export function stripHooks(settings: Json): Json {
  const next = stripMatching(settings, isOurs);
  if (isOurStatusLine(next.statusLine)) delete next.statusLine;
  return next;
}

export interface InstallOptions extends BridgeOpts {
  /** Also add the status line used for the usage rings (never replaces the user's own). */
  statusLine?: boolean;
  /** Also add the tool and subagent events the work map is drawn from. */
  map?: boolean;
}

/** Returns a copy of settings with Helo's hooks added (replacing older ones). */
export function applyHooks(settings: Json, { port, token, statusLine = false, map = false }: InstallOptions): Json {
  const hadOwnStatusLine = statusLineState(settings) === 'other';
  const next = stripHooks(settings);
  const events: Record<string, Hook> = {};
  const all = map ? { ...EVENTS, ...Object.fromEntries(MAP_EVENTS.map((e) => [e, MAP_TIMEOUT])) } : EVENTS;
  for (const [event, timeout] of Object.entries(all)) {
    events[event] = { type: 'http', url: hookUrl(port), timeout, headers: { Authorization: `Bearer ${token}` } };
  }
  addGroups(next, events);
  if (statusLine && !hadOwnStatusLine) {
    next.statusLine = { type: 'command', command: statusLineCommand({ port, token }), padding: 0 };
  }
  return next;
}

export function hasHooks(settings: Json, { port, token }: BridgeOpts): boolean {
  return hasAll(settings, Object.keys(EVENTS), (h) =>
    isOurs(h) && h.url === hookUrl(port) && Boolean(h.headers) && h.headers?.Authorization === `Bearer ${token}`);
}

/** Whether the work map's events are installed too. */
export function hasMapHooks(settings: Json, { port, token }: BridgeOpts): boolean {
  return hasAll(settings, [...MAP_EVENTS], (h) =>
    isOurs(h) && h.url === hookUrl(port) && Boolean(h.headers) && h.headers?.Authorization === `Bearer ${token}`);
}

export function install(file: string, opts: InstallOptions): { statusLine: StatusLineState } {
  const next = applyHooks(readSettings(file), opts);
  writeSettings(file, next);
  return { statusLine: statusLineState(next) };
}

export function uninstall(file: string): void {
  writeSettings(file, stripHooks(readSettings(file)));
}

export function isInstalled(file: string, opts: BridgeOpts): boolean {
  try {
    return hasHooks(readSettings(file), opts);
  } catch {
    return false;
  }
}

/** Status of the Claude settings file without throwing. */
export function inspect(file: string, opts: BridgeOpts): { installed: boolean; map: boolean; statusLine: StatusLineState; error: string } {
  try {
    const s = readSettings(file);
    return { installed: hasHooks(s, opts), map: hasMapHooks(s, opts), statusLine: statusLineState(s), error: '' };
  } catch (err) {
    return { installed: false, map: false, statusLine: 'none', error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Codex CLI (~/.codex/hooks.json). Codex runs command hooks with the event JSON
// on stdin and reads a decision from stdout; curl forwards both ways.

const CODEX_EVENTS: Record<string, number> = { PermissionRequest: 300, Stop: 10, UserPromptSubmit: 10 };
const CODEX_MARK = /127\.0\.0\.1:\d+\/helo\/hook\?agent=codex/;

function isOurCodexHook(hook: Hook): boolean {
  return Boolean(hook) && hook.type === 'command' && typeof hook.command === 'string' && CODEX_MARK.test(hook.command);
}

export function codexCommand({ port, token }: BridgeOpts, maxSeconds: number): string {
  return `curl.exe -s -m ${maxSeconds} -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" --data-binary "@-" "http://127.0.0.1:${port}${HOOK_PATH}?agent=codex"`;
}

export function stripCodexHooks(settings: Json): Json {
  return stripMatching(settings, isOurCodexHook);
}

export function applyCodexHooks(settings: Json, opts: BridgeOpts): Json {
  const next = stripCodexHooks(settings);
  const events: Record<string, Hook> = {};
  for (const [event, timeout] of Object.entries(CODEX_EVENTS)) {
    const command = codexCommand(opts, Math.max(2, timeout - 10));
    events[event] = { type: 'command', command, commandWindows: command, timeout };
  }
  return addGroups(next, events);
}

export function hasCodexHooks(settings: Json, opts: BridgeOpts): boolean {
  return hasAll(settings, Object.keys(CODEX_EVENTS), (h) =>
    isOurCodexHook(h) && typeof h.command === 'string' && h.command.includes(`Bearer ${opts.token}`) && h.command.includes(`:${opts.port}/`));
}

export function installCodex(file: string, opts: BridgeOpts): void {
  writeSettings(file, applyCodexHooks(readSettings(file), opts));
}

export function uninstallCodex(file: string): void {
  writeSettings(file, stripCodexHooks(readSettings(file)));
}

export function isCodexInstalled(file: string, opts: BridgeOpts): boolean {
  try {
    return hasCodexHooks(readSettings(file), opts);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Watch-only agents. Their hooks are command hooks too, and curl forwards the event the
// same way, but Helo never decides anything for them: it answers at once.

function watchCommand({ port, token }: BridgeOpts, agent: 'gemini' | 'cursor'): string {
  return `curl.exe -s -m 3 -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" --data-binary "@-" "http://127.0.0.1:${port}${HOOK_PATH}?agent=${agent}"`;
}

const matchesBridge = (command: unknown, opts: BridgeOpts) =>
  typeof command === 'string' && command.includes(`Bearer ${opts.token}`) && command.includes(`:${opts.port}/`);

// ---------------------------------------------------------------------------
// Gemini CLI (~/.gemini/settings.json). Same shape as Claude Code's hooks (event -> groups ->
// hooks), with its own event names and the timeout in milliseconds.

const GEMINI_EVENTS = ['BeforeAgent', 'AfterAgent', 'Notification', 'AfterTool'];
const GEMINI_MARK = /127\.0\.0\.1:\d+\/helo\/hook\?agent=gemini/;

function isOurGeminiHook(hook: Hook): boolean {
  return Boolean(hook) && typeof hook.command === 'string' && GEMINI_MARK.test(hook.command);
}

export function geminiCommand(opts: BridgeOpts): string {
  return watchCommand(opts, 'gemini');
}

export function stripGeminiHooks(settings: Json): Json {
  return stripMatching(settings, isOurGeminiHook);
}

export function applyGeminiHooks(settings: Json, opts: BridgeOpts): Json {
  const next = stripGeminiHooks(settings) as Json & { hooks?: Record<string, unknown[]> };
  if (!next.hooks || typeof next.hooks !== 'object') next.hooks = {};
  for (const event of GEMINI_EVENTS) {
    if (!Array.isArray(next.hooks[event])) next.hooks[event] = [];
    const hook = { name: 'helo', type: 'command', command: geminiCommand(opts), timeout: 5000 };
    // Tool events match on the tool's name; "*" is every tool.
    next.hooks[event].push(event === 'AfterTool' ? { matcher: '*', hooks: [hook] } : { hooks: [hook] });
  }
  return next;
}

export function hasGeminiHooks(settings: Json, opts: BridgeOpts): boolean {
  return hasAll(settings, GEMINI_EVENTS, (h) => isOurGeminiHook(h) && matchesBridge(h.command, opts));
}

export function installGemini(file: string, opts: BridgeOpts): void {
  writeSettings(file, applyGeminiHooks(readSettings(file), opts));
}

export function uninstallGemini(file: string): void {
  writeSettings(file, stripGeminiHooks(readSettings(file)));
}

export function isGeminiInstalled(file: string, opts: BridgeOpts): boolean {
  try {
    return hasGeminiHooks(readSettings(file), opts);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cursor (~/.cursor/hooks.json): { "version": 1, "hooks": { event: [ { command, timeout } ] } }.
// The list under each event holds the hooks themselves, not groups. Timeout is in seconds.

const CURSOR_EVENTS = ['beforeSubmitPrompt', 'afterAgentResponse', 'stop'];
const CURSOR_MARK = /127\.0\.0\.1:\d+\/helo\/hook\?agent=cursor/;

function isOurCursorHook(hook: unknown): boolean {
  return Boolean(hook) && typeof hook === 'object' && typeof (hook as Hook).command === 'string' && CURSOR_MARK.test((hook as Hook).command as string);
}

export function cursorCommand(opts: BridgeOpts): string {
  return watchCommand(opts, 'cursor');
}

export function stripCursorHooks(settings: Json): Json {
  const next = structuredClone(settings) as Json & { hooks?: Record<string, unknown> };
  if (!next.hooks || typeof next.hooks !== 'object') return next;
  for (const event of Object.keys(next.hooks)) {
    const list = next.hooks[event];
    if (!Array.isArray(list)) continue;
    const kept = list.filter((h) => !isOurCursorHook(h));
    if (kept.length) next.hooks[event] = kept;
    else delete next.hooks[event];
  }
  return next;
}

export function applyCursorHooks(settings: Json, opts: BridgeOpts): Json {
  const next = stripCursorHooks(settings) as Json & { hooks?: Record<string, unknown[]> };
  if (typeof next.version !== 'number') next.version = 1;
  if (!next.hooks || typeof next.hooks !== 'object') next.hooks = {};
  for (const event of CURSOR_EVENTS) {
    if (!Array.isArray(next.hooks[event])) next.hooks[event] = [];
    next.hooks[event].push({ command: cursorCommand(opts), timeout: 5 });
  }
  return next;
}

export function hasCursorHooks(settings: Json, opts: BridgeOpts): boolean {
  const hooks = (settings.hooks || {}) as Record<string, unknown>;
  return CURSOR_EVENTS.every((event) => {
    const list = hooks[event];
    return Array.isArray(list) && list.some((h) => isOurCursorHook(h) && matchesBridge((h as Hook).command, opts));
  });
}

export function installCursor(file: string, opts: BridgeOpts): void {
  writeSettings(file, applyCursorHooks(readSettings(file), opts));
}

/** Removes Helo's hooks. A file left with only the version number is kept: Cursor reads it as "no hooks". */
export function uninstallCursor(file: string): void {
  writeSettings(file, stripCursorHooks(readSettings(file)));
}

export function isCursorInstalled(file: string, opts: BridgeOpts): boolean {
  try {
    return hasCursorHooks(readSettings(file), opts);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Moving to another port (the saved one was taken at startup)

export type HookAgent = 'claude' | 'codex' | 'gemini' | 'cursor';

/**
 * Points every connected agent's hooks at the new port. An agent counts as connected when its
 * file has Helo's hooks for the old port. Files that cannot be read or written are left alone
 * and reported in `failed`.
 */
export function movePort(files: Record<HookAgent, string>, from: BridgeOpts, to: InstallOptions): { moved: HookAgent[]; failed: HookAgent[] } {
  const steps: Record<HookAgent, [(file: string, opts: BridgeOpts) => boolean, (file: string, opts: InstallOptions) => unknown]> = {
    claude: [isInstalled, install],
    codex: [isCodexInstalled, installCodex],
    gemini: [isGeminiInstalled, installGemini],
    cursor: [isCursorInstalled, installCursor],
  };
  const moved: HookAgent[] = [];
  const failed: HookAgent[] = [];
  for (const agent of Object.keys(steps) as HookAgent[]) {
    const [connected, connect] = steps[agent];
    if (!connected(files[agent], from)) continue;
    try {
      connect(files[agent], to);
      moved.push(agent);
    } catch {
      failed.push(agent);
    }
  }
  return { moved, failed };
}
