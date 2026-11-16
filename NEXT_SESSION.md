# Next session

Written 2026-11-16. Read this first, then `TODO.md` (the full list, with tick boxes). The reasoning behind the finding IDs (S1, B3, R2, ...) is in `audit/`.

## Where things stand

- **Everything is committed and pushed to `main`.** The site deploys from `main` to https://helo-win.vercel.app.
- **Checks on 2026-11-16:** `npm run typecheck`, `npm test` (135 tests) and `npm run build` pass in `app/`; `npm run lint` and `npm run build` pass in `site/`.
- **The user tested the app on 2026-11-16** and reported that the work map and everything else works. That was before this session's changes were built, so the points under "Not yet tried" below are still open.
- **The installer in `app/dist` is from 13 Nov** and has none of the work since. Rebuild with `npm run dist` in `app/`.

## Built on 2026-11-16

- **Gemini CLI and Cursor connections** (watch only: working, needs you, finished). `src/main/agent-events.ts` turns their events into Helo's; installers are in `src/main/hooks-install.ts`. Neither documents a hook that can answer its approval prompt, so there are no Allow/Deny cards for them.
- **Notifications from other apps**, with a switch per app. `Poll-Notifications` in `resources/winhelper.ps1` reads Windows' notification list once a second; `src/main/notifications.ts` makes the banner. Checked with a real Windows toast on this PC. It does not need a Store package, which the old README said it did.
- **Card safety:** shortcuts are now Alt+Shift+Y / Alt+Shift+N (S1); cards show the whole command and scroll, and a command too long to show switches the Allow shortcut off (S2); cards ignore clicks for half a second after they appear or change (S3).
- **Lines changed** ("+48 −12") on the finished banner and in the Agents tab, for Claude Code while the work map is on (`src/main/changes.ts`).
- **Site:** privacy page, footer links, `robots.txt`, `sitemap.xml`, share image.

## Built after that (same day, second session)

- **B3: banner queue** (`src/main/banners.ts`, `test/banners.test.ts`). A short banner covers "needs your answer" and the waiting one comes back afterwards. One waiting banner per session; it goes when the session is answered, finishes, fails or asks for a tool.
- **S7: port fallback.** When the saved port is taken, the bridge tries the next ten and then any free port (`listenOrFallback` in `bridge.ts`), saves the new port in `bridge.json` and points every connected agent's hooks at it (`movePort` in `hooks-install.ts`). A banner says so. `GET /helo/hello` answers `{"app":"helo"}` without a token. Tests in `test/port.test.ts`. Not tried by hand with the real app (it would rewrite the real hook files). The browser extension keeps the old port and must be paired again after a move.
- **T1: log file and Copy diagnostics.** `src/main/logfile.ts` writes `helo.log` in the data folder (two files of 200 KB at most) and hides tokens, long random strings and the home folder path. Clipboard text and notification text are never passed to it. Settings, General, Help has "Copy diagnostics" and "Show log file". Uncaught errors, helper status and window crashes are logged. Tests in `test/logfile.test.ts`. The two buttons were not clicked by hand.

## Not yet tried

- Gemini CLI and Cursor against a live session. Neither is installed on this PC; they were built from the published hook docs and checked with unit tests and the real hook commands run through `cmd.exe` and PowerShell. Gemini CLI's docs say it was replaced by Antigravity CLI in June 2026; whether Antigravity reads the same file was not checked.
- The half-second click guard on cards, by hand.
- The new shortcuts on the user's keyboard.
- Notifications on Windows 11 or a clean account (Windows may ask for permission there; here access was already allowed).
- The lines-changed count on a live Claude Code session.

## Do next, in this order

4. **B2 / R4: uninstall cleanup.** NSIS step that removes the hooks from all four agents' files; ask about the data folder.
5. **A5: type an answer or plan feedback on the island.** Cards then take keyboard focus; the audit left this as the user's call and the user has not objected.
6. **OpenCode connection.** Install OpenCode on this PC first (ask the user); its docs describe two plugin APIs and leave the permission payloads out.
7. **S12: clipboard safety** (expiry, pause switch, encrypted on disk), then **S10 / S11** (licence file and timeouts).
8. **Smaller features from the Halo comparison:** calendar Join button, clipboard search and pins, long break, disk-space warning. See `TODO.md`.
9. **Site:** tech specs section, changelog page, more FAQ questions.
10. **Rebuild the installer** and run the release checklist (R6 in `audit/05-release-readiness.md`).

## Waiting on the user

The name, the Lemon Squeezy product (store IDs and buy link), a support email, the terms details (seller name, refund rule, governing law), where the installer is hosted, and a code-signing certificate. The terms page and the download button wait on these. Details are at the top of `TODO.md`.

## Useful commands

Run in `app/`:

    npm run typecheck
    npm test
    npm run build
    npm start                                                        # run the built app
    npm run dist                                                     # installer into dist/
    node_modules/electron/dist/electron.exe . --smoke=<folder>       # screenshots with sample data
    node_modules/electron/dist/electron.exe . --selftest=<file.json> # real Windows integrations; quit the normal app first

Run in `site/`: `npm run lint`, `npm run build`. Read `site/AGENTS.md` before changing the site: this Next.js version differs from older ones, and its docs are in `site/node_modules/next/dist/docs/`.
