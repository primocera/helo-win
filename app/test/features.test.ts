// Tests for the non-UI logic behind the island's features.
import { test, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeSettings, updateSettings, DEFAULT_SETTINGS, cleanIcsUrl } from '../src/main/settings';
import { AgentTracker, parseUsage, parseModel, freshUsage, statusLineText, DONE_FOR_MS } from '../src/main/agents';
import * as timer from '../src/main/timer';
import { ClipboardHistory, MAX_TEXT_CHARS, clipType } from '../src/main/clipboard-history';
import { powerFromRaw, batteryBanner, appNameFromConsentKey, privacyFromRaw, privacyBanner, livePosition, mediaFromRaw, mediaAppName } from '../src/main/system';
import { parseLrc, lineAt, fetchLyrics } from '../src/main/lyrics';
import { upcomingEvents } from '../src/main/calendar';
import { Shelf, convertedName } from '../src/main/shelf';
import { LineSplitter, WinHelper, parseDdcList, parseDdcValues } from '../src/main/winhelper';
import { parseBluetoothBatteries } from '../src/main/bluetooth';
import { newImages } from '../src/main/finished-watch';
import { faceFor, faceOnly, NAP_AFTER_MS } from '../src/shared/face';
import { formatClock, formatDuration, formatRemaining, relativeTime } from '../src/shared/time';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'helo-test-'));

// ---- settings ----------------------------------------------------------------

test('settings: garbage falls back to defaults field by field', () => {
  expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  const s = normalizeSettings({ features: { media: false, bogus: true }, timer: { focusMin: 9999 }, display: { edge: 'left', monitor: 'x' } });
  expect(s.features.media).toBe(false);
  expect(s.features.agents).toBe(true);
  expect('bogus' in s.features).toBe(false);
  expect(s.timer.focusMin).toBe(180);
  expect(s.display).toEqual({ monitor: 'primary', edge: 'top', compact: 'browsers', hideInFullscreen: true, open: 'hover', position: null, locked: false, accent: 'mint' });
});

test('settings: partial updates merge and are validated', () => {
  const s = updateSettings(DEFAULT_SETTINGS, { features: { lyrics: true }, clipboard: { maxItems: 2 }, display: { monitor: 7, edge: 'bottom' } });
  expect(s.features.lyrics).toBe(true);
  expect(s.features.media).toBe(true);
  expect(s.clipboard.maxItems).toBe(5);
  expect(s.display).toEqual({ monitor: 7, edge: 'bottom', compact: 'browsers', hideInFullscreen: true, open: 'hover', position: null, locked: false, accent: 'mint' });
});

test('settings: calendar URL must be http(s); webcal is rewritten', () => {
  expect(cleanIcsUrl('webcal://example.com/a.ics')).toBe('https://example.com/a.ics');
  expect(cleanIcsUrl('file:///C:/x.ics')).toBe('');
  expect(cleanIcsUrl('javascript:alert(1)')).toBe('');
  expect(cleanIcsUrl('  https://cal.example.com/x.ics ')).toBe('https://cal.example.com/x.ics');
});

// ---- agents & usage -----------------------------------------------------------

test('agents: moods follow hook events and the most urgent session wins', () => {
  let now = 0;
  const t = new AgentTracker(() => now);
  expect(t.mood()).toBe('idle');
  t.record({ hook_event_name: 'UserPromptSubmit', session_id: 'a', cwd: 'C:\\code\\shop' }, 'claude');
  expect(t.mood()).toBe('working');
  t.record({ hook_event_name: 'PermissionRequest', session_id: 'b' }, 'codex');
  expect(t.mood()).toBe('waiting');
  expect(t.list()[0]).toMatchObject({ agent: 'codex', mood: 'waiting' });
  t.record({ hook_event_name: 'Stop', session_id: 'b' }, 'codex');
  t.record({ hook_event_name: 'Stop', session_id: 'a' }, 'claude');
  expect(t.mood()).toBe('done');
  expect(t.list().find((s) => s.agent === 'claude')?.project).toBe('shop');
  now += DONE_FOR_MS + 1;
  expect(t.tick()).toBe(true);
  expect(t.mood()).toBe('idle');
  // Notifications only count when they mean "waiting for you".
  expect(t.record({ hook_event_name: 'Notification', notification_type: 'auth_success', session_id: 'a' }, 'claude')).toBe(false);
  expect(t.record({ hook_event_name: 'Notification', notification_type: 'idle_prompt', session_id: 'a' }, 'claude')).toBe(true);
  expect(t.mood()).toBe('waiting');
});

