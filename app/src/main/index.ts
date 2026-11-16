// Main process: owns the island window, the settings window, the tray, the
// local bridge for agent hooks, the Windows helper and all persisted data.
import {
  app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, nativeImage, globalShortcut, clipboard,
  powerSaveBlocker, ClipboardItem, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { config } from './config';
import * as hooks from './hooks-install';
import { createBridge, type HookInput, type PermissionReply } from './bridge';
import { createLicense, type License } from './license';
import { permissionView, eventBanner, buildAnswers, AGENT_LABEL } from './format';
import { readJson, writeJson, debounced } from './jsonfile';
import { normalizeSettings, updateSettings, DEFAULT_SETTINGS } from './settings';
import { WorkMap, MAP_EVENTS } from './workmap';
import { AgentTracker, parseUsage, parseModel, freshUsage, statusLineText } from './agents';
import * as timerFns from './timer';
import { ClipboardHistory } from './clipboard-history';
import { Shelf, convertedName, CONVERTIBLE } from './shelf';
import { powerFromRaw, batteryBanner, privacyFromRaw, privacyBanner, mediaFromRaw, mediaTrackKey } from './system';
import { fetchLyrics } from './lyrics';
import { fetchCalendar } from './calendar';
import { WinHelper, parseDdcList, parseDdcValues, DDC_INPUTS, type HelperMessage } from './winhelper';
import { readBluetoothBatteries } from './bluetooth';
import { drawMark, toBGRA, WHITE } from './icon';
import { runSmoke, runSelfTest } from './smoke';
import { DownloadWatcher, SteamWatcher, ScreenshotWatcher } from './finished-watch';
import { BusyIdleDetector } from './finished';
import { listStartupApps, setStartupApp } from './startup-apps';
import { faceOnly } from '../shared/face';
import { ChangeTracker, changeText } from './changes';
import { BannerQueue } from './banners';
import { notificationFromRaw, notificationBanner, rememberApp } from './notifications';
import { formatDuration } from '../shared/time';
import { parseWebMessage, trackerEvent, webBanner, pairingCode, WEB_SOURCE, WEB_SILENCE_MS } from './webchat';
import type {
  AgentName, Banner, Behavior, ConnectionState, ConvertFormat, FinishedItem, IslandState, PermissionView, Settings, SettingsInfo,
  StartupApp, WatchCondition, WatchTarget,
} from '../shared/types';
import { AGENT_NAMES } from '../shared/types';

// ---------------------------------------------------------------------------
// Modes and paths

const argValue = (name: string) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};
const smokeDir = argValue('smoke');
const selfTestOut = argValue('selftest');
const testMode = Boolean(smokeDir || selfTestOut);

// The island is a small transparent always-on-top window; Chromium's occlusion
// tracking can wrongly treat it as hidden and stop painting it.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// Test modes never touch the real user data or the real agent config files.
const testRoot = testMode ? fs.mkdtempSync(path.join(os.tmpdir(), 'helo-test-run-')) : null;
if (testRoot) app.setPath('userData', path.join(testRoot, 'userData'));
// Development aid: run against a separate data folder.
else if (process.env.HELO_USER_DATA && !app.isPackaged) app.setPath('userData', process.env.HELO_USER_DATA);
if (!testMode && !app.requestSingleInstanceLock()) app.quit();

const CLAUDE_SETTINGS = testRoot ? path.join(testRoot, 'claude', 'settings.json') : path.join(os.homedir(), '.claude', 'settings.json');
const CODEX_DIR = testRoot ? path.join(testRoot, 'codex') : path.join(os.homedir(), '.codex');
const CODEX_HOOKS = path.join(CODEX_DIR, 'hooks.json');
const GEMINI_DIR = testRoot ? path.join(testRoot, 'gemini') : path.join(os.homedir(), '.gemini');
const GEMINI_SETTINGS = path.join(GEMINI_DIR, 'settings.json');
const CURSOR_DIR = testRoot ? path.join(testRoot, 'cursor') : path.join(os.homedir(), '.cursor');
const CURSOR_HOOKS = path.join(CURSOR_DIR, 'hooks.json');

// The window is only as big as it needs to be: transparent windows on Windows
// repaint all of their pixels on every animation frame.
// Full fits the widest panel (the work map, 820) with the face beside it.
const SIZES = { full: { width: 940, height: 520 }, compact: { width: 600, height: 84 } } as const;
/** Height of the idle island. */
const PILL = 34;
/** Dragged this close to the top or bottom of the screen, the island attaches to it. */
const SNAP = 10;
type IslandSize = keyof typeof SIZES;
let islandSize: IslandSize = 'compact';
let shrinkTimer: NodeJS.Timeout | null = null;

const userFile = (name: string) => path.join(app.getPath('userData'), name);
const helperScript = () => (app.isPackaged
  ? path.join(process.resourcesPath, 'winhelper.ps1')
  : path.join(app.getAppPath(), 'resources', 'winhelper.ps1'));

const log = (msg: string) => {
  if (!app.isPackaged || testMode) console.log(`[helo] ${msg}`);
};

// ---------------------------------------------------------------------------
// State

let island: BrowserWindow | null = null;
let islandReady = false;
let settingsWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let license: License;
let settings: Settings = DEFAULT_SETTINGS;
let bridgeInfo: { port: number; token: string; webToken: string };
/** The port the bridge really listens on (differs from the saved one only in test modes). */
let livePort = 0;
let bridgeError: Error | null = null;
let helper: WinHelper | null = null;
let history: ClipboardHistory | null = null;
let shelf: Shelf;
let keepAwakeId: number | null = null;
let hudTimer: NodeJS.Timeout | null = null;
let shortcutsOn = false;
let panelOpen = false;
const tracker = new AgentTracker();
const workMap = new WorkMap();
const pending = new Map<string, { view: PermissionView; resolve: (b: Behavior | PermissionReply | null) => void; sessionId: unknown; toolInput: Record<string, unknown> }>();
const shelfIcons = new Map<string, string | null>();
const artByKey = new Map<string, string | null>();
let lastMediaKey = '';
let lyricsAbort: AbortController | null = null;
const remindedEvents = new Set<string>();

const state: IslandState = {
  ready: false,
  settings: DEFAULT_SETTINGS,
  license: { state: 'trial', daysLeft: config.trialDays },
  requests: [],
  banner: null,
  agents: {
    sessions: [],
    mood: 'idle',
    usage: null,
    model: null,
    claude: { connected: false, note: '' },
    codex: { connected: false, note: '' },
    gemini: { connected: false, note: '' },
    cursor: { connected: false, note: '' },
  },
  map: null,
  media: null,
  lyrics: null,
  timer: timerFns.initialTimer(),
  clipboard: [],
  notes: '',
  shelf: [],
  keepAwake: false,
  privacy: { microphone: [], camera: [] },
  power: null,
  volume: null,
  hud: null,
  displays: [],
  bluetooth: [],
  calendar: { events: [], error: '', fetchedAt: 0 },
  finished: { watch: null, recent: [], doneAt: 0, steamFound: false },
  helper: 'off',
  faceOnly: false,
  place: { edge: 'top', floating: false },
};

/** Merges a patch into the state and sends it to the island. */
function push(patch: Partial<IslandState>) {
  Object.assign(state, patch);
  if (island && !island.isDestroyed() && islandReady) island.webContents.send('state', patch);
}

// ---------------------------------------------------------------------------
// Banners and agent requests

// A short banner covers a "needs your answer" banner; the waiting one comes back afterwards.
const banners = new BannerQueue((banner) => push({ banner }));

/**
 * Shows a banner for `ms`. 0 = it waits until it is clicked or answered, and `key` says whose
 * it is (a session id). `action` runs if the user clicks it.
 */
function showBanner(next: Banner | null, ms = 6000, action: (() => void) | null = null, key = '') {
  banners.show(next, { ms, action, key });
}

/** The session id of a hook event, as the key of its waiting banner. */
function waitKey(sessionId: unknown): string {
  return typeof sessionId === 'string' ? sessionId : '';
}

function pushRequests() {
  push({ requests: [...pending.values()].map((p) => p.view) });
  applyFullscreen();
  syncShortcuts();
}

function pushAgents() {
  push({
    agents: {
      ...state.agents,
      sessions: tracker.list().map((s) => {
        const c = s.agent === 'claude' ? changes.get(s.key.slice('claude:'.length)) : null;
        return c ? { ...s, added: c.added, removed: c.removed } : s;
      }),
      mood: tracker.mood(),
      usage: freshUsage(state.agents.usage),
    },
  });
}

