import { test, expect } from 'vitest';
import {
  finishedDownloads, snapshot, partialTarget, parseVdf, steamLibraries, parseAcf, steamBecameReady, BusyIdleDetector,
} from '../src/main/finished';

// ---- Downloads ------------------------------------------------------------------

test('downloads: partial names and their targets', () => {
  expect(partialTarget('movie.mkv.part')).toBe('movie.mkv');
  expect(partialTarget('setup.exe.crdownload')).toBe('setup.exe');
  expect(partialTarget('Unconfirmed 812345.crdownload')).toBe(null);
  expect(partialTarget('photo.png')).toBe(null);
});

test('downloads: Chrome renames name.crdownload to the final file', () => {
  const prev = snapshot(['old.pdf', 'setup.exe.crdownload']);
  const { candidates } = finishedDownloads(prev, ['old.pdf', 'setup.exe']);
  expect(candidates).toEqual(['setup.exe']);
});

test('downloads: Chrome "Unconfirmed N.crdownload" becomes a file with another name', () => {
  const prev = snapshot(['old.pdf', 'Unconfirmed 4711.crdownload']);
  expect(finishedDownloads(prev, ['old.pdf', 'report final.pdf']).candidates).toEqual(['report final.pdf']);
});

test('downloads: Firefox keeps an empty target next to .part; finishing removes the .part', () => {
  const start = snapshot(['a.txt']);
  const during = finishedDownloads(start, ['a.txt', 'big.zip', 'big.zip.part']);
  expect(during.candidates).toEqual([]); // the empty placeholder appearing is not a finished download
  const done = finishedDownloads(during.next, ['a.txt', 'big.zip']);
  expect(done.candidates).toEqual(['big.zip']);
});

test('downloads: cancelled downloads and unrelated files do not count', () => {
  const prev = snapshot(['a.txt', 'x.iso.crdownload']);
  expect(finishedDownloads(prev, ['a.txt']).candidates).toEqual([]); // cancelled
  expect(finishedDownloads(snapshot(['a.txt']), ['a.txt', 'notes.txt']).candidates).toEqual([]); // saved by another app
  const ff = snapshot(['big.zip', 'big.zip.part']);
  expect(finishedDownloads(ff, []).candidates).toEqual([]); // Firefox cancel removes both
});

// ---- Steam ---------------------------------------------------------------------------

const LIBRARYFOLDERS = `"libraryfolders"
{
	"0"
	{
		"path"		"C:\\\\Program Files (x86)\\\\Steam"
		"label"		""
		"apps"
		{
			"730"		"71589381210"
		}
	}
	"1"
	{
		"path"		"D:\\\\SteamLibrary"
	}
}`;

const acf = (flags: number, toDownload = 0, downloaded = 0) => `"AppState"
{
	"appid"		"730"
	"universe"		"1"
	"name"		"Counter-Strike 2"
	"StateFlags"		"${flags}"
	"installdir"		"Counter-Strike Global Offensive"
	"BytesToDownload"		"${toDownload}"
	"BytesDownloaded"		"${downloaded}"
	"InstalledDepots"
	{
		"731"
		{
			"manifest"		"6436761910375028561"
			"size"		"8"
		}
	}
}`;

test('steam: VDF parsing and library folders', () => {
  expect(steamLibraries(LIBRARYFOLDERS)).toEqual(['C:\\Program Files (x86)\\Steam', 'D:\\SteamLibrary']);
  expect(steamLibraries('"LibraryFolders"\n{\n\t"TimeNextStatsReport"\t\t"123"\n\t"1"\t\t"E:\\\\Games"\n}')).toEqual(['E:\\Games']);
  expect(parseVdf('"a" { "b" "c" // comment\n }')).toEqual({ a: { b: 'c' } });
});

test('steam: app manifest parsing', () => {
  expect(parseAcf(acf(6, 5057627072, 0))).toEqual({ appid: '730', name: 'Counter-Strike 2', flags: 6, bytesToDownload: 5057627072, bytesDownloaded: 0 });
  expect(parseAcf('garbage')).toBe(null);
});

test('steam: "ready to play" only after a download or update finishes', () => {
  const queued = parseAcf(acf(6, 5057627072, 0))!; // installed + update required
  const downloading = parseAcf(acf(1026 | 1048576, 5057627072, 1_000_000))!;
  const ready = parseAcf(acf(4))!;
  expect(steamBecameReady(queued, downloading)).toBe(false);
  expect(steamBecameReady(downloading, ready)).toBe(true);
  expect(steamBecameReady(queued, ready)).toBe(true);
  expect(steamBecameReady(ready, ready)).toBe(false); // nothing happened
  expect(steamBecameReady(undefined, ready)).toBe(false); // first sighting
  expect(steamBecameReady(downloading, parseAcf(acf(4 | 2048))!)).toBe(false); // uninstalling
  expect(steamBecameReady(parseAcf(acf(4 | 64))!, parseAcf(acf(4))!)).toBe(false); // game was running, not updating
});

// ---- Busy -> idle -------------------------------------------------------------------------

function run(det: BusyIdleDetector, cpuPctPerStep: number[], stepMs = 2000) {
  let t = 0;
  let cpu = 0;
  const out: (string | null)[] = [det.push({ t, cpuMs: cpu, alive: true })];
  for (const pct of cpuPctPerStep) {
    t += stepMs;
    cpu += (pct / 100) * stepMs;
    out.push(det.push({ t, cpuMs: cpu, alive: true }));
  }
  return out;
}

test('watch: busy then quiet for 15 s fires once as "idle"', () => {
  const det = new BusyIdleDetector();
  const out = run(det, [150, 180, 120, 3, 2, 4, 1, 2, 3, 2, 1]);
  expect(out.indexOf('idle')).toBe(11); // 8 quiet samples x 2 s = 16 s >= 15 s
  expect(out.filter((x) => x === 'idle').length).toBe(1);
});

test('watch: never busy means it keeps waiting; a short blip does not count', () => {
  const det = new BusyIdleDetector();
  expect(run(det, [2, 1, 50, 2, 1, 2, 3, 1, 2, 1, 2, 2, 1])).not.toContain('idle');
  expect(det.phase).toBe('waiting');
});

test('watch: activity in between resets the quiet clock', () => {
  const det = new BusyIdleDetector();
  const out = run(det, [100, 100, 100, 2, 2, 2, 2, 20, 2, 2, 2, 2, 2, 2]);
  expect(out.indexOf('idle')).toBe(-1);
  expect(det.phase).toBe('settling');
  expect(det.push({ t: 99_999, cpuMs: 0, alive: false })).toBe('closed');
});