test('usage: reads the documented rate_limits object and drops reset windows', () => {
  const now = 1_700_000_000_000;
  const input = {
    model: { display_name: 'Opus' },
    context_window: { used_percentage: 8.4 },
    rate_limits: {
      five_hour: { used_percentage: 23.5, resets_at: now / 1000 + 3600 },
      seven_day: { used_percentage: 41.2, resets_at: now / 1000 - 10 },
    },
  };
  const usage = parseUsage(input, now);
  expect(usage).toEqual({ fiveHour: { usedPercent: 23.5, resetsAt: now + 3_600_000 }, sevenDay: null, updatedAt: now });
  expect(statusLineText(input, usage)).toBe('Opus · ctx 8% · 5h 24%');
  expect(parseUsage({ model: {} }, now)).toBe(null);
  expect(freshUsage(usage, now + 3_600_001)).toBe(null);
});

// ---- timer ----------------------------------------------------------------------

test('timer: start, pause, resume and automatic phase switch', () => {
  let s = timer.initialTimer(25, 5);
  s = timer.start(s, 0);
  expect(timer.remaining(s, 60_000)).toBe(24 * 60_000);
  s = timer.pause(s, 60_000);
  expect(s.running).toBe(false);
  expect(timer.remaining(s, 999_999)).toBe(24 * 60_000);
  s = timer.start(s, 100_000);
  expect(s.endsAt).toBe(100_000 + 24 * 60_000);
  const r = timer.tick(s, s.endsAt!);
  expect(r.finished).toBe('focus');
  expect(r.state).toMatchObject({ phase: 'break', running: true, completedFocus: 1, remainingMs: 5 * 60_000 });
  expect(timer.tick(r.state, r.state.endsAt! - 1).finished).toBe(null);
  expect(timer.skip(r.state)).toMatchObject({ phase: 'focus', running: false, remainingMs: 25 * 60_000 });
  expect(timer.reset(r.state)).toMatchObject({ phase: 'focus', running: false });
  expect(timer.configure(timer.initialTimer(), 50, 10).remainingMs).toBe(50 * 60_000);
});

// ---- clipboard history -------------------------------------------------------------

test('clipboard: dedupes, caps, persists and clears', () => {
  const dir = tmp();
  let now = 0;
  const h = new ClipboardHistory(dir, 3, () => ++now);
  expect(h.addText('')).toBe(false);
  expect(h.addText('x'.repeat(MAX_TEXT_CHARS + 1))).toBe(false);
  h.addText('one');
  h.addText('two');
  h.addText('one'); // moves to the top instead of duplicating
  expect(h.list().map((c) => c.text)).toEqual(['one', 'two']);
  h.addText('three');
  h.addText('four');
  expect(h.list().map((c) => c.text)).toEqual(['four', 'three', 'one']);
  const png = Buffer.from('89504e470d0a1a0a0000', 'hex');
  h.addImage(png, 'data:image/png;base64,AAAA', 'Image 1×1');
  const img = h.list()[0];
  expect(img.kind).toBe('image');
  expect(fs.readdirSync(dir).filter((f) => f.endsWith('.png')).length).toBe(1);
  expect(h.get(img.id)).toEqual({ kind: 'image', png });

  const reloaded = new ClipboardHistory(dir, 3);
  expect(reloaded.list().map((c) => c.text)).toEqual(['Image 1×1', 'four', 'three']);
  reloaded.clear();
  expect(reloaded.list()).toEqual([]);
  expect(fs.readdirSync(dir).filter((f) => f.endsWith('.png')).length).toBe(0);
});

test('clipboard: a tampered index cannot point outside the folder', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify([
    { id: 'a', kind: 'image', text: 'x', hash: 'h', at: 1, file: '..\\..\\secret.png' },
    { id: 'b', kind: 'text', text: 'ok', hash: 'h2', at: 2 },
  ]));
  expect(new ClipboardHistory(dir).list().map((c) => c.id)).toEqual(['b']);
});

// ---- battery / privacy / media -----------------------------------------------------

