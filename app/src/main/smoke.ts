// Two test modes, both with a temporary user data folder and temporary agent
// config files (the real ~/.claude and ~/.codex are never touched):
//
//   --smoke=<dir>     Shows each view with SAMPLE data and saves a screenshot
//                     of it. The sample data exists only in this mode.
//   --selftest=<json> Exercises the real system integrations (helper, bridge
//                     through curl, converter, focus, clipboard) and writes a
//                     JSON report.
import { BrowserWindow, nativeImage, clipboard, screen, ClipboardItem, type NativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import * as hooks from './hooks-install';
import { DownloadWatcher, SteamWatcher, findSteamPath } from './finished-watch';
import { BusyIdleDetector, parseAcf } from './finished';
import { drawMark } from './icon';
import { permissionView } from './format';
import { WorkMap } from './workmap';
import { MAP_SETUP } from '../shared/workmap';
import type { WinHelper } from './winhelper';
import type { ClipboardHistory } from './clipboard-history';
import type { IslandState, PanelTab, SmokeView } from '../shared/types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until(fn: () => boolean, ms: number, step = 100): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await wait(step);
  }
  return fn();
}

// ---------------------------------------------------------------------------
// Smoke screenshots

interface SmokeCtx {
  dir: string;
  island: BrowserWindow;
  state: IslandState;
  push: (p: Partial<IslandState>) => void;
  openSettings: (section?: string) => BrowserWindow;
  isReady: () => boolean;
  quit: (code: number) => void;
}

