// Types shared by the main process, the preload script and the renderer.
// Everything that crosses IPC is plain JSON data described here.

import type { WorkMapState } from './workmap';

/** 'always' = allow and add the rule Claude Code suggested (Claude Code only). */
export type Behavior = 'allow' | 'deny' | 'always';
export type AgentName = 'claude' | 'codex' | 'gemini' | 'cursor';
/** Every agent Helo can connect to, in the order Settings lists them. */
export const AGENT_NAMES: readonly AgentName[] = ['claude', 'codex', 'gemini', 'cursor'];
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
  /** The whole command, path or address being approved, line breaks kept. */
  summary: string;
  /** The summary was too long to send in full; the rest has to be read in the terminal. */
  summaryCut?: boolean;
  project: string;
  /** Rule text for the "Always allow" button, e.g. "Bash(npm test)", or null when not offered. */
  always: string | null;
  receivedAt: number;
}

export type BannerKind = 'done' | 'input' | 'info' | 'warn' | 'timer' | 'battery' | 'calendar' | 'privacy' | 'download' | 'steam' | 'app' | 'notify';

export interface Banner {
  kind: BannerKind;
  title: string;
  text: string;
  at?: number;
  /** Clicking the banner does something (reveal a download, open Steam). */
  clickable?: boolean;
  /** Clicking goes to the window of the session it is about. */
  jump?: boolean;
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
  /** Lines added and removed since the session's last prompt (Claude Code, with the work map on). */
  added?: number;
  removed?: number;
  /** The name of the file the session is editing right now (Claude Code). */
  file?: string;
  /** The session's window is known, so the island can bring it forward. */
  jump?: boolean;
}

export interface AgentsState {
  sessions: AgentSession[];
  mood: Mood;
  usage: Usage | null;
  /** The model the latest Claude Code session is on (e.g. "Opus 5.5"), from its status line. */
  model: string | null;
  claude: ConnectionState;
  codex: ConnectionState;
  gemini: ConnectionState;
  cursor: ConnectionState;
}

export interface ConnectionState {
  connected: boolean;
  /** Short explanation shown in settings, e.g. why the status line was not added. */
  note: string;
}

/** Repeat nothing, the whole list, or the one track. The names are Windows' own. */
export type RepeatMode = 'None' | 'List' | 'Track';

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
  /** The app lets shuffle and repeat be changed from outside (Spotify does; most browsers do not). */
  canShuffle: boolean;
  canRepeat: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
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
  /** Length of the long break, and after how many focus sessions it comes (0 = never). */
  longBreakMin: number;
  longEvery: number;
  /** The break that is running or up next is the long one. */
  longBreak: boolean;
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
  /** When each app listed above started using the microphone or camera (app name -> epoch ms), as Windows recorded it. */
  since: Record<string, number>;
  /** The microphone is muted for every app. Null: no microphone, or not known. */
  micMuted: boolean | null;
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
  /** The event's Zoom, Meet, Teams or Webex link, when it has one. Always https and one of those services. */
  join?: string;
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
  /** Banners for other apps' Windows notifications. */
  notifications: boolean;
  /** A warning when the Windows drive is nearly full. */
  disk: boolean;
}

export type Edge = 'top' | 'bottom';

export interface Settings {
  features: FeatureFlags;
  /** Apps whose notifications have been seen, and whether each is shown (app name -> on). */
  notifications: { apps: Record<string, boolean> };
  /** compact: when the idle island shrinks to just the face. */
  display: {
    monitor: 'primary' | number;
    edge: Edge;
    compact: 'never' | 'browsers' | 'always';
    hideInFullscreen: boolean;
    open: 'hover' | 'click';
    /** Where the user dragged the island: the pill's middle (x) and its top (y), in pixels from the display's top-left corner. Null: centred on `edge`. */
    position: { x: number; y: number } | null;
    /** Locked, the island cannot be dragged. */
    locked: boolean;
    /** The colour of the bars, the timer, Blink's blush and other highlights. */
    accent: 'mint' | 'rose';
    /** The song's title (or the lyric line being sung) shows in the closed island while music plays. */
    title: boolean;
  };
  /** `expireHours`: unpinned copies are forgotten after this long (0 = never). `paused`: nothing new is saved. */
  clipboard: { maxItems: number; images: boolean; expireHours: number; paused: boolean };
  /** `longEvery`: a long break after this many focus sessions (0 = never). */
  timer: { focusMin: number; breakMin: number; longBreakMin: number; longEvery: number };
  battery: { lowPercent: number };
  /** Warn when the Windows drive has less than this many GB free. */
  disk: { lowGb: number };
  calendar: { icsUrl: string };
  finished: { addToShelf: boolean };
  shelf: { screenshots: boolean };
  /** The sound when an agent needs the user. `volume`: 0-100. `fullscreen`: also over a game or a fullscreen video. */
  sound: { on: boolean; volume: number; fullscreen: boolean };
  /** helo:// links from scripts and shortcuts. */
  links: { on: boolean };
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
  /** Where the island sits now: which way it opens, and whether it is away from the screen edge. */
  place: { edge: Edge; floating: boolean };
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
  agents: Record<AgentName, ConnectionState>;
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
  /** Show the right-click menu. */
  menu?: boolean;
}

