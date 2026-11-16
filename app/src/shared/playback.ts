// Playback helpers shared by the main process and the island.
import type { IslandState, LyricLine, MediaState, RepeatMode } from './types';

/** What the repeat button changes to: off, the whole list, the one track, off again. */
export function nextRepeat(mode: RepeatMode): RepeatMode {
  return mode === 'None' ? 'List' : mode === 'List' ? 'Track' : 'None';
}

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

/**
 * What the closed island shows beside the bars while music plays: the lyric line being sung
 * when synced lyrics are on, otherwise the title. '' when it shows nothing (music off or
 * paused, the user switched it off, or the timer's countdown has the space).
 */
export function idleSong(s: Pick<IslandState, 'settings' | 'media' | 'lyrics' | 'timer'>, now: number): string {
  const m = s.media;
  const f = s.settings.features;
  if (!f.media || !s.settings.display.title || !m || m.status !== 'Playing') return '';
  if (f.timer && s.timer.running && s.timer.endsAt != null) return '';
  if (f.lyrics && s.lyrics?.status === 'synced') {
    const i = lineAt(s.lyrics.lines, livePosition(m, now));
    const text = i >= 0 ? s.lyrics.lines[i].text.trim() : '';
    if (text) return text;
  }
  return m.title.trim();
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