function sampleArt(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d6f8a"/><stop offset="1" stop-color="#0d1b3a"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><circle cx="84" cy="38" r="16" fill="#f4d58d"/><path d="M0 92 L38 62 L66 84 L90 66 L120 88 L120 120 L0 120Z" fill="#0a0f1f"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function sampleThumb(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#2b3a55"/><rect x="12" y="14" width="80" height="10" rx="3" fill="#8fb3ff"/><rect x="12" y="34" width="130" height="6" rx="3" fill="#56688f"/><rect x="12" y="48" width="110" height="6" rx="3" fill="#56688f"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export async function runSmoke(ctx: SmokeCtx) {
  const { dir, island, push } = ctx;
  fs.mkdirSync(dir, { recursive: true });
  try {
    await until(ctx.isReady, 20_000);
    await wait(1500);
    const now = Date.now();
    const smoke = (view: Partial<SmokeView> & { backdrop?: boolean }) => island.webContents.send('smoke', { panel: null, backdrop: true, ...view });
    const shot = async (name: string, win: BrowserWindow = island, settle = 900) => {
      await wait(settle);
      let img: NativeImage | null = null;
      for (let attempt = 0; attempt < 3 && !img; attempt++) {
        try {
          win.webContents.invalidate();
          await wait(150);
          img = await win.webContents.capturePage();
        } catch (err) {
          console.log(`[helo] capture ${name} retry: ${(err as Error).message}`);
          await wait(500);
        }
      }
      if (img) fs.writeFileSync(path.join(dir, `${name}.png`), img.toPNG());
    };

    // Sample state (screenshots only).
    push({
      media: {
        app: 'Spotify.exe', title: 'Night Drive', artist: 'The Sample Band', album: 'Demo Tapes', status: 'Playing',
        canPlay: true, canPause: true, canNext: true, canPrevious: true, canSeek: true,
        positionMs: 72_000, startMs: 0, endMs: 214_000, updatedAt: now, art: sampleArt(),
      },
      lyrics: {
        trackKey: 'x', status: 'synced', plain: '',
        lines: [
          { timeMs: 60_000, text: 'Headlights on the empty road' },
          { timeMs: 70_000, text: 'Every sign is pointing home' },
          { timeMs: 80_000, text: 'Radio low, the city glows' },
        ],
      },
      calendar: {
        events: [
          { title: 'Design review', start: now + 12 * 60_000, end: now + 72 * 60_000, allDay: false, location: 'Room 4', join: 'https://meet.google.com/abc-defg-hij' },
          { title: 'Dentist', start: now + 26 * 3_600_000, end: now + 27 * 3_600_000, allDay: false, location: '' },
        ],
        error: '', fetchedAt: now,
      },
      agents: {
        ...ctx.state.agents,
        sessions: [
          { key: 'gemini:c', agent: 'gemini', project: 'docs-site', mood: 'waiting', since: now - 20_000, jump: true },
          { key: 'claude:a', agent: 'claude', project: 'shop-api', mood: 'working', since: now - 40_000, added: 48, removed: 12, file: 'checkout.ts', jump: true },
          { key: 'codex:b', agent: 'codex', project: 'landing-page', mood: 'done', since: now - 90_000 },
        ],
        mood: 'idle',
        model: 'Opus 5.5',
        usage: { fiveHour: { usedPercent: 38, resetsAt: now + 2.4 * 3_600_000 }, sevenDay: { usedPercent: 61, resetsAt: now + 3.2 * 86_400_000 }, updatedAt: now },
        claude: { connected: true, note: '' },
        codex: { connected: false, note: '' },
        gemini: { connected: false, note: '' },
        cursor: { connected: false, note: '' },
      },
      clipboard: [
        { id: '0', kind: 'text', type: 'color', pinned: true, text: '#2B6BE4', at: now - 9 * 3_600_000 },
        { id: '1', kind: 'text', type: 'text', pinned: false, text: 'npm run build && npm test', at: now - 30_000 },
        { id: '2', kind: 'image', type: 'image', pinned: false, text: 'Image 1280×720', thumb: sampleThumb(), at: now - 5 * 60_000 },
        { id: '3', kind: 'text', type: 'link', pinned: false, text: 'https://example.com/docs/getting-started', at: now - 50 * 60_000 },
        { id: '4', kind: 'text', type: 'text', pinned: false, text: 'Meeting notes: ship the island on Friday, check the installer on a clean PC.', at: now - 3 * 3_600_000 },
      ],
      notes: 'Ideas\n- try the bottom edge on the laptop\n- ask Sam about the icon',
      shelf: [
        { id: 's1', name: 'screenshot.png', path: 'C:\\Users\\me\\Desktop\\screenshot.png', size: 482_133, isDirectory: false, icon: null, missing: false },
        { id: 's2', name: 'invoice-2026-11.pdf', path: 'C:\\Users\\me\\Downloads\\invoice-2026-11.pdf', size: 88_120, isDirectory: false, icon: null, missing: false },
        { id: 's3', name: 'project-assets', path: 'C:\\Users\\me\\project-assets', size: 0, isDirectory: true, icon: null, missing: false },
      ],
      timer: { phase: 'focus', running: true, endsAt: now + 18 * 60_000 + 42_000, remainingMs: 18 * 60_000, focusMin: 25, breakMin: 5, longBreakMin: 15, longEvery: 4, longBreak: false, completedFocus: 2 },
      volume: { level: 64, muted: false },
      power: { hasBattery: true, percent: 82, pluggedIn: true, charging: true },
      privacy: { microphone: [], camera: [] },
      bluetooth: [{ name: 'WH-1000XM5', percent: 70 }],
      displays: [
        { index: 0, name: 'Generic PnP Monitor', brightness: 70, max: 100, contrast: null, contrastMax: null, input: null },
        { index: 1, name: 'ASUS VG259Q5A', brightness: 55, max: 100, contrast: 50, contrastMax: 100, input: 0x0f },
      ],
      helper: 'running',
      settings: { ...ctx.state.settings, calendar: { icsUrl: 'https://calendar.example.com/sample.ics' } },
      finished: {
        watch: { pid: 4242, name: 'GameLauncher', title: 'Loading world…', condition: 'idle', phase: 'settling', quietMs: 9000, since: now - 95_000 },
        recent: [
          { id: 'f1', kind: 'download', title: 'Download finished', text: 'installer-2.4.1.exe', at: now - 4 * 60_000, actionable: true },
          { id: 'f2', kind: 'steam', title: 'Sample Game is ready to play', text: 'Steam finished downloading.', at: now - 38 * 60_000, actionable: true },
          { id: 'f3', kind: 'app', title: 'Editor looks done', text: 'It went quiet, which usually means loading finished.', at: now - 2 * 3_600_000, actionable: false },
        ],
        doneAt: 0,
        steamFound: true,
      },
    });

    smoke({});
    await shot('01-idle');
    smoke({ hover: true });
    await shot('02-idle-hover');
    smoke({});
    push({ faceOnly: true });
    await shot('02b-idle-face-only');
    push({ faceOnly: false });
    push({ banner: { kind: 'done', title: 'Finished in shop-api', text: 'All 42 tests pass. I also updated the README.', at: Date.now() } });
    await shot('03-banner-done');
    push({ banner: { kind: 'input', title: 'Claude needs your answer', text: 'Open the terminal for shop-api', at: Date.now() } });
    await shot('04-banner-input');
    push({ banner: { kind: 'download', title: 'Download finished', text: 'installer-2.4.1.exe', at: Date.now(), clickable: true } });
    await shot('04b-banner-download');
    push({ banner: { kind: 'steam', title: 'Sample Game is ready to play', text: 'Steam finished downloading.', at: Date.now(), clickable: true } });
    await shot('04c-banner-steam');
    push({ banner: null, agents: { ...ctx.state.agents, mood: 'waiting' } });
    push({
      requests: [
        { id: 'r1', kind: 'tool', agent: 'claude', tool: 'Bash', summary: 'npm install && npm run build -- --mode production', project: 'shop-api', always: 'Bash(npm install)', receivedAt: Date.now() },
        { id: 'r2', kind: 'tool', agent: 'codex', tool: 'apply_patch', summary: 'src/index.ts', project: 'landing-page', always: null, receivedAt: Date.now() },
      ],
    });
    await shot('05-permission');
    const sampleEdit = {
      hook_event_name: 'PermissionRequest', cwd: 'C:\\code\\shop-api', tool_name: 'Edit',
      tool_input: {
        file_path: 'C:\\code\\shop-api\\src\\cart.ts',
        old_string: 'export function total(items: Item[]) {\n  let sum = 0;\n  for (const i of items) sum += i.price;\n  return sum;\n}',
        new_string: 'export function total(items: Item[]) {\n  let sum = 0;\n  for (const i of items) sum += i.price * i.quantity;\n  return Math.round(sum * 100) / 100;\n}',
      },
    };
    push({ requests: [permissionView('r3', sampleEdit)] });
    await shot('05b-permission-edit');
    const sampleQuestion = {
      hook_event_name: 'PermissionRequest', cwd: 'C:\\code\\shop-api', tool_name: 'AskUserQuestion',
      tool_input: {
        questions: [{
          question: 'Which database should the cart service use?',
          header: 'Database',
          multiSelect: false,
          options: [
            { label: 'PostgreSQL', description: 'Already used by the orders service.' },
            { label: 'SQLite', description: 'Simplest to run locally; one file.' },
            { label: 'Redis', description: 'Fast, but carts would not survive a restart without persistence.' },
          ],
        }],
      },
    };
    push({ requests: [permissionView('r4', sampleQuestion)] });
    await shot('05c-question');
    const samplePlan = {
      hook_event_name: 'PermissionRequest', cwd: 'C:\\code\\shop-api', tool_name: 'ExitPlanMode',
      tool_input: { plan: '# Add quantities to the cart\n\n1. Add a `quantity` column to `cart_items` (default 1).\n2. Multiply by quantity in `total()` and round to cents.\n3. Update the three cart tests and add one for quantity 0.\n4. Run the test suite.' },
    };
    push({ requests: [permissionView('r5', samplePlan)] });
    await shot('05d-plan');
    push({ requests: [], agents: { ...ctx.state.agents, mood: 'idle' }, hud: { kind: 'volume', level: 64, muted: false, at: Date.now() } });
    await shot('06-hud-volume');
    push({ hud: null });
    smoke({ menu: true });
    await shot('07-menu');
    push({ map: sampleMap() });
    const tabs: PanelTab[] = ['media', 'agents', 'map', 'timer', 'clipboard', 'notes', 'shelf', 'system', 'calendar', 'finished'];
    for (const tab of tabs) {
      smoke({ panel: tab });
      await shot(`10-panel-${tab}`);
    }
    push({ finished: { ...ctx.state.finished, watch: null } });
    smoke({ panel: 'finished' });
    await shot('10-panel-finished-pick');
    smoke({});
    push({ settings: { ...ctx.state.settings, display: { ...ctx.state.settings.display, edge: 'bottom' } }, place: { edge: 'bottom', floating: false } });
    await shot('15-edge-bottom-idle');
    smoke({ panel: 'media' });
    await shot('15-edge-bottom-panel');
    push({ place: { edge: 'top', floating: true } });
    await shot('16-floating-panel');
    smoke({});
    await shot('16-floating-idle');
    push({ settings: { ...ctx.state.settings, display: { ...ctx.state.settings.display, edge: 'top' } }, place: { edge: 'top', floating: false } });
    smoke({ faces: true });
    await shot('20-faces', island, 1200);
    smoke({});

    const settingsWin = ctx.openSettings();
    await new Promise<void>((r) => settingsWin.webContents.once('did-finish-load', () => r()));
    for (const section of ['general', 'features', 'agents', 'license', 'startup']) {
      settingsWin.webContents.send('settings:section', section);
      await shot(`30-settings-${section}`, settingsWin, section === 'startup' ? 3000 : 700);
    }
    console.log(`[helo] smoke screenshots saved to ${dir}`);
    ctx.quit(0);
  } catch (err) {
    console.error('[helo] smoke failed', err);
    ctx.quit(1);
  }
}

