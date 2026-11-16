// Shuffle and repeat, and the song shown in the closed island.
import { test, expect } from 'vitest';
import { nextRepeat, idleSong } from '../src/shared/playback';
import { mediaFromRaw } from '../src/main/system';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/main/settings';
import { initialTimer } from '../src/main/timer';
import type { LyricsState, MediaState, Settings } from '../src/shared/types';

test('repeat: off, the list, the track, off again', () => {
  expect(nextRepeat('None')).toBe('List');
  expect(nextRepeat('List')).toBe('Track');
  expect(nextRepeat('Track')).toBe('None');
});

test('media: shuffle and repeat are read from the helper, and anything odd means off', () => {
  const m = mediaFromRaw({ title: 'Song', canShuffle: true, canRepeat: true, shuffle: true, repeat: 'Track' }, null)!;
  expect(m).toMatchObject({ canShuffle: true, canRepeat: true, shuffle: true, repeat: 'Track' });
  const odd = mediaFromRaw({ title: 'Song', canShuffle: 'yes', shuffle: 1, repeat: 'Forever' }, null)!;
  expect(odd).toMatchObject({ canShuffle: false, canRepeat: false, shuffle: false, repeat: 'None' });
  // Windows reports no repeat mode at all for apps that have none.
  expect(mediaFromRaw({ title: 'Song', repeat: '' }, null)!.repeat).toBe('None');
});

const playing = mediaFromRaw({ title: ' Night Drive ', artist: 'Band', status: 'Playing', positionMs: 72_000, startMs: 0, endMs: 200_000, updatedAt: 1000 }, null) as MediaState;
const lyrics: LyricsState = { trackKey: 'x', status: 'synced', plain: '', lines: [{ timeMs: 60_000, text: 'First line' }, { timeMs: 70_000, text: 'Second line' }, { timeMs: 90_000, text: '' }] };
const base = { settings: DEFAULT_SETTINGS, media: playing, lyrics: null as LyricsState | null, timer: initialTimer() };
const withFeatures = (features: Partial<Settings['features']>, display: Partial<Settings['display']> = {}): Settings => ({ ...DEFAULT_SETTINGS, features: { ...DEFAULT_SETTINGS.features, ...features }, display: { ...DEFAULT_SETTINGS.display, ...display } });

test('closed island: shows the title while music plays', () => {
  expect(idleSong(base, 1000)).toBe('Night Drive');
  expect(idleSong({ ...base, media: { ...playing, status: 'Paused' } }, 1000)).toBe('');
  expect(idleSong({ ...base, media: null }, 1000)).toBe('');
});

test('closed island: nothing when switched off, or while the timer counts down', () => {
  expect(DEFAULT_SETTINGS.display.title).toBe(true);
  expect(normalizeSettings({ display: { title: false } }).display.title).toBe(false);
  expect(idleSong({ ...base, settings: withFeatures({}, { title: false }) }, 1000)).toBe('');
  expect(idleSong({ ...base, settings: withFeatures({ media: false }) }, 1000)).toBe('');
  expect(idleSong({ ...base, timer: { ...initialTimer(), running: true, endsAt: 99_000 } }, 1000)).toBe('');
  // With the timer feature off, a countdown left running takes no space.
  expect(idleSong({ ...base, settings: withFeatures({ timer: false }), timer: { ...initialTimer(), running: true, endsAt: 99_000 } }, 1000)).toBe('Night Drive');
});

test('closed island: the line being sung when synced lyrics are on', () => {
  const s = { ...base, settings: withFeatures({ lyrics: true }), lyrics };
  // Position 72 s at the time it was measured.
  expect(idleSong(s, 1000)).toBe('Second line');
  // 20 s later the line is an empty one (an instrumental break): back to the title.
  expect(idleSong(s, 21_000)).toBe('Night Drive');
  // Lyrics switched off, or not synced: the title.
  expect(idleSong({ ...s, settings: DEFAULT_SETTINGS }, 1000)).toBe('Night Drive');
  expect(idleSong({ ...s, lyrics: { ...lyrics, status: 'plain' } }, 1000)).toBe('Night Drive');
});
