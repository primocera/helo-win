// Types shared by the main process, the preload script and the renderer.
// Everything that crosses IPC is plain JSON data described here.

import type { WorkMapState } from './workmap';

/** 'always' = allow and add the rule Claude Code suggested (Claude Code only). */
export type Behavior = 'allow' | 'deny' | 'always';
export type AgentName = 'claude' | 'codex';
/** Where a tracked session comes from: a coding agent, or a chat in the browser (via the extension). */
export type SessionSource = AgentName | 'claude-web' | 'chatgpt-web';

export interface DiffLine {
  kind: 'add' | 'del' | 'same';
  text: string;
}

/** The changed lines of a file edit, for the red/green card. */
export interface DiffView {
  file: string;
  added: number;
  removed: number;
  lines: DiffLine[];
  /** Changed lines that did not fit in `lines`. */
  more: number;
}

export interface QuestionView {
  question: string;
  header: string;
  multi: boolean;
  options: { label: string; description: string }[];
}

export interface PermissionView {
  id: string;
  /** tool: Allow/Deny. question: pick answers. plan: approve or reject a plan. */
  kind: 'tool' | 'question' | 'plan';
  diff?: DiffView;
  questions?: QuestionView[];
  plan?: string;
  agent: AgentName;
  tool: string;
  summary: string;
  project: string;
  /** Rule text for the "Always allow" button, e.g. "Bash(npm test)", or null when not offered. */
  always: string | null;
  receivedAt: number;
}

export type BannerKind = 'done' | 'input' | 'info' | 'warn' | 'timer' | 'battery' | 'calendar' | 'privacy' | 'download' | 'steam' | 'app';

export interface Banner {
  kind: BannerKind;
  title: string;
  text: string;
  at?: number;
  /** Clicking the banner does something (reveal a download, open Steam). */
  clickable?: boolean;
}

export type LicenseStatus =
  | { state: 'licensed' }
  | { state: 'trial'; daysLeft: number }
  | { state: 'expired' };

export type Mood = 'idle' | 'working' | 'waiting' | 'done';

/** What the mascot face (Blink) shows. Agent moods plus UI-driven ones. */
export type Face = 'calm' | 'happy' | 'listening' | 'thinking' | 'needsYou' | 'done' | 'napping' | 'broken';

export interface UsageWindow {
  usedPercent: number;
  /** Epoch milliseconds. */
  resetsAt: number;
}

export interface Usage {
  fiveHour: UsageWindow | null;
  sevenDay: UsageWindow | null;
  updatedAt: number;
}

export interface AgentSession {
  key: string;
  agent: SessionSource;
  project: string;
  mood: Mood;
  since: number;
}

export interface AgentsState {
  sessions: AgentSession[];
  mood: Mood;
  usage: Usage | null;
  /** The model the latest Claude Code session is on (e.g. "Opus 5.5"), from its status line. */
  model: string | null;
  claude: ConnectionState;
  codex: ConnectionState;
}

export interface ConnectionState {
  connected: boolean;
  /** Short explanation shown in settings, e.g. why the status line was not added. */
  note: string;
}

export interface MediaState {
  app: string;
  title: string;
  artist: string;
  album: string;
  status: 'Playing' | 'Paused' | 'Stopped' | 'Changing' | 'Opened' | 'Closed' | string;
  canPlay: boolean;
  canPause: boolean;
  canNext: boolean;
  canPrevious: boolean;
  canSeek: boolean;
  positionMs: number;
  startMs: number;
  endMs: number;
  /** Epoch ms at which positionMs was measured by the source app. */
  updatedAt: number;
  art: string | null;
}

export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface LyricsState {
  trackKey: string;
  status: 'loading' | 'synced' | 'plain' | 'none' | 'error';
  lines: LyricLine[];
  plain: string;
}

export type TimerPhase = 'focus' | 'break';

export interface TimerState {
  phase: TimerPhase;
  running: boolean;
  /** Epoch ms when the running phase ends; null when paused or reset. */
  endsAt: number | null;
  /** Remaining ms while paused (or the full length after a reset). */
  remainingMs: number;
  focusMin: number;
  breakMin: number;
  completedFocus: number;
}