/** The API the preload script exposes as `window.helo`. */
export interface HeloApi {
  onState(fn: (patch: Partial<IslandState>) => void): () => void;
  onSmoke(fn: (view: SmokeView) => void): () => void;
  /** Pointer direction relative to the mascot, each axis -1..1 (for its eyes). */
  onCursor(fn: (v: { x: number; y: number }) => void): () => void;
  /** Main asks the island to close its panel (e.g. the user clicked another app). */
  onCollapse(fn: () => void): () => void;
  /** Main asks the island to play the "an agent needs you" sound at this volume (0-100). */
  onSound(fn: (v: { volume: number }) => void): () => void;
  /** Main asks the island to open its panel on this tab (a helo://open link). */
  onOpenTab(fn: (tab: PanelTab) => void): () => void;
  onConvertJob(fn: (job: { id: string; bytes: Uint8Array; mime: string; to: ConvertFormat }) => void): () => void;
  ready(): void;
  hover(on: boolean): void;
  /** The island follows the pointer from now on (true) or stays where it is (false). */
  drag(on: boolean): void;
  /** Locks or unlocks the island's position. */
  setLocked(on: boolean): void;
  panel(open: boolean): void;
  /** The window size the current view needs. */
  size(size: 'compact' | 'full'): void;
  /** `feedback`: what the user typed when rejecting a plan. */
  decide(id: string, behavior: Behavior, feedback?: string): void;
  /** Answers a question card: for each question (by position), the labels picked and the text typed ('' for none). */
  answer(id: string, picks: string[][], typed?: string[]): void;
  /** A text field on a card is in use: the island takes the keyboard, and gives it back after. */
  typing(on: boolean): void;
  /** Leaves a question or plan for the terminal. */
  skip(id: string): void;
  media(action: 'toggle' | 'next' | 'previous' | 'seek' | 'shuffle' | 'repeat', positionMs?: number): void;
  timer(action: 'start' | 'pause' | 'reset' | 'skip'): void;
  clipCopy(id: string): void;
  clipRemove(id: string): void;
  clipClear(): void;
  clipPin(id: string): void;
  /** Stops or resumes saving new copies. */
  clipPause(on: boolean): void;
  /** Opens the meeting link of a calendar event (`start` and `title` say which). */
  joinEvent(start: number, title: string): void;
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
  /** Mutes or unmutes the microphone, for every app. */
  setMicMute(on: boolean): void;
  /** Brings the window of an app that is using the microphone or camera to the front. */
  callReturn(app: string): void;
  setDisplayBrightness(index: number, level: number): void;
  setDisplayContrast(index: number, level: number): void;
  setDisplayInput(index: number, input: number): void;
  refreshDisplays(): void;
  openSettings(section?: string): void;
  bannerClick(): void;
  /** The island leaves the screen: for a minute, or (`forever`) until it is shown again from the tray. */
  stepAside(forever: boolean): void;
  quit(): void;
  /** Brings the window of this session (its `key`) to the front. */
  sessionJump(key: string): void;
  listWindows(): Promise<WatchTarget[]>;
  startWatch(pid: number, condition: WatchCondition): Promise<ActionResult>;
  cancelWatch(): void;
  openFinished(id: string): void;
  // Settings window
  onSettingsSection(fn: (section: string) => void): () => void;
  settingsInfo(): Promise<SettingsInfo>;
  /** Puts versions, states and the end of the log on the clipboard, for a support message. */
  copyDiagnostics(): Promise<ActionResult>;
  openLogFolder(): void;
  /** Plays the "an agent needs you" sound once, at the volume set. */
  testSound(): void;
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
