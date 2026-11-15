// Client for resources/winhelper.ps1: one long-lived PowerShell process that
// speaks JSON lines over stdio. It reads media sessions (WinRT), volume (Core
// Audio), microphone/camera use, power, clipboard changes and DDC/CI brightness.
// The helper exits on its own when its stdin closes, so it never outlives us.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';

/** Splits a byte stream into lines; keeps a partial last line until more data arrives. */
export class LineSplitter {
  private buf = '';
  constructor(private maxLine = 8 * 1024 * 1024) {}

  push(chunk: string): string[] {
    this.buf += chunk;
    const out: string[] = [];
    let i: number;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, i).replace(/\r$/, '');
      this.buf = this.buf.slice(i + 1);
      if (line.trim()) out.push(line);
    }
    if (this.buf.length > this.maxLine) this.buf = ''; // drop a runaway line
    return out;
  }
}

export interface HelperFeatures {
  media: boolean;
  volume: boolean;
  privacy: boolean;
  power: boolean;
  clipboard: boolean;
  brightness: boolean;
}

export type HelperMessage = Record<string, unknown> & { type: string };

export interface HelperOptions {
  script: string;
  /** Command to run; tests pass node with a fake helper. */
  command?: string;
  args?: string[];
  log?: (msg: string) => void;
  maxRestarts?: number;
}

/**
 * Events: 'message' (HelperMessage), 'status' ('starting' | 'running' | 'failed').
 */
export class WinHelper extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private features: HelperFeatures = { media: false, volume: false, privacy: false, power: false, clipboard: false, brightness: false };
  private restarts = 0;
  private stopped = false;
  private restartTimer: NodeJS.Timeout | null = null;
  status: 'off' | 'starting' | 'running' | 'failed' = 'off';

  constructor(private opts: HelperOptions) {
    super();
  }

  start() {
    this.stopped = false;
    if (this.proc) return;
    this.setStatus('starting');
    const command = this.opts.command ?? 'powershell.exe';
    const args = this.opts.args ?? ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', this.opts.script];
    const proc = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.proc = proc;
    const lines = new LineSplitter();
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => {
      for (const line of lines.push(chunk)) this.onLine(line);
    });
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (d: string) => this.opts.log?.(`helper stderr: ${d.trim().slice(0, 500)}`));
    proc.stdin.on('error', () => { /* helper exited; handled below */ });
    proc.on('error', (err) => this.opts.log?.(`helper spawn error: ${err.message}`));
    proc.on('exit', (code) => {
      this.proc = null;
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new Error('helper exited'));
      }
      this.pending.clear();
      if (this.stopped) {
        this.setStatus('off');
        return;
      }
      this.opts.log?.(`helper exited with ${code}`);
      if (this.restarts >= (this.opts.maxRestarts ?? 5)) {
        this.setStatus('failed');
        return;
      }
      this.restarts++;
      this.setStatus('starting');
      this.restartTimer = setTimeout(() => this.start(), Math.min(30_000, 1000 * 2 ** this.restarts));
    });
  }

  stop() {
    this.stopped = true;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    const proc = this.proc;
    if (!proc) return;
    proc.stdin.end(); // the helper exits when stdin closes
    const killTimer = setTimeout(() => proc.kill(), 1500);
    proc.once('exit', () => clearTimeout(killTimer));
  }

  get pid(): number | undefined {
    return this.proc?.pid;
  }

  setFeatures(features: HelperFeatures) {
    this.features = { ...features };
    if (this.status === 'running') this.request('enable', { features: this.features }).catch(() => {});
  }

  request<T = unknown>(cmd: string, args: Record<string, unknown> = {}, timeoutMs = 8000): Promise<T> {
    const proc = this.proc;
    if (!proc || this.status !== 'running') return Promise.reject(new Error('helper not running'));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`helper timed out on ${cmd}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      proc.stdin.write(`${JSON.stringify({ id, cmd, ...args })}\n`);
    });
  }

  private setStatus(s: WinHelper['status']) {
    if (this.status === s) return;
    this.status = s;
    this.emit('status', s);
  }

  private onLine(line: string) {
    let msg: HelperMessage;
    try {
      const parsed: unknown = JSON.parse(line);
      if (!parsed || typeof parsed !== 'object' || typeof (parsed as HelperMessage).type !== 'string') return;
      msg = parsed as HelperMessage;
    } catch {
      this.opts.log?.(`helper sent non-JSON: ${line.slice(0, 200)}`);
      return;
    }
    if (msg.type === 'ready') {
      this.restarts = 0;
      this.setStatus('running');
      this.request('enable', { features: this.features }).catch(() => {});
      return;
    }
    if (msg.type === 'fatal') {
      this.opts.log?.(`helper fatal: ${String(msg.message)}`);
      this.restarts = this.opts.maxRestarts ?? 5; // compiling will not start working on its own
      return;
    }
    if (msg.type === 'reply' && typeof msg.id === 'number') {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(String(msg.error || 'helper error')));
      return;
    }
    if (msg.type === 'error') {
      this.opts.log?.(`helper ${String(msg.where)}: ${String(msg.message)}`);
      return;
    }
    this.emit('message', msg);
  }
}

/** Parses the DDC/CI "index|name|current|max" lines from the helper. */
/** VCP 0x60 values from the MCCS standard that the island offers as inputs. */
export const DDC_INPUTS: { value: number; label: string }[] = [
  { value: 0x0f, label: 'DP 1' },
  { value: 0x10, label: 'DP 2' },
  { value: 0x11, label: 'HDMI 1' },
  { value: 0x12, label: 'HDMI 2' },
  { value: 0x1b, label: 'USB-C' },
];

/** The current value per monitor index from a ddc-list reply (monitors that did not answer are left out). */
export function parseDdcValues(text: unknown): Map<number, { current: number; max: number }> {
  const out = new Map<number, { current: number; max: number }>();
  if (typeof text !== 'string') return out;
  for (const line of text.split('\n')) {
    const [i, , cur, max] = line.split('|');
    const index = Number(i);
    const current = Number(cur);
    if (i !== '' && Number.isInteger(index) && Number.isFinite(current) && current >= 0) out.set(index, { current, max: Number(max) });
  }
  return out;
}

export function parseDdcList(text: unknown): { index: number; name: string; brightness: number | null; max: number | null }[] {
  if (typeof text !== 'string' || !text.trim()) return [];
  return text.split('\n').map((line) => {
    const [i, name, cur, max] = line.split('|');
    const c = Number(cur);
    const m = Number(max);
    return {
      index: Number(i),
      name: (name || 'Display').trim().slice(0, 80) || 'Display',
      brightness: c >= 0 && m > 0 ? Math.round((c / m) * 100) : null,
      max: m > 0 ? m : null,
    };
  }).filter((d) => Number.isInteger(d.index));
}
