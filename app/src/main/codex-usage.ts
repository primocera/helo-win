// Codex usage limits. Codex CLI has no status line to report them through, but it writes them
// into its own session files (~/.codex/sessions/2026/04/20/rollout-....jsonl) each time it
// answers, in lines like:
//   {"timestamp":"...","type":"event_msg","payload":{"type":"token_count","rate_limits":{
//     "primary":{"used_percent":48.0,"window_minutes":10080,"resets_at":1777250558},"secondary":null}}}
// Only those lines are parsed. The rest of the file (the conversation) is skipped unread, and
// nothing read here leaves the PC.
import fs from 'node:fs';
import path from 'node:path';
import type { Usage, UsageWindow } from '../shared/types';

/** How much of the end of a session file is looked at. */
const TAIL_BYTES = 400_000;
/** A window this long or shorter is the "5 hours" ring; a longer one is the "week" ring. */
const SHORT_WINDOW_MIN = 24 * 60;

function windowFrom(raw: unknown, lineMs: number, nowMs: number): { win: UsageWindow; minutes: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const used = typeof r.used_percent === 'number' ? r.used_percent : Number.NaN;
  if (!Number.isFinite(used)) return null;
  // Newer versions give the reset as a time, older ones as seconds from when the line was written.
  let resetsAt = 0;
  if (typeof r.resets_at === 'number' && Number.isFinite(r.resets_at)) resetsAt = r.resets_at * 1000;
  else if (typeof r.resets_in_seconds === 'number' && Number.isFinite(r.resets_in_seconds) && lineMs) resetsAt = lineMs + r.resets_in_seconds * 1000;
  // Without a reset time nobody can tell whether the number is still true.
  if (!resetsAt || resetsAt <= nowMs) return null;
  const minutes = typeof r.window_minutes === 'number' && Number.isFinite(r.window_minutes) ? r.window_minutes : 0;
  return { win: { usedPercent: Math.max(0, Math.min(100, used)), resetsAt }, minutes };
}

/** The newest usage in the text of a session file, or null when it has none that still holds. */
export function parseCodexUsage(text: string, nowMs = Date.now()): Usage | null {
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.includes('"rate_limits"')) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue; // the first line of a tail is usually cut in half
    }
    const payload = obj.payload && typeof obj.payload === 'object' ? (obj.payload as Record<string, unknown>) : null;
    const limits = payload?.rate_limits && typeof payload.rate_limits === 'object' ? (payload.rate_limits as Record<string, unknown>) : null;
    if (!limits) continue;
    const lineMs = typeof obj.timestamp === 'string' ? Date.parse(obj.timestamp) || 0 : 0;
    let fiveHour: UsageWindow | null = null;
    let sevenDay: UsageWindow | null = null;
    for (const raw of [limits.primary, limits.secondary]) {
      const w = windowFrom(raw, lineMs, nowMs);
      if (!w) continue;
      if (w.minutes > 0 && w.minutes <= SHORT_WINDOW_MIN) fiveHour ??= w.win;
      else sevenDay ??= w.win;
    }
    // The newest line is the truth, even when it says nothing is left to show.
    return fiveHour || sevenDay ? { fiveHour, sevenDay, updatedAt: lineMs || nowMs } : null;
  }
  return null;
}

const byNameDesc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

function list(dir: string, pattern: RegExp): string[] {
  try {
    return fs.readdirSync(dir).filter((n) => pattern.test(n)).sort(byNameDesc);
  } catch {
    return [];
  }
}

/** The newest session files, newest first. Their folders and names are dates, so sorting by name is sorting by time. */
export function newestRollouts(sessionsDir: string, max = 4): string[] {
  const out: string[] = [];
  for (const year of list(sessionsDir, /^\d{4}$/)) {
    for (const month of list(path.join(sessionsDir, year), /^\d{2}$/)) {
      for (const day of list(path.join(sessionsDir, year, month), /^\d{2}$/)) {
        const dir = path.join(sessionsDir, year, month, day);
        for (const file of list(dir, /^rollout-.*\.jsonl$/)) {
          out.push(path.join(dir, file));
          if (out.length >= max) return out;
        }
      }
    }
  }
  return out;
}

function readTail(file: string): string {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const length = Math.min(size, TAIL_BYTES);
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, size - length);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

/** Codex's usage from its newest session file that has any. Null when Codex is not installed or has not been used lately. */
export function readCodexUsage(sessionsDir: string, nowMs = Date.now()): Usage | null {
  for (const file of newestRollouts(sessionsDir)) {
    try {
      const text = readTail(file);
      // A file that mentions limits settles it: an older file cannot know better.
      if (text.includes('"rate_limits"')) return parseCodexUsage(text, nowMs);
    } catch {
      // unreadable or just deleted: try the one before
    }
  }
  return null;
}
