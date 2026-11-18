// Dictation with Whisper on Groq: what is sent, and how answers and failures come back.
import { test, expect } from 'vitest';
import { transcribe, cleanGroqKey, GROQ_TRANSCRIBE_URL, GROQ_MODEL, MAX_WAV_BYTES, GroqError } from '../src/main/groq';

const wav = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0]);
const ok = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

test('groq: a key looks like a key', () => {
  expect(cleanGroqKey('  gsk_abcdefghijklmnopqrstuvwxyz0123  ')).toBe('gsk_abcdefghijklmnopqrstuvwxyz0123');
  expect(cleanGroqKey('short')).toBe('');
  expect(cleanGroqKey('has spaces in it and is long enough')).toBe('');
  expect(cleanGroqKey(42)).toBe('');
});

test('groq: sends the recording with the key and the Whisper model, and returns the text', async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const fetchFn = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ text: '  Pošlji film   ekipi. ' }), { status: 200 });
  }) as unknown as typeof fetch;
  expect(await transcribe(wav, 'gsk_key', fetchFn)).toBe('Pošlji film ekipi.');
  expect(seen!.url).toBe(GROQ_TRANSCRIBE_URL);
  expect((seen!.init.headers as Record<string, string>).Authorization).toBe('Bearer gsk_key');
  const form = seen!.init.body as FormData;
  expect(form.get('model')).toBe(GROQ_MODEL);
  expect(form.get('file')).toBeInstanceOf(Blob);
});

test('groq: failures become plain messages', async () => {
  await expect(transcribe(wav, '', ok({ text: 'x' }) as unknown as typeof fetch)).rejects.toThrow('Add your Groq key');
  await expect(transcribe(wav, 'k', ok({}, 401) as unknown as typeof fetch)).rejects.toThrow('did not accept the key');
  await expect(transcribe(wav, 'k', ok({}, 429) as unknown as typeof fetch)).rejects.toThrow('limit');
  await expect(transcribe(wav, 'k', ok({}, 500) as unknown as typeof fetch)).rejects.toThrow('error 500');
  const offline = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
  await expect(transcribe(wav, 'k', offline)).rejects.toThrow('Could not reach Groq');
  await expect(transcribe(new Uint8Array(MAX_WAV_BYTES + 1), 'k', ok({ text: 'x' }) as unknown as typeof fetch)).rejects.toBeInstanceOf(GroqError);
  expect(await transcribe(wav, 'k', ok({ nothing: true }) as unknown as typeof fetch)).toBe('');
});
