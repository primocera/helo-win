/** 0:00, 4:05, 1:02:05 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Countdown text; rounds up so a timer never shows 0:00 while still running. */
export function formatRemaining(ms: number): string {
  return formatClock(Math.ceil(Math.max(0, ms) / 1000) * 1000);
}

/** "now", "5m", "3h", "2d" */
export function relativeTime(at: number, now: number): string {
  const d = Math.max(0, now - at);
  if (d < 60_000) return 'now';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
  return `${Math.floor(d / 86_400_000)}d`;
}

/** "in 12 min", "now", "9:30" style label for a calendar event start. */
export function eventWhen(start: number, end: number, allDay: boolean, now: number): string {
  if (allDay) return 'All day';
  if (start <= now && end > now) return 'Now';
  const mins = Math.round((start - now) / 60_000);
  if (mins < 60) return `in ${mins} min`;
  return new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** A length of time in words: "45s", "2m 14s", "1h 5m". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}
