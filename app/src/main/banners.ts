// The banner slot of the island. Two kinds of banner share it:
//  - short ones ("Copied", a download, a battery alert) that leave after a few seconds;
//  - waiting ones ("Claude needs your answer") that stay until clicked or answered.
// A short banner covers a waiting one and the waiting one comes back afterwards, so the alert
// the user must act on is never lost. No Electron imports.
import type { Banner } from '../shared/types';

type Action = (() => void) | null;

interface Entry {
  banner: Banner;
  action: Action;
}

export interface BannerOptions {
  /** How long it stays, in ms. 0 = it waits until it is clicked or `answered`. */
  ms?: number;
  /** Runs when the user clicks the banner. */
  action?: Action;
  /** For waiting banners: whose it is (a session id). One waiting banner per key. */
  key?: string;
}

/** At most this many waiting banners are kept; the oldest is dropped beyond it. */
export const MAX_WAITING = 20;

export class BannerQueue {
  private short: Entry | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Waiting banners by key, oldest first. The newest is the one shown. */
  private readonly waiting = new Map<string, Entry>();

  /** `onChange` is called with the banner to put on screen (or null) whenever it changes. */
  constructor(private readonly onChange: (banner: Banner | null) => void, private readonly now: () => number = Date.now) {}

  /** The banner on screen. */
  current(): Banner | null {
    return this.visible()?.banner ?? null;
  }

  /** True while a waiting banner exists, on screen or covered by a short one. */
  hasWaiting(): boolean {
    return this.waiting.size > 0;
  }

  show(banner: Banner | null, { ms = 6000, action = null, key = '' }: BannerOptions = {}): void {
    if (!banner) return;
    const entry: Entry = { banner: { ...banner, at: this.now(), clickable: Boolean(action) }, action };
    if (ms > 0) {
      this.clearTimer();
      this.short = entry;
      this.timer = setTimeout(() => {
        this.timer = null;
        this.short = null;
        this.emit();
      }, ms);
    } else {
      // A new waiting banner is the most urgent thing there is: it goes on screen at once.
      this.clearTimer();
      this.short = null;
      this.waiting.delete(key);
      this.waiting.set(key, entry);
      while (this.waiting.size > MAX_WAITING) this.waiting.delete(this.waiting.keys().next().value as string);
    }
    this.emit();
  }

  /** The user clicked the banner on screen: it goes away and its action runs. */
  click(): void {
    const shown = this.visible();
    if (!shown?.action) return;
    if (shown === this.short) {
      this.clearTimer();
      this.short = null;
    } else {
      for (const [key, entry] of this.waiting) if (entry === shown) this.waiting.delete(key);
    }
    this.emit();
    shown.action();
  }

  /**
   * The wait is over (answered in the terminal, or the session moved on): drops the waiting
   * banner with this key, and the one with no key. Without a key, drops all of them.
   */
  answered(key?: string): void {
    if (this.waiting.size === 0) return;
    if (key === undefined) this.waiting.clear();
    else {
      this.waiting.delete(key);
      this.waiting.delete('');
    }
    this.emit();
  }

  /** Stops the timer (when the app quits). */
  dispose(): void {
    this.clearTimer();
  }

  private visible(): Entry | null {
    if (this.short) return this.short;
    let last: Entry | null = null;
    for (const entry of this.waiting.values()) last = entry;
    return last;
  }

  private shown: Banner | null = null;

  private emit(): void {
    const next = this.current();
    if (next === this.shown) return;
    this.shown = next;
    this.onChange(next);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