/** `picks`: the labels chosen on a question card, one list per question. */
function settle(id: string, behavior: Behavior | null, picks?: unknown) {
  const entry = pending.get(id);
  if (!entry) return;
  let reply: Behavior | PermissionReply | null = behavior;
  if (entry.view.kind === 'question' && behavior) {
    // A question is answered with picks, or left for the terminal; it is never just allowed or denied.
    const answers = behavior === 'allow' ? buildAnswers(entry.view.questions ?? [], picks) : null;
    if (!answers) return;
    reply = { behavior: 'allow', updatedInput: { ...entry.toolInput, answers } };
  } else if (entry.view.kind === 'plan' && behavior) {
    reply = behavior === 'deny'
      ? { behavior: 'deny', message: `The user rejected this plan from ${config.appName}. Ask what they would like changed before planning again.` }
      : { behavior: 'allow', updatedInput: entry.toolInput };
  }
  pending.delete(id);
  entry.resolve(reply);
  if (behavior) tracker.record({ hook_event_name: behavior === 'deny' ? 'Stop' : 'PermissionResolved', session_id: entry.sessionId }, entry.view.agent);
  if (behavior === 'deny' && entry.view.agent === 'claude' && workMap.refuse(entry.sessionId, entry.view.tool)) pushMap();
  pushRequests();
  pushAgents();
}

function pushMap() {
  push({ map: workMap.view() });
}

// Alt+Shift+Y / Alt+Shift+N answer the request on screen. They are only registered while a
// request is waiting. Not Ctrl+Alt: on keyboards with an AltGr key (Slovenian, Croatian, German
// and many more) AltGr is Ctrl+Alt, so typing a bracket would answer the card.
const ALLOW_KEY = 'Alt+Shift+Y';
const DENY_KEY = 'Alt+Shift+N';
function syncShortcuts() {
  const want = pending.size > 0;
  if (want === shortcutsOn) return;
  shortcutsOn = want;
  if (!want) {
    globalShortcut.unregister(ALLOW_KEY);
    globalShortcut.unregister(DENY_KEY);
    return;
  }
  const answer = (behavior: Behavior) => () => {
    const first = pending.keys().next().value;
    if (!first) return;
    // Part of the command is not on the card, so it cannot be allowed without looking: click, or use the terminal.
    if (behavior === 'allow' && pending.get(first)?.view.summaryCut) return;
    settle(first, behavior);
  };
  globalShortcut.register(ALLOW_KEY, answer('allow'));
  globalShortcut.register(DENY_KEY, answer('deny'));
}

const changes = new ChangeTracker((file) => readForDiff(file));

/** The current text of a file an agent wants to overwrite (small text files only), for the diff card. */
function readForDiff(file: string): string | null {
  try {
    if (!path.isAbsolute(file) || fs.statSync(file).size > 300_000) return null;
    const text = fs.readFileSync(file, 'utf8');
    return text.includes('\0') ? null : text;
  } catch {
    return null;
  }
}

function onPermission(input: HookInput, signal: AbortSignal, agent: AgentName): Promise<Behavior | PermissionReply | null> {
  if (!settings.features.agents) return Promise.resolve(null);
  if (license.status().state === 'expired') {
    showBanner({ kind: 'warn', title: `${config.appName} trial ended`, text: 'Enter a license key in Settings.' });
    return Promise.resolve(null);
  }
  tracker.record(input, agent);
  pushAgents();
  // It is asking for a tool, so it is no longer waiting for an answer in the terminal.
  banners.answered(waitKey(input.session_id));
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const toolInput = input.tool_input && typeof input.tool_input === 'object' ? (input.tool_input as Record<string, unknown>) : {};
    pending.set(id, { view: permissionView(id, input, agent, Date.now(), readForDiff), resolve, sessionId: input.session_id, toolInput });
    signal.addEventListener('abort', () => settle(id, null), { once: true });
    pushRequests();
  });
}

function onEvent(input: HookInput, agent: AgentName) {
  if (agent === 'claude' && settings.features.map && workMap.record(input)) pushMap();
  if (agent === 'claude' && changes.record(input)) pushAgents();
  // The work map's own events mean nothing to the cards, banners and the face.
  if ((MAP_EVENTS as readonly string[]).includes(String(input.hook_event_name))) return;
  if (!settings.features.agents) return;
  // How long this session had been working, read before the event changes its state.
  const before = tracker.list().find((s) => s.key === `${agent}:${typeof input.session_id === 'string' && input.session_id ? input.session_id : 'default'}`);
  const workedMs = before?.mood === 'working' ? Date.now() - before.since : 0;
  if (tracker.record(input, agent)) pushAgents();
  // Claude Code also sends a notification for each permission prompt; the card already covers it.
  if (input.hook_event_name === 'Notification' && input.notification_type === 'permission_prompt') {
    for (const entry of pending.values()) if (entry.sessionId === input.session_id) return;
  }
  const banner = eventBanner(input, agent);
  // The user answered in the terminal, or the session finished or failed: its "waiting for you"
  // banner has done its job. (A plain notification says nothing about that, so it stays.)
  if (banner?.kind !== 'input' && input.hook_event_name !== 'Notification') banners.answered(waitKey(input.session_id));
  if (banner && input.hook_event_name === 'Stop' && workedMs >= 5000) banner.title += ` · ${formatDuration(workedMs)}`;
  if (banner && input.hook_event_name === 'Stop' && agent === 'claude') {
    const lines = changeText(changes.get(input.session_id));
    if (lines) banner.title += ` · ${lines}`;
  }
  if (banner?.kind === 'input') {
    // Stays on screen until the user clicks it (or answers in the terminal).
    showBanner(banner, 0, () => {}, waitKey(input.session_id));
    return;
  }
  showBanner(banner);
}

// Browser chats (claude.ai, chatgpt.com) reported by the extension.
const webSilence = new Map<string, NodeJS.Timeout>();

function onWeb(body: Record<string, unknown>) {
  if (!settings.features.agents) return;
  const msg = parseWebMessage(body);
  if (!msg) return;
  const source = WEB_SOURCE[msg.site];
  const key = `${source}:${msg.id}`;
  const quiet = webSilence.get(key);
  if (quiet) clearTimeout(quiet);
  webSilence.delete(key);
  if (msg.state === 'working') {
    // The page repeats "working" while it lasts. If it goes silent (tab crashed,
    // browser closed), stop showing it as busy.
    webSilence.set(key, setTimeout(() => {
      webSilence.delete(key);
      if (tracker.record(trackerEvent({ ...msg, state: 'gone' }), source)) pushAgents();
    }, WEB_SILENCE_MS));
  }
  if (tracker.record(trackerEvent(msg), source)) pushAgents();
  showBanner(webBanner(msg));
}

function onStatus(input: HookInput): string {
  const usage = parseUsage(input);
  const model = parseModel(input);
  const modelChanged = Boolean(model) && model !== state.agents.model;
  if (modelChanged) state.agents.model = model;
  if (usage && settings.features.usage) state.agents.usage = usage;
  if (modelChanged || (usage && settings.features.usage)) pushAgents();
  if (settings.features.map && workMap.status(input)) pushMap();
  return statusLineText(input, usage);
}

// ---------------------------------------------------------------------------
// Agent connections

function connectionStates(): Record<AgentName, ConnectionState> {
  if (bridgeError) {
    const note = `Port ${bridgeInfo.port} is busy. Quit the other app that uses it and restart ${config.appName}.`;
    const off = { connected: false, note };
    return { claude: off, codex: off, gemini: off, cursor: off };
  }
  const c = hooks.inspect(CLAUDE_SETTINGS, bridgeInfo);
  let claudeNote = c.error ? `Could not read ~/.claude/settings.json: ${c.error}` : '';
  if (!claudeNote && c.installed && settings.features.usage) {
    if (c.statusLine === 'other') claudeNote = 'Usage rings need the status line, but you already have your own, so it was left alone.';
    else if (c.statusLine === 'none') claudeNote = 'Reconnect to add the status line used by the usage rings.';
  }
  const codexInstalled = hooks.isCodexInstalled(CODEX_HOOKS, bridgeInfo);
  let codexNote = '';
  if (codexInstalled) codexNote = 'In Codex, run /hooks once and trust the Helo hooks, or they will not run.';
  else if (!fs.existsSync(CODEX_DIR)) codexNote = 'Codex CLI does not seem to be installed (no ~/.codex folder).';
  const geminiInstalled = hooks.isGeminiInstalled(GEMINI_SETTINGS, bridgeInfo);
  const geminiNote = !geminiInstalled && !fs.existsSync(GEMINI_DIR) ? 'Gemini CLI does not seem to be installed (no ~/.gemini folder).' : '';
  const cursorInstalled = hooks.isCursorInstalled(CURSOR_HOOKS, bridgeInfo);
  const cursorNote = !cursorInstalled && !fs.existsSync(CURSOR_DIR) ? 'Cursor does not seem to be installed (no ~/.cursor folder).' : '';
  return {
    claude: { connected: c.installed, note: claudeNote },
    codex: { connected: codexInstalled, note: codexNote },
    gemini: { connected: geminiInstalled, note: geminiNote },
    cursor: { connected: cursorInstalled, note: cursorNote },
  };
}

function refreshConnections() {
  const conn = connectionStates();
  Object.assign(state.agents, conn);
  pushAgents();
  refreshTray();
}