test('battery: readings and alerts', () => {
  expect(powerFromRaw({ ac: 1, flag: 128, percent: 255 })).toEqual({ hasBattery: false, percent: null, pluggedIn: true, charging: false });
  const on = (percent: number, plugged: boolean) => powerFromRaw({ ac: plugged ? 1 : 0, flag: plugged ? 8 : 0, percent });
  expect(batteryBanner(on(50, false), on(50, true), 20)?.title).toBe('Charging · 50%');
  expect(batteryBanner(on(50, true), on(50, false), 20)?.title).toBe('On battery · 50%');
  expect(batteryBanner(on(99, true), on(100, true), 20)?.title).toBe('Battery full');
  expect(batteryBanner(on(21, false), on(20, false), 20)?.title).toBe('Battery low: 20%');
  expect(batteryBanner(on(11, false), on(10, false), 20)?.kind).toBe('warn');
  expect(batteryBanner(on(30, false), on(29, false), 20)).toBe(null);
  expect(batteryBanner(null, on(15, false), 20)?.title).toBe('Battery low: 15%');
  expect(batteryBanner(null, powerFromRaw({ ac: 1, flag: 128, percent: 255 }), 20)).toBe(null);
});

test('privacy: registry keys become app names and new users raise a banner', () => {
  expect(appNameFromConsentKey('C:#Program Files#Zoom#bin#Zoom.exe')).toBe('Zoom');
  expect(appNameFromConsentKey('Microsoft.WindowsSoundRecorder_8wekyb3d8bbwe')).toBe('Windows Sound Recorder');
  const prev = privacyFromRaw({ microphone: [], camera: [] });
  const next = privacyFromRaw({ microphone: ['C:#Apps#Teams.exe', 'C:#Apps#Teams.exe', 'C:#x#helo.exe'], camera: [] }, ['helo']);
  expect(next.microphone).toEqual(['Teams']);
  expect(privacyBanner(prev, next)).toEqual({ kind: 'privacy', title: 'Microphone on', text: 'Teams' });
  expect(privacyBanner(next, next)).toBe(null);
});

test('media: helper data is validated and position runs on while playing', () => {
  const m = mediaFromRaw({ title: 'Song', artist: 'Band', status: 'Playing', positionMs: 10_000, startMs: 0, endMs: 200_000, updatedAt: 1000, canSeek: true, extra: '<b>' }, null)!;
  expect(m.title).toBe('Song');
  expect(m.canNext).toBe(false);
  expect(livePosition(m, 6000)).toBe(15_000);
  expect(livePosition({ ...m, status: 'Paused' }, 6000)).toBe(10_000);
  expect(livePosition(m, 10_000_000)).toBe(200_000);
  expect(mediaFromRaw(null, null)).toBe(null);
  expect(mediaAppName('Spotify.exe')).toBe('Spotify');
  expect(mediaAppName('msedge.exe')).toBe('Edge');
});

// ---- lyrics -----------------------------------------------------------------------

test('lyrics: LRC parsing and current line lookup', () => {
  const lines = parseLrc('[ar:Someone]\n[00:12.50]First line\n[00:15.2] Second\n[01:00.00][00:05.00]Chorus\nno stamp');
  expect(lines.map((l) => [l.timeMs, l.text])).toEqual([[5000, 'Chorus'], [12500, 'First line'], [15200, 'Second'], [60000, 'Chorus']]);
  expect(lineAt(lines, 0)).toBe(-1);
  expect(lineAt(lines, 13_000)).toBe(1);
  expect(lineAt(lines, 99_000)).toBe(3);
});

test('lyrics: LRCLIB lookup retries loosely and handles missing lyrics', async () => {
  const urls: string[] = [];
  const fetchImpl = async (url: string) => {
    urls.push(url);
    if (urls.length === 1) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ syncedLyrics: '[00:01.00]Hi' }) };
  };
  const r = await fetchLyrics({ title: 'T', artist: 'A', album: 'Al', durationMs: 180_000 }, 'k', { fetchImpl });
  expect(r.status).toBe('synced');
  expect(r.lines).toEqual([{ timeMs: 1000, text: 'Hi' }]);
  expect(urls[0]).toContain('duration=180');
  expect(urls[1]).not.toContain('album_name');
  const none = await fetchLyrics({ title: 'T', artist: 'A', album: '', durationMs: 0 }, 'k', { fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }) });
  expect(none.status).toBe('none');
});

