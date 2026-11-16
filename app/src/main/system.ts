// Turns raw helper events (power, privacy, media) into app state, and decides
// when a battery or microphone change deserves a banner. No Electron imports.
import type { Banner, MediaState, PowerState, PrivacyState } from '../shared/types';
export { livePosition } from '../shared/playback';

// ---- Battery ----------------------------------------------------------------

/** From GetSystemPowerStatus: ac 0/1/255, flag bits (8 charging, 128 no battery), percent 0-100 or 255. */
export function powerFromRaw(raw: { ac?: unknown; flag?: unknown; percent?: unknown }): PowerState {
  const flag = typeof raw.flag === 'number' ? raw.flag : 255;
  const pct = typeof raw.percent === 'number' && raw.percent >= 0 && raw.percent <= 100 ? raw.percent : null;
  const hasBattery = flag !== 255 && (flag & 128) === 0 && pct !== null;
  return {
    hasBattery,
    percent: hasBattery ? pct : null,
    pluggedIn: raw.ac === 1,
    charging: hasBattery && (flag & 8) !== 0,
  };
}

/**
 * Compares two power readings and returns a banner for: plugged in, unplugged,
 * fully charged, and dropping to/below the low (and 10%) thresholds.
 */
export function batteryBanner(prev: PowerState | null, next: PowerState, lowPercent: number): Banner | null {
  if (!next.hasBattery || next.percent == null) return null;
  const pct = next.percent;
  if (!prev || !prev.hasBattery || prev.percent == null) {
    return !next.pluggedIn && pct <= lowPercent
      ? { kind: 'battery', title: `Battery low: ${pct}%`, text: 'Plug in your charger.' }
      : null;
  }
  if (next.pluggedIn && !prev.pluggedIn) {
    return { kind: 'battery', title: pct >= 100 ? 'Plugged in · full' : `Charging · ${pct}%`, text: 'Power adapter connected.' };
  }
  if (!next.pluggedIn && prev.pluggedIn) {
    return { kind: 'battery', title: `On battery · ${pct}%`, text: 'Power adapter disconnected.' };
  }
  if (next.pluggedIn && pct >= 100 && prev.percent < 100) {
    return { kind: 'battery', title: 'Battery full', text: 'You can unplug the charger.' };
  }
  if (!next.pluggedIn) {
    const crossed = (limit: number) => prev.percent! > limit && pct <= limit;
    if (crossed(10)) return { kind: 'warn', title: `Battery critical: ${pct}%`, text: 'Plug in now to keep working.' };
    if (crossed(lowPercent)) return { kind: 'battery', title: `Battery low: ${pct}%`, text: 'Plug in your charger.' };
  }
  return null;
}

// ---- Microphone / camera ----------------------------------------------------

/**
 * Registry key names from CapabilityAccessManager\ConsentStore to readable app names.
 *   "C:#Program Files#Zoom#bin#Zoom.exe"         -> "Zoom"
 *   "Microsoft.WindowsSoundRecorder_8wekyb3d8bbwe" -> "Windows Sound Recorder"
 */
export function appNameFromConsentKey(key: string): string {
  if (key.includes('#')) {
    const file = key.split('#').pop() || key;
    return file.replace(/\.exe$/i, '');
  }
  let name = key.replace(/_[a-z0-9]{13}$/i, ''); // package family suffix
  name = name.split('.').pop() || name;
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^Windows /, 'Windows ');
}

export function privacyFromRaw(raw: { microphone?: unknown; camera?: unknown }, selfNames: string[] = []): PrivacyState {
  const names = (v: unknown) => {
    const list = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    const out = list.map(appNameFromConsentKey).filter((n) => n && !selfNames.includes(n.toLowerCase()));
    return [...new Set(out)].slice(0, 5);
  };
  return { microphone: names(raw.microphone), camera: names(raw.camera) };
}

export function privacyBanner(prev: PrivacyState, next: PrivacyState): Banner | null {
  const started = (a: string[], b: string[]) => b.filter((x) => !a.includes(x));
  const mic = started(prev.microphone, next.microphone);
  const cam = started(prev.camera, next.camera);
  if (cam.length) return { kind: 'privacy', title: 'Camera on', text: cam.join(', ') };
  if (mic.length) return { kind: 'privacy', title: 'Microphone on', text: mic.join(', ') };
  return null;
}

// ---- Media ------------------------------------------------------------------

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function mediaFromRaw(raw: unknown, art: string | null): MediaState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    app: str(r.app, 200),
    title: str(r.title),
    artist: str(r.artist),
    album: str(r.album),
    status: str(r.status, 20),
    canPlay: r.canPlay === true,
    canPause: r.canPause === true,
    canNext: r.canNext === true,
    canPrevious: r.canPrevious === true,
    canSeek: r.canSeek === true,
    canShuffle: r.canShuffle === true,
    canRepeat: r.canRepeat === true,
    shuffle: r.shuffle === true,
    repeat: r.repeat === 'List' || r.repeat === 'Track' ? r.repeat : 'None',
    positionMs: num(r.positionMs),
    startMs: num(r.startMs),
    endMs: num(r.endMs),
    updatedAt: num(r.updatedAt),
    art,
  };
}

/** Friendly name for the app that owns the media session ("Spotify.exe" -> "Spotify"). */
export function mediaAppName(app: string): string {
  if (!app) return '';
  const known: Record<string, string> = { 'msedge.exe': 'Edge', 'chrome.exe': 'Chrome', 'firefox.exe': 'Firefox', 'spotify.exe': 'Spotify' };
  const lower = app.toLowerCase();
  if (known[lower]) return known[lower];
  if (lower.startsWith('spotifyab.spotifymusic')) return 'Spotify';
  if (lower.includes('zunemusic')) return 'Media Player';
  const base = app.split('!')[0].split('\\').pop() || app;
  return base.replace(/\.exe$/i, '').replace(/_[a-z0-9]{13}$/i, '').split('.').pop() || base;
}

export function mediaTrackKey(m: Pick<MediaState, 'title' | 'artist' | 'album'> | null): string {
  return m ? `${m.artist}\u0000${m.title}\u0000${m.album}` : '';
}

// ---------------------------------------------------------------------------
// Disk space

const GB = 1024 ** 3;

export interface DiskWarnState {
  /** A warning for the current shortage has been shown. */
  warned: boolean;
  at: number;
}

/**
 * Whether to warn now. Once per shortage: again only after the drive was back above the limit
 * (by 1 GB, so a drive hovering at the limit does not nag), or after a day of still being low.
 */
export function diskWarning(prev: DiskWarnState, freeBytes: number, lowGb: number, now: number): { warn: boolean; state: DiskWarnState } {
  if (!Number.isFinite(freeBytes) || freeBytes < 0) return { warn: false, state: prev };
  if (freeBytes >= (lowGb + 1) * GB) return { warn: false, state: { warned: false, at: prev.at } };
  if (freeBytes >= lowGb * GB) return { warn: false, state: prev };
  if (prev.warned && now - prev.at < 24 * 3_600_000) return { warn: false, state: prev };
  return { warn: true, state: { warned: true, at: now } };
}

export function diskBanner(drive: string, freeBytes: number): Banner {
  const gb = freeBytes / GB;
  return { kind: 'warn', title: 'Disk space is low', text: `${drive} has ${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB free. Click to see what is using it.` };
}