// ---------------------------------------------------------------------------
// Self-test against the real system

interface SelfTestCtx {
  out: string;
  island: BrowserWindow;
  helper: WinHelper;
  state: IslandState;
  push: (p: Partial<IslandState>) => void;
  isReady: () => boolean;
  bridgeOpts: { port: number; token: string };
  claudeSettings: string;
  codexHooks: string;
  geminiSettings: string;
  cursorHooks: string;
  convertImage: (source: string, to: 'png' | 'jpeg' | 'webp') => Promise<string>;
  setPanelOpen: (open: boolean) => Promise<void>;
  captureClipboard: () => Promise<void>;
  history: ClipboardHistory;
  setKeepAwake: (on: boolean) => void;
  decide: (id: string, behavior: 'allow' | 'deny' | 'always' | null, picks?: string[][]) => void;
  treeCpu: (pid: number) => Promise<{ alive: boolean; cpuMs: number; startTicks: string }>;
  isPanelOpen: () => boolean;
  openSettings: (section?: string) => BrowserWindow;
  settingsFile: string;
  tmp: string;
  quit: (code: number) => void;
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

/** Runs a shell command with `stdin` and returns stdout. */
function run(cmd: string, args: string[], stdin: string, timeoutMs = 20_000): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { windowsHide: true, windowsVerbatimArguments: cmd.toLowerCase().endsWith('cmd.exe') });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => { stdout += d; });
    p.stderr.on('data', (d) => { stderr += d; });
    const t = setTimeout(() => p.kill(), timeoutMs);
    p.on('close', (code) => {
      clearTimeout(t);
      resolve({ code, stdout, stderr });
    });
    p.on('error', (err) => {
      clearTimeout(t);
      resolve({ code: -1, stdout, stderr: err.message });
    });
    p.stdin.end(stdin);
  });
}

