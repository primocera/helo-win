// Turns hook payloads into the short texts the island shows.
// Everything here is untrusted text: the renderer shows it as text only.
import path from 'node:path';
import type { AgentName, Banner, DiffLine, DiffView, PermissionView, QuestionView } from '../shared/types';

export function clip(text: unknown, max: number): string {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function projectName(cwd: unknown): string {
  return typeof cwd === 'string' && cwd ? path.win32.basename(cwd.replace(/\//g, '\\')) : '';
}

export function summarize(input: unknown): string {
  const i = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  for (const field of ['command', 'file_path', 'url', 'pattern', 'query']) {
    const v = i[field];
    if (typeof v === 'string' && v) return clip(v, 400);
  }
  try {
    return clip(JSON.stringify(i), 400);
  } catch {
    return '';
  }
}

/** The most text a card shows. Longer than this and the card says so, and the Allow shortcut is off. */
export const MAX_SUMMARY = 6000;

/**
 * What a card shows for a tool call: the whole command (or path, address, pattern) with its
 * line breaks kept, so nothing the user is approving is hidden. `cut` is true when even
 * MAX_SUMMARY was not enough.
 */
export function fullSummary(input: unknown): { text: string; cut: boolean } {
  const i = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  let text = '';
  for (const field of ['command', 'file_path', 'url', 'pattern', 'query']) {
    const v = i[field];
    if (typeof v === 'string' && v) {
      text = v;
      break;
    }
  }
  if (!text) {
    try {
      text = JSON.stringify(i, null, 1);
    } catch {
      text = '';
    }
    if (text === '{}') text = '';
  }
  text = text.replace(/\r\n/g, '\n').trim();
  return text.length > MAX_SUMMARY ? { text: text.slice(0, MAX_SUMMARY), cut: true } : { text, cut: false };
}

export const AGENT_LABEL: Record<AgentName, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini', cursor: 'Cursor' };

export interface PermissionSuggestion {
  type: 'addRules';
  rules: { toolName: string; ruleContent?: string }[];
  behavior: 'allow';
  destination: string;
}

const DESTINATIONS = new Set(['session', 'localSettings', 'projectSettings', 'userSettings']);

/**
 * The "Always allow" option: the first allow-rule entry Claude Code put in
 * `permission_suggestions`. Per the hooks docs, a hook may echo a suggestion back
 * as `updatedPermissions`. Mode changes (setMode) are never offered.
 */
export function alwaysAllowSuggestion(input: Record<string, unknown>): PermissionSuggestion | null {
  const list = input.permission_suggestions;
  if (!Array.isArray(list)) return null;
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as Record<string, unknown>;
    if (s.type !== 'addRules' || s.behavior !== 'allow' || typeof s.destination !== 'string' || !DESTINATIONS.has(s.destination)) continue;
    if (!Array.isArray(s.rules) || !s.rules.length) continue;
    const rules = s.rules
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object' && typeof (r as Record<string, unknown>).toolName === 'string')
      .map((r) => (typeof r.ruleContent === 'string' ? { toolName: r.toolName as string, ruleContent: r.ruleContent } : { toolName: r.toolName as string }));
    if (rules.length !== s.rules.length) continue;
    return { type: 'addRules', rules, behavior: 'allow', destination: s.destination };
  }
  return null;
}

/** "Bash(npm test)" style label for a suggestion. */
export function ruleLabel(s: PermissionSuggestion): string {
  return clip(s.rules.map((r) => (r.ruleContent ? `${r.toolName}(${r.ruleContent})` : r.toolName)).join(', '), 120);
}

const MAX_DIFF_INPUT = 400;
const MAX_DIFF_LINES = 60;

const splitLines = (s: string) => s.replace(/\r\n/g, '\n').split('\n');
const lineText = (s: string) => (s.length > 240 ? `${s.slice(0, 239)}…` : s);

/** Line diff (longest common subsequence). Very long inputs fall back to "all removed, all added". */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before === '' ? [] : splitLines(before);
  const b = after === '' ? [] : splitLines(after);
  if (a.length > MAX_DIFF_INPUT || b.length > MAX_DIFF_INPUT) {
    return [...a.map((text): DiffLine => ({ kind: 'del', text })), ...b.map((text): DiffLine => ({ kind: 'add', text }))];
  }
  const w = b.length + 1;
  const lcs = new Uint16Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * w + j] = a[i] === b[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] });
      i++;
      j++;
    } else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) out.push({ kind: 'del', text: a[i++] });
    else out.push({ kind: 'add', text: b[j++] });
  }
  while (i < a.length) out.push({ kind: 'del', text: a[i++] });
  while (j < b.length) out.push({ kind: 'add', text: b[j++] });
  return out;
}

