// helo:// links, so a script or a shortcut can ask the island for something:
//
//   helo://banner?title=Build%20done&text=All%20tests%20pass
//   helo://timer/start            (also pause, reset, skip; start takes ?minutes=1..180)
//   helo://awake/on               (also off, toggle)
//   helo://shelf/add?path=C:\Users\me\report.pdf
//   helo://open/clipboard         (any tab of the panel)
//
// A link can come from anywhere, a web page included, so it can do these five things and
// nothing else. Nothing here touches the disk or the network: a path is only looked at after
// the user has seen it and clicked. No Electron imports.
import { APP_NAME } from '../shared/brand';
import type { PanelTab } from '../shared/types';

export const LINK_SCHEME = APP_NAME.toLowerCase();

export type LinkAction =
  | { kind: 'banner'; title: string; text: string }
  | { kind: 'timer'; action: 'start' | 'pause' | 'reset' | 'skip'; minutes?: number }
  | { kind: 'awake'; on: boolean | 'toggle' }
  | { kind: 'shelf'; path: string }
  | { kind: 'open'; tab: PanelTab };

const TABS: Record<string, PanelTab> = {
  home: 'media', media: 'media', music: 'media', agents: 'agents', map: 'map', timer: 'timer', clipboard: 'clipboard',
  notes: 'notes', shelf: 'shelf', system: 'system', calendar: 'calendar', finished: 'finished',
};

export const MAX_LINK = 2000;
export const MAX_LINK_PATH = 400;

/** One line of plain text: no control characters, no runs of spaces, at most `max` characters. */
function line(v: string | null, max: number): string {
  // eslint-disable-next-line no-control-regex
  const s = (v ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * A file on a drive of this PC: "C:\folder\file.txt". Network paths (\\server\share) are refused,
 * because merely looking at one makes Windows sign in to that server.
 */
export function isLocalPath(p: string): boolean {
  // eslint-disable-next-line no-control-regex
  return p.length <= MAX_LINK_PATH && /^[A-Za-z]:[\\/][^\u0000-\u001f<>"|?*]*$/.test(p) && !p.slice(2).includes(':');
}

/** What a link asks for, or null when it is not one of the five things a link may do. */
export function parseLink(raw: unknown): LinkAction | null {
  if (typeof raw !== 'string' || raw.length > MAX_LINK) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== `${LINK_SCHEME}:` || url.username || url.password || url.port) return null;
  const what = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean).map((p) => p.toLowerCase());
  if (parts.length > 1) return null;
  const arg = parts[0] ?? '';
  const q = url.searchParams;
  switch (what) {
    case 'banner': {
      if (arg) return null;
      const title = line(q.get('title'), 60);
      const text = line(q.get('text'), 140);
      if (!title && !text) return null;
      return { kind: 'banner', title: title || 'Message', text };
    }
    case 'timer': {
      if (arg !== 'start' && arg !== 'pause' && arg !== 'reset' && arg !== 'skip') return null;
      if (arg !== 'start' || !q.has('minutes')) return { kind: 'timer', action: arg };
      const minutes = Number(q.get('minutes'));
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) return null;
      return { kind: 'timer', action: 'start', minutes };
    }
    case 'awake':
      if (arg === 'on' || arg === 'off') return { kind: 'awake', on: arg === 'on' };
      return arg === 'toggle' ? { kind: 'awake', on: 'toggle' } : null;
    case 'shelf': {
      const path = q.get('path') ?? '';
      return arg === 'add' && isLocalPath(path) ? { kind: 'shelf', path } : null;
    }
    case 'open':
      return Object.hasOwn(TABS, arg) ? { kind: 'open', tab: TABS[arg] } : null;
    default:
      return null;
  }
}

/** The link in a command line (Windows starts the app with it as an argument), or null. */
export function findLink(argv: readonly unknown[]): string | null {
  for (let i = argv.length - 1; i >= 0; i--) {
    const a = argv[i];
    if (typeof a === 'string' && a.toLowerCase().startsWith(`${LINK_SCHEME}://`)) return a;
  }
  return null;
}

/** A path short enough for a banner, with its start and its end both still readable. */
export function shownPath(p: string, max = 84): string {
  return p.length <= max ? p : `${p.slice(0, 24)}…${p.slice(-(max - 25))}`;
}

/** At most `max` links in any `windowMs`, so a page or a broken script cannot flood the island. */
export class LinkLimiter {
  private times: number[] = [];

  constructor(private max = 8, private windowMs = 10_000) {}

  allow(now: number): boolean {
    this.times = this.times.filter((t) => now - t < this.windowMs);
    if (this.times.length >= this.max) return false;
    this.times.push(now);
    return true;
  }
}