function connectAgent(agent: AgentName, on: boolean) {
  if (bridgeError) throw bridgeError;
  if (agent === 'claude') {
    if (on) hooks.install(CLAUDE_SETTINGS, { ...bridgeInfo, statusLine: settings.features.usage, map: settings.features.map });
    else hooks.uninstall(CLAUDE_SETTINGS);
  } else if (agent === 'codex') {
    if (on) hooks.installCodex(CODEX_HOOKS, bridgeInfo);
    else hooks.uninstallCodex(CODEX_HOOKS);
  } else if (agent === 'gemini') {
    if (on) hooks.installGemini(GEMINI_SETTINGS, bridgeInfo);
    else hooks.uninstallGemini(GEMINI_SETTINGS);
  } else if (on) hooks.installCursor(CURSOR_HOOKS, bridgeInfo);
  else hooks.uninstallCursor(CURSOR_HOOKS);
  const connectedText: Record<AgentName, string> = {
    claude: 'New sessions will ask here.',
    codex: 'Run /hooks in Codex to trust the hooks.',
    gemini: 'New sessions will show up here.',
    cursor: 'New chats will show up here.',
  };
  showBanner(on
    ? { kind: 'done', title: `${AGENT_LABEL[agent]} connected`, text: connectedText[agent] }
    : { kind: 'info', title: `${AGENT_LABEL[agent]} disconnected`, text: `${config.appName} hooks were removed.` });
  refreshConnections();
}

// ---------------------------------------------------------------------------
// Settings

function loadSettings() {
  settings = normalizeSettings(readJson<unknown>(userFile('settings.json'), {}));
}

function applySettings(prev: Settings | null) {
  push({ settings });
  applyFaceOnly();
  if (!settings.display.hideInFullscreen) fullscreenAhead = false;
  applyFullscreen();
  placeIsland();
  history?.setMax(settings.clipboard.maxItems);
  if (!prev || prev.timer.focusMin !== settings.timer.focusMin || prev.timer.breakMin !== settings.timer.breakMin) {
    push({ timer: timerFns.configure(state.timer, settings.timer.focusMin, settings.timer.breakMin) });
  }
  if (!settings.features.keepAwake && keepAwakeId != null) setKeepAwake(false);
  if (!settings.features.lyrics) push({ lyrics: null });
  else if (prev && !prev.features.lyrics) maybeFetchLyrics(true);
  if (!prev || prev.calendar.icsUrl !== settings.calendar.icsUrl || prev.features.calendar !== settings.features.calendar) refreshCalendar().catch(() => {});
  // Turning the usage rings on/off adds/removes the status line if Claude Code is connected.
  // The same for the work map and its tool events. This also runs at startup, so a connection
  // made by an older version gets the map's events without the user connecting again.
  const claude = hooks.inspect(CLAUDE_SETTINGS, bridgeInfo);
  if (claude.installed && ((prev && prev.features.usage !== settings.features.usage) || claude.map !== settings.features.map)) {
    try {
      hooks.install(CLAUDE_SETTINGS, { ...bridgeInfo, statusLine: settings.features.usage, map: settings.features.map });
    } catch (err) {
      log(`hooks update failed: ${(err as Error).message}`);
    }
  }
  if (!settings.features.map && state.map) {
    workMap.clear();
    push({ map: null });
  }
  if (!settings.features.usage) state.agents.usage = null;
  syncHelperFeatures();
  syncFinishedWatchers();
  refreshConnections();
  if (!prev || prev.features.battery !== settings.features.battery) void refreshBluetooth();
}

function syncHelperFeatures() {
  const f = settings.features;
  const wantHelper = f.media || f.hud || f.privacy || f.battery || f.clipboard || f.displays || f.notifications;
  if (!helper) return;
  helper.setFeatures({ media: f.media, volume: f.hud, privacy: f.privacy, power: f.battery, clipboard: f.clipboard, brightness: f.hud, notifications: f.notifications });
  if (wantHelper && helper.status === 'off') helper.start();
  if (!wantHelper && helper.status !== 'off') helper.stop();
  if (!f.media) push({ media: null, lyrics: null });
  if (!f.privacy) push({ privacy: { microphone: [], camera: [] } });
}

function settingsInfo(): SettingsInfo {
  return {
    settings,
    displays: screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      label: `${d.label || `Display ${i + 1}`} (${d.size.width}×${d.size.height})`,
      primary: d.id === screen.getPrimaryDisplay().id,
    })),
    startWithWindows: app.isPackaged ? app.getLoginItemSettings().openAtLogin : false,
    canStartWithWindows: app.isPackaged,
    license: license.status(),
    price: config.price,
    appName: config.appName,
    version: app.getVersion(),
    agents: connectionStates(),
    webPairingCode: pairingCode(livePort || bridgeInfo.port, bridgeInfo.webToken),
  };
}

// ---------------------------------------------------------------------------
// Island window

function targetDisplay() {
  const m = settings.display.monitor;
  if (typeof m === 'number') {
    const found = screen.getAllDisplays().find((d) => d.id === m);
    if (found) return found;
  }
  return screen.getPrimaryDisplay();
}

/** While the island is being dragged: where it is (as settings.display.position) and which way it opened when the drag began. */
let dragSpot: { x: number; y: number; top: boolean } | null = null;
let dragTimer: NodeJS.Timeout | null = null;

/**
 * Where the pill is on the screen: its middle (x) and its top (y), which way the island opens from there, and
 * whether it is away from the top and bottom of the screen. It always stays where the whole panel fits.
 */
function islandSpot() {
  const d = targetDisplay();
  const lowest = d.workArea.y + d.workArea.height - PILL;
  const pos = dragSpot ?? settings.display.position;
  if (!pos) {
    const top = settings.display.edge === 'top';
    return { x: d.bounds.x + d.bounds.width / 2, y: top ? d.bounds.y : lowest, top, floating: false };
  }
  const half = Math.min(SIZES.full.width, d.bounds.width) / 2;
  const x = Math.min(Math.max(d.bounds.x + pos.x, d.bounds.x + half), d.bounds.x + d.bounds.width - half);
  let y = Math.min(Math.max(d.bounds.y + pos.y, d.bounds.y), lowest);
  if (y - d.bounds.y <= SNAP) y = d.bounds.y;
  else if (lowest - y <= SNAP) y = lowest;
  // In the upper half of the screen the panel opens downwards, in the lower half upwards. Not while dragging: the panel would jump.
  const top = dragSpot ? dragSpot.top : y + PILL / 2 < d.bounds.y + d.bounds.height / 2;
  return { x, y, top, floating: y !== d.bounds.y && y !== lowest };
}

function placeIsland() {
  if (!island || island.isDestroyed()) return;
  const spot = islandSpot();
  const { width, height } = SIZES[smokeDir ? 'full' : islandSize];
  island.setBounds({
    x: Math.round(spot.x - width / 2),
    y: Math.round(spot.top ? spot.y : spot.y + PILL - height),
    width,
    height,
  });
  const edge = spot.top ? 'top' : 'bottom';
  // Screenshots set the place themselves.
  if (!smokeDir && (state.place.edge !== edge || state.place.floating !== spot.floating)) push({ place: { edge, floating: spot.floating } });
}

function saveDisplay(patch: Partial<Settings['display']>) {
  settings = updateSettings(settings, { display: patch });
  writeJson(userFile('settings.json'), settings);
  push({ settings });
}

/** The island follows the pointer until the page says the button is up. */
function startDrag() {
  if (!island || island.isDestroyed() || dragTimer || settings.display.locked || smokeDir) return;
  const d = targetDisplay().bounds;
  const from = islandSpot();
  const start = screen.getCursorScreenPoint();
  dragTimer = setInterval(() => {
    const p = screen.getCursorScreenPoint();
    dragSpot = { x: from.x - d.x + p.x - start.x, y: from.y - d.y + p.y - start.y, top: from.top };
    placeIsland();
  }, 16);
}

function endDrag() {
  if (!dragTimer) return;
  clearInterval(dragTimer);
  dragTimer = null;
  if (dragSpot) {
    // Saved as it was clamped and snapped, so the island does not move again later.
    const d = targetDisplay().bounds;
    const spot = islandSpot();
    dragSpot = null;
    saveDisplay({ position: { x: Math.round(spot.x - d.x), y: Math.round(spot.y - d.y) } });
  }
  placeIsland();
}

/** Grows the window at once; shrinks it after the collapse animation has played. */
function setIslandSize(size: IslandSize) {
  if (shrinkTimer) clearTimeout(shrinkTimer);
  shrinkTimer = null;
  if (size === 'full') {
    if (islandSize !== 'full') {
      islandSize = 'full';
      placeIsland();
    }
    return;
  }
  shrinkTimer = setTimeout(() => {
    shrinkTimer = null;
    if (islandSize === 'compact') return;
    islandSize = 'compact';
    placeIsland();
  }, 480);
}

function pageUrl(page: 'island' | 'settings', win: BrowserWindow) {
  const dev = process.env.ELECTRON_RENDERER_URL;
  if (dev && !app.isPackaged) return win.loadURL(`${dev}/${page}.html`);
  return win.loadFile(path.join(__dirname, '../renderer', `${page}.html`));
}