/** Keeps the changed lines plus one unchanged line either side, capped for the card. */
export function diffView(file: string, all: DiffLine[]): DiffView | null {
  const added = all.filter((l) => l.kind === 'add').length;
  const removed = all.filter((l) => l.kind === 'del').length;
  if (!added && !removed) return null;
  const changed = (n: number) => n >= 0 && n < all.length && all[n].kind !== 'same';
  const lines: DiffLine[] = [];
  let more = 0;
  all.forEach((l, n) => {
    if (l.kind === 'same' && !changed(n - 1) && !changed(n + 1)) return;
    if (lines.length < MAX_DIFF_LINES) lines.push({ kind: l.kind, text: lineText(l.text) });
    else if (l.kind !== 'same') more++;
  });
  return { file: clip(path.win32.basename(file.replace(/\//g, '\\')), 60), added, removed, lines, more };
}

/**
 * The red/green lines for Claude Code's Edit and Write tools. `readFile` returns
 * the file's current text (or null), so a Write over an existing file shows what changes.
 */
export function editDiff(tool: unknown, toolInput: unknown, readFile: (file: string) => string | null = () => null): DiffView | null {
  const i = toolInput && typeof toolInput === 'object' ? (toolInput as Record<string, unknown>) : {};
  if (typeof i.file_path !== 'string' || !i.file_path) return null;
  if (tool === 'Edit' && typeof i.old_string === 'string' && typeof i.new_string === 'string') {
    return diffView(i.file_path, diffLines(i.old_string, i.new_string));
  }
  if (tool === 'Write' && typeof i.content === 'string') {
    return diffView(i.file_path, diffLines(readFile(i.file_path) ?? '', i.content));
  }
  return null;
}

/** The questions of an AskUserQuestion call, or null when the input is not in the documented shape. */
export function questionViews(toolInput: unknown): QuestionView[] | null {
  const list = toolInput && typeof toolInput === 'object' ? (toolInput as Record<string, unknown>).questions : null;
  if (!Array.isArray(list) || !list.length || list.length > 4) return null;
  const out: QuestionView[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') return null;
    const q = raw as Record<string, unknown>;
    if (typeof q.question !== 'string' || !q.question || !Array.isArray(q.options) || !q.options.length) return null;
    const options: QuestionView['options'] = [];
    for (const o of q.options) {
      const label = o && typeof o === 'object' ? (o as Record<string, unknown>).label : null;
      if (typeof label !== 'string' || !label) return null;
      options.push({ label, description: clip((o as Record<string, unknown>).description, 160) });
    }
    out.push({ question: q.question, header: clip(q.header, 30), multi: q.multiSelect === true, options });
  }
  return out;
}

/**
 * Turns the labels picked on the card into the documented `answers` object
 * (question text -> label; several labels joined with commas). Returns null
 * unless every question has a valid pick.
 */
export function buildAnswers(questions: QuestionView[], picks: unknown): Record<string, string> | null {
  if (!Array.isArray(picks) || picks.length !== questions.length) return null;
  const answers: Record<string, string> = {};
  for (let n = 0; n < questions.length; n++) {
    const q = questions[n];
    const chosen = Array.isArray(picks[n]) ? [...new Set(picks[n] as unknown[])] : [];
    if (!chosen.length || (!q.multi && chosen.length !== 1)) return null;
    if (!chosen.every((c) => typeof c === 'string' && q.options.some((o) => o.label === c))) return null;
    answers[q.question] = (chosen as string[]).join(', ');
  }
  return answers;
}

export function permissionView(
  id: string,
  input: Record<string, unknown>,
  agent: AgentName = 'claude',
  now = Date.now(),
  readFile?: (file: string) => string | null,
): PermissionView {
  const suggestion = agent === 'claude' ? alwaysAllowSuggestion(input) : null;
  const questions = agent === 'claude' && input.tool_name === 'AskUserQuestion' ? questionViews(input.tool_input) : null;
  const isPlan = agent === 'claude' && input.tool_name === 'ExitPlanMode';
  const planText = isPlan && input.tool_input && typeof input.tool_input === 'object' ? (input.tool_input as Record<string, unknown>).plan : null;
  const diff = agent === 'claude' ? editDiff(input.tool_name, input.tool_input, readFile) : null;
  const summary = fullSummary(input.tool_input);
  return {
    id,
    kind: questions ? 'question' : isPlan ? 'plan' : 'tool',
    ...(questions ? { questions } : {}),
    ...(isPlan ? { plan: typeof planText === 'string' ? planText.slice(0, 6000) : '' } : {}),
    ...(diff ? { diff } : {}),
    agent,
    tool: clip(input.tool_name || 'Tool', 40),
    summary: summary.text,
    ...(summary.cut ? { summaryCut: true } : {}),
    project: clip(projectName(input.cwd), 40),
    always: suggestion ? ruleLabel(suggestion) : null,
    receivedAt: now,
  };
}

/** Banner for a non-permission event, or null when there is nothing to show. */
export function eventBanner(input: Record<string, unknown>, agent: AgentName = 'claude'): Banner | null {
  const project = clip(projectName(input.cwd), 40);
  const who = AGENT_LABEL[agent];
  switch (input.hook_event_name) {
    case 'Stop':
      return { kind: 'done', title: project ? `Finished in ${project}` : `${who} finished`, text: clip(input.last_assistant_message, 120) };
    case 'NeedsInput':
      return { kind: 'input', title: `${who} needs your answer`, text: project ? `Open the terminal for ${project}` : 'Open the terminal' };
    case 'Failed':
      return { kind: 'warn', title: project ? `${who} stopped in ${project}` : `${who} stopped`, text: 'It ended with an error.' };
    case 'Notification':
      // "Claude is waiting for your input": treated like a question, so it stays up until clicked.
      if (input.notification_type === 'idle_prompt') {
        return { kind: 'input', title: `${who} is waiting for you`, text: project ? `Open the terminal for ${project}` : clip(input.message, 120) || 'Open the terminal' };
      }
      return { kind: 'info', title: clip(input.title || 'Claude Code', 60), text: clip(input.message, 120) };
    default:
      return null;
  }
}
