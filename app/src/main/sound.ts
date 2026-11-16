// The sound that plays when an agent needs the user (a card, or "needs your answer").
// Deciding whether to play is here; the notes themselves are made in the island's page.
// No Electron imports.
import type { Settings } from '../shared/types';

/** Two alerts closer together than this make one sound. */
export const CHIME_GAP_MS = 1500;

export interface ChimeCheck {
  sound: Settings['sound'];
  /** A game or a fullscreen video covers the island's screen. */
  fullscreen: boolean;
  /** When the last sound played (0: never). */
  lastAt: number;
  now: number;
}

export function shouldChime({ sound, fullscreen, lastAt, now }: ChimeCheck): boolean {
  if (!sound.on || sound.volume <= 0) return false;
  if (fullscreen && !sound.fullscreen) return false;
  return now - lastAt >= CHIME_GAP_MS;
}
