import type { Face, Mood } from './types';

/** After this long without the pointer near the island and no agent activity, the mascot naps. */
export const NAP_AFTER_MS = 3 * 60_000;

export interface FaceInput {
  mood: Mood;
  hovering: boolean;
  listening: boolean;
  broken: boolean;
  idleForMs: number;
  /** Music or video is playing: the face leans in as if listening. */
  music?: boolean;
  /** A focus session is running. */
  focusing?: boolean;
  /** Something just finished (a download, a timer, an answer). */
  celebrating?: boolean;
}

/** Which mascot face to show. Order matters: the first rule that applies wins. */
export function faceFor({ mood, hovering, listening, broken, idleForMs, music = false, focusing = false, celebrating = false }: FaceInput): Face {
  if (broken) return 'broken';
  if (mood === 'waiting') return 'needsYou';
  if (listening) return 'listening';
  if (mood === 'working') return 'thinking';
  if (mood === 'done' || celebrating) return 'done';
  if (hovering) return 'happy';
  if (focusing) return 'thinking';
  if (music) return 'listening';
  if (idleForMs >= NAP_AFTER_MS) return 'napping';
  return 'calm';
}

/** Browsers whose tab strip sits where the island is. Process names, lower case, no ".exe". */
export const BROWSERS = new Set(['chrome', 'msedge', 'firefox', 'brave', 'opera', 'opera_gx', 'vivaldi', 'arc', 'zen', 'librewolf', 'chromium', 'iexplore']);

export type CompactMode = 'never' | 'browsers' | 'always';

/** Whether the idle island should shrink to just the face. */
export function faceOnly(mode: CompactMode, foregroundApp: string): boolean {
  if (mode === 'always') return true;
  return mode === 'browsers' && BROWSERS.has(foregroundApp.toLowerCase().replace(/\.exe$/, ''));
}

export interface Box { left: number; top: number; right: number; bottom: number }

/**
 * Whether a window lies under the closed island. The window and its monitor are in one unit (Windows'),
 * the island's pill and its display in another (Electron's), so each pair is compared as a share of its screen.
 */
export function windowUnder(win: Box, monitor: Box, pill: Box, display: Box): boolean {
  const mw = monitor.right - monitor.left;
  const mh = monitor.bottom - monitor.top;
  const dw = display.right - display.left;
  const dh = display.bottom - display.top;
  if (![mw, mh, dw, dh].every((n) => Number.isFinite(n) && n > 0)) return false;
  const w = { left: (win.left - monitor.left) / mw, right: (win.right - monitor.left) / mw, top: (win.top - monitor.top) / mh, bottom: (win.bottom - monitor.top) / mh };
  const p = { left: (pill.left - display.left) / dw, right: (pill.right - display.left) / dw, top: (pill.top - display.top) / dh, bottom: (pill.bottom - display.top) / dh };
  if (![w.left, w.right, w.top, w.bottom, p.left, p.right, p.top, p.bottom].every(Number.isFinite)) return false;
  return w.left < p.right && w.right > p.left && w.top < p.bottom && w.bottom > p.top;
}

const PRIORITY: Record<Mood, number> = { waiting: 3, working: 2, done: 1, idle: 0 };

/** The most urgent of several moods (waiting > working > done > idle). */
export function strongestMood(...moods: Mood[]): Mood {
  return moods.reduce((a, b) => (PRIORITY[b] > PRIORITY[a] ? b : a), 'idle' as Mood);
}

/** An app watch counts as "working" while active and "done" for two minutes after it fires. */
export function watchMood(active: boolean, doneAt: number, now: number): Mood {
  if (active) return 'working';
  return doneAt && now - doneAt < 2 * 60_000 ? 'done' : 'idle';
}
