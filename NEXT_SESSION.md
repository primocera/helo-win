# Next session

Written 2026-11-15. Read this first; the full reasoning is in `audit/`. The audit covered `app/` and the app-related parts of `site/`. `game/` was left out on purpose.

## Where things stand

- **Nothing is committed.** The repository has no history (finding P1).
- **Built on 2026-11-14, uncommitted:** question cards, plan cards, red/green edit cards, screenshots to the shelf, monitor contrast and input switching, Bluetooth battery levels. 83 unit tests pass; type check and build pass.
- **Self-test:** 39 of 40 pass. The failing check is panel focus hand-back. It failed twice while a normal copy of the app was running; cause not proven (B20).
- **Claude Code is already connected.** `~/.claude/settings.json` has the four HTTP hooks and the status line, and they match the port (47615) and token in `%APPDATA%\helo\bridge.json`. A backup exists at `~/.claude/settings.json.helo-backup`. No change was needed.
- **The running app is the old build.** Process `electron.exe .` was started on 2026-11-14 at 19:35, before the new cards were built. It still sends questions and plans to the terminal. Quit it from the tray and run `npm start` in `app/` to load the new build.
- **Not yet tried on a live session:** answering a question, approving a plan, rejecting a plan.
- **Never tried on hardware:** Bluetooth levels, contrast and input writes, a real screenshot, an AltGr keyboard.

## Done on 2026-11-15 (branch `session-map`)

- **P1** — everything is committed (`main`, first commit).
- **B1** — the first `.helo-backup` is kept; later writes no longer replace it.
- **Work map** — a new panel tab drawn with lot-map's code (`app/src/shared/map/`), fed by `app/src/main/workmap.ts`. Self-test: 40 of 41 pass (the failure is still B20).
- **Not yet tried on a live session:** the work map. The first start of the new build adds six hooks to `~/.claude/settings.json` by itself (an older connection is upgraded); only Claude Code sessions started after that send tool events.
- S9 changed: the hook route now takes bodies up to 8 MB and answers an oversized one with an empty 200.

## Do in this order

Items 1 (P1) and 6 (B1) are done.

Each item names its finding. Stop and test after each.

1. **P1 — Commit everything as it is.** One commit for the current state. Add `audit/` and this file. Check `app/dist/` and `out/` are ignored.
2. **Restart the app on the new build and try a live session.** Ask Claude Code something that makes it ask a question and something that makes it plan. Record what happens for S5 (plan rejection) and B6 (does the card close when you answer in the terminal). These two answers change later tasks.
3. **S1 — Change the shortcuts.** Confirm the AltGr problem on your keyboard first (AltGr+N with a card showing). Then pick keys AltGr cannot produce and add a setting. Files: `syncShortcuts()` in `src/main/index.ts`, the `kbd` labels in `src/renderer/src/island/Views.tsx`, `settings.ts`, `shared/types.ts`, the site copy.
4. **S3 — Ignore clicks for about 500 ms after a card appears or changes.** File: `Views.tsx` (`CardView`, `QuestionCard`, `PlanCard`).
5. **S2 — Show everything that is being approved.** Make `.card-summary` scroll instead of clamping, keep line breaks, mark cut text, and block the Allow shortcut when text was cut. Files: `summarize()` and `permissionView()` in `src/main/format.ts`, `island.css`, `Views.tsx`. Add tests to `test/core.test.ts`.
6. **B1 — Keep the first backup.** `writeSettings()` in `src/main/hooks-install.ts`. Add a test: connect, change, disconnect, and the backup still equals the original.
7. **A1 step 1 — Move the request queue out of `index.ts`** into `src/main/requests.ts` with no Electron imports (`pending`, `settle()`, reply building, shortcut target). Add unit tests for every card kind. Fix B4 and B5 while there.
8. **B3 — Banner queue** in a new `src/main/banners.ts`, with tests. Sticky banners come back after short ones.
9. **T1 — Log file and "Copy diagnostics"** in Settings. Never write tokens or clipboard text.
10. **S12 — Clipboard safety.** No capture without the exclusion signal; expiry for unpinned clips; a pause switch; encrypt the index with `safeStorage`.
11. **B2 / R4 — Clean up on uninstall and when disconnecting.** NSIS uninstall step that strips the hooks; ask about deleting data.
12. **S7 — Port fallback.** Choose a free port when 47615 is taken and rewrite the hooks.
13. **R1 — Store IDs and buy link**, once the Lemon Squeezy product exists. Make a packaged build fail when they are unset. Fix S11 (timeouts, non-JSON answers, atomic write) in the same change.
14. **A3 / R7 — One shared product file** for the app and the site; correct the site's hook count, feature list and privacy answer.

## Decisions that are yours

These block work and should be settled early.

| Decision | Options | My recommendation |
| --- | --- | --- |
| The PowerShell helper (A2) | Keep as is; precompile the C# into a DLL; replace with a signed native helper | Precompile now, replace before launch |
| Licence strength (S10) | Leave it editable; protect with `safeStorage` | `safeStorage`; it is a small change |
| Browser extension (R5) | Publish to the stores; drop web chats from the first release | Drop from the first release |
| Typing on cards (A5) | Keep cards focus-free; allow click-to-type for answers and plan feedback | Allow click-to-type; it completes the main feature |
| Final product name (R8) | Rename before or after launch | Before; the name is in paths that are hard to migrate |
| Code signing (R2) | Buy a certificate now or at launch | Needed before auto-update (R3) can ship |

## Findings index

| ID | File | One line |
| --- | --- | --- |
| P1, P2 | 04 | No commits; no lint or CI |
| S1–S6 | 01 | Shortcuts on AltGr; cut-down cards; click-through; rule scope; plan rejection; malformed questions |
| S7–S9 | 01 | Port fallback; token in plain text; 1 MB cap |
| S10, S11 | 01 | Licence forgeable; licence calls without timeout |
| S12–S14 | 01 | Clipboard data; calendar address; site privacy answer |
| S15, S16 | 01 | Extension detection; load-unpacked |
| B1–B8 | 02 | Backup, uninstall, banners, deny state, shortcut queue, terminal answer, corrupt files, two writers |
| B9–B12 | 02 | Helper gives up; helper stalls; monitor index; input switch has no way back |
| B13–B20 | 02 | Reload loop; conversion memory; polling; screenshot watcher; small items; self-test |
| A1–A7 | 03 | One big file; helper design; three sources of truth; versions; decisions; duplication; dependencies |
| T1, T2 | 04 | No logs; failures invisible |
| R1–R9 | 05 | Store IDs; signing; updates; uninstall; extension; checklist; site mismatch; names; legal |

## Useful commands

Run in `app/`:

    npm run typecheck
    npm test
    npm run build
    npm start                                                        # run the built app
    node_modules/electron/dist/electron.exe . --smoke=<folder>       # screenshots with sample data
    node_modules/electron/dist/electron.exe . --selftest=<file.json> # real Windows integrations; quit the normal app first

Sample cards for screenshots are in `src/main/smoke.ts` (`05b-permission-edit`, `05c-question`, `05d-plan`).
