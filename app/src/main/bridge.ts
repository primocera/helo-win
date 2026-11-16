// Local HTTP endpoint that Claude Code's HTTP hooks (and Codex command hooks,
// through curl) post to. No Electron imports here, so it can be tested with plain Node.
import http from 'node:http';
import crypto from 'node:crypto';
import { alwaysAllowSuggestion } from './format';
import { WATCH_ONLY, createNormalizer } from './agent-events';
import type { AgentName, Behavior } from '../shared/types';

export const HOOK_PATH = '/helo/hook';
export const STATUS_PATH = '/helo/status';
/** The browser extension posts here, with its own token. */
export const WEB_PATH = '/helo/web';
/** Answers "this port is Helo" without a token, so a port can be checked before it is trusted. */
export const HELLO_PATH = '/helo/hello';
export const HELLO_REPLY = '{"app":"helo"}';

/** How many ports after the saved one are tried when it is taken, before any free port is used. */
export const PORT_TRIES = 10;

/** The ports to try, in order, when `port` is the saved one. 0 = any free port. */
export function portCandidates(port: number): number[] {
  const list = [port];
  for (let i = 1; i <= PORT_TRIES && port + i <= 65535; i++) list.push(port + i);
  list.push(0);
  return list;
}
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
  const name = url.searchParams.get('agent');
  return name === 'codex' || name === 'gemini' || name === 'cursor' ? name : 'claude';
}

/**
 * Gemini CLI and Cursor run command hooks and read JSON from the command's output. Helo only
 * watches these two, so every answer is the one that changes nothing: Cursor's prompt hook
 * must be told to carry on, and everything else gets an empty object.
 */
function watchReply(agent: AgentName, input: HookInput | null): string {
  return agent === 'cursor' && input?.hook_event_name === 'beforeSubmitPrompt' ? '{"continue":true}' : '{}';
}

export function createBridge({ token, onPermission, onEvent, onStatus, webToken, onWeb, decisionTimeoutMs = 280_000 }: BridgeHandlers) {
  const normalize = createNormalizer();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const route = url.pathname;
    if (req.method === 'GET' && route === HELLO_PATH) {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(HELLO_REPLY);
      return;
    }
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
        const agent = agentFrom(url);
        if (route === HOOK_PATH && WATCH_ONLY.has(agent)) res.writeHead(200, { 'Content-Type': 'application/json' }).end(watchReply(agent, null));
        else res.writeHead(route === HOOK_PATH ? 200 : 413).end();
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooBig) return;
      let input: HookInput;
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^﻿/, ''));
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
    if (WATCH_ONLY.has(agent)) {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(watchReply(agent, input));
      const event = normalize(agent, input);
      if (event) onEvent(event, agent);
      return;
    }
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

  function listen(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', reject);
        const addr = server.address();
        resolve(typeof addr === 'object' && addr ? addr.port : port);
      });
    });
  }

  return {
    listen,
    /**
     * Listens on `port`, or when another program holds it, on the next free port after it
     * (and failing those, on any free port). Returns the port in use; the caller saves it
     * and rewrites the hooks when it differs.
     */
    async listenOrFallback(port: number): Promise<number> {
      let last: unknown = null;
      for (const candidate of portCandidates(port)) {
        try {
          return await listen(candidate);
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          // Taken, or reserved by Windows (Hyper-V and WSL reserve ranges): try the next one.
          if (code !== 'EADDRINUSE' && code !== 'EACCES') throw err;
          last = err;
        }
      }
      throw last;
    },
    close(): Promise<void> {
      return new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    },
  };
}
