// Builds the work map's board from Claude Code hook events and status line data.
// No Electron imports here, so it can be tested with plain Node.
//
// lot-map (shared/map) gets its events from inside Claude Code. Hooks tell less:
//   - There is no event for a model request. A "step" here is inferred: the model
//     is taken to be working from the user's message, or from the end of the last
//     tool call, until the next tool call or the answer.
//   - What other hooks did is not visible, so the Hooks station stays quiet.
import { classify, clean, shortModel } from '../shared/map/classify';
import { taskNotice, taskOf } from '../shared/map/feed';
import type { Setup } from '../shared/map/setup';
import type { Board, Entry, StationId, Status } from '../shared/map/types';
import { EMPTY_BOARD, MAP_SETUP, type WorkMapState } from '../shared/workmap';
import { clip, projectName } from './format';

const KEEP = 80;
const CREW = 12;
const MAX_SESSIONS = 6;
/** Another session takes the map over when the shown one has said nothing for this long. */
const QUIET_MS = 30_000;

/** The events the map needs on top of the ones Helo already receives. */
export const MAP_EVENTS = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'SubagentStart', 'SubagentStop', 'PreCompact'] as const;

type Input = Record<string, unknown>;

interface Session {
  board: Board;
  project: string;
  lastAt: number;
  /** Open tool calls: tool_use_id → the entry's id, and whether the main loop made the call. */
  tools: Map<string, { id: string; main: boolean; tool: string }>;
  /** The inferred model step that is running. */
  stepEntry?: string;
  /** A compaction that is running; the next event of the session ends it. */
  compactEntry?: string;
  step: number;
}

interface Start {
  station: StationId;
  label: string;
  from?: Entry['from'];
  status?: Status;
  agentId?: string;
  mark?: Entry['mark'];
  uncounted?: boolean;
  patch?: Partial<Pick<Board, 'model' | 'step' | 'switchedAt'>>;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const isFault = (s: Status): boolean => s === 'err' || s === 'block';
const oneMore = (faults: Board['faults'], station: StationId): Board['faults'] => ({ ...faults, [station]: (faults?.[station] ?? 0) + 1 });

/** The newest rows, and beside them every background task still going. */
function kept(entries: Entry[]): Entry[] {
  const from = entries.length - KEEP;
  return from <= 0 ? entries : entries.filter((e, i) => i >= from || (e.status === 'run' && e.task !== undefined));
}

export class WorkMap {
  private sessions = new Map<string, Session>();
  private current: string | null = null;
  private seq = 0;

  constructor(private setup: Setup = MAP_SETUP, private now: () => number = Date.now) {}

  /** The board to show, or null before any session was seen. */
  view(): WorkMapState | null {
    const s = this.current === null ? undefined : this.sessions.get(this.current);
    return s ? { board: s.board, project: s.project } : null;
  }

  clear(): void {
    this.sessions.clear();
    this.current = null;
  }

  /** Records a Claude Code hook event. Returns true when the shown board changed. */
  record(input: Input): boolean {
    const event = str(input.hook_event_name);
    const key = str(input.session_id) || 'default';
    const s = this.session(key, input);
    const before = s.board;
    const shown = this.current;
    this.focus(key, event);
    const agentId = str(input.agent_id) || undefined;
    const { t } = this.setup;

    if (s.compactEntry !== undefined && event !== 'PreCompact') {
      this.finish(s, s.compactEntry, 'ok');
      s.compactEntry = undefined;
    }