// ---- calendar -----------------------------------------------------------------------

test('calendar: upcoming events include recurrences and skip past and cancelled ones', () => {
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
    'BEGIN:VEVENT', 'UID:1', 'DTSTART:20261113T090000Z', 'DTEND:20261113T093000Z', 'SUMMARY:Standup', 'RRULE:FREQ=DAILY;COUNT=5', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:2', 'DTSTART:20261110T100000Z', 'DTEND:20261110T110000Z', 'SUMMARY:Old', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:3', 'DTSTART:20261113T150000Z', 'DTEND:20261113T160000Z', 'SUMMARY:Cancelled', 'STATUS:CANCELLED', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:4', 'DTSTART;VALUE=DATE:20261114', 'DTEND;VALUE=DATE:20261115', 'SUMMARY:Holiday', 'LOCATION:Home', 'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const now = Date.parse('2026-11-13T12:00:00Z');
  const events = upcomingEvents(ics, now, 3 * 86_400_000);
  expect(events.map((e) => e.title)).toEqual(['Holiday', 'Standup', 'Standup', 'Standup']);
  expect(events.find((e) => e.title === 'Holiday')).toMatchObject({ allDay: true, location: 'Home' });
  expect(events[1].start).toBe(Date.parse('2026-11-14T09:00:00Z'));
});

// ---- shelf -----------------------------------------------------------------------------

test('shelf: keeps existing absolute paths only, persists, and names conversions', () => {
  const dir = tmp();
  const a = path.join(dir, 'a.png');
  fs.writeFileSync(a, 'x');
  const shelf = new Shelf(path.join(dir, 'shelf.json'));
  expect(shelf.add([a, a, 'relative.txt', path.join(dir, 'missing.txt'), 42])).toBe(1);
  const [item] = shelf.list();
  expect(item).toMatchObject({ name: 'a.png', size: 1, missing: false, isDirectory: false });
  expect(new Shelf(path.join(dir, 'shelf.json')).pathOf(item.id)).toBe(a);
  fs.rmSync(a);
  expect(shelf.list()[0].missing).toBe(true);
  expect(convertedName('C:\\p\\photo.png', 'webp', () => false)).toBe('C:\\p\\photo.webp');
  const taken = new Set(['C:\\p\\photo.webp', 'C:\\p\\photo (2).webp']);
  expect(convertedName('C:\\p\\photo.png', 'webp', (p) => taken.has(p))).toBe('C:\\p\\photo (3).webp');
});

// ---- helper protocol -------------------------------------------------------------------

test('helper: line splitting handles partial chunks and CRLF', () => {
  const s = new LineSplitter();
  expect(s.push('{"a":1}\r\n{"b"')).toEqual(['{"a":1}']);
  expect(s.push(':2}\n\n')).toEqual(['{"b":2}']);
});

test('helper: request/reply and events over stdio with a fake helper process', async () => {
  const dir = tmp();
  const fake = path.join(dir, 'fake.js');
  fs.writeFileSync(fake, `
    const rl = require('node:readline').createInterface({ input: process.stdin });
    console.log(JSON.stringify({ type: 'ready', pid: process.pid }));
    rl.on('line', (l) => {
      const m = JSON.parse(l);
      if (m.cmd === 'enable') { console.log(JSON.stringify({ type: 'reply', id: m.id, ok: true, result: true })); console.log(JSON.stringify({ type: 'volume', level: 42, muted: false })); }
      else if (m.cmd === 'ping') console.log(JSON.stringify({ type: 'reply', id: m.id, ok: true, result: 'pong' }));
      else console.log(JSON.stringify({ type: 'reply', id: m.id, ok: false, error: 'nope' }));
    });
    rl.on('close', () => process.exit(0));
  `);
  const helper = new WinHelper({ script: fake, command: process.execPath, args: [fake] });
  const volume = new Promise((resolve) => helper.on('message', (m) => m.type === 'volume' && resolve(m)));
  helper.setFeatures({ media: false, volume: true, privacy: false, power: false, clipboard: false, brightness: false, notifications: false });
  helper.start();
  expect(await volume).toEqual({ type: 'volume', level: 42, muted: false });
  expect(await helper.request('ping')).toBe('pong');
  await expect(helper.request('other')).rejects.toThrow('nope');
  const exited = new Promise((resolve) => helper.once('status', resolve));
  helper.stop();
  expect(await exited).toBe('off');
});

