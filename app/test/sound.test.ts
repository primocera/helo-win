// The sound when an agent needs you: when it plays, and its settings.
import { test, expect } from 'vitest';
import { shouldChime, CHIME_GAP_MS } from '../src/main/sound';
import { normalizeSettings, updateSettings, DEFAULT_SETTINGS } from '../src/main/settings';

const sound = { on: true, volume: 60, fullscreen: true };

test('sound: plays when switched on, and not more than once per gap', () => {
  expect(shouldChime({ sound, fullscreen: false, lastAt: 0, now: 10_000 })).toBe(true);
  expect(shouldChime({ sound, fullscreen: false, lastAt: 10_000, now: 10_000 + CHIME_GAP_MS - 1 })).toBe(false);
  expect(shouldChime({ sound, fullscreen: false, lastAt: 10_000, now: 10_000 + CHIME_GAP_MS })).toBe(true);
});

test('sound: silent when switched off or at volume 0', () => {
  expect(shouldChime({ sound: { ...sound, on: false }, fullscreen: false, lastAt: 0, now: 10_000 })).toBe(false);
  expect(shouldChime({ sound: { ...sound, volume: 0 }, fullscreen: false, lastAt: 0, now: 10_000 })).toBe(false);
});

test('sound: in fullscreen only when the user allows it', () => {
  expect(shouldChime({ sound, fullscreen: true, lastAt: 0, now: 10_000 })).toBe(true);
  expect(shouldChime({ sound: { ...sound, fullscreen: false }, fullscreen: true, lastAt: 0, now: 10_000 })).toBe(false);
  expect(shouldChime({ sound: { ...sound, fullscreen: false }, fullscreen: false, lastAt: 0, now: 10_000 })).toBe(true);
});

test('sound settings: defaults, limits and partial updates', () => {
  expect(DEFAULT_SETTINGS.sound).toEqual({ on: true, volume: 60, fullscreen: true });
  expect(normalizeSettings({}).sound).toEqual(DEFAULT_SETTINGS.sound);
  expect(normalizeSettings({ sound: { on: 'yes', volume: 400, fullscreen: false } }).sound).toEqual({ on: true, volume: 100, fullscreen: false });
  expect(normalizeSettings({ sound: { volume: -5 } }).sound.volume).toBe(0);
  const s = updateSettings(DEFAULT_SETTINGS, { sound: { on: false } });
  expect(s.sound).toEqual({ on: false, volume: 60, fullscreen: true });
});
