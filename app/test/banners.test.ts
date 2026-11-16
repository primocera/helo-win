// The banner slot: a short banner must never wipe "needs your answer" (B3).
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { BannerQueue, MAX_WAITING } from '../src/main/banners';
import type { Banner } from '../src/shared/types';

const input = (title = 'Claude needs your answer'): Banner => ({ kind: 'input', title, text: 'Open the terminal' });
const copied: Banner = { kind: 'info', title: 'Copied', text: 'hello' };
const download: Banner = { kind: 'download', title: 'Download finished', text: 'a.zip' };

let seen: (Banner | null)[];
let q: BannerQueue;
const last = () => seen[seen.length - 1];

beforeEach(() => {
  vi.useFakeTimers();
  seen = [];
  q = new BannerQueue((b) => seen.push(b));
});
afterEach(() => vi.useRealTimers());

test('a short banner shows, then leaves', () => {
  q.show(copied, { ms: 1500 });
  expect(last()?.title).toBe('Copied');
  expect(last()?.clickable).toBe(false);
  vi.advanceTimersByTime(1499);
  expect(q.current()?.title).toBe('Copied');
  vi.advanceTimersByTime(1);
  expect(last()).toBe(null);
  expect(q.current()).toBe(null);
});

test('"needs your answer" comes back after a short banner covers it', () => {
  q.show(input(), { ms: 0, action: () => {}, key: 's1' });
  const waitingAt = q.current()?.at;
  q.show(copied, { ms: 1500 });
  expect(q.current()?.title).toBe('Copied');
  expect(q.hasWaiting()).toBe(true);
  vi.advanceTimersByTime(1500);
  expect(q.current()?.kind).toBe('input');
  expect(q.current()?.clickable).toBe(true);
  // It keeps the time it first appeared, so "2 min ago" stays true.
  expect(q.current()?.at).toBe(waitingAt);
  vi.advanceTimersByTime(60 * 60_000);
  expect(q.current()?.kind).toBe('input');
});

test('several short banners in a row still end on the waiting one', () => {
  q.show(input(), { ms: 0, action: () => {}, key: 's1' });
  q.show(copied, { ms: 1500 });
  vi.advanceTimersByTime(1000);
  q.show(download, { ms: 8000 });
  vi.advanceTimersByTime(1000);
  // The first banner's timer must not cut the second one short.
  expect(q.current()?.title).toBe('Download finished');
  vi.advanceTimersByTime(7000);
  expect(q.current()?.kind).toBe('input');
});

test('a new waiting banner shows at once, over a short one', () => {
  q.show(download, { ms: 8000 });
  q.show(input(), { ms: 0, action: () => {}, key: 's1' });
  expect(q.current()?.kind).toBe('input');
  vi.advanceTimersByTime(20_000);
  expect(q.current()?.kind).toBe('input');
});

test('clicking a short banner runs its action and uncovers the waiting one', () => {
  const open = vi.fn();
  q.show(input(), { ms: 0, action: () => {}, key: 's1' });
  q.show(download, { ms: 8000, action: open });
  q.click();
  expect(open).toHaveBeenCalledTimes(1);
  expect(q.current()?.kind).toBe('input');
  vi.advanceTimersByTime(8000);
  expect(q.current()?.kind).toBe('input');
});

test('clicking the waiting banner dismisses it', () => {
  const done = vi.fn();
  q.show(input(), { ms: 0, action: done, key: 's1' });
  q.click();
  expect(done).toHaveBeenCalledTimes(1);
  expect(q.current()).toBe(null);
  expect(q.hasWaiting()).toBe(false);
  q.click();
  expect(done).toHaveBeenCalledTimes(1);
});

test('a banner without an action ignores clicks', () => {
  q.show(copied, { ms: 1500 });
  q.click();
  expect(q.current()?.title).toBe('Copied');
});

test('two sessions wait: answering one leaves the other', () => {
  q.show(input('A needs your answer'), { ms: 0, action: () => {}, key: 'a' });
  q.show(input('B needs your answer'), { ms: 0, action: () => {}, key: 'b' });
  expect(q.current()?.title).toBe('B needs your answer');
  q.answered('b');
  expect(q.current()?.title).toBe('A needs your answer');
  q.answered('a');
  expect(q.current()).toBe(null);
});

test('answering while a short banner covers it: nothing comes back', () => {
  q.show(input(), { ms: 0, action: () => {}, key: 's1' });
  q.show(copied, { ms: 1500 });
  q.answered('s1');
  expect(q.current()?.title).toBe('Copied');
  vi.advanceTimersByTime(1500);
  expect(q.current()).toBe(null);
});

test('answered: another session does not clear it, no key clears all, a keyless banner goes with any answer', () => {
  q.show(input(), { ms: 0, action: () => {}, key: 's1' });
  q.answered('other');
  expect(q.hasWaiting()).toBe(true);
  q.answered();
  expect(q.hasWaiting()).toBe(false);
  q.show(input(), { ms: 0, action: () => {} });
  q.answered('anything');
  expect(q.hasWaiting()).toBe(false);
});

test('the same session asking twice keeps one banner', () => {
  q.show(input('first'), { ms: 0, action: () => {}, key: 's1' });
  q.show(input('second'), { ms: 0, action: () => {}, key: 's1' });
  expect(q.current()?.title).toBe('second');
  q.click();
  expect(q.current()).toBe(null);
});

test('waiting banners are capped, null is ignored, and nothing is sent when nothing changes', () => {
  q.show(null);
  expect(seen).toEqual([]);
  for (let i = 0; i < MAX_WAITING + 5; i++) q.show(input(`w${i}`), { ms: 0, action: () => {}, key: `k${i}` });
  let count = 0;
  while (q.current()) { q.click(); count++; }
  expect(count).toBe(MAX_WAITING);
  const sent = seen.length;
  q.answered('k1');
  q.click();
  expect(seen.length).toBe(sent);
});
