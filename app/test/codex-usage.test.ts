// Codex usage rings, read from Codex's own session files.
import { test, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCodexUsage, newestRollouts, readCodexUsage } from '../src/main/codex-usage';

const NOW = Date.parse('2026-04-20T01:00:00Z');
const inAnHour = Math.round((NOW + 3_600_000) / 1000);
const inThreeDays = Math.round((NOW + 3 * 86_400_000) / 1000);
const line = (limits: unknown, at = '2026-04-20T00:53:34.064Z') => JSON.stringify({ timestamp: at, type: 'event_msg', payload: { type: 'token_count', info: null, rate_limits: limits } });

test('codex usage: the line Codex writes for a free plan (one weekly window)', () => {
  // The shape found in a real session file.
  const text = line({ limit_id: 'codex', limit_name: null, primary: { used_percent: 48.0, window_minutes: 10080, resets_at: inThreeDays }, secondary: null, credits: null, plan_type: 'free' });
  expect(parseCodexUsage(text, NOW)).toEqual({ fiveHour: null, sevenDay: { usedPercent: 48, resetsAt: inThreeDays * 1000 }, updatedAt: Date.parse('2026-04-20T00:53:34.064Z') });
});

test('codex usage: a short and a long window, the newest line wins', () => {
  const older = line({ primary: { used_percent: 10, window_minutes: 300, resets_at: inAnHour }, secondary: { used_percent: 20, window_minutes: 10080, resets_at: inThreeDays } }, '2026-04-20T00:10:00Z');
  const newer = line({ primary: { used_percent: 31.4, window_minutes: 300, resets_at: inAnHour }, secondary: { used_percent: 150, window_minutes: 10080, resets_at: inThreeDays } }, '2026-04-20T00:50:00Z');
  const u = parseCodexUsage(`{"type":"response_item","payload":{"text":"hello"}}\n${older}\n{"type":"event_msg","payload":{"type":"agent_message"}}\n${newer}\n`, NOW);
  expect(u?.fiveHour).toEqual({ usedPercent: 31.4, resetsAt: inAnHour * 1000 });
  expect(u?.sevenDay?.usedPercent).toBe(100);
});

test('codex usage: older versions give the reset as seconds from the line', () => {
  const u = parseCodexUsage(line({ primary: { used_percent: 5, window_minutes: 300, resets_in_seconds: 1200 } }, '2026-04-20T00:50:00Z'), NOW);
  expect(u?.fiveHour?.resetsAt).toBe(Date.parse('2026-04-20T00:50:00Z') + 1_200_000);
});

test('codex usage: a window that has reset, or has no reset time, is not shown', () => {
  const past = Math.round((NOW - 60_000) / 1000);
  expect(parseCodexUsage(line({ primary: { used_percent: 48, window_minutes: 10080, resets_at: past }, secondary: null }), NOW)).toBe(null);
  expect(parseCodexUsage(line({ primary: { used_percent: 48, window_minutes: 300 } }), NOW)).toBe(null);
  // The newest line says it has reset: an older line is not dug up in its place.
  const stale = line({ primary: { used_percent: 90, window_minutes: 300, resets_at: inAnHour } }, '2026-04-19T00:00:00Z');
  expect(parseCodexUsage(`${stale}\n${line({ primary: { used_percent: 48, window_minutes: 300, resets_at: past } })}`, NOW)).toBe(null);
});

test('codex usage: other lines, cut lines and odd values are passed over', () => {
  expect(parseCodexUsage('', NOW)).toBe(null);
  expect(parseCodexUsage('{"type":"response_item","payload":{"text":"what are my \\"rate_limits\\"?"}}', NOW)).toBe(null);
  expect(parseCodexUsage('ts":"x","payload":{"rate_limits":{"primary":{"used_per', NOW)).toBe(null);
  expect(parseCodexUsage(line({ primary: { used_percent: 'lots', window_minutes: 300, resets_at: inAnHour } }), NOW)).toBe(null);
  expect(parseCodexUsage(line(null), NOW)).toBe(null);
});

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'helo-codex-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('codex usage: read from the newest session file that mentions limits', () => {
  const day = (d: string) => {
    const dir = path.join(tmp, 'sessions', '2026', '04', d);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };
  fs.writeFileSync(path.join(day('18'), 'rollout-2026-04-18T09-00-00-aaa.jsonl'), `${line({ primary: { used_percent: 11, window_minutes: 300, resets_at: inAnHour } })}\n`);
  fs.writeFileSync(path.join(day('19'), 'rollout-2026-04-19T09-00-00-bbb.jsonl'), `${line({ primary: { used_percent: 22, window_minutes: 300, resets_at: inAnHour } })}\n`);
  // The newest session has not answered yet, so it has no limits line.
  fs.writeFileSync(path.join(day('19'), 'rollout-2026-04-19T21-00-00-ccc.jsonl'), '{"type":"session_meta","payload":{}}\n');
  fs.writeFileSync(path.join(day('19'), 'notes.txt'), 'not a session');
  const sessions = path.join(tmp, 'sessions');
  expect(newestRollouts(sessions).map((f) => path.basename(f))).toEqual([
    'rollout-2026-04-19T21-00-00-ccc.jsonl', 'rollout-2026-04-19T09-00-00-bbb.jsonl', 'rollout-2026-04-18T09-00-00-aaa.jsonl',
  ]);
  expect(readCodexUsage(sessions, NOW)?.fiveHour?.usedPercent).toBe(22);
  expect(readCodexUsage(path.join(tmp, 'nowhere'), NOW)).toBe(null);
});