test('helper: DDC/CI list parsing', () => {
  expect(parseDdcList('0|Generic PnP Monitor|50|100\n1|ASUS|-1|-1')).toEqual([
    { index: 0, name: 'Generic PnP Monitor', brightness: 50, max: 100 },
    { index: 1, name: 'ASUS', brightness: null, max: null },
  ]);
  expect(parseDdcList('')).toEqual([]);
});

// ---- shared UI logic ---------------------------------------------------------------------

test('face: agent and UI states map to mascot faces with the right priority', () => {
  const base = { mood: 'idle' as const, hovering: false, listening: false, broken: false, idleForMs: 0 };
  expect(faceFor(base)).toBe('calm');
  expect(faceFor({ ...base, hovering: true })).toBe('happy');
  expect(faceFor({ ...base, mood: 'working' })).toBe('thinking');
  expect(faceFor({ ...base, mood: 'working', hovering: true })).toBe('thinking');
  expect(faceFor({ ...base, mood: 'waiting', listening: true })).toBe('needsYou');
  expect(faceFor({ ...base, mood: 'done' })).toBe('done');
  expect(faceFor({ ...base, idleForMs: 30 * 60_000 })).toBe('napping');
  expect(faceFor({ ...base, broken: true, mood: 'waiting' })).toBe('broken');
});

test('time formatting', () => {
  expect(formatClock(0)).toBe('0:00');
  expect(formatClock(3_725_000)).toBe('1:02:05');
  expect(formatRemaining(61_000)).toBe('1:01');
  expect(relativeTime(1000, 1000 + 20_000)).toBe('now');
  expect(relativeTime(0, 5 * 60_000)).toBe('5m');
  expect(relativeTime(0, 3 * 3_600_000)).toBe('3h');
});

test('face: app watches feed the mascot mood', async () => {
  const { strongestMood, watchMood } = await import('../src/shared/face');
  expect(watchMood(true, 0, 1000)).toBe('working');
  expect(watchMood(false, 1000, 2000)).toBe('done');
  expect(watchMood(false, 1000, 1000 + 3 * 60_000)).toBe('idle');
  expect(strongestMood('done', 'working', 'idle')).toBe('working');
  expect(strongestMood('working', 'waiting')).toBe('waiting');
});

test('agents: the model name comes from the status line input', () => {
  expect(parseModel({ model: { id: 'claude-opus-5-5', display_name: ' Opus 5.5 ' } })).toBe('Opus 5.5');
  expect(parseModel({ model: { display_name: '' } })).toBeNull();
  expect(parseModel({ model: 'Opus' })).toBeNull();
  expect(parseModel({})).toBeNull();
});

test('face: music, focus sessions and finished things change the face; agents still win', () => {
  const base = { mood: 'idle' as const, hovering: false, listening: false, broken: false, idleForMs: 0 };
  expect(faceFor({ ...base, music: true })).toBe('listening');
  expect(faceFor({ ...base, focusing: true })).toBe('thinking');
  expect(faceFor({ ...base, focusing: true, music: true })).toBe('thinking');
  expect(faceFor({ ...base, celebrating: true, music: true })).toBe('done');
  expect(faceFor({ ...base, hovering: true, music: true })).toBe('happy');
  expect(faceFor({ ...base, mood: 'waiting', music: true, celebrating: true })).toBe('needsYou');
  expect(faceFor({ ...base, idleForMs: NAP_AFTER_MS })).toBe('napping');
  expect(faceFor({ ...base, idleForMs: NAP_AFTER_MS, music: true })).toBe('listening');
});

test('face-only: on in browsers by default choice, never or always when set', () => {
  expect(faceOnly('browsers', 'msedge')).toBe(true);
  expect(faceOnly('browsers', 'Chrome.exe')).toBe(true);
  expect(faceOnly('browsers', 'Code')).toBe(false);
  expect(faceOnly('browsers', '')).toBe(false);
  expect(faceOnly('never', 'chrome')).toBe(false);
  expect(faceOnly('always', 'Code')).toBe(true);
});

