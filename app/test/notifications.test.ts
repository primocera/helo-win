// Notifications from other apps: what becomes a banner, and the per-app switches.
import { test, expect } from 'vitest';
import { notificationFromRaw, notificationBanner, rememberApp, cleanApps, MAX_APPS } from '../src/main/notifications';
import { normalizeSettings, updateSettings, DEFAULT_SETTINGS } from '../src/main/settings';

test('a helper message becomes app, title and text', () => {
  expect(notificationFromRaw({ type: 'notification', id: '7', app: 'Slack', lines: ['Ana', 'Lunch at 12?', 'in #team'] }))
    .toEqual({ app: 'Slack', title: 'Ana', text: 'Lunch at 12? in #team' });
  expect(notificationFromRaw({ app: 'Mail', lines: ['Invoice'] })).toEqual({ app: 'Mail', title: 'Invoice', text: '' });
  expect(notificationFromRaw({ app: '', lines: [] })).toBe(null);
  expect(notificationFromRaw({ app: 'X', lines: 'not a list' })).toEqual({ app: 'X', title: '', text: '' });
});

test('the banner names the app, and is skipped for muted apps, Helo itself and empty notifications', () => {
  const n = { app: 'Slack', title: 'Ana', text: 'Lunch at 12?' };
  expect(notificationBanner(n, {})).toEqual({ kind: 'notify', title: 'Slack · Ana', text: 'Lunch at 12?' });
  expect(notificationBanner(n, { Slack: true })).not.toBe(null);
  expect(notificationBanner(n, { Slack: false })).toBe(null);
  expect(notificationBanner({ ...n, app: 'helo' }, {}, ['Helo'])).toBe(null);
  expect(notificationBanner({ app: 'Slack', title: '', text: '' }, {})).toBe(null);
  expect(notificationBanner({ app: '', title: 'Hello', text: '' }, {})).toEqual({ kind: 'notify', title: 'Hello', text: '' });
});

test('a new app is remembered once, switched on, up to the limit', () => {
  const apps = { Slack: false };
  expect(rememberApp(apps, 'Slack')).toBe(apps);
  expect(rememberApp(apps, '')).toBe(apps);
  expect(rememberApp(apps, 'Mail')).toEqual({ Slack: false, Mail: true });
  const full = Object.fromEntries(Array.from({ length: MAX_APPS }, (_, i) => [`app${i}`, true]));
  expect(rememberApp(full, 'One more')).toBe(full);
});

test('settings: the per-app list survives a save, and bad entries are dropped', () => {
  expect(DEFAULT_SETTINGS.features.notifications).toBe(true);
  const saved = normalizeSettings({ notifications: { apps: { Slack: false, Mail: true, Bad: 'yes', '': true } } });
  expect(saved.notifications.apps).toEqual({ Slack: false, Mail: true });
  expect(normalizeSettings({ notifications: { apps: ['x'] } }).notifications.apps).toEqual({});
  const next = updateSettings(saved, { notifications: { apps: { ...saved.notifications.apps, Slack: true } } });
  expect(next.notifications.apps).toEqual({ Slack: true, Mail: true });
  expect(updateSettings(next, { features: { notifications: false } }).notifications.apps).toEqual({ Slack: true, Mail: true });
  expect(cleanApps(null, { A: true })).toEqual({ A: true });
});
