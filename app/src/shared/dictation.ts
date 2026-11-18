// Dictation: which key to hold, and how the helper's events change what the island shows. Pure, so it is tested.
import type { DictationKey, DictationState } from './types';

/** Windows virtual-key codes for the keys that can be held to dictate. */
export const DICTATION_VK: Record<DictationKey, number> = { rctrl: 0xa3, rshift: 0xa1, ralt: 0xa5 };

/** What each key is called in Settings and on the site. */
export const DICTATION_KEY_NAMES: Record<DictationKey, string> = { rctrl: 'Right Ctrl', rshift: 'Right Shift', ralt: 'Right Alt' };

/** The most of the words so far that the island shows: the end of them, where the speaker is. */
export const LIVE_MAX = 50;

/** The end of `text`, at most `max` characters, starting at a word, with "…" in front when cut. */
export function liveText(text: string, max = LIVE_MAX): string {
  const one = text.replace(/\s+/g, ' ').trim();
  if (one.length <= max) return one;
  const tail = one.slice(one.length - (max - 1));
  const space = tail.indexOf(' ');
  return `…${space >= 0 && space < 16 ? tail.slice(space + 1) : tail}`;
}

/**
 * The island's dictation state after one helper event ("listen", "partial", "audio", "typed", "empty", "cancel",
 * "error").
 * Unknown kinds leave it as it is.
 */
export function nextDictation(current: DictationState | null, kind: string, text: string): DictationState | null {
  switch (kind) {
    case 'listen':
      return { phase: 'listening', text: '' };
    case 'audio':
      // The recording is on its way to Whisper.
      return current?.phase === 'listening' ? { phase: 'writing', text: '' } : current;
    case 'partial':
      return current?.phase === 'listening' ? { phase: 'listening', text: liveText(text) } : current;
    case 'typed':
    case 'empty':
    case 'cancel':
      return null;
    case 'error':
      return { phase: 'error', text: text.slice(0, 200) || 'Dictation stopped.' };
    default:
      return current;
  }
}
