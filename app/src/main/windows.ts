// Which window a session lives in, so a click on its banner can bring that window forward.
// A hook says nothing about windows. But when a prompt is sent, the window in front is the one
// it was typed in, so that is remembered for the session. No Electron imports.

export interface WindowRef {
  /** The window handle, as a number. */
  handle: number;
  /** The process that owns it. A handle can be reused by another program; the pair cannot. */
  pid: number;
  /** The process name without ".exe", e.g. "WindowsTerminal". */
  name: string;
}

/** Parses the helper's "handle|pid|process name" reply. Null when there is no window in front. */
export function parseForeground(text: unknown): WindowRef | null {
  if (typeof text !== 'string') return null;
  const [h, p, ...rest] = text.split('|');
  const handle = Number(h);
  const pid = Number(p);
  if (!Number.isSafeInteger(handle) || handle <= 0 || !Number.isSafeInteger(pid) || pid <= 0) return null;
  return { handle, pid, name: rest.join('|').trim().slice(0, 80) };
}

// Programs an agent runs in: terminals, and editors with a terminal or an agent panel.
// A prompt can also arrive while something else is in front (sent from a phone, or by a
// script), and that window must not be taken for the session's.
const HOSTS = new Set([
  'windowsterminal', 'conhost', 'openconsole', 'cmd', 'powershell', 'pwsh', 'wt',
  'wezterm-gui', 'alacritty', 'mintty', 'hyper', 'tabby', 'kitty', 'ghostty', 'rio', 'warp', 'wave', 'terminus',
  'conemu', 'conemu64', 'cmder', 'fluentterminal', 'mobaxterm', 'putty', 'git-bash', 'bash', 'wsl', 'wslhost', 'ubuntu', 'debian',
  'code', 'code - insiders', 'vscodium', 'cursor', 'windsurf', 'antigravity', 'trae', 'kiro', 'zed', 'positron',
  'devenv', 'sublime_text', 'nvim-qt', 'neovide', 'gvim', 'emacs', 'fleet',
  'claude', 'codex',
]);
// JetBrains IDEs: idea64, pycharm64, webstorm64, rider64, goland64, ...
const JETBRAINS = /^(idea|pycharm|webstorm|phpstorm|rider|goland|clion|rubymine|rustrover|datagrip|dataspell|studio)(64)?$/;

/** True when a process with this name is somewhere an agent session is typed into. */
export function isAgentHost(name: string): boolean {
  const n = name.trim().toLowerCase().replace(/\.exe$/, '');
  return HOSTS.has(n) || JETBRAINS.test(n);
}

/** At most this many sessions are remembered; the oldest goes first. */
export const MAX_WINDOWS = 100;

export class SessionWindows {
  private readonly byKey = new Map<string, WindowRef>();

  /**
   * Remembers the window in front as the session's. Kept only when it is a terminal or an
   * editor; otherwise what was known before stays. Returns true when it was kept.
   */
  remember(key: string, win: WindowRef | null): boolean {
    if (!key || !win || !isAgentHost(win.name)) return false;
    this.byKey.delete(key);
    this.byKey.set(key, win);
    while (this.byKey.size > MAX_WINDOWS) this.byKey.delete(this.byKey.keys().next().value as string);
    return true;
  }

  get(key: string): WindowRef | null {
    return this.byKey.get(key) ?? null;
  }

  forget(key: string): void {
    this.byKey.delete(key);
  }

  /** The keys of every session with a known window. */
  keys(): string[] {
    return [...this.byKey.keys()];
  }
}
