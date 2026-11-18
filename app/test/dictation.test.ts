// Dictation: the key setting, and what the island shows as the helper reports listening, words and the end.
import { test, expect } from 'vitest';
import { DICTATION_VK, liveText, nextDictation, LIVE_MAX } from '../src/shared/dictation';
import { normalizeSettings, updateSettings, DEFAULT_SETTINGS } from '../src/main/settings';

test('dictation: off by default, right Ctrl by default, and only known keys are kept', () => {
  expect(DEFAULT_SETTINGS.features.dictation).toBe(false);
  expect(DEFAULT_SETTINGS.dictation.key).toBe('rctrl');
  expect(updateSettings(DEFAULT_SETTINGS, { dictation: { key: 'rshift' } }).dictation.key).toBe('rshift');
  expect(updateSettings(DEFAULT_SETTINGS, { dictation: { key: 'capslock' } }).dictation.key).toBe('rctrl');
  expect(normalizeSettings({ features: { dictation: true } }).features.dictation).toBe(true);
});

test('dictation: the keys are the right-hand Windows virtual keys', () => {
  expect(DICTATION_VK).toEqual({ rctrl: 0xa3, rshift: 0xa1, ralt: 0xa5 });
});

test('dictation: the island shows the end of what was said, cut at a word', () => {
  expect(liveText('  ship   the page ')).toBe('ship the page');
  const long = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen';
  const shown = liveText(long);
  expect(shown.length).toBeLessThanOrEqual(LIVE_MAX);
  expect(shown.startsWith('…')).toBe(true);
  expect(shown.endsWith('sixteen')).toBe(true);
  expect(shown.slice(1).split(' ').every((w) => long.split(' ').includes(w))).toBe(true);
});

test('dictation: listen, words, then typed, empty or cancelled closes it; errors show', () => {
  let s = nextDictation(null, 'listen', '');
  expect(s).toEqual({ phase: 'listening', text: '' });
  s = nextDictation(s, 'partial', 'ship the new');
  expect(s).toEqual({ phase: 'listening', text: 'ship the new' });
  expect(nextDictation(s, 'typed', 'ship the new page')).toBeNull();
  expect(nextDictation(s, 'empty', '')).toBeNull();
  expect(nextDictation(s, 'cancel', '')).toBeNull();
  // Words that arrive after it closed do not open it again.
  expect(nextDictation(null, 'partial', 'late words')).toBeNull();
  expect(nextDictation(null, 'error', 'No microphone found.')).toEqual({ phase: 'error', text: 'No microphone found.' });
  expect(nextDictation(s, 'something-else', '')).toBe(s);
});

test('dictation: Whisper is a choice, Windows the default; a recording sent to it shows "writing"', () => {
  expect(DEFAULT_SETTINGS.dictation.engine).toBe('windows');
  expect(updateSettings(DEFAULT_SETTINGS, { dictation: { engine: 'whisper' } }).dictation).toEqual({ key: 'rctrl', engine: 'whisper' });
  expect(updateSettings(DEFAULT_SETTINGS, { dictation: { engine: 'cloud' } }).dictation.engine).toBe('windows');
  const listening = nextDictation(null, 'listen', '');
  expect(nextDictation(listening, 'audio', '')).toEqual({ phase: 'writing', text: '' });
  expect(nextDictation(null, 'audio', '')).toBeNull();
});