test('settings: the new display options are validated', () => {
  const s = updateSettings(DEFAULT_SETTINGS, { display: { open: 'click', hideInFullscreen: false, compact: 'always' } });
  expect(s.display).toMatchObject({ open: 'click', hideInFullscreen: false, compact: 'always' });
  const bad = updateSettings(s, { display: { open: 'shake', hideInFullscreen: 'yes', compact: 7 } });
  expect(bad.display).toMatchObject({ open: 'click', hideInFullscreen: false, compact: 'always' });
  // Where the island was dragged, and the lock: kept until set again, and a screen edge can clear the place.
  const moved = updateSettings(s, { display: { position: { x: 640.4, y: 212 }, locked: true } });
  expect(moved.display).toMatchObject({ position: { x: 640, y: 212 }, locked: true });
  expect(updateSettings(moved, { display: { position: 'left', locked: 1 } }).display).toMatchObject({ position: { x: 640, y: 212 }, locked: true });
  expect(updateSettings(moved, { display: { edge: 'bottom', position: null } }).display).toMatchObject({ edge: 'bottom', position: null, locked: true });
});

test('clipboard: links, colours and images are told apart', () => {
  expect(clipType('text', ' https://example.com/a?b=1 ')).toBe('link');
  expect(clipType('text', 'see https://example.com')).toBe('text');
  expect(clipType('text', '#2B6BE4')).toBe('color');
  expect(clipType('text', 'rgb(43, 107, 228)')).toBe('color');
  expect(clipType('text', '#hello')).toBe('text');
  expect(clipType('image', 'Image 4x4')).toBe('image');
});

test('clipboard: pinned clips stay on top, survive trimming and Clear all, and persist', () => {
  const dir = tmp();
  let now = 1000;
  const h = new ClipboardHistory(dir, 5, () => now++);
  h.addText('keep me');
  const keepId = h.list()[0].id;
  h.togglePin(keepId);
  for (let i = 0; i < 8; i++) h.addText(`clip ${i}`);
  const list = h.list();
  expect(list[0]).toMatchObject({ text: 'keep me', pinned: true });
  expect(list.filter((c) => !c.pinned).map((c) => c.text)).toEqual(['clip 7', 'clip 6', 'clip 5', 'clip 4', 'clip 3']);
  h.clear();
  expect(h.list().map((c) => c.text)).toEqual(['keep me']);
  expect(new ClipboardHistory(dir, 5).list()[0].pinned).toBe(true);
  h.togglePin(keepId);
  h.clear();
  expect(h.list()).toEqual([]);
});

test('time: durations read naturally', () => {
  expect(formatDuration(4_400)).toBe('4s');
  expect(formatDuration(134_000)).toBe('2m 14s');
  expect(formatDuration(3_900_000)).toBe('1h 5m');
});

test('bluetooth: battery lines are parsed, de-duplicated and bounded', () => {
  expect(parseBluetoothBatteries('WH-1000XM5|70\r\nMX Master 3|100\r\nWH-1000XM5|65\r\nBroken|abc\r\nToo much|140\r\n|50\r\n')).toEqual([
    { name: 'MX Master 3', percent: 100 },
    { name: 'WH-1000XM5', percent: 70 },
  ]);
  expect(parseBluetoothBatteries('')).toEqual([]);
  expect(parseBluetoothBatteries(null)).toEqual([]);
});

test('ddc: values per monitor, skipping monitors that did not answer', () => {
  const values = parseDdcValues('0|Generic PnP Monitor|-1|-1\n1|ASUS|3855|65535\n2|Dell|50|100');
  expect(values.has(0)).toBe(false);
  expect(values.get(1)!.current & 0xff).toBe(0x0f);
  expect(values.get(2)).toEqual({ current: 50, max: 100 });
  expect(parseDdcValues('').size).toBe(0);
});

test('screenshots: only new image files count', () => {
  expect(newImages(new Set(['old.png']), ['old.png', 'Screenshot (2).png', 'photo.JPG', 'notes.txt', 'desktop.ini'])).toEqual(['Screenshot (2).png', 'photo.JPG']);
});

test('settings: screenshots-to-shelf defaults on and can be switched off', () => {
  expect(normalizeSettings({}).shelf.screenshots).toBe(true);
  expect(updateSettings(normalizeSettings({}), { shelf: { screenshots: false } }).shelf.screenshots).toBe(false);
});
