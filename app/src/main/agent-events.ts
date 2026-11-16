// Gemini CLI and Cursor have their own hook events and field names. This turns them into the
// events the rest of Helo already understands (UserPromptSubmit, Stop, NeedsInput, ...), with
// `session_id` and `cwd` filled in. No Electron imports, so it can be tested with plain Node.
//
// Helo only watches these two agents. Neither documents a hook that can answer the approval
// prompt the user would otherwise see, so there are no Allow/Deny cards for them.
import type { AgentName } from '../shared/types';

type Input = Record<string, unknown>;

/** Agents whose hooks are answered at once and never decide anything. */
export const WATCH_ONLY: ReadonlySet<AgentName> = new Set<AgentName>(['gemini', 'cursor']);

/** Cursor conversations whose last answer is remembered for the "finished" banner. */
const MAX_REMEMBERED = 50;

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/**
 * Gemini CLI (geminicli.com/docs/hooks/reference): BeforeAgent fires when a prompt is sent,
 * AfterAgent when the turn ends (with the answer in `prompt_response`), Notification with
 * `notification_type: "ToolPermission"` when it asks to run a tool, AfterTool once a tool ran.
 */
function fromGemini(input: Input): Input | null {
  const base = { session_id: str(input.session_id), cwd: str(input.cwd) };
  switch (input.hook_event_name) {
    case 'BeforeAgent':
      return { ...base, hook_event_name: 'UserPromptSubmit' };
    case 'AfterAgent':
      return { ...base, hook_event_name: 'Stop', last_assistant_message: str(input.prompt_response) };
    case 'Notification':
      return input.notification_type === 'ToolPermission' ? { ...base, hook_event_name: 'NeedsInput' } : null;
    // A tool ran, so any approval it needed has been given in the terminal.
    case 'AfterTool':
      return { ...base, hook_event_name: 'PermissionResolved' };
    default:
      return null;
  }
}

/** The folder name is all Helo shows, so the first workspace root is enough. */
function cursorCwd(input: Input): string {
  const roots = input.workspace_roots;
  return Array.isArray(roots) && typeof roots[0] === 'string' ? roots[0] : str(input.cwd);
}

export function createNormalizer(): (agent: AgentName, input: Input) => Input | null {
  // conversation id -> the text of its latest answer (Cursor sends it in a separate event before `stop`).
  const lastText = new Map<string, string>();

  /**
   * Cursor (cursor.com/docs/agent/hooks): beforeSubmitPrompt fires when a prompt is sent,
   * afterAgentResponse carries each finished answer in `text`, and stop ends the run with
   * `status` "completed", "aborted" or "error".
   */
  function fromCursor(input: Input): Input | null {
    const id = str(input.conversation_id);
    const base = { session_id: id, cwd: cursorCwd(input) };
    switch (input.hook_event_name) {
      case 'beforeSubmitPrompt':
        return { ...base, hook_event_name: 'UserPromptSubmit' };
      case 'afterAgentResponse':
        lastText.delete(id);
        lastText.set(id, str(input.text).slice(0, 2000));
        if (lastText.size > MAX_REMEMBERED) lastText.delete(lastText.keys().next().value as string);
        return null;
      case 'stop': {
        const text = lastText.get(id) ?? '';
        lastText.delete(id);
        if (input.status === 'aborted') return { ...base, hook_event_name: 'Aborted' };
        if (input.status === 'error') return { ...base, hook_event_name: 'Failed' };
        return { ...base, hook_event_name: 'Stop', last_assistant_message: text };
      }
      default:
        return null;
    }
  }

  return (agent, input) => (agent === 'gemini' ? fromGemini(input) : agent === 'cursor' ? fromCursor(input) : input);
}
