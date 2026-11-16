// Calls: how long an app has had the microphone or camera, and finding the app again.
import { test, expect } from 'vitest';
import { privacyFromRaw, privacyStarted, consentKeys, privacyBanner } from '../src/main/system';

const zoom = 'C:#Program Files#Zoom#bin#Zoom.exe';
const teams = 'MSTeams_8wekyb3d8bbwe';

test('calls: the start time comes with each app, and the earlier of microphone and camera counts', () => {
  const p = privacyFromRaw({ microphone: [`${zoom}|1700000060000`, `${teams}|1700000500000`], camera: [`${zoom}|1700000000000`] });
  expect(p.microphone).toEqual(['Zoom', 'MSTeams']);
  expect(p.camera).toEqual(['Zoom']);
  expect(p.since).toEqual({ Zoom: 1700000000000, MSTeams: 1700000500000 });
});

test('calls: a line without a time still names the app; our own app is left out with its time', () => {
  const p = privacyFromRaw({ microphone: [zoom, 'C:#x#helo.exe|1700000000000'], camera: 'nope' }, ['helo']);
  expect(p.microphone).toEqual(['Zoom']);
  expect(p.camera).toEqual([]);
  expect(p.since).toEqual({});
});

test('calls: whether the microphone is muted is carried over, not read from this message', () => {
  expect(privacyFromRaw({ microphone: [], camera: [] }).micMuted).toBe(null);
  expect(privacyFromRaw({ microphone: [], camera: [] }, [], true).micMuted).toBe(true);
  expect(privacyFromRaw({ microphone: [], camera: [], micMuted: false } as never, [], true).micMuted).toBe(true);
});

test('calls: the registry key is kept for each app name, to find its window', () => {
  const keys = consentKeys({ microphone: [`${zoom}|1700000060000`], camera: [`${teams}|5`, zoom] });
  expect(keys.get('Zoom')).toBe(zoom);
  expect(keys.get('MSTeams')).toBe(teams);
  expect(keys.size).toBe(2);
  expect(consentKeys({}).size).toBe(0);
});

test('calls: which app just started, for the banner click', () => {
  const none = privacyFromRaw({ microphone: [], camera: [] });
  const one = privacyFromRaw({ microphone: [`${zoom}|1`], camera: [] });
  const two = privacyFromRaw({ microphone: [`${zoom}|1`], camera: [`${teams}|2`] });
  expect(privacyStarted(none, one)).toEqual(['Zoom']);
  expect(privacyStarted(one, two)).toEqual(['MSTeams']);
  expect(privacyStarted(two, two)).toEqual([]);
  expect(privacyStarted(two, none)).toEqual([]);
  expect(privacyBanner(one, two)).toEqual({ kind: 'privacy', title: 'Camera on', text: 'MSTeams' });
});
