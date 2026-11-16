// Tracks what each agent session is doing (for the mascot face and the agents
// tab) and the Claude Code rate-limit usage reported through the status line.
import { clip, projectName } from './format';
import type { AgentSession, Mood, SessionSource, Usage, UsageWindow } from '../shared/types';

/** A finished session counts as "done" for this long, then goes back to idle. */
export const DONE_FOR_MS = 2 * 60_000;
/** A session that has said nothing for this long is dropped. */
export const FORGET_AFTER_MS = 6 * 60 * 60_000;

const PRIORITY: Record<Mood, number> = { waiting: 3, working: 2, done: 1, idle: 0 };

export function moodForEvent(event: unknown, notificationType?: unknown): Mood | null {
  switch (event) {
    case 'UserPromptSubmit':
      return 'working';
    case 'PermissionRequest':
    case 'NeedsInput':
      return 'waiting';
    case 'Notification':
      // idle_prompt: Claude has been waiting for input for a while; permission_prompt: needs approval.
      return notificationType === 'permission_prompt' || notificationType === 'idle_prompt' || notificationType === 'elicitation_dialog'
        ? 'waiting'
        : null;
    case 'Stop':
      return 'done';
    case 'PermissionResolved':
      return 'working';
    // The run was cancelled or broke: nothing is running and nothing was finished.
    case 'Aborted':
    case 'Failed':
      return 'idle';
    default:
      return null;
  }
}

export class AgentTracker {
  private sessions = new Map<string, AgentSession>();

  constructor(private now: () => number = Date.now) {}

  /** Records a hook event. Returns true when anything visible changed. */
  record(input: Record<string, unknown>, agent: SessionSource): boolean {
    const mood = moodForEvent(input.hook_event_name, input.notification_type);
    if (!mood) return false;
    const id = typeof input.session_id === 'string' && input.session_id ? input.session_id : 'default';
    const key = `${agent}:${id}`;
    const prev = this.sessions.get(key);
    // Coding agents are named by their folder; browser chats send their own title.
    const named = typeof input.project_title === 'string' ? clip(input.project_title, 40) : clip(projectName(input.cwd), 40);
    const project = named || prev?.project || '';
    if (prev && prev.mood === mood && prev.project === project) {
      prev.since = this.now();
      return false;
    }
    this.sessions.set(key, { key, agent, project, mood, since: this.now() });
    return true;
  }

  /** Moves finished sessions back to idle and forgets old ones. Returns true when anything changed. */
  tick(): boolean {
    const t = this.now();
    let changed = false;
    for (const [key, s] of this.sessions) {
      if (t - s.since > FORGET_AFTER_MS) {
        this.sessions.delete(key);
        changed = true;
      } else if (s.mood === 'done' && t - s.since > DONE_FOR_MS) {
        s.mood = 'idle';
        changed = true;
      }
    }
    return changed;
  }

  list(): AgentSession[] {
    return [...this.sessions.values()].sort((a, b) => PRIORITY[b.mood] - PRIORITY[a.mood] || b.since - a.since);
  }

  /** The most urgent mood across sessions: waiting > working > done > idle. */
  mood(): Mood {
    let best: Mood = 'idle';
    for (const s of this.sessions.values()) if (PRIORITY[s.mood] > PRIORITY[best]) best = s.mood;
    return best;
  }
}

function usageWindow(raw: unknown, nowMs: number): UsageWindow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const used = typeof r.used_percentage === 'number' ? r.used_percentage : Number.NaN;
  const resets = typeof r.resets_at === 'number' ? r.resets_at * 1000 : Number.NaN;
  if (!Number.isFinite(used)) return null;
  if (Number.isFinite(resets) && resets <= nowMs) return null; // window already reset
  return { usedPercent: Math.max(0, Math.min(100, used)), resetsAt: Number.isFinite(resets) ? resets : 0 };
}

/**
 * Reads the documented `rate_limits` object of Claude Code's status line input.
 * Returns null when the input has no rate limit data (API-key users, or before
 * the first response of a session).
 */
export function parseUsage(input: Record<string, unknown>, nowMs = Date.now()): Usage | null {
  const rl = input.rate_limits;
  if (!rl || typeof rl !== 'object') return null;
  const r = rl as Record<string, unknown>;
  const fiveHour = usageWindow(r.five_hour, nowMs);
  const sevenDay = usageWindow(r.seven_day, nowMs);
  if (!fiveHour && !sevenDay) return null;
  return { fiveHour, sevenDay, updatedAt: nowMs };
}

/** Drops windows whose reset time has passed. */
export function freshUsage(usage: Usage | null, nowMs = Date.now()): Usage | null {
  if (!usage) return null;
  const keep = (w: UsageWindow | null) => (w && (!w.resetsAt || w.resetsAt > nowMs) ? w : null);
  const fiveHour = keep(usage.fiveHour);
  const sevenDay = keep(usage.sevenDay);
  return fiveHour || sevenDay ? { ...usage, fiveHour, sevenDay } : null;
}

/** The model name from Claude Code's status line input (`model.display_name`), or null. */
export function parseModel(input: Record<string, unknown>): string | null {
  const model = input.model && typeof input.model === 'object' ? (input.model as Record<string, unknown>).display_name : null;
  return typeof model === 'string' && model.trim() ? clip(model.trim(), 30) : null;
}

/** The text Helo's status line prints in the terminal. */
export function statusLineText(input: Record<string, unknown>, usage: Usage | null): string {
  const parts: string[] = [];
  const model = parseModel(input);
  if (model) parts.push(model);
  const ctx = input.context_window && typeof input.context_window === 'object'
    ? (input.context_window as Record<string, unknown>).used_percentage
    : null;
  if (typeof ctx === 'number') parts.push(`ctx ${Math.round(ctx)}%`);
  if (usage?.fiveHour) parts.push(`5h ${Math.round(usage.fiveHour.usedPercent)}%`);
  if (usage?.sevenDay) parts.push(`7d ${Math.round(usage.sevenDay.usedPercent)}%`);
  return parts.join(' · ');
}
