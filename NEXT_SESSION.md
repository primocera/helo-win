# Next session

Written 2026-11-16. Read this first, then `TODO.md` (the full list, with tick boxes). The reasoning behind the finding IDs (S1, B3, R2, ...) is in `audit/`.

## Where things stand

- **Everything is committed and pushed to `main`.** The site deploys from `main` to https://helo-win.vercel.app.
- **Checks on 2026-11-16:** `npm run typecheck`, `npm test` (159 tests) and `npm run build` pass in `app/`; `npm run lint` and `npm run build` pass in `site/`.
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
- **B2 / R4: uninstall cleanup.** The uninstaller runs the app with `--disconnect-all` (`removeAll` in `hooks-install.ts`: hooks and status line out of all four agents' files, Helo's backup copies deleted, start-with-Windows entry removed), then asks whether to delete the data folder; the default and a silent uninstall keep it (`app/resources/uninstall.nsh`). The app half was run against a throwaway home folder (`HELO_AGENT_HOME`, development builds only). The NSIS half is only proven once the installer is built and an uninstall is run by hand. Not done: a visible status line when the app is not running.
- **A5: typing on a card.** Question cards have "Type an answer" and plan cards have "Feedback" (rejects the plan and passes the text to Claude). A card only takes the keyboard after the user clicks one of those; focus goes back to the window they were in on send, cancel or when the card goes (`setTyping` in `index.ts`, `TypeBox` in `Views.tsx`). Enter sends, Shift+Enter is a new line, Esc cancels. Tests in `test/typing.test.ts` cover the answers; the focus hand-over was not tried by hand and needs a live Claude Code question and plan.
- **S12: clipboard safety.** Unpinned copies are forgotten after a set time (default 1 day; Settings, Features, Clipboard history), there is a Pause switch in Settings and in the clipboard tab, and the history is encrypted on disk with Windows data protection (`safeStorage`; `index.bin` and sealed image files; a plain history from an older version is encrypted at the next start). The polling fallback is gone: with the Windows helper down nothing is captured, because only the helper sees the private-copy flag. The encryption round trip was checked in Electron on this PC; the Pause button was not clicked by hand.
- **S10 / S11: licence.** The licence file is encrypted with Windows data protection (`license.bin`; an old `license.json` is converted at the next start), written through a temp file, and dates in the future no longer extend the trial or skip the check with the store. Calls to the store give up after 10 seconds, and an error page or no connection gives a plain sentence. Decisions I took: deleting the file still restarts the trial, and a licensed PC that stays offline keeps working. Tests in `test/license.test.ts`.
- **Smaller features.** Calendar: events with a Zoom, Meet, Teams or Webex link get a Join button (from 15 minutes before) and a clickable banner a minute before; only https links to those services are ever opened (`isMeetingLink` in `calendar.ts`). Focus timer: a long break after every N focus sessions (default 15 minutes after 4; Settings). Low disk space: a warning when the Windows drive drops below a limit (default 10 GB), once per shortage; clicking opens Windows' storage page. Clipboard search, filters and pins were already there. Tests in `test/extras.test.ts`. Not tried by hand: a real calendar feed with meeting links, the join banner, and the disk warning on screen.
- **Site:** tech specs section (`specs` in `site/lib/product.ts`, each line beside the app file that proves it), a changelog page at `/changelog`, five more questions, and the copy brought in step with today's app changes (uninstall, clipboard encryption and expiry, typed answers, Join button, long break, low disk space, 22 feature switches).

## Not yet tried

- Gemini CLI and Cursor against a live session. Neither is installed on this PC; they were built from the published hook docs and checked with unit tests and the real hook commands run through `cmd.exe` and PowerShell. Gemini CLI's docs say it was replaced by Antigravity CLI in June 2026; whether Antigravity reads the same file was not checked.
- The half-second click guard on cards, by hand.
- The new shortcuts on the user's keyboard.
- Notifications on Windows 11 or a clean account (Windows may ask for permission there; here access was already allowed).
- The lines-changed count on a live Claude Code session.

## Do next, in this order

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
