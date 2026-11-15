// Upcoming events from an iCalendar (.ics) feed the user pastes in settings
// (Google Calendar "secret address in iCal format", Outlook "publish calendar", ...).
// ical.js handles recurrence rules and time zones.
import ICAL from 'ical.js';
import type { CalendarEvent } from '../shared/types';

const MAX_ICS_BYTES = 5 * 1024 * 1024;

/** Events that end after `now` and start before `now + horizonMs`, soonest first. */
export function upcomingEvents(icsText: string, now: number, horizonMs = 7 * 86_400_000, limit = 10): CalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(icsText));
  // Register the feed's own VTIMEZONE definitions so TZID references resolve.
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(tz);
    } catch { /* ignore broken zones */ }
  }
  const until = now + horizonMs;
  const out: CalendarEvent[] = [];
  const vevents = root.getAllSubcomponents('vevent');
  // Recurrence exceptions (RECURRENCE-ID) replace single occurrences of their master.
  const exceptions = new Map<string, ICAL.Event[]>();
  for (const v of vevents) {
    if (v.hasProperty('recurrence-id')) {
      const e = new ICAL.Event(v);
      const list = exceptions.get(e.uid) || [];
      list.push(e);
      exceptions.set(e.uid, list);
    }
  }
  for (const v of vevents) {
    if (v.hasProperty('recurrence-id')) continue;
    const event = new ICAL.Event(v);
    for (const ex of exceptions.get(event.uid) || []) event.relateException(ex);
    const status = String(v.getFirstPropertyValue('status') || '').toUpperCase();
    if (status === 'CANCELLED') continue;
    const push = (start: ICAL.Time, end: ICAL.Time, title: string, location: string) => {
      const s = start.toJSDate().getTime();
      const e = end.toJSDate().getTime();
      if (e > now && s < until) {
        out.push({ title: (title || 'Busy').slice(0, 200), start: s, end: e, allDay: start.isDate, location: (location || '').slice(0, 200) });
      }
    };
    if (event.isRecurring()) {
      const it = event.iterator();
      let next: ICAL.Time | null;
      let guard = 0;
      while ((next = it.next()) && guard++ < 5000) {
        if (next.toJSDate().getTime() >= until) break;
        const d = event.getOccurrenceDetails(next);
        push(d.startDate, d.endDate, d.item.summary, d.item.location);
      }
    } else if (event.startDate) {
      push(event.startDate, event.endDate || event.startDate, event.summary, event.location);
    }
  }
  return out.sort((a, b) => a.start - b.start).slice(0, limit);
}

type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export async function fetchCalendar(url: string, now: number, fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<CalendarEvent[]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20_000);
  try {
    const res = await fetchImpl(url, { signal: ac.signal, headers: { Accept: 'text/calendar, text/plain, */*' } });
    if (!res.ok) throw new Error(`The calendar server answered ${res.status}.`);
    const text = await res.text();
    if (text.length > MAX_ICS_BYTES) throw new Error('The calendar file is too large.');
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('That address did not return an iCalendar (.ics) file.');
    return upcomingEvents(text, now);
  } finally {
    clearTimeout(timer);
  }
}
