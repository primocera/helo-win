// Which window a session lives in (for "click the banner to go to the terminal").
import { test, expect } from 'vitest';
import { SessionWindows, parseForeground, isAgentHost, MAX_WINDOWS } from '../src/main/windows';

test('the helper reply is parsed into handle, pid and process name', () => {
  expect(parseForeground('5309238|9544|Code')).toEqual({ handle: 5309238, pid: 9544, name: 'Code' });
  expect(parseForeground('66|7|Code - Insiders')).toEqual({ handle: 66, pid: 7, name: 'Code - Insiders' });
});

test('no window in front, or a broken reply, is nothing', () => {
  expect(parseForeground('0|0|')).toBe(null);
  expect(parseForeground('abc|1|x')).toBe(null);
  expect(parseForeground('12|-4|x')).toBe(null);
  expect(parseForeground('')).toBe(null);
  expect(parseForeground(undefined)).toBe(null);
  expect(parseForeground(42)).toBe(null);
});

test('terminals and editors count as places a session is typed in', () => {
  for (const name of ['WindowsTerminal', 'Code', 'cursor', 'pwsh', 'idea64', 'pycharm64', 'wezterm-gui', 'Code.exe']) expect(isAgentHost(name)).toBe(true);
  for (const name of ['chrome', 'msedge', 'explorer', 'Spotify', 'electron', 'Helo', '']) expect(isAgentHost(name)).toBe(false);
});

test('a session remembers the terminal it was typed in', () => {
  const w = new SessionWindows();
  expect(w.remember('claude:a', { handle: 10, pid: 1, name: 'WindowsTerminal' })).toBe(true);
  expect(w.get('claude:a')?.handle).toBe(10);
  expect(w.get('claude:b')).toBe(null);
});

test('a prompt sent while a browser is in front does not replace the terminal', () => {
  const w = new SessionWindows();
  w.remember('claude:a', { handle: 10, pid: 1, name: 'WindowsTerminal' });
  expect(w.remember('claude:a', { handle: 99, pid: 2, name: 'chrome' })).toBe(false);
  expect(w.remember('claude:a', null)).toBe(false);
  expect(w.get('claude:a')?.handle).toBe(10);
});

test('a session that moved to another window is followed there', () => {
  const w = new SessionWindows();
  w.remember('claude:a', { handle: 10, pid: 1, name: 'WindowsTerminal' });
  w.remember('claude:a', { handle: 20, pid: 3, name: 'Code' });
  expect(w.get('claude:a')).toEqual({ handle: 20, pid: 3, name: 'Code' });
});

test('a closed window is forgotten, and old sessions do not pile up', () => {
  const w = new SessionWindows();
  w.remember('claude:a', { handle: 10, pid: 1, name: 'cmd' });
  w.forget('claude:a');
  expect(w.get('claude:a')).toBe(null);
  for (let i = 0; i < MAX_WINDOWS + 5; i++) w.remember(`claude:${i}`, { handle: i + 1, pid: 1, name: 'cmd' });
  expect(w.keys().length).toBe(MAX_WINDOWS);
  expect(w.get('claude:0')).toBe(null);
  expect(w.get(`claude:${MAX_WINDOWS + 4}`)?.handle).toBe(MAX_WINDOWS + 5);
});
