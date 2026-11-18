// Dictation with Whisper on Groq, with the user's own API key: the helper records while the key is held and hands over
// a WAV file; this sends it to Groq's speech-to-text endpoint and returns the text. Only used when the user has chosen
// Whisper in Settings and saved a key. `fetch` is passed in so tests run without the network.

export const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
export const GROQ_MODEL = 'whisper-large-v3-turbo';
/** A recording longer than this is not sent (Groq's free tier takes files up to 25 MB; 16 kHz mono is ~1.9 MB a minute). */
export const MAX_WAV_BYTES = 24 * 1024 * 1024;

/** A Groq key as the user pasted it, or '' when it does not look like one. */
export function cleanGroqKey(raw: unknown): string {
  const key = typeof raw === 'string' ? raw.trim() : '';
  return /^[A-Za-z0-9_-]{20,200}$/.test(key) ? key : '';
}

export class GroqError extends Error {}

/** Sends a WAV recording to Groq and returns what was said, trimmed. Throws GroqError with a message for the island. */
export async function transcribe(
  wav: Uint8Array,
  key: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 30_000,
): Promise<string> {
  if (!key) throw new GroqError('Add your Groq key in Settings.');
  if (wav.byteLength > MAX_WAV_BYTES) throw new GroqError('That was too long to send in one go.');
  const form = new FormData();
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'dictation.wav');
  form.append('model', GROQ_MODEL);
  form.append('response_format', 'json');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchFn(GROQ_TRANSCRIBE_URL, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: abort.signal });
  } catch (err) {
    throw new GroqError((err as Error).name === 'AbortError' ? 'Groq did not answer in time.' : 'Could not reach Groq. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 || res.status === 403) throw new GroqError('Groq did not accept the key. Check it in Settings.');
  if (res.status === 429) throw new GroqError('Groq says the key has hit its limit. Try again in a minute.');
  if (!res.ok) throw new GroqError(`Groq could not write it out (error ${res.status}).`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new GroqError('Groq sent an answer that could not be read.');
  }
  const text = body && typeof body === 'object' && typeof (body as { text?: unknown }).text === 'string' ? (body as { text: string }).text : '';
  return text.replace(/\s+/g, ' ').trim();
}
