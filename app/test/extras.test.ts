// Meeting links in the calendar, the long break, and the low disk space warning.
import { test, expect } from 'vitest';
import { upcomingEvents, meetingLink, isMeetingLink } from '../src/main/calendar';
import * as timer from '../src/main/timer';
import { diskWarning, diskBanner } from '../src/main/system';
import { normalizeSettings, DEFAULT_SETTINGS } from '../src/main/settings';

// ---- calendar: Join ------------------------------------------------------------------

test('meeting links: Zoom, Meet, Teams and Webex are recognised, nothing else is', () => {
  expect(isMeetingLink('https://us02web.zoom.us/j/123456789?pwd=abc')).toBe(true);
  expect(isMeetingLink('https://meet.google.com/abc-defg-hij')).toBe(true);
  expect(isMeetingLink('https://teams.microsoft.com/l/meetup-join/19%3ameeting_x/0')).toBe(true);
  expect(isMeetingLink('https://teams.live.com/meet/123')).toBe(true);
  expect(isMeetingLink('https://acme.webex.com/meet/ana')).toBe(true);
  // Not https, not one of the services, or dressed up to look like one.
  expect(isMeetingLink('http://meet.google.com/abc-defg-hij')).toBe(false);
  expect(isMeetingLink('https://example.com/zoom.us/j/1')).toBe(false);
  expect(isMeetingLink('https://zoom.us.evil.example/j/1')).toBe(false);
  expect(isMeetingLink('https://notzoom.us/j/1')).toBe(false);
  expect(isMeetingLink('https://zoom.us@evil.example/j/1')).toBe(false);
  expect(isMeetingLink('file:///C:/Windows/System32/calc.exe')).toBe(false);
  expect(isMeetingLink('ms-settings:storagesense')).toBe(false);
  expect(isMeetingLink('not a link')).toBe(false);
});

test('meeting links: found in a description, with the punctuation around them left out', () => {
  expect(meetingLink('Room 4', 'Agenda: https://example.com/doc\nJoin: <https://meet.google.com/abc-defg-hij>. See you!')).toBe('https://meet.google.com/abc-defg-hij');
  expect(meetingLink('Join Zoom (https://zoom.us/j/987654321).')).toBe('https://zoom.us/j/987654321');
  expect(meetingLink('', undefined, 42, 'No link here, just https://example.com')).toBeUndefined();
  // The first field with a meeting link wins.
  expect(meetingLink('https://teams.live.com/meet/1', 'https://zoom.us/j/2')).toBe('https://teams.live.com/meet/1');
});

test('calendar: events carry their meeting link, from the location, the description or the calendar\'s own field', () => {
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
    'BEGIN:VEVENT', 'UID:1', 'DTSTART:20261113T130000Z', 'DTEND:20261113T133000Z', 'SUMMARY:Standup', 'RRULE:FREQ=DAILY;COUNT=2',
    'DESCRIPTION:Daily sync\\nhttps://meet.google.com/abc-defg-hij', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:2', 'DTSTART:20261113T140000Z', 'DTEND:20261113T150000Z', 'SUMMARY:Review', 'LOCATION:https://us02web.zoom.us/j/5551234', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:3', 'DTSTART:20261113T160000Z', 'DTEND:20261113T170000Z', 'SUMMARY:Planning',
    'X-GOOGLE-CONFERENCE:https://meet.google.com/xyz-uvwx-rst', 'DESCRIPTION:Notes at https://example.com/notes', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:4', 'DTSTART:20261113T180000Z', 'DTEND:20261113T190000Z', 'SUMMARY:Lunch', 'LOCATION:Cafe', 'DESCRIPTION:Menu https://example.com/menu', 'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const events = upcomingEvents(ics, Date.parse('2026-11-13T12:00:00Z'), 2 * 86_400_000);
  const byTitle = (t: string) => events.filter((e) => e.title === t);
  expect(byTitle('Standup').map((e) => e.join)).toEqual(['https://meet.google.com/abc-defg-hij', 'https://meet.google.com/abc-defg-hij']);
  expect(byTitle('Review')[0].join).toBe('https://us02web.zoom.us/j/5551234');
  expect(byTitle('Planning')[0].join).toBe('https://meet.google.com/xyz-uvwx-rst');
  expect('join' in byTitle('Lunch')[0]).toBe(false);
});

// ---- timer: long break ---------------------------------------------------------------

/** Runs the timer to the end of its current phase. */
function finish(s: ReturnType<typeof timer.initialTimer>) {
  const running = s.running ? s : timer.start(s, 0);
  return timer.tick(running, running.endsAt!).state;
}

