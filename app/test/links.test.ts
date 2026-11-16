// helo:// links: the five things a link may ask for, and everything it may not.
import { test, expect } from 'vitest';
import { parseLink, findLink, isLocalPath, shownPath, LinkLimiter, LINK_SCHEME } from '../src/main/links';
import { normalizeSettings, DEFAULT_SETTINGS } from '../src/main/settings';

test('links: the scheme is the app name', () => {
  expect(LINK_SCHEME).toBe('helo');
});

test('links: banner', () => {
  expect(parseLink('helo://banner?title=Build%20done&text=All%20tests%20pass')).toEqual({ kind: 'banner', title: 'Build done', text: 'All tests pass' });
  expect(parseLink('helo://banner/?text=hello')).toEqual({ kind: 'banner', title: 'Message', text: 'hello' });
  expect(parseLink('helo://banner')).toBe(null);
  expect(parseLink('helo://banner?title=%20')).toBe(null);
  // Line breaks, control characters and direction marks cannot dress a banner up; long text is cut.
  const b = parseLink(`helo://banner?title=a%0Ab%00c%E2%80%AEd&text=${'x'.repeat(300)}`);
  expect(b).toMatchObject({ kind: 'banner', title: 'a b c d' });
  expect(b && b.kind === 'banner' && b.text.length).toBe(140);
});

test('links: timer', () => {
  expect(parseLink('helo://timer/start')).toEqual({ kind: 'timer', action: 'start' });
  expect(parseLink('helo://timer/start?minutes=45')).toEqual({ kind: 'timer', action: 'start', minutes: 45 });
  expect(parseLink('helo://TIMER/Pause')).toEqual({ kind: 'timer', action: 'pause' });
  expect(parseLink('helo://timer/reset')).toEqual({ kind: 'timer', action: 'reset' });
  expect(parseLink('helo://timer/skip')).toEqual({ kind: 'timer', action: 'skip' });
  expect(parseLink('helo://timer/start?minutes=0')).toBe(null);
  expect(parseLink('helo://timer/start?minutes=181')).toBe(null);
  expect(parseLink('helo://timer/start?minutes=2.5')).toBe(null);
  expect(parseLink('helo://timer/start?minutes=abc')).toBe(null);
  expect(parseLink('helo://timer')).toBe(null);
  expect(parseLink('helo://timer/explode')).toBe(null);
});

test('links: keep awake', () => {
  expect(parseLink('helo://awake/on')).toEqual({ kind: 'awake', on: true });
  expect(parseLink('helo://awake/off')).toEqual({ kind: 'awake', on: false });
  expect(parseLink('helo://awake/toggle')).toEqual({ kind: 'awake', on: 'toggle' });
  expect(parseLink('helo://awake')).toBe(null);
});

test('links: shelf takes a file on a local drive and nothing else', () => {
  expect(parseLink('helo://shelf/add?path=C%3A%5CUsers%5Cme%5Creport.pdf')).toEqual({ kind: 'shelf', path: 'C:\\Users\\me\\report.pdf' });
  expect(parseLink('helo://shelf/add?path=D:/work/a%20b.txt')).toEqual({ kind: 'shelf', path: 'D:/work/a b.txt' });
  // A network path would make Windows sign in to that server just by being looked at.
  expect(parseLink('helo://shelf/add?path=%5C%5Cevil.example%5Cshare%5Cx.txt')).toBe(null);
  expect(parseLink('helo://shelf/add?path=//evil.example/share/x.txt')).toBe(null);
  expect(parseLink('helo://shelf/add?path=relative%5Cfile.txt')).toBe(null);
  expect(parseLink('helo://shelf/add?path=C:%5Cfile.txt:stream')).toBe(null);
  expect(parseLink('helo://shelf/add')).toBe(null);
  expect(parseLink('helo://shelf/clear')).toBe(null);
  expect(parseLink(`helo://shelf/add?path=C:%5C${'a'.repeat(500)}`)).toBe(null);
  expect(isLocalPath('C:\\a\nb')).toBe(false);
  expect(isLocalPath('C:\\ok\\file.txt')).toBe(true);
});

test('links: open a tab', () => {
  expect(parseLink('helo://open/clipboard')).toEqual({ kind: 'open', tab: 'clipboard' });
  expect(parseLink('helo://open/home')).toEqual({ kind: 'open', tab: 'media' });
  expect(parseLink('helo://open/Map')).toEqual({ kind: 'open', tab: 'map' });
  expect(parseLink('helo://open/settings')).toBe(null);
  expect(parseLink('helo://open/constructor')).toBe(null);
  expect(parseLink('helo://open')).toBe(null);
});

test('links: anything else is refused', () => {
  expect(parseLink('https://banner?title=x')).toBe(null);
  expect(parseLink('helo://quit')).toBe(null);
  expect(parseLink('helo://settings/update?x=1')).toBe(null);
  expect(parseLink('helo://decide/allow')).toBe(null);
  expect(parseLink('helo://timer/start/extra')).toBe(null);
  expect(parseLink('helo://user:pw@banner?title=x')).toBe(null);
  expect(parseLink('helo://banner:80?title=x')).toBe(null);
  expect(parseLink('not a link')).toBe(null);
  expect(parseLink(42)).toBe(null);
  expect(parseLink(`helo://banner?title=${'x'.repeat(3000)}`)).toBe(null);
});

test('links: found in a command line', () => {
  expect(findLink(['C:\\Program Files\\Helo\\Helo.exe', '--flag', 'helo://timer/start'])).toBe('helo://timer/start');
  expect(findLink(['Helo.exe', 'HELO://awake/on'])).toBe('HELO://awake/on');
  expect(findLink(['Helo.exe', '--url=helo://awake/on', 'C:\\helo://x'])).toBe(null);
  expect(findLink(['Helo.exe'])).toBe(null);
});

test('links: a long path keeps its start and its end on the banner', () => {
  expect(shownPath('C:\\a.txt')).toBe('C:\\a.txt');
  const long = `C:\\Users\\me\\${'deep\\'.repeat(30)}report-final.pdf`;
  const shown = shownPath(long);
  expect(shown.length).toBe(84);
  expect(shown.startsWith('C:\\Users\\me\\')).toBe(true);
  expect(shown.endsWith('report-final.pdf')).toBe(true);
});

test('links: no more than eight in ten seconds', () => {
  const l = new LinkLimiter();
  for (let i = 0; i < 8; i++) expect(l.allow(1000 + i)).toBe(true);
  expect(l.allow(1100)).toBe(false);
  expect(l.allow(11_001)).toBe(true);
});

test('links setting: on by default, can be switched off', () => {
  expect(DEFAULT_SETTINGS.links).toEqual({ on: true });
  expect(normalizeSettings({ links: { on: false } }).links.on).toBe(false);
  expect(normalizeSettings({ links: 'no' }).links.on).toBe(true);
});
