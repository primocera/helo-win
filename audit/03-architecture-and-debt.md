# Architecture and technical debt

## A1 — The main process is one file (High)

`src/main/index.ts` is about 1,640 lines and holds some 40 module-level variables (`pending`, `state`, `settings`, `helper`, `bannerTimer`, `waitingSession`, …). The pure modules around it are small and tested; this file is where the behaviour actually lives, and it has no unit tests because it imports Electron at the top.

The difficult problems all cross this file:

- An approval touches the bridge, `pending`, the tracker, the banner slot, the global shortcuts, the fullscreen rule and the window size.
- A settings change touches the helper, watchers, hooks file, tray and licence.

Recommended split, in this order, each step small and testable:

1. `requests.ts` — the pending queue, `settle()`, reply building. No Electron imports; takes callbacks. This is the security-critical logic and should be the first thing under test.
2. `banners.ts` — the queue from B3.
3. `island-window.ts` — size, placement, focus, pointer tracking.
4. `ipc.ts` — channel registration, with one validator per channel.
5. What remains in `index.ts` is start-up wiring.

## A2 — The PowerShell helper (High)

One long-lived `powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden` that compiles about 400 lines of C# with `Add-Type` at every start. It avoids native npm modules, which keeps the build simple. The costs:

- **Antivirus.** An unsigned app that launches hidden PowerShell with a policy bypass, compiles code at run time, reads the clipboard and registers global hotkeys matches malware heuristics closely. Expect false positives.
- **Locked-down PCs.** Constrained Language Mode and AppLocker block `Add-Type`. On those machines the helper reports `fatal` and half the app is gone.
- **Start-up time and memory.** Compiling takes seconds; the process holds tens of megabytes for the life of the app.
- **Single thread.** See B10.

Options, cheapest first:

1. Keep it, but compile the C# once into a DLL at build time and load that (no run-time compiler, faster start, something that can be signed).
2. Replace it with a small signed native helper (.NET or Rust) speaking the same JSON-lines protocol. The protocol and `winhelper.ts` stay as they are.

Decide before investing more in helper features.

## A3 — Three sources of truth for product facts (Medium)

Price, trial length, buy link and feature list live in `app/src/main/config.ts`, `site/lib/product.ts` and `README.md`. They already disagree: the site says connecting adds "three hooks" (it adds four and a status line) and marks battery alerts as not shipped (they are built). Put the shared facts in one JSON file both projects import.

## A4 — Whole-state pushes and no schema versions (Low)

`push()` sends patches, but a clipboard change resends every clip with its thumbnail. Fine at 50 items; note it if the cap rises. None of the saved files (`settings.json`, `shelf.json`, `clipboard/index.json`, `bridge.json`) carries a version number, so the first breaking change to any of them has no migration path. Add `"version": 1` now.

## A5 — Decisions worth challenging

| Decision | Problem | Alternative |
| --- | --- | --- |
| A fixed port saved in a file | S7 | Choose a free port and rewrite the hooks; or a named pipe for Codex |
| HTTP hooks that fail when the app is closed | Every Claude Code event makes a failed request; blank status line | Accept, but make the status line degrade visibly (B2) |
| Cards never take keyboard focus | Free-text answers and plan feedback are impossible; the product's main feature is half there | Let the user click a text field to opt into focus, and give focus back after |
| The web chat feature needs a load-unpacked extension | R5 | Publish to the stores, or drop it until then |
| Bluetooth via a PowerShell run every 5 minutes | B15; measured 10.7 s per run | Move into the helper (A2) or read on demand |
| Trial and licence in a plain file | S10 | `safeStorage`, or accept and document |
| Global shortcuts registered only while a card waits | Good idea, wrong keys (S1) | Keep the idea, change the keys |

## A6 — Unnecessary complexity

- `DownloadWatcher` and `ScreenshotWatcher` in `finished-watch.ts` repeat the same watch-debounce-wait-for-stable-size logic. One generic "new stable file" watcher with a filter would serve both.
- The list of monitor inputs is written twice (`winhelper.ts` and `Panel.tsx`). Move it to `src/shared/`.
- `smoke.ts` is 600+ lines mixing screenshot samples and real integration tests. Split them; the sample data is also the only place card layouts are exercised.
- `HeloApi` in `shared/types.ts` and the preload file must be edited together for every channel, with string channel names repeated in `index.ts`. A single channel table would remove a class of typos.

## A7 — Dependency risk (Low)

`package.json` uses caret ranges on very recent major versions (Electron 45, TypeScript 7, Vite 8, Vitest 5). The lock file pins them today. Renovate or a monthly manual update with the self-test would keep Electron's security fixes coming without surprises. There is no auto-update, so users stay on whatever Electron they installed (see R3).
