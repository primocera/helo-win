// Playback helpers shared by the main process and the island.
import type { LyricLine, MediaState } from './types';

/**
 * Where playback is now. Sources only report position now and then, so while
 * playing we add the time since the source's last update. Clamped to the track.
 */
export function livePosition(m: Pick<MediaState, 'status' | 'positionMs' | 'startMs' | 'endMs' | 'updatedAt'>, now: number): number {
  let pos = m.positionMs;
  if (m.status === 'Playing' && m.updatedAt > 0) pos += Math.max(0, now - m.updatedAt);
  const end = m.endMs > m.startMs ? m.endMs : Number.POSITIVE_INFINITY;
  return Math.max(m.startMs, Math.min(end, pos));
}

/** Index of the line being sung at `positionMs`, or -1 before the first line. */
export function lineAt(lines: LyricLine[], positionMs: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].timeMs <= positionMs) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