function lockDown(contents: WebContents) {
  if (testMode || !app.isPackaged) {
    contents.on('console-message', (e) => log(`renderer ${e.level}: ${e.message} (${e.sourceId}:${e.lineNumber})`));
    contents.on('did-fail-load', (_e, code, desc, url) => log(`load failed ${code} ${desc} ${url}`));
    contents.on('preload-error', (_e, p, err) => log(`preload error ${p}: ${err.message}`));
  }
  contents.on('will-navigate', (e) => e.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.session.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
}

const preloadPath = () => path.join(__dirname, '../preload/index.js');

function createIsland() {
  island = new BrowserWindow({
    ...SIZES[smokeDir ? 'full' : 'compact'],
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false, // never steals focus from the terminal; see setPanelOpen
    hasShadow: false,
    thickFrame: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  island.setAlwaysOnTop(true, 'screen-saver');
  island.setIgnoreMouseEvents(true, { forward: true });
  lockDown(island.webContents);
  placeIsland();
  pageUrl('island', island);
  island.webContents.on('render-process-gone', () => {
    islandReady = false;
    island?.webContents.reload();
  });
  setInterval(checkPointerLeft, 150);
  island.on('blur', () => {
    // Clicking another app while typing in the panel closes it.
    if (panelOpen && !testMode) island?.webContents.send('island:collapse');
  });
  screen.on('display-metrics-changed', placeIsland);
  screen.on('display-added', placeIsland);
  screen.on('display-removed', placeIsland);
}

/**
 * The island is created non-focusable so cards and banners never take focus
 * from the terminal. While the user has the panel open (they hovered it), it
 * becomes focusable so notes and other inputs can be typed into; when the
 * panel closes it becomes non-focusable again and gives focus back.
 */
let hoverOn = false;
let outsideSince = 0;

/**
 * Safety net for fast pointer moves: if the pointer jumps out of the window,
 * the page may never see a mouseleave. While hovered or open (and not being
 * typed in), leaving the window for 300 ms restores click-through and closes
 * the panel.
 */
function checkPointerLeft() {
  if (!island || island.isDestroyed() || smokeDir || dragTimer || (!hoverOn && !panelOpen) || island.isFocused()) {
    outsideSince = 0;
    return;
  }
  const p = screen.getCursorScreenPoint();
  const b = island.getBounds();
  if (p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height) {
    outsideSince = 0;
    return;
  }
  if (!outsideSince) {
    outsideSince = Date.now();
    return;
  }
  if (Date.now() - outsideSince < 300) return;
  outsideSince = 0;
  hoverOn = false;
  island.setIgnoreMouseEvents(true, { forward: true });
  island.webContents.send('island:collapse');
}

let previousForeground = 0;

async function setPanelOpen(open: boolean) {
  if (!island || island.isDestroyed() || open === panelOpen) return;
  panelOpen = open;
  if (open) {
    island.setFocusable(true);
    // Remember where the user was, to give focus back there when the panel closes.
    if (helper?.status === 'running') {
      helper.request<number>('foreground-window').then((h) => { if (!island?.isFocused()) previousForeground = Number(h) || 0; }).catch(() => {});
    }
  } else {
    const hadFocus = island.isFocused();
    if (hadFocus && previousForeground && helper?.status === 'running') {
      await helper.request('activate', { handle: previousForeground }, 2000).catch(() => false);
    }
    island.setFocusable(false);
    if (island.isFocused()) island.blur();
  }
  island.setAlwaysOnTop(true, 'screen-saver');
  island.setSkipTaskbar(true);
}

// ---------------------------------------------------------------------------
// Settings window and tray

function openSettings(section?: string) {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    if (section) settingsWin.webContents.send('settings:section', section);
    return settingsWin;
  }
  settingsWin = new BrowserWindow({
    width: 760,
    height: 620,
    minWidth: 640,
    minHeight: 480,
    title: `${config.appName} Settings`,
    backgroundColor: '#0b0b0c',
    autoHideMenuBar: true,
    show: !testMode,
    icon: nativeImage.createFromBitmap(toBGRA(drawMark(64, { tile: true, pill: [94, 240, 196, 255] })), { width: 64, height: 64 }),
    webPreferences: { preload: preloadPath(), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  settingsWin.setMenu(null);
  lockDown(settingsWin.webContents);
  pageUrl('settings', settingsWin);
  if (section) settingsWin.webContents.once('did-finish-load', () => settingsWin?.webContents.send('settings:section', section));
  settingsWin.on('closed', () => { settingsWin = null; });
  return settingsWin;
}

function trayIcon() {
  const size = 32;
  return nativeImage.createFromBitmap(toBGRA(drawMark(size, { tile: false, pill: WHITE })), { width: size, height: size });
}

function licenseLabel() {
  const s = license.status();
  if (s.state === 'licensed') return 'Licensed';
  if (s.state === 'trial') return `Trial: ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left`;
  return 'Trial ended';
}

function refreshTray() {
  if (!tray) return;
  const claude = state.agents.claude.connected;
  const items: Electron.MenuItemConstructorOptions[] = [
    { label: `${config.appName} ${app.getVersion()}`, enabled: false },
    { label: licenseLabel(), enabled: false },
    { type: 'separator' },
    { label: 'Settings…', click: () => openSettings() },
    claude
      ? { label: 'Disconnect Claude Code', click: () => safeConnect('claude', false) }
      : { label: 'Connect Claude Code', enabled: !bridgeError, click: () => safeConnect('claude', true) },
    { label: 'Enter license key…', click: () => openSettings('license') },
    { label: `Buy ${config.appName} (${config.price})`, click: () => shell.openExternal(config.store.buyUrl) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ];
  tray.setToolTip(`${config.appName}: ${claude ? 'connected to Claude Code' : 'not connected'}`);
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function safeConnect(agent: AgentName, on: boolean) {
  try {
    connectAgent(agent, on);
  } catch (err) {
    showBanner({ kind: 'warn', title: 'Could not change the connection', text: (err as Error).message });
  }
}

// ---------------------------------------------------------------------------
// Windows helper events

/** How long the last track stays visible after playback ends. */
const MEDIA_LINGER_MS = 10 * 60_000;
let mediaGoneTimer: NodeJS.Timeout | null = null;

function onHelperMessage(msg: HelperMessage) {
  switch (msg.type) {
    case 'media': {
      if (!settings.features.media) return;
      const media = mediaFromRaw(msg.session, null);
      const key = media ? `${media.app}|${media.title}|${media.artist}|${media.album}` : '';
      if (mediaGoneTimer) clearTimeout(mediaGoneTimer);
      mediaGoneTimer = null;
      if (!media && state.media?.title) {
        // The song or video ended and its app let go of it. Keep showing what was
        // playing for a while (greyed, no controls) instead of blanking at once.
        push({ media: { ...state.media, status: 'Stopped', canPlay: false, canPause: false, canNext: false, canPrevious: false, canSeek: false, positionMs: state.media.endMs, updatedAt: Date.now() } });
        mediaGoneTimer = setTimeout(() => {
          mediaGoneTimer = null;
          push({ media: null });
        }, MEDIA_LINGER_MS);
        break;
      }
      push({ media: media ? { ...media, art: artByKey.get(key) ?? state.media?.art ?? null } : null });
      maybeFetchLyrics(false);
      break;
    }
    case 'art': {
      const key = typeof msg.key === 'string' ? msg.key : '';
      const art = typeof msg.art === 'string' && /^data:image\/(png|jpeg|jpg|gif|bmp|webp);base64,/.test(msg.art) ? msg.art : null;
      artByKey.clear();
      artByKey.set(key, art);
      if (state.media) push({ media: { ...state.media, art } });
      break;
    }
    case 'volume': {
      const level = typeof msg.level === 'number' ? msg.level : null;
      const muted = msg.muted === true;
      const first = state.volume === null;
      push({ volume: { level, muted } });
      if (!first && level !== null && settings.features.hud) showHud('volume', level, muted);
      break;
    }
    case 'brightness': {
      if (typeof msg.level === 'number' && settings.features.hud) showHud('brightness', msg.level, false);
      break;
    }
    case 'privacy': {
      const next = privacyFromRaw(msg as { microphone?: unknown; camera?: unknown }, ['electron', 'helo']);
      const banner = privacyBanner(state.privacy, next);
      push({ privacy: next });
      if (banner && settings.features.privacy) showBanner(banner, 5000);
      break;
    }
    case 'notification': {
      if (!settings.features.notifications || license.status().state === 'expired') break;
      const n = notificationFromRaw(msg);
      if (!n) break;
      const apps = rememberApp(settings.notifications.apps, n.app);
      if (apps !== settings.notifications.apps) {
        settings = updateSettings(settings, { notifications: { apps } });
        writeJson(userFile('settings.json'), settings);
        push({ settings });
      }
      // A card or a "needs your answer" banner is more urgent than another app's message.
      if (pending.size > 0 || banners.hasWaiting()) break;
      showBanner(notificationBanner(n, settings.notifications.apps, [config.appName, 'Electron']), 6000);
      break;
    }
    case 'notifications-access': {
      if (msg.status === 'Denied' && settings.features.notifications) {
        showBanner({ kind: 'warn', title: 'Notifications are blocked', text: 'Allow them in Windows Settings, Privacy, Notifications.' }, 8000);
      }
      break;
    }
    case 'power': {
      const next = powerFromRaw(msg as { ac?: unknown; flag?: unknown; percent?: unknown });
      const banner = batteryBanner(state.power, next, settings.battery.lowPercent);
      push({ power: next });
      if (banner && settings.features.battery) showBanner(banner, 7000);
      break;
    }
    case 'clipboard':
      if (settings.features.clipboard && msg.excluded !== true) void captureClipboard();
      break;
    default:
      break;
  }
}

function showHud(kind: 'volume' | 'brightness', level: number, muted: boolean) {
  if (hudTimer) clearTimeout(hudTimer);
  push({ hud: { kind, level, muted, at: Date.now() } });
  hudTimer = setTimeout(() => push({ hud: null }), 1600);
}

// ---------------------------------------------------------------------------
// Clipboard history

let lastClipText = '';
let capturing = false;

async function captureClipboard() {
  if (!history || capturing || license.status().state === 'expired') return;
  capturing = true;
  try {
    const text = await clipboard.readText();
    if (text) {
      lastClipText = text;
      if (history.addText(text)) push({ clipboard: history.list() });
      return;
    }
    if (!settings.clipboard.images) return;
    const items = await clipboard.read();
    const item = items.find((i) => i.types.includes('image/png'));
    if (!item) return;
    const blob = await item.getType('image/png');
    if (!(blob instanceof Blob) || blob.size > 30 * 1024 * 1024) return;
    const png = Buffer.from(await blob.arrayBuffer());
    const img = nativeImage.createFromBuffer(png);
    if (img.isEmpty()) return;
    const { width, height } = img.getSize();
    const thumb = img.resize(width >= height ? { width: Math.min(width, 160) } : { height: Math.min(height, 120) }).toDataURL();
    if (history.addImage(png, thumb, `Image ${width}×${height}`)) push({ clipboard: history.list() });
  } catch (err) {
    log(`clipboard read failed: ${(err as Error).message}`);
  } finally {
    capturing = false;
  }
}

/** Without the helper there is no change signal; poll text only. */
async function pollClipboardFallback() {
  if (!settings.features.clipboard || helper?.status === 'running') return;
  const text = await clipboard.readText().catch(() => '');
  if (text && text !== lastClipText) captureClipboard();
}

// ---------------------------------------------------------------------------
// Lyrics and calendar

function maybeFetchLyrics(force: boolean) {
  const media = state.media;
  if (!settings.features.lyrics || !media) return;
  const key = mediaTrackKey(media);
  if (!force && key === lastMediaKey) return;
  lastMediaKey = key;
  lyricsAbort?.abort();
  if (!media.title) {
    push({ lyrics: null });
    return;
  }
  const ac = new AbortController();
  lyricsAbort = ac;
  push({ lyrics: { trackKey: key, status: 'loading', lines: [], plain: '' } });
  fetchLyrics(
    { title: media.title, artist: media.artist, album: media.album, durationMs: media.endMs - media.startMs },
    key,
    { userAgent: `${config.appName}/${app.getVersion()}`, signal: ac.signal },
  )
    .then((lyrics) => { if (!ac.signal.aborted) push({ lyrics }); })
    .catch(() => { if (!ac.signal.aborted) push({ lyrics: { trackKey: key, status: 'error', lines: [], plain: '' } }); });
}

async function refreshCalendar(): Promise<void> {
  const url = settings.calendar.icsUrl;
  if (!settings.features.calendar || !url) {
    push({ calendar: { events: [], error: '', fetchedAt: 0 } });
    return;
  }
  try {
    const events = await fetchCalendar(url, Date.now());
    push({ calendar: { events, error: '', fetchedAt: Date.now() } });
  } catch (err) {
    const msg = (err as Error).name === 'AbortError' ? 'The calendar server did not answer.' : (err as Error).message;
    push({ calendar: { ...state.calendar, error: msg.slice(0, 200), fetchedAt: Date.now() } });
    throw err;
  }
}

function calendarReminders(now: number) {
  if (!settings.features.calendar) return;
  for (const e of state.calendar.events) {
    if (e.allDay) continue;
    const id = `${e.title}@${e.start}`;
    if (e.start - now <= 5 * 60_000 && e.start > now - 60_000 && !remindedEvents.has(id)) {
      remindedEvents.add(id);
      const mins = Math.max(0, Math.round((e.start - now) / 60_000));
      showBanner({ kind: 'calendar', title: e.title, text: mins ? `Starts in ${mins} min${e.location ? ` · ${e.location}` : ''}` : 'Starting now' }, 10_000);
    }
  }
}

// ---------------------------------------------------------------------------
// Keep awake, timer, converter

function setKeepAwake(on: boolean) {
  if (on && keepAwakeId == null && settings.features.keepAwake) keepAwakeId = powerSaveBlocker.start('prevent-display-sleep');
  if (!on && keepAwakeId != null) {
    powerSaveBlocker.stop(keepAwakeId);
    keepAwakeId = null;
  }
  push({ keepAwake: keepAwakeId != null && powerSaveBlocker.isStarted(keepAwakeId) });
}

function timerTick(now: number) {
  const { state: next, finished } = timerFns.tick(state.timer, now);
  if (next === state.timer) return;
  push({ timer: next });
  if (finished && settings.features.timer) {
    showBanner(finished === 'focus'
      ? { kind: 'timer', title: 'Focus session done', text: `Take a ${next.breakMin} minute break.` }
      : { kind: 'timer', title: 'Break is over', text: `Back to focus for ${next.focusMin} minutes.` }, 10_000);
  }
}

const convertJobs = new Map<string, { resolve: (r: { bytes?: Uint8Array; error?: string }) => void; timer: NodeJS.Timeout }>();
const MAGIC: Record<ConvertFormat, (b: Buffer) => boolean> = {
  png: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8,
  webp: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' };

/** Converts an image with the island renderer's canvas (Chromium decodes and encodes PNG/JPEG/WebP). */
export async function convertImage(source: string, to: ConvertFormat): Promise<string> {
  if (!CONVERTIBLE.test(source)) throw new Error('Only PNG, JPG, WebP, GIF and BMP images can be converted.');
  const st = fs.statSync(source);
  if (st.size > 60 * 1024 * 1024) throw new Error('That image is too large (over 60 MB).');
  if (!island || !islandReady) throw new Error('The island is not ready.');
  const bytes = fs.readFileSync(source);
  const id = crypto.randomUUID();
  const ext = path.extname(source).slice(1).toLowerCase();
  const result = await new Promise<{ bytes?: Uint8Array; error?: string }>((resolve) => {
    const timer = setTimeout(() => {
      convertJobs.delete(id);
      resolve({ error: 'Conversion timed out.' });
    }, 30_000);
    convertJobs.set(id, { resolve, timer });
    island!.webContents.send('convert:job', { id, bytes: new Uint8Array(bytes), mime: MIME[ext] || 'image/png', to });
  });
  if (result.error || !result.bytes) throw new Error(result.error || 'Conversion failed.');
  const out = Buffer.from(result.bytes);
  if (!MAGIC[to](out)) throw new Error('The converted file did not come out right.');
  const target = convertedName(source, to === 'jpeg' ? 'jpg' : to);
  fs.writeFileSync(target, out, { flag: 'wx' });
  return target;
}

// ---------------------------------------------------------------------------
// Finished alerts: downloads, Steam, watched apps

let downloadWatcher: DownloadWatcher | null = null;
let steamWatcher: SteamWatcher | null = null;
const finishedActions = new Map<string, () => void>();
let appWatch: { target: WatchTarget; condition: WatchCondition; startTicks: string; detector: BusyIdleDetector; timer: NodeJS.Timeout; since: number } | null = null;

function recordFinished(kind: FinishedItem['kind'], title: string, text: string, action: (() => void) | null, bannerMs = 8000) {
  const id = crypto.randomUUID();
  if (action) finishedActions.set(id, action);
  const recent = [{ id, kind, title, text, at: Date.now(), actionable: Boolean(action) }, ...state.finished.recent].slice(0, 8);
  for (const key of finishedActions.keys()) if (!recent.some((r) => r.id === key)) finishedActions.delete(key);
  push({ finished: { ...state.finished, recent } });
  showBanner({ kind, title, text }, bannerMs, action);
}

function syncFinishedWatchers() {
  const f = settings.features;
  const allowed = license.status().state !== 'expired';
  if (f.downloads && allowed) {
    if (!downloadWatcher) {
      downloadWatcher = new DownloadWatcher(app.getPath('downloads'), (file) => {
        const name = path.basename(file);
        if (settings.features.shelf && settings.finished.addToShelf && shelf.add([file])) loadShelfIcons();
        recordFinished('download', 'Download finished', name, () => shell.showItemInFolder(file));
      }, log);
    }
    downloadWatcher.start();
  } else {
    downloadWatcher?.stop();
  }
  if (f.steam && allowed) {
    if (!steamWatcher) {
      steamWatcher = new SteamWatcher((game) => {
        const appid = /^\d+$/.test(game.appid) ? game.appid : '';
        recordFinished('steam', `${game.name} is ready to play`, 'Steam finished downloading.', appid ? () => { shell.openExternal(`steam://nav/games/details/${appid}`); } : null, 10_000);
      }, log);
    }
    if (!steamWatcher.running) steamWatcher.start().then((ok) => push({ finished: { ...state.finished, steamFound: ok } }));
  } else {
    steamWatcher?.stop();
  }
  if (!f.watchApp && appWatch) cancelWatch();
  if (f.shelf && settings.shelf.screenshots && allowed) {
    if (!screenshotWatcher) {
      screenshotWatcher = new ScreenshotWatcher(path.join(app.getPath('pictures'), 'Screenshots'), (file) => {
        if (!shelf.add([file])) return;
        loadShelfIcons();
        showBanner({ kind: 'info', title: 'Screenshot added to the shelf', text: path.basename(file) }, 4000, () => shell.showItemInFolder(file));
      }, log);
    }
    // Windows creates the folder with the first screenshot, so keep trying until it exists.
    if (!screenshotWatcher.running) screenshotWatcher.start();
  } else {
    screenshotWatcher?.stop();
  }
}

let screenshotWatcher: ScreenshotWatcher | null = null;

let bluetoothBusy = false;
async function refreshBluetooth() {
  if (!settings.features.battery) {
    if (state.bluetooth.length) push({ bluetooth: [] });
    return;
  }
  if (bluetoothBusy || smokeDir) return;
  bluetoothBusy = true;
  try {
    const next = await readBluetoothBatteries();
    if (JSON.stringify(next) !== JSON.stringify(state.bluetooth)) push({ bluetooth: next });
  } finally {
    bluetoothBusy = false;
  }
}

function parseWindows(text: unknown): WatchTarget[] {
  if (typeof text !== 'string' || !text) return [];
  const own = new Set([process.pid, island?.webContents.getOSProcessId(), helper?.pid]);
  return text.split('\n').map((line) => {
    const [pid, name, ...title] = line.split('|');
    return { pid: Number(pid), name: (name || '').slice(0, 80), title: title.join('|').slice(0, 160) };
  }).filter((w) => Number.isInteger(w.pid) && w.pid > 0 && !own.has(w.pid) && w.name.toLowerCase() !== 'explorer');
}

async function treeCpu(pid: number): Promise<{ alive: boolean; cpuMs: number; startTicks: string }> {
  const r = String(await helper!.request('proc-cpu', { pid }, 5000));
  const [alive, cpu, , start] = r.split('|');
  return { alive: alive === '1', cpuMs: Number(cpu) || 0, startTicks: start || '0' };
}

async function startWatch(pid: number, condition: WatchCondition): Promise<{ ok: boolean; error?: string }> {
  if (!settings.features.watchApp) return { ok: false, error: 'Watching apps is turned off in Settings.' };
  if (!helper || helper.status !== 'running') return { ok: false, error: 'The Windows helper is not running.' };
  const windows = parseWindows(await helper.request('windows'));
  const target = windows.find((w) => w.pid === pid);
  if (!target) return { ok: false, error: 'That app is no longer open.' };
  cancelWatch();
  const first = await treeCpu(pid);
  if (!first.alive) return { ok: false, error: 'That app is no longer running.' };
  const detector = new BusyIdleDetector();
  detector.push({ t: Date.now(), cpuMs: first.cpuMs, alive: true });
  const timer = setInterval(() => void pollWatch(), 2000);
  appWatch = { target, condition, startTicks: first.startTicks, detector, timer, since: Date.now() };
  pushWatch();
  return { ok: true };
}

function pushWatch() {
  const w = appWatch;
  push({
    finished: {
      ...state.finished,
      watch: w ? { ...w.target, condition: w.condition, phase: w.detector.phase, quietMs: w.detector.quietForMs, since: w.since } : null,
    },
  });
}

let polling = false;
async function pollWatch() {
  const w = appWatch;
  if (!w || polling || !helper || helper.status !== 'running') return;
  polling = true;
  try {
    const s = await treeCpu(w.target.pid);
    if (appWatch !== w) return;
    const alive = s.alive && s.startTicks === w.startTicks; // a new process with a reused id is not ours
    const result = w.detector.push({ t: Date.now(), cpuMs: s.cpuMs, alive });
    if (result === 'closed') {
      finishWatch(`${w.target.name} closed`, w.condition === 'idle' ? 'It closed before it went quiet.' : w.target.title);
    } else if (result === 'idle' && w.condition === 'idle') {
      finishWatch(`${w.target.name} looks done`, 'It went quiet, which usually means loading finished.');
    } else pushWatch();
  } catch (err) {
    log(`watch poll: ${(err as Error).message}`);
  } finally {
    polling = false;
  }
}

function finishWatch(title: string, text: string) {
  if (appWatch) clearInterval(appWatch.timer);
  appWatch = null;
  state.finished = { ...state.finished, watch: null, doneAt: Date.now() };
  recordFinished('app', title, text, null, 10_000);
}

function cancelWatch() {
  if (!appWatch) return;
  clearInterval(appWatch.timer);
  appWatch = null;
  pushWatch();
}

// ---------------------------------------------------------------------------
// Shelf

function pushShelf() {
  push({ shelf: shelf.list(shelfIcons) });
}

async function loadShelfIcons() {
  for (const item of shelf.list()) {
    if (shelfIcons.has(item.path) || item.missing) continue;
    try {
      const icon = await app.getFileIcon(item.path, { size: 'normal' });
      shelfIcons.set(item.path, icon.isEmpty() ? null : icon.toDataURL());
    } catch {
      shelfIcons.set(item.path, null);
    }
  }
  pushShelf();
}

// ---------------------------------------------------------------------------
// IPC. Every handler checks which window sent the message.

const isIsland = (e: IpcMainEvent | IpcMainInvokeEvent) => Boolean(island && !island.isDestroyed() && e.sender === island.webContents);
const isSettings = (e: IpcMainEvent | IpcMainInvokeEvent) => Boolean(settingsWin && !settingsWin.isDestroyed() && e.sender === settingsWin.webContents);
const isOurs = (e: IpcMainEvent | IpcMainInvokeEvent) => isIsland(e) || isSettings(e);

function on(channel: string, guard: (e: IpcMainEvent) => boolean, fn: (e: IpcMainEvent, ...args: unknown[]) => void) {
  ipcMain.on(channel, (e, ...args) => {
    if (!guard(e)) return;
    try {
      fn(e, ...args);
    } catch (err) {
      log(`${channel} failed: ${(err as Error).message}`);
    }
  });
}

function handle(channel: string, guard: (e: IpcMainInvokeEvent) => boolean, fn: (e: IpcMainInvokeEvent, ...args: unknown[]) => unknown) {
  ipcMain.handle(channel, (e, ...args) => {
    if (!guard(e)) throw new Error('not allowed');
    return fn(e, ...args);
  });
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

/** The browser extension ships next to the app, unpacked, so the browser can load it. */
const extensionDir = app.isPackaged ? path.join(process.resourcesPath, 'extension') : path.join(app.getAppPath(), 'extension');

const startupFolder = () => path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');

/** Startup apps for the settings page, each with its icon when Windows has one. */
async function startupApps(): Promise<StartupApp[]> {
  const entries = await listStartupApps({ folder: startupFolder() });
  return Promise.all(entries.map(async ({ iconPath, ...entry }) => {
    try {
      if (iconPath && fs.existsSync(iconPath)) return { ...entry, icon: (await app.getFileIcon(iconPath, { size: 'normal' })).toDataURL() };
    } catch { /* no icon */ }
    return entry;
  }));
}

function registerIpc() {
  on('island:ready', isIsland, () => {
    islandReady = true;
    island?.webContents.send('state', { ...state, ready: true });
    island?.showInactive();
  });
  on('island:hover', isIsland, (_e, v) => {
    hoverOn = v === true;
    if (island && !island.isDestroyed() && !smokeDir) island.setIgnoreMouseEvents(!hoverOn, { forward: true });
  });
  on('island:drag', isIsland, (_e, v) => (v === true ? startDrag() : endDrag()));
  on('island:lock', isIsland, (_e, v) => {
    endDrag();
    saveDisplay({ locked: v === true });
  });
  on('island:panel', isIsland, (_e, v) => setPanelOpen(v === true));
  on('island:size', isIsland, (_e, v) => setIslandSize(v === 'full' ? 'full' : 'compact'));
  on('decide', isIsland, (_e, msg) => {
    const m = msg as { id?: unknown; behavior?: unknown };
    if (m && (m.behavior === 'allow' || m.behavior === 'deny' || m.behavior === 'always')) settle(str(m.id), m.behavior);
  });
  on('answer', isIsland, (_e, msg) => {
    const m = msg as { id?: unknown; picks?: unknown };
    if (m) settle(str(m.id), 'allow', m.picks);
  });
  on('skip', isIsland, (_e, id) => settle(str(id, 100), null));
  on('media', isIsland, (_e, msg) => {
    const m = msg as { action?: unknown; positionMs?: unknown };
    const action = str(m?.action);
    if (!['toggle', 'next', 'previous', 'seek'].includes(action) || !helper) return;
    const value = typeof m.positionMs === 'number' && Number.isFinite(m.positionMs) ? Math.max(0, m.positionMs) : undefined;
    helper.request('media', { action, value }).catch((err) => log(`media ${action}: ${err.message}`));
  });
  on('timer', isIsland, (_e, action) => {
    const now = Date.now();
    const t = state.timer;
    const next = action === 'start' ? timerFns.start(t, now)
      : action === 'pause' ? timerFns.pause(t, now)
        : action === 'reset' ? timerFns.reset(t)
          : action === 'skip' ? timerFns.skip(t) : t;
    push({ timer: next });
  });
  on('clip:copy', isIsland, (_e, id) => {
    const item = history?.get(str(id, 100));
    if (!item) return;
    if (item.kind === 'text') {
      lastClipText = item.text;
      clipboard.writeText(item.text).catch(() => {});
    } else {
      clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(item.png)], { type: 'image/png' }) })]).catch(() => {});
    }
    showBanner({ kind: 'info', title: 'Copied', text: item.kind === 'text' ? item.text : 'Image' }, 1500);
  });
  on('clip:remove', isIsland, (_e, id) => {
    history?.remove(str(id, 100));
    push({ clipboard: history?.list() ?? [] });
  });
  on('clip:clear', isOurs, () => {
    history?.clear();
    push({ clipboard: history?.list() ?? [] });
  });
  on('clip:pin', isIsland, (_e, id) => {
    history?.togglePin(str(id, 100));
    push({ clipboard: history?.list() ?? [] });
  });
  const saveNotesSoon = debounced(() => writeJson(userFile('notes.json'), { text: state.notes }), 400);
  on('notes:save', isIsland, (_e, text) => {
    state.notes = str(text, 100_000);
    saveNotesSoon();
  });
  app.on('before-quit', () => saveNotesSoon.flush());
  on('shelf:add', isIsland, (_e, paths) => {
    if (!Array.isArray(paths)) return;
    if (shelf.add(paths.slice(0, 50))) loadShelfIcons();
  });
  on('shelf:remove', isIsland, (_e, id) => {
    shelf.remove(str(id, 100));
    pushShelf();
  });
  on('shelf:clear', isIsland, () => {
    shelf.clear();
    pushShelf();
  });
  on('shelf:open', isIsland, (_e, id) => {
    const p = shelf.pathOf(str(id, 100));
    if (p && fs.existsSync(p)) shell.showItemInFolder(p);
  });
  on('shelf:drag', isIsland, (e, id) => {
    const p = shelf.pathOf(str(id, 100));
    if (!p || !fs.existsSync(p)) return;
    const iconUrl = shelfIcons.get(p);
    const icon = iconUrl ? nativeImage.createFromDataURL(iconUrl) : trayIcon();
    e.sender.startDrag({ file: p, icon });
  });
  handle('shelf:convert', isIsland, async (_e, id, to) => {
    const p = shelf.pathOf(str(id, 100));
    if (!settings.features.converter) return { ok: false, error: 'The converter is turned off in Settings.' };
    if (!p) return { ok: false, error: 'That file is no longer on the shelf.' };
    if (to !== 'png' && to !== 'jpeg' && to !== 'webp') return { ok: false, error: 'Unknown format.' };
    try {
      const out = await convertImage(p, to);
      shelf.add([out]);
      await loadShelfIcons();
      showBanner({ kind: 'done', title: 'Converted', text: path.basename(out) }, 3000);
      return { ok: true, path: out };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });
  on('convert:done', isIsland, (_e, id, result) => {
    const job = convertJobs.get(str(id, 100));
    if (!job) return;
    convertJobs.delete(str(id, 100));
    clearTimeout(job.timer);
    const r = (result || {}) as { bytes?: unknown; error?: unknown };
    job.resolve(r.bytes instanceof Uint8Array ? { bytes: r.bytes } : { error: str(r.error) || 'Conversion failed.' });
  });
  on('keepAwake', isIsland, (_e, v) => setKeepAwake(v === true));
  on('volume:set', isIsland, (_e, v) => {
    if (typeof v === 'number' && Number.isFinite(v)) helper?.request('volume', { value: Math.round(Math.max(0, Math.min(100, v))) }).catch(() => {});
  });
  on('volume:mute', isIsland, (_e, v) => { helper?.request('mute', { value: v === true }).catch(() => {}); });
  on('displays:refresh', isIsland, () => { refreshDisplays(); });
  on('displays:set', isIsland, (_e, index, level) => {
    const d = state.displays.find((x) => x.index === index);
    if (!d || !d.max || typeof level !== 'number' || !Number.isFinite(level) || !helper) return;
    const pct = Math.round(Math.max(0, Math.min(100, level)));
    helper.request('ddc-set', { index: d.index, code: 0x10, value: Math.round((pct / 100) * d.max) }, 10_000)
      .then(() => push({ displays: state.displays.map((x) => (x.index === d.index ? { ...x, brightness: pct } : x)) }))
      .catch((err) => log(`ddc-set: ${err.message}`));
  });
  on('displays:contrast', isIsland, (_e, index, level) => {
    const d = state.displays.find((x) => x.index === index);
    if (!d || !d.contrastMax || typeof level !== 'number' || !Number.isFinite(level) || !helper) return;
    const pct = Math.round(Math.max(0, Math.min(100, level)));
    helper.request('ddc-set', { index: d.index, code: 0x12, value: Math.round((pct / 100) * d.contrastMax) }, 10_000)
      .then(() => push({ displays: state.displays.map((x) => (x.index === d.index ? { ...x, contrast: pct } : x)) }))
      .catch((err) => log(`ddc-set contrast: ${err.message}`));
  });
  on('displays:input', isIsland, (_e, index, value) => {
    const d = state.displays.find((x) => x.index === index);
    // Only for monitors that report their input, and only to the standard input values.
    if (!d || d.input == null || !DDC_INPUTS.some((i) => i.value === value) || !helper) return;
    helper.request('ddc-set', { index: d.index, code: 0x60, value }, 10_000)
      .then(() => setTimeout(refreshDisplays, 4000))
      .catch((err) => log(`ddc-set input: ${err.message}`));
  });
  on('banner:click', isIsland, () => {
    banners.click();
  });
  handle('watch:windows', isIsland, async () => {
    if (!helper || helper.status !== 'running') return [];
    return parseWindows(await helper.request('windows'));
  });
  handle('watch:start', isIsland, (_e, pid, condition) => {
    if (typeof pid !== 'number' || (condition !== 'exit' && condition !== 'idle')) return { ok: false, error: 'Pick an app first.' };
    return startWatch(pid, condition).catch((err) => ({ ok: false, error: (err as Error).message }));
  });
  on('watch:cancel', isIsland, () => cancelWatch());
  on('finished:open', isIsland, (_e, id) => finishedActions.get(str(id, 100))?.());
  on('settings:open', isIsland, (_e, section) => openSettings(str(section, 30) || undefined));
  on('buy', isOurs, () => shell.openExternal(config.store.buyUrl));

  handle('settings:info', isSettings, () => settingsInfo());
  handle('settings:update', isSettings, (_e, patch) => {
    const prev = settings;
    settings = updateSettings(settings, patch);
    writeJson(userFile('settings.json'), settings);
    applySettings(prev);
    return settingsInfo();
  });
  on('web:openFolder', isSettings, () => void shell.openPath(extensionDir));
  handle('startup:list', isSettings, () => startupApps());
  handle('startup:set', isSettings, async (_e, id, v) => {
    try {
      await setStartupApp(str(id, 400), v === true, { folder: startupFolder() });
      return { ok: true, apps: await startupApps() };
    } catch (err) {
      return { ok: false, error: (err as Error).message, apps: await startupApps() };
    }
  });
  handle('settings:startWithWindows', isSettings, (_e, v) => {
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: v === true });
    return settingsInfo();
  });
  handle('agents:connect', isSettings, (_e, agent, v) => {
    if (!(AGENT_NAMES as readonly unknown[]).includes(agent)) return { ok: false, error: 'Unknown agent.', info: settingsInfo() };
    try {
      connectAgent(agent as AgentName, v === true);
      return { ok: true, info: settingsInfo() };
    } catch (err) {
      return { ok: false, error: (err as Error).message, info: settingsInfo() };
    }
  });
  const licenseAction = (fn: (arg: unknown) => Promise<void>) => async (_e: IpcMainInvokeEvent, arg: unknown) => {
    try {
      await fn(arg);
      return { ok: true, status: license.status() };
    } catch (err) {
      return { ok: false, error: (err as Error).message, status: license.status() };
    } finally {
      push({ license: license.status() });
      refreshTray();
    }
  };
  handle('license:activate', isSettings, licenseAction((key) => license.activate(str(key, 200))));
  handle('license:deactivate', isSettings, licenseAction(() => license.deactivate()));
  handle('calendar:refresh', isSettings, async () => {
    try {
      await refreshCalendar();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: state.calendar.error || (err as Error).message };
    }
  });
}

async function refreshDisplays() {
  if (!settings.features.displays || !helper || helper.status !== 'running') return;
  try {
    const text = await helper.request<string>('ddc-list', { code: 0x10 }, 15_000);
    // Contrast (0x12) and the input in use (0x60); a monitor that does not answer just has no such control.
    const contrast = parseDdcValues(await helper.request<string>('ddc-list', { code: 0x12 }, 15_000).catch(() => ''));
    const input = parseDdcValues(await helper.request<string>('ddc-list', { code: 0x60 }, 15_000).catch(() => ''));
    push({
      displays: parseDdcList(text).map((d) => {
        const c = contrast.get(d.index);
        const hasContrast = Boolean(c && c.max > 0);
        return {
          ...d,
          contrast: hasContrast ? Math.round((c!.current / c!.max) * 100) : null,
          contrastMax: hasContrast ? c!.max : null,
          // The low byte is the input; some monitors put other data in the high bytes.
          input: input.has(d.index) ? input.get(d.index)!.current & 0xff : null,
        };
      }),
    });
  } catch (err) {
    log(`ddc-list: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Cursor direction for the mascot's eyes

let lastCursor = { x: 0, y: 0 };
// Which app is in front decides whether the idle island shrinks to just the face.
let foregroundApp = '';
let foregroundBusy = false;

function applyFaceOnly() {
  const next = faceOnly(settings.display.compact, foregroundApp);
  if (next !== state.faceOnly) push({ faceOnly: next });
}

/** A game or fullscreen video covers the island's screen: the island steps aside. */
let fullscreenAhead = false;

function applyFullscreen() {
  if (!island || island.isDestroyed() || !islandReady) return;
  // A waiting Allow/Deny card is worth showing even over a game.
  const hide = fullscreenAhead && settings.display.hideInFullscreen && pending.size === 0 && !panelOpen;
  if (hide && island.isVisible()) island.hide();
  else if (!hide && !island.isVisible()) island.showInactive();
}

async function pollForeground() {
  const wanted = settings.display.compact === 'browsers' || settings.display.hideInFullscreen;
  if (foregroundBusy || testMode || !helper || helper.status !== 'running' || !wanted) return;
  foregroundBusy = true;
  try {
    const [name, full, left, top] = String(await helper.request('foreground-app', {}, 1500) || '').split('|');
    // Our own windows (the island, settings) do not count as "the app in front".
    if (name && !/^(electron|helo)$/i.test(name)) {
      foregroundApp = name;
      const d = targetDisplay().bounds;
      fullscreenAhead = full === '1' && Number(left) === d.x && Number(top) === d.y;
    }
    applyFullscreen();
    applyFaceOnly();
  } catch { /* try again on the next tick */ } finally {
    foregroundBusy = false;
  }
}

function sendCursor() {
  if (!island || island.isDestroyed() || !islandReady || !settings.features.mascot || testMode) return;
  const p = screen.getCursorScreenPoint();
  const b = island.getBounds();
  const top = state.place.edge === 'top';
  const cx = b.x + b.width / 2 - (state.faceOnly ? 0 : 130);
  const cy = top ? b.y + 16 : b.y + b.height - 16;
  const x = Math.max(-1, Math.min(1, (p.x - cx) / 400));
  const y = Math.max(-1, Math.min(1, (p.y - cy) / 300));
  if (Math.abs(x - lastCursor.x) < 0.02 && Math.abs(y - lastCursor.y) < 0.02) return;
  lastCursor = { x, y };
  island.webContents.send('cursor', lastCursor);
}

// ---------------------------------------------------------------------------
// Startup

function loadBridgeInfo() {
  const file = userFile('bridge.json');
  const saved = readJson<{ port?: unknown; token?: unknown; webToken?: unknown }>(file, {});
  const newToken = () => crypto.randomBytes(24).toString('hex');
  if (Number.isInteger(saved.port) && typeof saved.token === 'string' && saved.token.length >= 32) {
    const info = { port: saved.port as number, token: saved.token, webToken: typeof saved.webToken === 'string' && saved.webToken.length >= 32 ? saved.webToken : newToken() };
    // Older installs have no secret for the browser extension yet.
    if (info.webToken !== saved.webToken) writeJson(file, info);
    return info;
  }
  const fresh = { port: config.defaultPort, token: newToken(), webToken: newToken() };
  writeJson(file, fresh);
  return fresh;
}

app.on('second-instance', () => openSettings());
app.on('window-all-closed', () => { /* tray app: keep running */ });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('before-quit', () => {
  downloadWatcher?.stop();
  steamWatcher?.stop();
  if (appWatch) clearInterval(appWatch.timer);
  helper?.stop();
  if (keepAwakeId != null) powerSaveBlocker.stop(keepAwakeId);
});

app.whenReady().then(async () => {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  license = createLicense({ file: userFile('license.json'), store: config.store, trialDays: config.trialDays });
  loadSettings();
  bridgeInfo = loadBridgeInfo();
  history = new ClipboardHistory(userFile('clipboard'), settings.clipboard.maxItems);
  shelf = new Shelf(userFile('shelf.json'));
  state.settings = settings;
  state.license = license.status();
  state.clipboard = history.list();
  state.notes = readJson<{ text?: string }>(userFile('notes.json'), {}).text ?? '';
  state.timer = timerFns.configure(state.timer, settings.timer.focusMin, settings.timer.breakMin);
  state.shelf = shelf.list();
  registerIpc();

  const bridge = createBridge({ token: bridgeInfo.token, onPermission, onEvent, onStatus, webToken: bridgeInfo.webToken, onWeb });
  let bridgePort = 0;
  try {
    bridgePort = await bridge.listen(testMode ? 0 : bridgeInfo.port);
    livePort = bridgePort;
  } catch (err) {
    bridgeError = err as Error;
  }
  app.on('before-quit', () => { bridge.close(); });

  createIsland();
  const conn = connectionStates();
  Object.assign(state.agents, conn);

  if (smokeDir) {
    runSmoke({ dir: smokeDir, island: island!, push, state, openSettings, isReady: () => islandReady, quit: (code) => app.exit(code) });
    return;
  }

  helper = new WinHelper({ script: helperScript(), log });
  helper.on('message', onHelperMessage);
  helper.on('status', (s) => {
    push({ helper: s });
    if (s === 'running') refreshDisplays();
  });
  syncHelperFeatures();

  if (selfTestOut) {
    runSelfTest({
      out: selfTestOut,
      island: island!,
      helper,
      state,
      push,
      isReady: () => islandReady,
      bridgeOpts: { port: bridgePort, token: bridgeInfo.token },
      claudeSettings: CLAUDE_SETTINGS,
      codexHooks: CODEX_HOOKS,
      geminiSettings: GEMINI_SETTINGS,
      cursorHooks: CURSOR_HOOKS,
      convertImage,
      setPanelOpen,
      captureClipboard,
      history: history!,
      setKeepAwake,
      decide: (id, behavior, picks) => settle(id, behavior, picks),
      treeCpu,
      isPanelOpen: () => panelOpen,
      openSettings,
      settingsFile: userFile('settings.json'),
      tmp: testRoot!,
      quit: (code) => {
        helper?.stop();
        setTimeout(() => app.exit(code), 500);
      },
    });
    return;
  }

  tray = new Tray(trayIcon());
  tray.on('click', () => tray?.popUpContextMenu());
  refreshTray();

  license.revalidate().then(() => {
    push({ license: license.status() });
    refreshTray();
  });

  let ticks = 0;
  setInterval(() => {
    const now = Date.now();
    ticks++;
    timerTick(now);
    calendarReminders(now);
    if (ticks % 30 === 0 && tracker.tick()) pushAgents();
    if (ticks % 2 === 0) void pollClipboardFallback();
    void pollForeground();
    if (ticks % 900 === 0) refreshCalendar().catch(() => {});
    if (ticks % 300 === 0) void refreshBluetooth();
    // The Screenshots folder appears with the first screenshot; start watching once it does.
    if (ticks % 60 === 0 && screenshotWatcher && !screenshotWatcher.running) syncFinishedWatchers();
    if (ticks % 3600 === 0) {
      push({ license: license.status() });
      refreshTray();
    }
  }, 1000);
  setInterval(sendCursor, 66);
  applySettings(null);
  loadShelfIcons();
});