export async function runSelfTest(ctx: SelfTestCtx) {
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    checks.push({ name, ok, detail });
    console.log(`[helo] ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
  };
  const seen = new Set<string>();
  ctx.helper.on('message', (m) => seen.add(m.type));
  const selfPids = () => new Set([process.pid, ctx.island.webContents.getOSProcessId()]);

  try {
    check('island page loaded', await until(ctx.isReady, 20_000));
    check('helper started', await until(() => ctx.helper.status === 'running', 30_000), `status ${ctx.helper.status}`);
    await until(() => seen.has('volume') && seen.has('power') && seen.has('privacy') && seen.has('media'), 15_000);
    check('helper: volume reading', ctx.state.volume !== null, JSON.stringify(ctx.state.volume));
    check('helper: power reading', ctx.state.power !== null, JSON.stringify(ctx.state.power));
    check('helper: microphone/camera reading', seen.has('privacy'), JSON.stringify(ctx.state.privacy));
    const front = String(await ctx.helper.request('foreground-app').catch((e: Error) => `error: ${e.message}`));
    check('helper: app in front and fullscreen state', /^[^|]+\|[01]\|-?\d+\|-?\d+$/.test(front), front);
    const m = ctx.state.media;
    check('helper: media session reading', seen.has('media'), m ? `${m.app}: "${m.title}" by "${m.artist}" (${m.status}), seek ${m.canSeek}, length ${Math.round((m.endMs - m.startMs) / 1000)}s` : 'no media session playing');

    // Media control: pause and resume whatever is playing, then check it is playing again.
    if (m && m.status === 'Playing' && m.canPause) {
      await ctx.helper.request('media', { action: 'toggle' });
      const paused = await until(() => ctx.state.media?.status === 'Paused', 4000);
      await ctx.helper.request('media', { action: 'toggle' });
      const resumed = await until(() => ctx.state.media?.status === 'Playing', 4000);
      check('media: play/pause control', paused && resumed, `paused ${paused}, resumed ${resumed}`);
    } else {
      check('media: play/pause control (skipped, nothing playing)', true, 'not exercised');
    }

    // Volume: set it to the level it already has.
    if (ctx.state.volume?.level != null) {
      const ok = await ctx.helper.request('volume', { value: ctx.state.volume.level });
      check('helper: set volume (same level)', ok === true, `level ${ctx.state.volume.level}`);
    }

    // DDC/CI: list monitors and write back the current brightness.
    try {
      const list = String(await ctx.helper.request('ddc-list', { code: 0x10 }, 15_000));
      check('ddc: read monitor brightness', list.length > 0, list.replace(/\n/g, ' ; '));
      const first = list.split('\n').map((l) => l.split('|')).find((p) => Number(p[2]) >= 0);
      if (first) {
        const ok = await ctx.helper.request('ddc-set', { index: Number(first[0]), code: 0x10, value: Number(first[2]) }, 15_000);
        check('ddc: write brightness (same value)', ok === true, `${first[1]} = ${first[2]}`);
      }
    } catch (err) {
      check('ddc: read monitor brightness', false, (err as Error).message);
    }

    // Bridge through the exact commands written into the agents' config files.
    const { port, token } = ctx.bridgeOpts;
    const decideNext = async (behavior: 'allow' | 'deny' | 'always') => {
      const okSeen = await until(() => ctx.state.requests.length > 0, 10_000);
      if (okSeen) ctx.decide(ctx.state.requests[0].id, behavior);
      return okSeen;
    };
    const permission = JSON.stringify({ hook_event_name: 'PermissionRequest', session_id: 'self', cwd: 'C:\\code\\selftest', tool_name: 'Bash', tool_input: { command: 'echo hi' } });
    {
      // The work map: tool events go through the real bridge and reach the island's state.
      const post = (body: unknown) => fetch(`http://127.0.0.1:${port}/helo/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const base = { session_id: 'self-map', cwd: 'C:\\code\\selftest', tool_name: 'Read', tool_use_id: 'm1' };
      const hasFile = (status: string) => ctx.state.map?.board.entries.some((e) => e.station === 'files' && e.status === status) === true;
      const started = Date.now();
      const res = await post({ ...base, hook_event_name: 'PreToolUse', tool_input: { file_path: 'C:\\code\\selftest\\a.ts' } });
      const took = Date.now() - started;
      const body = await res.text();
      const shown = await until(() => hasFile('run'), 3000);
      await post({ ...base, hook_event_name: 'PostToolUse', tool_response: {} });
      const done = await until(() => hasFile('ok'), 3000);
      check('work map: a tool call is answered with no decision and shows on the map', res.status === 200 && body === '' && shown && done && ctx.state.requests.length === 0,
        `status ${res.status} in ${took} ms, shown ${shown}, finished ${done}`);
    }
    const codexCmd = hooks.codexCommand({ port, token }, 30);
    {
      const pending = run('cmd.exe', ['/d', '/s', '/c', `"${codexCmd}"`], permission);
      const shown = await decideNext('deny');
      const r = await pending;
      let decision = '';
      try { decision = JSON.parse(r.stdout).hookSpecificOutput.decision.behavior; } catch { /* */ }
      check('codex hook command via cmd.exe: card shown and deny returned', shown && decision === 'deny', `exit ${r.code}, stdout ${r.stdout.slice(0, 160)} ${r.stderr.slice(0, 160)}`);
    }
    {
      const pending = run('powershell.exe', ['-NoProfile', '-Command', codexCmd], permission);
      const shown = await decideNext('allow');
      const r = await pending;
      let decision = '';
      try { decision = JSON.parse(r.stdout).hookSpecificOutput.decision.behavior; } catch { /* */ }
      check('codex hook command via PowerShell: card shown and allow returned', shown && decision === 'allow', `exit ${r.code}, stdout ${r.stdout.slice(0, 160)} ${r.stderr.slice(0, 160)}`);
    }
    {
      // Claude Code's HTTP hook, as Claude Code sends it.
      const always = JSON.stringify({ ...JSON.parse(permission), permission_suggestions: [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'echo hi' }], behavior: 'allow', destination: 'localSettings' }] });
      const pending = fetch(`http://127.0.0.1:${port}/helo/hook`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: always });
      const shown = await decideNext('always');
      const json = (await (await pending).json()) as { hookSpecificOutput: { decision: { updatedPermissions?: { rules?: { ruleContent?: string }[] }[] } } };
      check('claude http hook: Always allow returns updatedPermissions', shown && json.hookSpecificOutput.decision.updatedPermissions?.[0]?.rules?.[0]?.ruleContent === 'echo hi', JSON.stringify(json));
    }
    {
      // A question and a plan, answered from the island in the documented updatedInput format.
      const hook = (body: unknown) => fetch(`http://127.0.0.1:${port}/helo/hook`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const base = { hook_event_name: 'PermissionRequest', session_id: 'self', cwd: 'C:\\code\\selftest' };
      const questions = [
        { question: 'Which framework?', header: 'Framework', multiSelect: false, options: [{ label: 'React', description: '' }, { label: 'Vue', description: '' }] },
        { question: 'Which checks?', header: 'Checks', multiSelect: true, options: [{ label: 'Lint', description: '' }, { label: 'Tests', description: '' }, { label: 'Types', description: '' }] },
      ];
      type Reply = { hookSpecificOutput?: { decision?: { behavior?: string; message?: string; updatedInput?: { answers?: Record<string, string>; questions?: unknown[]; plan?: string } } } };
      let pending = hook({ ...base, tool_name: 'AskUserQuestion', tool_input: { questions } });
      let shown = await until(() => ctx.state.requests[0]?.kind === 'question', 10_000);
      if (shown) ctx.decide(ctx.state.requests[0].id, 'allow', [['Vue'], ['Lint', 'Types']]);
      let d = ((await (await pending).json()) as Reply).hookSpecificOutput?.decision;
      check('claude http hook: question answered from the island', shown && d?.behavior === 'allow' && d.updatedInput?.answers?.['Which framework?'] === 'Vue' && d.updatedInput.answers['Which checks?'] === 'Lint, Types' && d.updatedInput.questions?.length === 2, JSON.stringify(d));

      pending = hook({ ...base, tool_name: 'AskUserQuestion', tool_input: { questions } });
      shown = await until(() => ctx.state.requests[0]?.kind === 'question', 10_000);
      if (shown) ctx.decide(ctx.state.requests[0].id, null);
      const text = await (await pending).text();
      check('claude http hook: "Answer in terminal" returns no decision', shown && text === '', `body "${text.slice(0, 120)}"`);

      pending = hook({ ...base, tool_name: 'ExitPlanMode', tool_input: { plan: '1. Do it', planFilePath: 'C:\\plans\\p.md' } });
      shown = await until(() => ctx.state.requests[0]?.kind === 'plan', 10_000);
      if (shown) ctx.decide(ctx.state.requests[0].id, 'allow');
      d = ((await (await pending).json()) as Reply).hookSpecificOutput?.decision;
      check('claude http hook: plan approved from the island', shown && d?.behavior === 'allow' && d.updatedInput?.plan === '1. Do it', JSON.stringify(d));

      pending = hook({ ...base, tool_name: 'ExitPlanMode', tool_input: { plan: '1. Do it' } });
      shown = await until(() => ctx.state.requests[0]?.kind === 'plan', 10_000);
      if (shown) ctx.decide(ctx.state.requests[0].id, 'deny');
      d = ((await (await pending).json()) as Reply).hookSpecificOutput?.decision;
      check('claude http hook: plan rejected from the island', shown && d?.behavior === 'deny' && Boolean(d.message), JSON.stringify(d));

      pending = hook({ ...base, tool_name: 'Edit', tool_input: { file_path: 'C:\\code\\selftest\\a.ts', old_string: 'const a = 1;\nconst b = 2;', new_string: 'const a = 1;\nconst b = 3;' } });
      shown = await until(() => ctx.state.requests.length > 0, 10_000);
      const diff = ctx.state.requests[0]?.diff;
      if (shown) ctx.decide(ctx.state.requests[0].id, 'allow');
      await pending;
      check('edit card: red/green lines', diff?.added === 1 && diff.removed === 1 && diff.file === 'a.ts', JSON.stringify(diff));
    }
    {
      const statusCmd = hooks.statusLineCommand({ port, token });
      const input = JSON.stringify({ model: { display_name: 'Opus' }, context_window: { used_percentage: 12 }, rate_limits: { five_hour: { used_percentage: 30, resets_at: Math.floor(Date.now() / 1000) + 3600 }, seven_day: { used_percentage: 55, resets_at: Math.floor(Date.now() / 1000) + 86400 } } });
      const bash = fs.existsSync('C:\\Program Files\\Git\\bin\\bash.exe') ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash.exe';
      const r = await run(bash, ['-c', statusCmd], input);
      const usage = ctx.state.agents.usage;
      check('status line command via Git Bash: prints the line and feeds the usage rings', r.stdout.trim() === 'Opus · ctx 12% · 5h 30% · 7d 55%' && usage?.fiveHour?.usedPercent === 30, `stdout "${r.stdout.trim()}" ${r.stderr.slice(0, 120)}`);
      const r2 = await run('powershell.exe', ['-NoProfile', '-Command', statusCmd], input);
      check('status line command via PowerShell', r2.stdout.trim().endsWith('7d 55%'), `stdout "${r2.stdout.trim()}" ${r2.stderr.slice(0, 120)}`);
    }

    // Hook installation, against temporary files.
    hooks.install(ctx.claudeSettings, { port, token, statusLine: true });
    check('install claude hooks (temp file)', hooks.isInstalled(ctx.claudeSettings, { port, token }), ctx.claudeSettings);
    hooks.installCodex(ctx.codexHooks, { port, token });
    check('install codex hooks (temp file)', hooks.isCodexInstalled(ctx.codexHooks, { port, token }), ctx.codexHooks);

    // Converter: PNG -> WebP and JPEG through the island's canvas.
    const src = path.join(ctx.tmp, 'sample.png');
    const size = 96;
    const rgba = drawMark(size, { tile: true, pill: [94, 240, 196, 255] });
    const bgra = Buffer.from(rgba);
    for (let i = 0; i < bgra.length; i += 4) { bgra[i] = rgba[i + 2]; bgra[i + 2] = rgba[i]; }
    fs.writeFileSync(src, nativeImage.createFromBitmap(bgra, { width: size, height: size }).toPNG());
    for (const to of ['webp', 'jpeg', 'png'] as const) {
      try {
        const out = await ctx.convertImage(src, to);
        const back = nativeImage.createFromPath(out);
        check(`converter: PNG -> ${to}`, fs.statSync(out).size > 0 && (to === 'webp' || back.getSize().width === size), `${path.basename(out)} ${fs.statSync(out).size} bytes`);
      } catch (err) {
        check(`converter: PNG -> ${to}`, false, (err as Error).message);
      }
    }

    // Focus: cards and banners must not take focus; the open panel may.
    const before = Number(await ctx.helper.request('foreground'));
    ctx.push({ banner: { kind: 'done', title: 'Self-test banner', text: 'checking focus', at: Date.now() } });
    const pending = fetch(`http://127.0.0.1:${port}/helo/hook`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: permission });
    await until(() => ctx.state.requests.length > 0, 5000);
    await wait(800);
    const during = Number(await ctx.helper.request('foreground'));
    check('focus: permission card and banner do not take focus', !ctx.island.isFocused() && !selfPids().has(during) && during === before, `foreground pid before ${before}, during ${during}`);
    if (ctx.state.requests[0]) ctx.decide(ctx.state.requests[0].id, 'deny');
    await pending;
    await ctx.setPanelOpen(true);
    await wait(300);
    check('focus: open panel is focusable but does not grab focus', ctx.island.isFocusable() && !ctx.island.isFocused(), `focusable ${ctx.island.isFocusable()}, focused ${ctx.island.isFocused()}`);
    // What a click in the notes field does: Windows makes the island the foreground window.
    const own = Number(ctx.island.getNativeWindowHandle().readBigUInt64LE(0));
    await ctx.helper.request('activate', { handle: own });
    await until(() => ctx.island.isFocused(), 2000);
    const fgWhileOpen = Number(await ctx.helper.request('foreground'));
    const typing = ctx.island.isFocused() && fgWhileOpen === process.pid;
    await ctx.setPanelOpen(false);
    await until(() => !ctx.island.isFocused(), 3000);
    await wait(300);
    const after = Number(await ctx.helper.request('foreground'));
    check('focus: panel can take keyboard focus, and gives it back to the previous app when it closes', typing && !ctx.island.isFocused() && !ctx.island.isFocusable() && after === before, `focused while open ${typing} (foreground pid ${fgWhileOpen}); after close: island focused ${ctx.island.isFocused()}, focusable ${ctx.island.isFocusable()}; foreground pid before ${before}, after ${after}`);

    // Pointer: clicks around the pill reach the apps underneath; hovering the pill opens the panel.
    {
      const h = ctx.helper;
      const b = ctx.island.getBounds();
      const scale = screen.getDisplayMatching(b).scaleFactor;
      const px = (x: number, y: number) => ({ x: Math.round(x * scale), y: Math.round(y * scale) });
      const pill = px(b.x + b.width / 2, b.y + 17);
      const empty = px(b.x + 12, b.y + b.height - 8);
      const away = px(b.x + b.width / 2, b.y + 520);
      const saved = String(await h.request('cursor-pos')).split('|').map(Number);
      await h.request('move-cursor', away);
      await until(() => !ctx.isPanelOpen(), 3000);
      await wait(800);
      const ours = selfPids();
      const emptyBefore = Number(await h.request('pid-at', empty));
      const pillBefore = Number(await h.request('pid-at', pill));
      await h.request('move-cursor', { x: pill.x - 3, y: pill.y });
      await wait(60);
      await h.request('move-cursor', pill);
      const opened = await until(() => ctx.isPanelOpen(), 3000);
      const pillDuring = Number(await h.request('pid-at', pill));
      await h.request('move-cursor', away);
      const closed = await until(() => !ctx.isPanelOpen(), 3000);
      await wait(800);
      const emptyAfter = Number(await h.request('pid-at', empty));
      await h.request('move-cursor', { x: saved[0], y: saved[1] });
      check(
        'pointer: clicks around the island pass through; hovering the pill opens the panel and leaving closes it',
        !ours.has(emptyBefore) && !ours.has(pillBefore) && opened && ours.has(pillDuring) && closed && !ours.has(emptyAfter),
        `window ${b.width}x${b.height}; under transparent area: pid ${emptyBefore} -> ${emptyAfter}; under pill idle ${pillBefore}, hovered ${pillDuring}; opened ${opened}, closed ${closed}`,
      );
    }

    // Clipboard: copy a unique text, see it in the history, then restore the clipboard text.
    const original = await clipboard.readText();
    const marker = `helo-selftest-${Date.now()}`;
    await clipboard.writeText(marker);
    const captured = await until(() => ctx.history.list().some((c) => c.text === marker), 5000);
    check('clipboard: new copies are captured (via the helper change signal)', captured);
    const item = ctx.history.list().find((c) => c.text === marker);
    if (item) ctx.history.remove(item.id);

    // An image copy (Electron 45's async clipboard API).
    const imgPng = nativeImage.createFromBitmap(Buffer.alloc(40 * 30 * 4, 200), { width: 40, height: 30 }).toPNG();
    await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(imgPng)], { type: 'image/png' }) })]);
    const gotImage = await until(() => ctx.history.list()[0]?.kind === 'image', 5000);
    const imgItem = ctx.history.list()[0];
    check('clipboard: image copies are captured with a thumbnail', gotImage && Boolean(imgItem?.thumb), imgItem ? `${imgItem.text}` : 'nothing');
    if (gotImage && imgItem) ctx.history.remove(imgItem.id);

    // A copy marked private by its app (as password managers do) must be skipped.
    const secret = `helo-private-${Date.now()}`;
    const ps = `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.DataObject; $d.SetData('Text', '${secret}'); $d.SetData('ExcludeClipboardContentFromMonitorProcessing', (New-Object System.IO.MemoryStream (,[byte[]](0,0,0,0)))); [System.Windows.Forms.Clipboard]::SetDataObject($d, $true)`;
    const r = await run('powershell.exe', ['-NoProfile', '-STA', '-Command', ps], '', 20_000);
    await wait(2500);
    const onClipboard = (await clipboard.readText()) === secret;
    const leaked = ctx.history.list().some((c) => c.text === secret);
    check('clipboard: copies marked private (ExcludeClipboardContentFromMonitorProcessing) are skipped', onClipboard && !leaked, `on clipboard ${onClipboard}, in history ${leaked} ${r.stderr.slice(0, 120)}`);
    await clipboard.writeText(original);

    // Finished: downloads (in a temporary folder, not the real Downloads).
    {
      const dl = path.join(ctx.tmp, 'Downloads');
      fs.mkdirSync(dl, { recursive: true });
      const found: string[] = [];
      const w = new DownloadWatcher(dl, (f) => found.push(path.basename(f)));
      w.start();
      await wait(300);
      fs.writeFileSync(path.join(dl, 'setup.exe.crdownload'), Buffer.alloc(2048, 1));
      await wait(1200);
      fs.renameSync(path.join(dl, 'setup.exe.crdownload'), path.join(dl, 'setup.exe'));
      fs.writeFileSync(path.join(dl, 'movie.mkv'), '');
      fs.writeFileSync(path.join(dl, 'movie.mkv.part'), Buffer.alloc(4096, 2));
      await wait(1200);
      fs.writeFileSync(path.join(dl, 'movie.mkv'), Buffer.alloc(4096, 2));
      fs.rmSync(path.join(dl, 'movie.mkv.part'));
      fs.writeFileSync(path.join(dl, 'cancelled.iso.crdownload'), 'x');
      await wait(1000);
      fs.rmSync(path.join(dl, 'cancelled.iso.crdownload'));
      await until(() => found.length >= 2, 8000);
      await wait(1500);
      w.stop();
      check('finished: downloads watcher (Chrome rename + Firefox .part, cancel ignored)', found.sort().join(',') === 'movie.mkv,setup.exe', found.join(', ') || 'nothing');
    }
    // Finished: Steam. Read the real libraries (read only), then simulate an update in a temporary library.
    {
      const steamPath = await findSteamPath();
      if (steamPath) {
        const real = new SteamWatcher(() => {});
        const ok = await real.start();
        const manifests = real.libraries.flatMap((l) => {
          try { return fs.readdirSync(path.join(l, 'steamapps')).filter((f) => /^appmanifest_\d+\.acf$/.test(f)).map((f) => path.join(l, 'steamapps', f)); } catch { return []; }
        });
        const parsed = manifests.map((f) => parseAcf(fs.readFileSync(f, 'utf8'))).filter(Boolean);
        real.stop();
        check('finished: real Steam libraries found and every app manifest parses', ok && parsed.length === manifests.length && manifests.length > 0, `${steamPath}; ${real.libraries.length} libraries; ${parsed.length}/${manifests.length} manifests: ${parsed.map((a) => `${a!.name} (${a!.flags})`).join(', ')}`);
      } else {
        check('finished: Steam not installed (skipped)', true, 'not exercised');
      }
      const lib = path.join(ctx.tmp, 'SteamLibrary');
      fs.mkdirSync(path.join(lib, 'steamapps'), { recursive: true });
      const acf = (flags: number) => `"AppState"\n{\n\t"appid"\t\t"480"\n\t"name"\t\t"Sample Game"\n\t"StateFlags"\t\t"${flags}"\n\t"BytesToDownload"\t\t"1000"\n\t"BytesDownloaded"\t\t"${flags === 4 ? 1000 : 10}"\n}\n`;
      const file = path.join(lib, 'steamapps', 'appmanifest_480.acf');
      fs.writeFileSync(file, acf(1026 | 1048576));
      const ready: string[] = [];
      const sim = new SteamWatcher((a) => ready.push(a.name), () => {}, [lib]);
      await sim.start();
      await wait(500);
      fs.writeFileSync(file, acf(4));
      await until(() => ready.length > 0, 6000);
      sim.stop();
      check('finished: Steam watcher announces a finished update', ready.join() === 'Sample Game', ready.join() || 'nothing');
    }
    // Finished: watch an app. A real process that is busy for 6 s and then idle, measured through the helper.
    {
      const child = spawn('powershell.exe', ['-NoProfile', '-Command', '$e=[DateTime]::Now.AddSeconds(6); while([DateTime]::Now -lt $e){ $x=1 }; Start-Sleep 40'], { windowsHide: true });
      const det = new BusyIdleDetector({ busyPct: 30, quietPct: 8, busyForMs: 3000, quietForMs: 6000 });
      let result: string | null = null;
      const phases = new Set<string>();
      const started = Date.now();
      while (!result && Date.now() - started < 40_000) {
        const s = await ctx.treeCpu(child.pid!);
        result = det.push({ t: Date.now(), cpuMs: s.cpuMs, alive: s.alive });
        phases.add(det.phase);
        await wait(1000);
      }
      const idleAfter = Math.round((Date.now() - started) / 1000);
      child.kill();
      await wait(1500);
      const gone = await ctx.treeCpu(child.pid!);
      check('finished: app watch sees busy -> quiet on a real process, and its exit', result === 'idle' && phases.has('busy') && !gone.alive, `result ${result} after ${idleAfter}s, phases ${[...phases].join('>')}, alive after kill ${gone.alive}`);
      const list = String(await ctx.helper.request('windows'));
      check('finished: list of apps with windows', list.split('\n').length > 0 && list.includes('|'), `${list.split('\n').length} apps: ${list.split('\n').map((l) => l.split('|')[1]).join(', ')}`);
    }

    // Settings window: changes go through the settings IPC and are saved; the island may not call it.
    {
      const win = ctx.openSettings();
      await new Promise<void>((resolve) => (win.webContents.isLoading() ? win.webContents.once('did-finish-load', () => resolve()) : resolve()));
      const info = await win.webContents.executeJavaScript(`window.helo.updateSettings({ features: { lyrics: true }, timer: { focusMin: 40 }, display: { edge: 'bottom' } })`);
      const saved = JSON.parse(fs.readFileSync(ctx.settingsFile, 'utf8'));
      const back = await win.webContents.executeJavaScript(`window.helo.updateSettings({ features: { lyrics: false }, timer: { focusMin: 25 }, display: { edge: 'top' } })`);
      let islandRefused = false;
      try {
        await ctx.island.webContents.executeJavaScript(`window.helo.updateSettings({ features: { media: false } })`);
      } catch {
        islandRefused = true;
      }
      win.destroy();
      check('settings: window updates and saves settings; the island page is refused', info.settings.features.lyrics === true && saved.timer.focusMin === 40 && saved.display.edge === 'bottom' && back.settings.display.edge === 'top' && islandRefused && ctx.state.timer.focusMin === 25,
        `saved lyrics ${saved.features.lyrics}, focusMin ${saved.timer.focusMin}, edge ${saved.display.edge}; island refused ${islandRefused}`);
    }

    // Keep awake.
    ctx.setKeepAwake(true);
    const awake = ctx.state.keepAwake;
    const req = await run('powercfg.exe', ['/requests'], '', 10_000);
    ctx.setKeepAwake(false);
    check('keep awake: power save blocker on/off', awake && !ctx.state.keepAwake, `powercfg /requests: ${req.code === 0 ? (req.stdout.match(/DISPLAY:[\s\S]*?(?=SYSTEM:)/)?.[0] || '').replace(/\s+/g, ' ').trim() : `not readable (${req.stdout.trim().slice(0, 80)})`}`);
  } catch (err) {
    check('self-test crashed', false, (err as Error).stack || String(err));
  }
  fs.writeFileSync(ctx.out, JSON.stringify({ at: new Date().toISOString(), checks }, null, 2));
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`[helo] self-test: ${checks.length - failed} passed, ${failed} failed`);
  ctx.quit(failed ? 1 : 0);
}