    switch (event) {
      case 'UserPromptSubmit': {
        // A background task reporting back is no message of the person's.
        const notice = taskNotice(str(input.prompt));
        if (notice !== undefined) {
          if (notice.status !== undefined) this.settle(s, notice.id, notice.status);
          break;
        }
        this.closeMain(s);
        s.step = 0;
        if (s.board.faults !== undefined) s.board = { ...s.board, faults: {} };
        this.begin(s, { station: 'you', label: t.newMessage, from: 'inbound', status: 'ok' });
        this.startStep(s);
        break;
      }
      case 'PreToolUse': {
        if (agentId === undefined) this.endStep(s);
        const toolInput = input.tool_input && typeof input.tool_input === 'object' ? (input.tool_input as Input) : {};
        let seen: { station: StationId; label: string };
        try {
          seen = classify(str(input.tool_name), toolInput, this.setup);
        } catch {
          seen = { station: 'shell', label: clip(str(input.tool_name), 40) };
        }
        const id = this.begin(s, { ...seen, ...(agentId === undefined ? {} : { from: 'agents' as const, agentId }) });
        s.tools.set(str(input.tool_use_id) || `call-${++this.seq}`, { id, main: agentId === undefined, tool: str(input.tool_name) });
        break;
      }
      case 'PostToolUse':
      case 'PostToolUseFailure': {
        const call = s.tools.get(str(input.tool_use_id));
        if (call === undefined) break;
        s.tools.delete(str(input.tool_use_id));
        const task = event === 'PostToolUse' ? taskOf(input.tool_response) : undefined;
        if (task !== undefined) s.board = { ...s.board, entries: s.board.entries.map((e) => (e.id === call.id && e.status === 'run' ? { ...e, task } : e)) };
        else this.finish(s, call.id, event === 'PostToolUse' ? 'ok' : 'err');
        // The model goes on once every call of its last step has answered.
        if (call.main && ![...s.tools.values()].some((c) => c.main)) this.startStep(s);
        break;
      }
      case 'SubagentStart': {
        if (agentId !== undefined && !(s.board.agents ?? []).includes(agentId)) {
          s.board = { ...s.board, agents: [...(s.board.agents ?? []), agentId].slice(-CREW) };
        }
        break;
      }
      case 'SubagentStop': {
        if (agentId === undefined) break;
        const at = this.now();
        for (const [k, c] of s.tools) if (!c.main && s.board.entries.some((e) => e.id === c.id && e.agentId === agentId)) s.tools.delete(k);
        s.board = {
          ...s.board,
          agents: (s.board.agents ?? []).filter((id) => id !== agentId),
          entries: s.board.entries.map((e) => (e.status === 'run' && (e.agentId === agentId || e.task === agentId) ? { ...e, status: 'ok' as const, endedAt: at } : e)),
        };
        break;
      }
      case 'Stop': {
        this.endStep(s);
        this.begin(s, { station: 'you', label: t.answerReady, status: 'ok', mark: 'done' });
        this.closeMain(s);
        break;
      }
      case 'PreCompact': {
        if (s.compactEntry === undefined) s.compactEntry = this.begin(s, { station: 'model', label: t.compacting });
        break;
      }
      default:
        break;
    }
    return this.current === key && (s.board !== before || shown !== key);
  }

  /** Claude Code status line data: the model and how full the context is. Returns true when the shown board changed. */
  status(input: Input): boolean {
    const key = str(input.session_id);
    const s = key ? this.sessions.get(key) : undefined;
    if (!s) return false;
    const before = s.board;
    const model = input.model && typeof input.model === 'object' ? str((input.model as Input).id) : '';
    const ctx = input.context_window && typeof input.context_window === 'object' ? (input.context_window as Input).used_percentage : null;
    if (model && model !== s.board.model) {
      const was = s.board.model;
      if (was === undefined) s.board = { ...s.board, model };
      else {
        this.begin(s, {
          station: 'model',
          label: `${shortModel(was)} → ${shortModel(model)}`,
          status: 'ok',
          mark: 'switch',
          uncounted: true,
          patch: { model, switchedAt: this.now() },
        });
      }
    }
    if (typeof ctx === 'number' && Number.isFinite(ctx)) {
      const context = Math.min(100, Math.max(0, ctx));
      if (context !== s.board.context) s.board = { ...s.board, context };
    }
    return this.current === key && s.board !== before;
  }

  /** The user refused a permission request: the newest open call of that tool reads as blocked. */
  refuse(sessionId: unknown, tool: string): boolean {
    const key = str(sessionId) || 'default';
    const s = this.sessions.get(key);
    if (!s) return false;
    const open = [...s.tools.entries()].filter(([, c]) => c.tool === tool).pop();
    if (!open) return false;
    s.tools.delete(open[0]);
    this.finish(s, open[1].id, 'block');
    if (open[1].main && ![...s.tools.values()].some((c) => c.main)) this.startStep(s);
    return this.current === key;
  }

