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