/** A board for the screenshots, made the way a real one is: from hook events. */
function sampleMap() {
  let t = Date.now() - 9000;
  const map = new WorkMap(MAP_SETUP, () => t);
  const send = (event: string, extra: Record<string, unknown> = {}, ms = 600) => {
    t += ms;
    map.record({ hook_event_name: event, session_id: 'smoke', cwd: 'C:\\code\\shop-api', ...extra });
  };
  const call = (id: string, tool: string, input: Record<string, unknown>, ms = 500, extra: Record<string, unknown> = {}) => {
    send('PreToolUse', { tool_name: tool, tool_use_id: id, tool_input: input, ...extra }, 300);
    send('PostToolUse', { tool_name: tool, tool_use_id: id, tool_response: {}, ...extra }, ms);
  };
  send('UserPromptSubmit', { prompt: 'Add quantities to the cart' });
  map.status({ session_id: 'smoke', model: { id: 'claude-opus-5-5' }, context_window: { used_percentage: 34 } });
  call('1', 'Read', { file_path: 'C:\\code\\shop-api\\src\\cart.ts' });
  call('2', 'Grep', { pattern: 'total(' });
  call('3', 'mcp__memory__search_nodes', { query: 'cart' });
  call('4', 'WebFetch', { url: 'https://docs.example.com/rounding' }, 900);
  send('PreToolUse', { tool_name: 'Agent', tool_use_id: '5', tool_input: { description: 'check the tests', prompt: 'x' } });
  send('SubagentStart', { agent_id: 'sub1', agent_type: 'Explore' }, 50);
  call('6', 'Glob', { pattern: 'test/**' }, 300, { agent_id: 'sub1' });
  call('7', 'Edit', { file_path: 'C:\\code\\shop-api\\src\\cart.ts' });
  send('PreToolUse', { tool_name: 'Bash', tool_use_id: '8', tool_input: { command: 'npm test', description: 'Run the tests' } }, 700);
  t = Date.now();
  return map.view();
}
