// Counts the lines each Claude Code session added and removed since its last prompt, for the
// "finished" banner and the Agents tab. Fed by the work map's PreToolUse and PostToolUse hooks:
// the count is worked out before the tool runs (a Write needs the file as it was) and only
// added once the tool reports that it ran. No Electron imports.
import { diffLines } from './format';

type Input = Record<string, unknown>;

export interface LineCount {
  added: number;
  removed: number;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

function count(before: string, after: string): LineCount {
  const lines = diffLines(before, after);
  return { added: lines.filter((l) => l.kind === 'add').length, removed: lines.filter((l) => l.kind === 'del').length };
}

/** The lines one Edit, MultiEdit or Write call changes, or null for any other tool. */
export function callChange(tool: unknown, toolInput: unknown, readFile: (file: string) => string | null): LineCount | null {
  const i = toolInput && typeof toolInput === 'object' ? (toolInput as Input) : {};
  if (typeof i.file_path !== 'string' || !i.file_path) return null;
  if (tool === 'Edit' && typeof i.old_string === 'string' && typeof i.new_string === 'string') return count(i.old_string, i.new_string);
  if (tool === 'MultiEdit' && Array.isArray(i.edits)) {
    const total = { added: 0, removed: 0 };
    for (const e of i.edits as Input[]) {
      if (!e || typeof e.old_string !== 'string' || typeof e.new_string !== 'string') continue;
      const c = count(e.old_string, e.new_string);
      total.added += c.added;
      total.removed += c.removed;
    }
    return total;
  }
  if (tool === 'Write' && typeof i.content === 'string') return count(readFile(i.file_path) ?? '', i.content);
  return null;
}

export class ChangeTracker {
  private totals = new Map<string, LineCount>();
  /** Calls that have started but not yet reported back. */
  private open = new Map<string, LineCount>();

  constructor(private readFile: (file: string) => string | null = () => null) {}

  private callKey(session: string, input: Input): string {
    const file = input.tool_input && typeof input.tool_input === 'object' ? str((input.tool_input as Input).file_path) : '';
    return `${session}:${str(input.tool_use_id) || file}`;
  }

  /** Records a hook event. Returns true when a session's total changed. */
  record(input: Input): boolean {
    const session = str(input.session_id) || 'default';
    switch (input.hook_event_name) {
      // A new prompt starts a new count.
      case 'UserPromptSubmit':
        return this.totals.delete(session);
      case 'PreToolUse': {
        const change = callChange(input.tool_name, input.tool_input, this.readFile);
        if (change) {
          this.open.set(this.callKey(session, input), change);
          // Calls that never report back (the session was closed) must not pile up.
          if (this.open.size > 200) this.open.delete(this.open.keys().next().value as string);
        }
        return false;
      }
      case 'PostToolUseFailure':
        this.open.delete(this.callKey(session, input));
        return false;
      case 'PostToolUse': {
        const key = this.callKey(session, input);
        const change = this.open.get(key);
        this.open.delete(key);
        if (!change || (!change.added && !change.removed)) return false;
        const t = this.totals.get(session) ?? { added: 0, removed: 0 };
        this.totals.set(session, { added: t.added + change.added, removed: t.removed + change.removed });
        return true;
      }
      default:
        return false;
    }
  }

  get(session: unknown): LineCount | null {
    return this.totals.get(str(session) || 'default') ?? null;
  }

  forget(session: unknown): void {
    this.totals.delete(str(session) || 'default');
  }
}

/** "+48 −12", or "" when nothing changed. */
export function changeText(c: LineCount | null): string {
  if (!c || (!c.added && !c.removed)) return '';
  return [c.added ? `+${c.added}` : '', c.removed ? `−${c.removed}` : ''].filter(Boolean).join(' ');
}