export interface ClipItem {
  id: string;
  kind: 'text' | 'image';
  /** Finer kind for the filter chips. */
  type: 'text' | 'link' | 'color' | 'image';
  pinned: boolean;
  /** Text content, or a short description for images. */
  text: string;
  /** Small data: URL preview for images. */
  thumb?: string;
  at: number;
}

export interface ShelfItem {
  id: string;
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  icon: string | null;
  missing: boolean;
}

export interface PrivacyState {
  microphone: string[];
  camera: string[];
}

export interface PowerState {
  hasBattery: boolean;
  percent: number | null;
  pluggedIn: boolean;
  charging: boolean;
}

export interface Hud {
  kind: 'volume' | 'brightness';
  level: number;
  muted: boolean;
  at: number;
}

export interface DisplayControl {
  index: number;
  name: string;
  brightness: number | null;
  max: number | null;
  /** 0-100, or null when the monitor does not report contrast. */
  contrast: number | null;
  contrastMax: number | null;
  /** The VCP 0x60 value of the input in use, or null when the monitor does not report it. */
  input: number | null;
}

/** A Bluetooth device that reports its battery level to Windows. */
export interface BluetoothBattery {
  name: string;
  percent: number;
}

export interface CalendarEvent {
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  location: string;
}

export interface CalendarState {
  events: CalendarEvent[];
  error: string;
  fetchedAt: number;
}

export interface FeatureFlags {
  agents: boolean;
  /** The work map: a live picture of what Claude Code is using (files, shell, network, subagents). */
  map: boolean;
  usage: boolean;
  mascot: boolean;
  media: boolean;
  lyrics: boolean;
  timer: boolean;
  clipboard: boolean;
  notes: boolean;
  shelf: boolean;
  keepAwake: boolean;
  battery: boolean;
  privacy: boolean;
  hud: boolean;
  displays: boolean;
  calendar: boolean;
  converter: boolean;
  downloads: boolean;
  steam: boolean;
  watchApp: boolean;
}

export type Edge = 'top' | 'bottom';

export interface Settings {
  features: FeatureFlags;
  /** compact: when the idle island shrinks to just the face. */
  display: { monitor: 'primary' | number; edge: Edge; compact: 'never' | 'browsers' | 'always'; hideInFullscreen: boolean; open: 'hover' | 'click' };
  clipboard: { maxItems: number; images: boolean };
  timer: { focusMin: number; breakMin: number };
  battery: { lowPercent: number };
  calendar: { icsUrl: string };
  finished: { addToShelf: boolean };
  shelf: { screenshots: boolean };
}

export interface WatchTarget {
  pid: number;
  name: string;
  title: string;
}

export type WatchCondition = 'exit' | 'idle';

export interface WatchState extends WatchTarget {
  condition: WatchCondition;
  /** waiting: not busy yet; busy: working; settling: quiet, counting down. */
  phase: 'waiting' | 'busy' | 'settling';
  quietMs: number;
  since: number;
}

export interface FinishedItem {
  id: string;
  kind: 'download' | 'steam' | 'app';
  title: string;
  text: string;
  at: number;
  actionable: boolean;
}

export interface FinishedState {
  watch: WatchState | null;
  recent: FinishedItem[];
  /** When the last watch fired (for the mascot's "done" face). */
  doneAt: number;
  steamFound: boolean;
}

export interface IslandState {
  ready: boolean;
  settings: Settings;
  license: LicenseStatus;
  requests: PermissionView[];
  banner: Banner | null;
  agents: AgentsState;
  map: WorkMapState | null;
  media: MediaState | null;
  lyrics: LyricsState | null;
  timer: TimerState;
  clipboard: ClipItem[];
  notes: string;
  shelf: ShelfItem[];
  keepAwake: boolean;
  privacy: PrivacyState;
  power: PowerState | null;
  volume: { level: number | null; muted: boolean } | null;
  hud: Hud | null;
  displays: DisplayControl[];
  bluetooth: BluetoothBattery[];
  calendar: CalendarState;
  finished: FinishedState;
  helper: 'starting' | 'running' | 'failed' | 'off';
  /** The idle island shows only the face right now (e.g. a browser is in front). */
  faceOnly: boolean;
}

export type PanelTab =
  | 'agents'
  | 'map'
  | 'media'
  | 'timer'
  | 'clipboard'
  | 'notes'
  | 'shelf'
  | 'system'
  | 'calendar'
  | 'finished';

export interface DisplayInfo {
  id: number;
  label: string;
  primary: boolean;
}

