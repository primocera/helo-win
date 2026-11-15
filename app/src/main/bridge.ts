// Local HTTP endpoint that Claude Code's HTTP hooks (and Codex command hooks,
// through curl) post to. No Electron imports here, so it can be tested with plain Node.
import http from 'node:http';
import crypto from 'node:crypto';
import { alwaysAllowSuggestion } from './format';
import type { AgentName, Behavior } from '../shared/types';

export const HOOK_PATH = '/helo/hook';
export const STATUS_PATH = '/helo/status';
/** The browser extension posts here, with its own token. */
export const WEB_PATH = '/helo/web';
const MAX_BODY = 1_000_000;
// Hook events carry whole tool inputs and outputs (a file being written, an image that was read).
const MAX_HOOK_BODY = 8_000_000;

// These tools are not a plain Allow/Deny. Per the hooks docs they are approved
// with "allow" plus `updatedInput` (the answers, or the plan echoed back).
export const INTERACTIVE_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode']);

/** A decision with the extra fields the PermissionRequest hook format allows. */
export interface PermissionReply {
  behavior: 'allow' | 'deny';
  updatedInput?: Record<string, unknown>;
  message?: string;
}

export type HookInput = Record<string, unknown> & { hook_event_name?: string; tool_name?: string };

export interface BridgeHandlers {
  token: string;
  /** Resolves to 'allow', 'deny' or null ("no decision": the agent asks in the terminal). */
  onPermission: (input: HookInput, signal: AbortSignal, agent: AgentName) => Promise<Behavior | PermissionReply | null>;
  /** Every other hook event (Notification, Stop, UserPromptSubmit, NeedsInput, and the work map's tool events). */
  onEvent: (input: HookInput, agent: AgentName) => void;
  /** Claude Code status line data. Returns the text the status line shows. */
  onStatus?: (input: HookInput) => string;
  /** Secret for the browser extension. It opens only the web route, never the hook routes. */
  webToken?: string;
  onWeb?: (body: Record<string, unknown>) => void;
  decisionTimeoutMs?: number;
}

function tokenMatches(header: unknown, token: string): boolean {
  const a = Buffer.from(String(header || ''));
  const b = Buffer.from(`Bearer ${token}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function agentFrom(url: URL): AgentName {
  return url.searchParams.get('agent') === 'codex' ? 'codex' : 'claude';
}

export function createBridge({ token, onPermission, onEvent, onStatus, webToken, onWeb, decisionTimeoutMs = 280_000 }: BridgeHandlers) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const route = url.pathname;
    const isWeb = route === WEB_PATH && Boolean(webToken);
    if (req.method !== 'POST' || (route !== HOOK_PATH && route !== STATUS_PATH && !isWeb)) {
      res.writeHead(404).end();
      return;
    }
    if (!tokenMatches(req.headers.authorization, isWeb ? webToken! : token)) {
      res.writeHead(401).end();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (chunk: Buffer) => {
      if (tooBig) return;
      size += chunk.length;
      if (size > (route === HOOK_PATH ? MAX_HOOK_BODY : MAX_BODY)) {
        tooBig = true;
        // For a hook, an empty 200 is "no decision": the agent carries on as if Helo were not there.
        res.writeHead(route === HOOK_PATH ? 200 : 413).end();
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooBig) return;
      let input: HookInput;
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
        input = parsed as HookInput;
      } catch {
        res.writeHead(400).end();
        return;
      }
      if (isWeb) {
        res.writeHead(200).end();
        if (input.state !== 'ping') {
          try {
            onWeb?.(input);
          } catch { /* a bad message must not take the bridge down */ }
        }
        return;
      }
      if (route === STATUS_PATH) {
        let line = '';
        try {
          line = onStatus ? onStatus(input) : '';
        } catch { /* show nothing */ }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end(line);
        return;
      }
      handle(input, agentFrom(url), res).catch(() => {
        if (!res.writableEnded) res.writeHead(200).end();
      });
    });
  });

  async function handle(input: HookInput, agent: AgentName, res: http.ServerResponse) {
    if (input.hook_event_name !== 'PermissionRequest') {
      res.writeHead(200).end();
      onEvent(input, agent);
      return;
    }
    const interactive = typeof input.tool_name === 'string' && INTERACTIVE_TOOLS.has(input.tool_name);
    // Only Claude Code documents how a hook answers these; for other agents the terminal asks.
    if (interactive && agent !== 'claude') {
      res.writeHead(200).end();
      onEvent({ ...input, hook_event_name: 'NeedsInput' }, agent);
      return;
    }

    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });
    const timer = setTimeout(() => abort.abort(), decisionTimeoutMs);
    let answer: Behavior | PermissionReply | null = null;
    try {
      answer = await onPermission(input, abort.signal, agent);
    } finally {
      clearTimeout(timer);
    }
    if (res.destroyed) return;

    if (answer && typeof answer === 'object') {
      const reply: PermissionReply = { behavior: answer.behavior === 'allow' ? 'allow' : 'deny' };
      if (reply.behavior === 'allow' && answer.updatedInput) reply.updatedInput = answer.updatedInput;
      if (reply.behavior === 'deny') reply.message = answer.message || 'Denied from Helo.';
      // "allow" alone does not approve these tools, so it becomes "no decision".
      if (interactive && reply.behavior === 'allow' && !reply.updatedInput) {
        res.writeHead(200).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: reply } }));
      return;
    }
    const behavior = interactive && answer !== 'deny' ? null : answer;

    if (behavior !== 'allow' && behavior !== 'deny' && behavior !== 'always') {
      res.writeHead(200).end();
      return;
    }
    const decision: { behavior: 'allow' | 'deny'; message?: string; updatedPermissions?: unknown[] } = {
      behavior: behavior === 'deny' ? 'deny' : 'allow',
    };
    if (behavior === 'deny') decision.message = 'Denied from Helo.';
    if (behavior === 'always' && agent === 'claude') {
      const suggestion = alwaysAllowSuggestion(input);
      if (suggestion) decision.updatedPermissions = [suggestion];
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PermissionRequest', decision },
    }));
  }

  return {
    listen(port: number): Promise<number> {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          server.off('error', reject);
          const addr = server.address();
          resolve(typeof addr === 'object' && addr ? addr.port : port);
        });
      });
    },
    close(): Promise<void> {
      return new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    },
  };
}