  private session(key: string, input: Input): Session {
    let s = this.sessions.get(key);
    if (!s) {
      s = { board: EMPTY_BOARD, project: '', lastAt: 0, tools: new Map(), step: 0 };
      this.sessions.set(key, s);
      if (this.sessions.size > MAX_SESSIONS) {
        const oldest = [...this.sessions.entries()].filter(([k]) => k !== key && k !== this.current).sort((a, b) => a[1].lastAt - b[1].lastAt)[0];
        if (oldest) this.sessions.delete(oldest[0]);
      }
    }
    s.project = clip(projectName(input.cwd), 40) || s.project;
    return s;
  }

  /** Which session the map shows: the one the person last wrote to, unless it went quiet and another is busy. */
  private focus(key: string, event: string): void {
    const at = this.now();
    const shown = this.current === null ? undefined : this.sessions.get(this.current);
    if (!shown || event === 'UserPromptSubmit' || at - shown.lastAt > QUIET_MS) this.current = key;
    const s = this.sessions.get(key);
    if (s) s.lastAt = at;
  }

  private begin(s: Session, start: Start): string {
    const at = this.now();
    const entry: Entry = {
      id: `${at.toString(36)}-${(++this.seq).toString(36)}`,
      station: start.station,
      label: clean(start.label),
      from: start.from ?? 'core',
      startedAt: at,
      status: start.status ?? 'run',
      ...(start.status !== undefined ? { endedAt: at } : {}),
      ...(start.agentId !== undefined ? { agentId: start.agentId } : {}),
      ...(start.mark !== undefined ? { mark: start.mark } : {}),
    };
    const b = s.board;
    s.board = {
      ...b,
      ...start.patch,
      entries: kept([...b.entries, entry]),
      counts: start.uncounted ? b.counts : { ...b.counts, [entry.station]: (b.counts[entry.station] ?? 0) + 1 },
      ...(isFault(entry.status) && entry.station !== 'you' ? { faults: oneMore(b.faults, entry.station) } : {}),
      ...(entry.agentId !== undefined && !(b.agents ?? []).includes(entry.agentId) ? { agents: [...(b.agents ?? []), entry.agentId].slice(-CREW) } : {}),
    };
    return entry.id;
  }

  private finish(s: Session, id: string, status: Status): void {
    const open = s.board.entries.find((e) => e.id === id && e.status === 'run');
    if (!open) return;
    const at = this.now();
    s.board = {
      ...s.board,
      entries: s.board.entries.map((e) => (e === open ? { ...e, status, endedAt: at } : e)),
      ...(isFault(status) ? { faults: oneMore(s.board.faults, open.station) } : {}),
    };
  }

  /** A background task ended: its row closes, as a fault when the task failed. */
  private settle(s: Session, task: string, status: Status): void {
    const open = s.board.entries.find((e) => e.task === task && e.status === 'run');
    if (open) this.finish(s, open.id, status);
  }

  private startStep(s: Session): void {
    if (s.stepEntry !== undefined && s.board.entries.some((e) => e.id === s.stepEntry && e.status === 'run')) return;
    s.step += 1;
    const model = s.board.model;
    const said = this.setup.t.step(s.step);
    s.stepEntry = this.begin(s, { station: 'model', label: model === undefined ? said : `${shortModel(model)} · ${said}`, patch: { step: s.step } });
  }

  private endStep(s: Session): void {
    if (s.stepEntry !== undefined) this.finish(s, s.stepEntry, 'ok');
    s.stepEntry = undefined;
  }

  /** A call that was interrupted never reports back; left alone its row would pulse for the rest of the session. */
  private closeMain(s: Session): void {
    const at = this.now();
    for (const [k, c] of s.tools) if (c.main) s.tools.delete(k);
    s.stepEntry = undefined;
    if (!s.board.entries.some((e) => e.status === 'run' && e.from === 'core' && e.task === undefined)) return;
    s.board = {
      ...s.board,
      entries: s.board.entries.map((e) => (e.status === 'run' && e.from === 'core' && e.task === undefined ? { ...e, status: 'ok' as const, endedAt: at } : e)),
    };
  }
}