export interface SettingsInfo {
  settings: Settings;
  displays: DisplayInfo[];
  startWithWindows: boolean;
  canStartWithWindows: boolean;
  license: LicenseStatus;
  price: string;
  appName: string;
  version: string;
  agents: { claude: ConnectionState; codex: ConnectionState };
  /** Pasted into the browser extension so it can reach this app. */
  webPairingCode: string;
}

/** An app that starts when the user signs in to Windows. */
export interface StartupApp {
  id: string;
  name: string;
  /** The command it runs, or where the entry lives. */
  detail: string;
  enabled: boolean;
  /** False for entries that apply to every user of the PC (administrator only). */
  canChange: boolean;
  /** Small icon as a data URL, when Windows has one. */
  icon?: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export type ConvertFormat = 'png' | 'jpeg' | 'webp';

/** Smoke mode: which view the renderer should show for a screenshot. */
export interface SmokeView {
  panel: PanelTab | null;
  /** Show every mascot face side by side (screenshot only). */
  faces?: boolean;
  hover?: boolean;
}

/** The API the preload script exposes as `window.helo`. */
export interface HeloApi {
  onState(fn: (patch: Partial<IslandState>) => void): () => void;
  onSmoke(fn: (view: SmokeView) => void): () => void;
  /** Pointer direction relative to the mascot, each axis -1..1 (for its eyes). */
  onCursor(fn: (v: { x: number; y: number }) => void): () => void;
  /** Main asks the island to close its panel (e.g. the user clicked another app). */
  onCollapse(fn: () => void): () => void;
  onConvertJob(fn: (job: { id: string; bytes: Uint8Array; mime: string; to: ConvertFormat }) => void): () => void;
  ready(): void;
  hover(on: boolean): void;
  panel(open: boolean): void;
  /** The window size the current view needs. */
  size(size: 'compact' | 'full'): void;
  decide(id: string, behavior: Behavior): void;
  /** Answers a question card: for each question (by position), the labels picked. */
  answer(id: string, picks: string[][]): void;
  /** Leaves a question or plan for the terminal. */
  skip(id: string): void;
  media(action: 'toggle' | 'next' | 'previous' | 'seek', positionMs?: number): void;
  timer(action: 'start' | 'pause' | 'reset' | 'skip'): void;
  clipCopy(id: string): void;
  clipRemove(id: string): void;
  clipClear(): void;
  clipPin(id: string): void;
  saveNotes(text: string): void;
  shelfAdd(files: File[]): void;
  shelfRemove(id: string): void;
  shelfClear(): void;
  shelfOpen(id: string): void;
  shelfDrag(id: string): void;
  shelfConvert(id: string, to: ConvertFormat): Promise<ActionResult & { path?: string }>;
  convertDone(id: string, result: { bytes?: Uint8Array; error?: string }): void;
  setKeepAwake(on: boolean): void;
  setVolume(level: number): void;
  setMute(on: boolean): void;
  setDisplayBrightness(index: number, level: number): void;
  setDisplayContrast(index: number, level: number): void;
  setDisplayInput(index: number, input: number): void;
  refreshDisplays(): void;
  openSettings(section?: string): void;
  bannerClick(): void;
  listWindows(): Promise<WatchTarget[]>;
  startWatch(pid: number, condition: WatchCondition): Promise<ActionResult>;
  cancelWatch(): void;
  openFinished(id: string): void;
  // Settings window
  onSettingsSection(fn: (section: string) => void): () => void;
  settingsInfo(): Promise<SettingsInfo>;
  updateSettings(patch: unknown): Promise<SettingsInfo>;
  setStartWithWindows(on: boolean): Promise<SettingsInfo>;
  connectAgent(agent: AgentName, on: boolean): Promise<ActionResult & { info: SettingsInfo }>;
  activateLicense(key: string): Promise<ActionResult & { status: LicenseStatus }>;
  deactivateLicense(): Promise<ActionResult & { status: LicenseStatus }>;
  buy(): void;
  refreshCalendar(): Promise<ActionResult>;
  listStartupApps(): Promise<StartupApp[]>;
  /** Opens the folder that holds the browser extension, for "Load unpacked". */
  openExtensionFolder(): void;
  setStartupApp(id: string, enabled: boolean): Promise<ActionResult & { apps: StartupApp[] }>;
}
