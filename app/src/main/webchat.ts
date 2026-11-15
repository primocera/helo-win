// Messages from the browser extension about Claude and ChatGPT on the web:
// "an answer is being written" and "it has finished". No Electron imports.
import { clip } from './format';
import type { Banner, SessionSource } from '../shared/types';

export type WebSite = 'claude' | 'chatgpt';
export type WebState = 'working' | 'done' | 'gone';

export interface WebMessage {
  site: WebSite;
  state: WebState;
  /** Browser tab id, so two chats are tracked separately. */
  id: string;
  title: string;
  /** The chat tab is the one the user is looking at. */
  focused: boolean;
}

export const WEB_LABEL: Record<WebSite, string> = { claude: 'Claude', chatgpt: 'ChatGPT' };
export const WEB_SOURCE: Record<WebSite, SessionSource> = { claude: 'claude-web', chatgpt: 'chatgpt-web' };

/** If a tab says "working" and then goes silent for this long, it is treated as finished. */
export const WEB_SILENCE_MS = 60_000;

/** Validates a request body from the extension. Returns null for anything unexpected. */
export function parseWebMessage(raw: unknown): WebMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.site !== 'claude' && r.site !== 'chatgpt') return null;
  if (r.state !== 'working' && r.state !== 'done' && r.state !== 'gone') return null;
  const id = typeof r.id === 'string' && /^[\w-]{1,40}$/.test(r.id) ? r.id : '';
  if (!id) return null;
  return { site: r.site, state: r.state, id, title: chatTitle(r.title, r.site), focused: r.focused === true };
}

/** The chat's name without the site's own suffix ("My plan - Claude" -> "My plan"). */
export function chatTitle(raw: unknown, site: WebSite): string {
  const title = clip(typeof raw === 'string' ? raw : '', 80);
  const name = WEB_LABEL[site];
  const stripped = title.replace(new RegExp(`\\s*[-–|]\\s*${name}$`, 'i'), '').trim();
  return stripped.toLowerCase() === name.toLowerCase() ? '' : stripped;
}

/** The event the agent tracker understands, so web chats show up next to the coding agents. */
export function trackerEvent(msg: WebMessage): Record<string, unknown> {
  return {
    hook_event_name: msg.state === 'working' ? 'UserPromptSubmit' : 'Stop',
    session_id: `tab-${msg.id}`,
    project_title: msg.title || `${WEB_LABEL[msg.site]} chat`,
  };
}

/** A "finished" banner, only when the answer ended while the user was looking elsewhere. */
export function webBanner(msg: WebMessage): Banner | null {
  if (msg.state !== 'done' || msg.focused) return null;
  return { kind: 'done', title: `${WEB_LABEL[msg.site]} finished answering`, text: msg.title };
}

/** The code the user pastes into the extension: local port and the extension's own secret. */
export function pairingCode(port: number, token: string): string {
  return `${port}-${token}`;
}