test('timer: every fourth focus session is followed by the long break', () => {
  let s = timer.initialTimer(25, 5, 15, 4);
  const breaks: [boolean, number][] = [];
  for (let i = 0; i < 8; i++) {
    s = finish(s); // focus -> break
    expect(s.phase).toBe('break');
    breaks.push([s.longBreak, s.remainingMs / 60_000]);
    s = finish(s); // break -> focus
    expect(s).toMatchObject({ phase: 'focus', longBreak: false, remainingMs: 25 * 60_000 });
  }
  expect(breaks).toEqual([[false, 5], [false, 5], [false, 5], [true, 15], [false, 5], [false, 5], [false, 5], [true, 15]]);
  expect(s.completedFocus).toBe(8);
});

test('timer: the long break can be off, skipping gives a short break, and settings reach a stopped timer', () => {
  let off = timer.initialTimer(25, 5, 15, 0);
  for (let i = 0; i < 9; i++) {
    off = finish(off);
    expect(off.longBreak).toBe(false);
    off = finish(off);
  }
  expect(timer.isLongBreak(0, 4)).toBe(false);
  expect(timer.isLongBreak(4, 4)).toBe(true);
  expect(timer.isLongBreak(4, 0)).toBe(false);

  let s = timer.initialTimer(25, 5, 15, 1);
  s = finish(s);
  expect(s).toMatchObject({ phase: 'break', longBreak: true, remainingMs: 15 * 60_000 });
  // New lengths while the long break is paused.
  const paused = timer.configure(timer.pause(s, s.endsAt! - 15 * 60_000), 25, 5, 30, 1);
  expect(paused.remainingMs).toBe(30 * 60_000);
  expect(timer.skip(timer.skip(s))).toMatchObject({ phase: 'break', longBreak: false, remainingMs: 5 * 60_000 });
  expect(timer.reset(s)).toMatchObject({ phase: 'focus', longBreak: false, remainingMs: 25 * 60_000 });
  // The old two-argument call keeps the long break as it was.
  expect(timer.configure(timer.initialTimer(), 50, 10)).toMatchObject({ longBreakMin: 15, longEvery: 4, remainingMs: 50 * 60_000 });
});

// ---- disk space ----------------------------------------------------------------------

test('disk: warns once when space runs low, again after it recovered or after a day', () => {
  const GB = 1024 ** 3;
  const HOUR = 3_600_000;
  let state = { warned: false, at: 0 };
  const check = (freeGb: number, now: number) => {
    const r = diskWarning(state, freeGb * GB, 10, now);
    state = r.state;
    return r.warn;
  };
  expect(check(50, 0)).toBe(false);
  expect(check(9.5, HOUR)).toBe(true);
  expect(check(9.4, 2 * HOUR)).toBe(false);
  // Hovering at the limit is not a recovery.
  expect(check(10.5, 3 * HOUR)).toBe(false);
  expect(check(9.9, 4 * HOUR)).toBe(false);
  // Still low a day later: one reminder.
  expect(check(9, 26 * HOUR)).toBe(true);
  expect(check(9, 27 * HOUR)).toBe(false);
  // Freed up, then low again.
  expect(check(40, 28 * HOUR)).toBe(false);
  expect(check(3, 29 * HOUR)).toBe(true);
  // A reading that makes no sense changes nothing.
  expect(check(Number.NaN, 30 * HOUR)).toBe(false);
  expect(diskBanner('C:', 4.24 * GB)).toMatchObject({ kind: 'warn', title: 'Disk space is low' });
  expect(diskBanner('C:', 4.24 * GB).text).toContain('C: has 4.2 GB free');
  expect(diskBanner('D:', 42.6 * GB).text).toContain('D: has 43 GB free');
});

test('settings: long break and disk limits have defaults and bounds', () => {
  expect(DEFAULT_SETTINGS.timer).toEqual({ focusMin: 25, breakMin: 5, longBreakMin: 15, longEvery: 4 });
  expect(DEFAULT_SETTINGS.disk).toEqual({ lowGb: 10 });
  expect(DEFAULT_SETTINGS.features.disk).toBe(true);
  const s = normalizeSettings({ timer: { longBreakMin: 999, longEvery: -3 }, disk: { lowGb: 0 }, features: { disk: false } });
  expect(s.timer).toMatchObject({ longBreakMin: 120, longEvery: 0, focusMin: 25 });
  expect(s.disk.lowGb).toBe(1);
  expect(s.features.disk).toBe(false);
  // Settings saved by an older version get the new values.
  expect(normalizeSettings({ timer: { focusMin: 30, breakMin: 10 } }).timer).toEqual({ focusMin: 30, breakMin: 10, longBreakMin: 15, longEvery: 4 });
});
