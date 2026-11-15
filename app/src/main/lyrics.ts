// Synced lyrics from LRCLIB (https://lrclib.net), a free public lyrics API.
// Only used when the user turns lyrics on in settings.
import type { LyricLine, LyricsState } from '../shared/types';
export { lineAt } from '../shared/playback';

const API = 'https://lrclib.net/api/get';

/** Parses LRC text ("[01:23.45] line") into sorted lines. Lines with several stamps are repeated. */
export function parseLrc(text: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const stamps: number[] = [];
    let rest = raw;
    let m: RegExpExecArray | null;
    const re = /^\s*\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
    while ((m = re.exec(rest))) {
      const frac = m[3] ? Number(m[3].padEnd(3, '0')) : 0;
      stamps.push(Number(m[1]) * 60_000 + Number(m[2]) * 1000 + frac);
      rest = rest.slice(m[0].length);
    }
    const line = rest.trim();
    for (const timeMs of stamps) out.push({ timeMs, text: line });
  }
  return out.sort((a, b) => a.timeMs - b.timeMs);
}

type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export async function fetchLyrics(
  track: { title: string; artist: string; album: string; durationMs: number },
  trackKey: string,
  { fetchImpl = fetch as unknown as FetchLike, userAgent = 'Helo', signal }: { fetchImpl?: FetchLike; userAgent?: string; signal?: AbortSignal } = {},
): Promise<LyricsState> {
  const base = { trackKey, lines: [] as LyricLine[], plain: '' };
  if (!track.title || !track.artist) return { ...base, status: 'none' };
  const q = new URLSearchParams({ track_name: track.title, artist_name: track.artist });
  if (track.album) q.set('album_name', track.album);
  if (track.durationMs > 0) q.set('duration', String(Math.round(track.durationMs / 1000)));
  let res = await fetchImpl(`${API}?${q}`, { headers: { 'User-Agent': userAgent }, signal });
  if (res.status === 404 && (track.album || track.durationMs > 0)) {
    // The exact match needs album and duration to agree; retry with title and artist only.
    const loose = new URLSearchParams({ track_name: track.title, artist_name: track.artist });
    res = await fetchImpl(`${API}?${loose}`, { headers: { 'User-Agent': userAgent }, signal });
  }
  if (res.status === 404) return { ...base, status: 'none' };
  if (!res.ok) return { ...base, status: 'error' };
  const json = (await res.json()) as Record<string, unknown>;
  if (typeof json.syncedLyrics === 'string' && json.syncedLyrics.trim()) {
    const lines = parseLrc(json.syncedLyrics).slice(0, 2000);
    if (lines.length) return { ...base, status: 'synced', lines };
  }
  if (typeof json.plainLyrics === 'string' && json.plainLyrics.trim()) {
    return { ...base, status: 'plain', plain: json.plainLyrics.slice(0, 20_000) };
  }
  return { ...base, status: 'none' };
}
