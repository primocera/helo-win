// The license file and the calls to the store (S10, S11).
import { test, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLicense } from '../src/main/license';

const DAY = 86_400_000;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'helo-test-'));

/** A stand-in for Windows data protection: reversible, and plainly not the original bytes. */
const codec = {
  seal: (data: Buffer) => Buffer.concat([Buffer.from('SEALED:'), Buffer.from(data.toString('base64'))]),
  open: (data: Buffer) => {
    if (!data.subarray(0, 7).equals(Buffer.from('SEALED:'))) throw new Error('not sealed');
    return Buffer.from(data.subarray(7).toString(), 'base64');
  },
};

const answers = (response: unknown) => async () => ({ json: async () => response });
const activated = { activated: true, instance: { id: 'inst-1' }, meta: {} };

test('with encryption the key is not readable on disk, and the license survives a restart', async () => {
  const dir = tmp();
  const file = path.join(dir, 'license.json');
  const license = createLicense({ file, codec, fetchImpl: answers(activated) });
  await license.activate('KEY-SECRET-123');
  expect(fs.readdirSync(dir)).toEqual(['license.bin']);
  expect(fs.readFileSync(path.join(dir, 'license.bin')).includes('KEY-SECRET-123')).toBe(false);
  expect(createLicense({ file, codec }).status()).toEqual({ state: 'licensed' });
});

test('a plain license file from an older version is encrypted, and the trial keeps its start date', () => {
  const dir = tmp();
  const file = path.join(dir, 'license.json');
  const start = 1_000 * DAY;
  fs.writeFileSync(file, JSON.stringify({ firstRunAt: start }));
  const license = createLicense({ file, codec, trialDays: 7, now: () => start + 3 * DAY });
  expect(license.status()).toEqual({ state: 'trial', daysLeft: 4 });
  expect(fs.readdirSync(dir)).toEqual(['license.bin']);
  expect(createLicense({ file, codec, trialDays: 7, now: () => start + 8 * DAY }).status()).toEqual({ state: 'expired' });
});

test('writing a plain file beside the encrypted one changes nothing', () => {
  const dir = tmp();
  const file = path.join(dir, 'license.json');
  const start = 1_000 * DAY;
  createLicense({ file, codec, trialDays: 7, now: () => start });
  // Someone drops in a file claiming a license.
  fs.writeFileSync(file, JSON.stringify({ firstRunAt: start, key: 'FAKE', instanceId: 'x', validatedAt: start }));
  expect(createLicense({ file, codec, trialDays: 7, now: () => start + DAY }).status()).toEqual({ state: 'trial', daysLeft: 6 });
});

test('dates in the future do not extend the trial or skip the check with the store', async () => {
  const dir = tmp();
  const file = path.join(dir, 'license.json');
  const now = 1_000 * DAY;
  fs.writeFileSync(file, JSON.stringify({ firstRunAt: now + 365 * DAY }));
  expect(createLicense({ file, trialDays: 7, now: () => now }).status()).toEqual({ state: 'trial', daysLeft: 7 });

  fs.writeFileSync(file, JSON.stringify({ firstRunAt: now - 30 * DAY, key: 'K', instanceId: 'i', validatedAt: now + 3650 * DAY }));
  let asked = 0;
  const license = createLicense({ file, now: () => now, fetchImpl: async () => { asked++; return { json: async () => ({ valid: false }) }; } });
  await license.revalidate();
  expect(asked).toBe(1);
  expect(license.status()).toEqual({ state: 'expired' });
});

test('a file that is not a license starts a fresh trial instead of throwing', () => {
  const dir = tmp();
  const file = path.join(dir, 'license.json');
  fs.writeFileSync(file, '[1,2,3]');
  expect(createLicense({ file, trialDays: 7 }).status()).toEqual({ state: 'trial', daysLeft: 7 });
  fs.writeFileSync(path.join(dir, 'license.bin'), 'garbage');
  expect(createLicense({ file, codec, trialDays: 7 }).status().state).toBe('trial');
});

test('a store that never answers: the call gives up with a sentence the user can act on', async () => {
  const file = path.join(tmp(), 'license.json');
  const hang = (_url: string, init: { signal?: AbortSignal }) => new Promise<never>((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
  });
  const license = createLicense({ file, fetchImpl: hang, timeoutMs: 50 });
  const started = Date.now();
  await expect(license.activate('KEY')).rejects.toThrow(/did not answer in time/);
  expect(Date.now() - started).toBeLessThan(3000);
  expect(license.status().state).toBe('trial');
});

test('an error page or no connection is explained, not shown as a parser error', async () => {
  const file = path.join(tmp(), 'license.json');
  const html = async () => ({ json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); } });
  await expect(createLicense({ file, fetchImpl: html }).activate('KEY')).rejects.toThrow(/could not be read/);
  const offline = async () => { throw new TypeError('fetch failed'); };
  await expect(createLicense({ file, fetchImpl: offline }).activate('KEY')).rejects.toThrow(/Could not reach the license server/);
  await expect(createLicense({ file, fetchImpl: answers(null) }).activate('KEY')).rejects.toThrow(/could not be read/);
  // The store's own message still comes through.
  await expect(createLicense({ file, fetchImpl: answers({ activated: false, error: 'This license key has reached the activation limit.' }) }).activate('KEY'))
    .rejects.toThrow(/activation limit/);
});

test('saving leaves no temp file behind', async () => {
  const dir = tmp();
  const license = createLicense({ file: path.join(dir, 'license.json'), fetchImpl: answers(activated) });
  await license.activate('KEY');
  expect(fs.readdirSync(dir)).toEqual(['license.json']);
  expect(JSON.parse(fs.readFileSync(path.join(dir, 'license.json'), 'utf8')).key).toBe('KEY');
});
