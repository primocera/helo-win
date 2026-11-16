// Notifications from other apps (Slack, Outlook, WhatsApp, ...), read by the helper from
// Windows' own notification list and shown as a banner. Nothing is stored: a notification is
// shown once and forgotten. No Electron imports.
import { clip } from './format';
import type { Banner } from '../shared/types';

export interface AppNotification {
  /** The app's name as Windows shows it, e.g. "Slack". */
  app: string;
  title: string;
  text: string;
}

/** How many apps the per-app switches remember. */
export const MAX_APPS = 60;

/** Turns the helper's message into a notification, or null when it has nothing to show. */
export function notificationFromRaw(msg: Record<string, unknown>): AppNotification | null {
  const lines = (Array.isArray(msg.lines) ? msg.lines : []).filter((l): l is string => typeof l === 'string' && l.trim() !== '');
  const app = clip(msg.app, 40);
  if (!lines.length && !app) return null;
  return { app, title: clip(lines[0] ?? '', 80), text: clip(lines.slice(1).join(' '), 160) };
}

/**
 * The banner for a notification, or null when it should not be shown: the app is switched
 * off, or it is one of `own` (Helo itself, which would otherwise echo its own alerts).
 */
export function notificationBanner(n: AppNotification, apps: Record<string, boolean>, own: string[] = []): Banner | null {
  if (own.some((name) => name.toLowerCase() === n.app.toLowerCase())) return null;
  if (n.app && apps[n.app] === false) return null;
  if (!n.title && !n.text) return null;
  const title = n.app && n.title ? `${n.app} · ${n.title}` : n.title || n.app;
  return { kind: 'notify', title: clip(title, 90), text: n.text };
}

/** Adds a newly seen app to the per-app switches (on). Returns the same object when nothing changed. */
export function rememberApp(apps: Record<string, boolean>, app: string): Record<string, boolean> {
  if (!app || app in apps || Object.keys(apps).length >= MAX_APPS) return apps;
  return { ...apps, [app]: true };
}

/** Keeps only valid entries of a saved per-app list. */
export function cleanApps(raw: unknown, fallback: Record<string, boolean>): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
  const out: Record<string, boolean> = {};
  for (const [name, on] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_APPS) break;
    if (name && name.length <= 60 && typeof on === 'boolean') out[name] = on;
  }
  return out;
}
