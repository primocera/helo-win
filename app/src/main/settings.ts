// User settings: defaults, validation of anything read from disk or sent by a
// renderer, and partial updates.
import type { FeatureFlags, Settings } from '../shared/types';
import { cleanApps } from './notifications';

export const DEFAULT_FEATURES: FeatureFlags = {
  agents: true,
  map: true,
  usage: true,
  mascot: true,
  media: true,
  lyrics: false, // sends track names to lrclib.net, so it is opt-in
  timer: true,
  clipboard: true,
  notes: true,
  shelf: true,
  keepAwake: true,
  battery: true,
  privacy: true,
  hud: true,
  displays: true,
  calendar: true,
  converter: true,
  downloads: true,
  steam: true,
  watchApp: true,
  notifications: true,
  disk: true,
};

export const DEFAULT_SETTINGS: Settings = {
  features: DEFAULT_FEATURES,
  notifications: { apps: {} },
  display: { monitor: 'primary', edge: 'top', compact: 'browsers', hideInFullscreen: true, open: 'hover', position: null, locked: false, accent: 'mint' },
  clipboard: { maxItems: 50, images: true, expireHours: 24, paused: false },
  timer: { focusMin: 25, breakMin: 5, longBreakMin: 15, longEvery: 4 },
  battery: { lowPercent: 20 },
  disk: { lowGb: 10 },
  calendar: { icsUrl: '' },
  finished: { addToShelf: true },
  shelf: { screenshots: true },
  sound: { on: true, volume: 60, fullscreen: true },
};

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Only http(s) URLs (webcal:// is rewritten to https://), at most 2000 characters. */
export function cleanIcsUrl(v: unknown): string {
  if (typeof v !== 'string') return '';
  let s = v.trim();
  if (!s) return '';
  if (/^webcals?:\/\//i.test(s)) s = s.replace(/^webcals?:\/\//i, 'https://');
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    return u.toString().slice(0, 2000);
  } catch {
    return '';
  }
}

/** Builds valid settings from anything, falling back to defaults field by field. */
export function normalizeSettings(raw: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const r = isObj(raw) ? raw : {};
  const f = isObj(r.features) ? r.features : {};
  const features = { ...base.features };
  for (const key of Object.keys(DEFAULT_FEATURES) as (keyof FeatureFlags)[]) {
    features[key] = bool(f[key], base.features[key]);
  }
  const d = isObj(r.display) ? r.display : {};
  const monitor = d.monitor === 'primary' || (typeof d.monitor === 'number' && Number.isFinite(d.monitor))
    ? (d.monitor as 'primary' | number)
    : base.display.monitor;
  const edge = d.edge === 'top' || d.edge === 'bottom' ? d.edge : base.display.edge;
  const compact = d.compact === 'never' || d.compact === 'browsers' || d.compact === 'always' ? d.compact : base.display.compact;
  const pos = isObj(d.position) && Number.isFinite(d.position.x) && Number.isFinite(d.position.y)
    ? { x: int(d.position.x, 0, 20000, 0), y: int(d.position.y, 0, 20000, 0) }
    : d.position === null ? null : base.display.position;
  const c = isObj(r.clipboard) ? r.clipboard : {};
  const t = isObj(r.timer) ? r.timer : {};
  const b = isObj(r.battery) ? r.battery : {};
  const dk = isObj(r.disk) ? r.disk : {};
  const cal = isObj(r.calendar) ? r.calendar : {};
  const fin = isObj(r.finished) ? r.finished : {};
  const sh = isObj(r.shelf) ? r.shelf : {};
  const snd = isObj(r.sound) ? r.sound : {};
  const notif = isObj(r.notifications) ? r.notifications : {};
  return {
    features,
    notifications: { apps: cleanApps(notif.apps, base.notifications.apps) },
    display: { monitor, edge, compact, hideInFullscreen: bool(d.hideInFullscreen, base.display.hideInFullscreen), open: d.open === 'click' || d.open === 'hover' ? d.open : base.display.open, position: pos, locked: bool(d.locked, base.display.locked), accent: d.accent === 'mint' || d.accent === 'rose' ? d.accent : base.display.accent },
    clipboard: { maxItems: int(c.maxItems, 5, 200, base.clipboard.maxItems), images: bool(c.images, base.clipboard.images), expireHours: int(c.expireHours, 0, 720, base.clipboard.expireHours), paused: bool(c.paused, base.clipboard.paused) },
    timer: {
      focusMin: int(t.focusMin, 1, 180, base.timer.focusMin),
      breakMin: int(t.breakMin, 1, 60, base.timer.breakMin),
      longBreakMin: int(t.longBreakMin, 1, 120, base.timer.longBreakMin),
      longEvery: int(t.longEvery, 0, 12, base.timer.longEvery),
    },
    battery: { lowPercent: int(b.lowPercent, 5, 50, base.battery.lowPercent) },
    disk: { lowGb: int(dk.lowGb, 1, 500, base.disk.lowGb) },
    calendar: { icsUrl: 'icsUrl' in cal ? cleanIcsUrl(cal.icsUrl) : base.calendar.icsUrl },
    finished: { addToShelf: bool(fin.addToShelf, base.finished.addToShelf) },
    shelf: { screenshots: bool(sh.screenshots, base.shelf.screenshots) },
    sound: { on: bool(snd.on, base.sound.on), volume: int(snd.volume, 0, 100, base.sound.volume), fullscreen: bool(snd.fullscreen, base.sound.fullscreen) },
  };
}

/** Applies a partial update (same shape as Settings, any subset) on top of current settings. */
export function updateSettings(current: Settings, patch: unknown): Settings {
  if (!isObj(patch)) return current;
  const merged: Record<string, unknown> = { ...current };
  for (const key of Object.keys(current) as (keyof Settings)[]) {
    const p = patch[key];
    if (isObj(p)) merged[key] = { ...(current[key] as object), ...p };
  }
  return normalizeSettings(merged, current);
}
