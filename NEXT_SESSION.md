# Next session

Written 2026-11-16. Read this first, then `TODO.md` (the full list, with tick boxes). The reasoning behind the finding IDs (S1, B3, R2, ...) is in `audit/`.

## Where things stand

- **Everything is committed and pushed to `main`.** The site deploys from `main` to https://helo-win.vercel.app.
- **Checks on 2026-11-16:** `npm run typecheck`, `npm test` (159 tests) and `npm run build` pass in `app/`; `npm run lint` and `npm run build` pass in `site/`.
- **The user tested the app on 2026-11-16** and reported that the work map and everything else works. That was before this session's changes were built, so the points under "Not yet tried" below are still open.
- **The installer was rebuilt on 2026-11-16**, before the third session, so it lacks the banner click and the notification click: `app/dist/Helo-Setup-0.1.0.exe` (116 MB, unsigned). It has not been installed or uninstalled by hand yet.

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

## Built in the third session (2026-11-16)

- **Click a banner to go to the session's window** (gap 1). When a prompt is sent, the window in front is remembered for that session, if it is a terminal or an editor (`src/main/windows.ts`; the list of program names is `HOSTS` there). Clicking "finished", "needs your answer" or an agent's notice brings that window forward, and so does "In terminal" on a card. Helper commands: `foreground-info`, and `activate` with a `pid` so a reused handle is never used. It picks the window, not the tab inside Windows Terminal. A session is only known after its first prompt while Helo runs. Tests in `test/windows.test.ts`; the helper commands were run by hand on this PC, the click on a real banner was not.
- **Click a notification to open its app** (gap 6). The helper passes on the app id Windows gives with the notification and opens it only if Windows lists that app (`Open-App` in `winhelper.ps1`): a window that is open comes forward, otherwise the app is started as from the Start menu. Run by hand against VS Code; not tried with a real Slack or Outlook notification.

## Not yet tried

Everything here was built and unit-tested but not used by hand. A live Claude Code session and ten minutes with the installed app cover most of it.

- **The new installer:** install it, then uninstall it. Check that the hooks leave `~/.claude/settings.json`, that it asks about the data folder, and that an update over an existing install leaves both alone.
- **Typing on a card (A5):** a real Claude Code question and a real plan. Does the text field take the keyboard, and does focus go back to the terminal after sending?
- **"Needs your answer" coming back** after "Copied" or a download banner covers it.
- **Copy diagnostics** and **Show log file** in Settings, General, Help.
- **Clipboard:** the Pause button in the tab, and that the old history is still there after the first start (it is encrypted on that start).
- **Calendar Join** with a real feed that has Zoom, Meet or Teams links, and the banner a minute before.
- **Low disk space** banner on screen (set the limit above the free space to see it; this PC has 44 GB free).
- **Port fallback:** only with care. It rewrites the real hook files when 47615 is taken.
- Gemini CLI and Cursor against a live session. Neither is installed on this PC. Gemini CLI's docs say it was replaced by Antigravity CLI in June 2026; whether Antigravity reads the same file was not checked.
- The half-second click guard on cards, and the Alt+Shift+Y / Alt+Shift+N shortcuts on the user's keyboard.
- Notifications on Windows 11 or a clean account (Windows may ask for permission there).
- The lines-changed count on a live Claude Code session.

## Gaps against halo-mac.com

Checked on 2026-11-16 against the home page and the changelog (Halo 3.0.2). This is what Halo lists that Helo does not have, most useful first. The tick boxes are in `TODO.md`.

Agents:

1. **Click the finished banner to jump back to the terminal.** Halo's banner does this. Helo's banner is not clickable. The helper can already bring a window to the front (`activate`); what is missing is knowing which window belongs to a session.
2. **A sound when an agent needs you.** Halo plays one for a permission, a question or a plan. Helo is silent.
3. **Agents tab: the file being edited, and an Answer button** on a session that waits. Helo shows the session, its state and lines changed.
4. **OpenCode connection.** Waits on OpenCode being installed here (see "Needs you" in `TODO.md`).
5. **Codex usage rings.** Halo shows usage limits for Claude Code and Codex. Helo has Claude Code only.

Notifications:

6. **Click a notification banner to open the app that sent it.**
7. **"Never twice":** Halo hides the system's own banner while it shows the notification. On Windows both show. Check first whether Windows lets an app do this at all; if not, say so in the FAQ and drop it.

Meetings:

8. **Camera check a minute before a meeting** (a mirror with a Join button).
9. **Calls:** how long an app has had the microphone, click to go back to the meeting, and a mute switch. Helo shows which app uses the microphone or camera, nothing more.

Tools:

10. **`helo://` links** for scripts: show a banner, start a timer, keep awake, add to the shelf, open a tab.
11. **Document conversion on the shelf** (Markdown, HTML, Word, PDF). Helo converts images only (PNG, JPG, WebP).
12. **Hold-to-talk dictation.** The largest item here. Windows has its own (Win+H), so decide whether it is worth building.
13. **Step aside for a minute** (Halo: Option-click the island) and a right-click menu on the island (Settings, Hide, Quit). Helo has these in the tray menu only.
14. **Timer set by dragging a ruler**, up to three hours. Helo sets lengths in Settings.
15. **Music:** shuffle and repeat buttons, and the song title or current lyric line beside the closed island.

Product:

16. **Updates.** Halo updates itself after asking. Helo has no update check (R3; signing comes first, R2).
17. **Languages.** Halo is in eight. Helo is in English.
18. **Show on several displays.** Halo can be on any set of displays. Helo sits on one.
19. **Look:** Halo has glass, tint, corner and shadow controls. Helo has two accent colours.

Site (all wait on the user): the film, quotes from buyers, the terms page, and a pricing section with a working buy link.

Not gaps, so do not build them: Halo's lock screen controls and its notch options are for Macs; Helo has a 7-day trial, the work map and Steam and app-watch alerts, which Halo does not.

## Do next, in this order

1. Done in the third session: click a banner to go to the session's window, click a notification to open its app.
2. **A sound when an agent needs you** (gap 2), with a switch and a volume in Settings. Off in fullscreen is the user's call; default on. Planned, nothing on disk yet: `settings.sound = { on, volume, fullscreen }` (not a feature switch, so the site's count of 22 stays); a pure `shouldChime` in `src/main/sound.ts` (one sound per 1.5 s); main sends a `sound` message to the island, which plays two soft notes with WebAudio (no sound file; the island window needs `autoplayPolicy: 'no-user-gesture-required'`); it plays when a card appears and when a "needs your answer" banner shows; Settings, AI agents gets the switch, a volume slider, a Play button and "Also in fullscreen".
3. **Agents tab: file being edited and an Answer button** (gap 3).
4. **`helo://` links** (gap 10). Register the protocol in the installer; accept only the five actions, and never a file path from a link without the user seeing it.
5. **Right-click menu on the island and "step aside for a minute"** (gap 13).
6. **Music: shuffle, repeat, and the title beside the closed island** (gap 15).
7. **Calls: duration and click to return** (gap 9). Mute needs a per-app audio API; look before promising it.
8. **OpenCode** once it is installed, then **Codex usage rings** (gaps 4 and 5).
9. **Camera check** (gap 8), then **document conversion** (gap 11).
10. Still open from the audit: precompile the helper's C# (A2), CI (P2), `safeStorage` async calls, a visible status line when the app is closed (B2), the packaged build failing on unset store IDs (R1, once the store exists).

## Prompt for the next session

Paste this to start:

    Read NEXT_SESSION.md and TODO.md in C:\Users\primo\helo-win, then carry on
    down "Do next, in this order" in NEXT_SESSION.md, starting with item 2
    (a sound when an agent needs you; the plan is written beside it). These are the gaps
    against halo-mac.com; the full list is under "Gaps against halo-mac.com".
    Work through as many items as you can without stopping to ask. After each
    item: run typecheck, tests and build, tick it in TODO.md, commit and push
    to main. Keep NEXT_SESSION.md up to date as you go. Keep the site's copy
    (site/lib/product.ts, the changelog and the privacy page) in step with
    what you build. Run things for me instead of telling me the command. If
    something needs my decision, pick the sensible default, note it in TODO.md
    under "Needs you", and keep going. At the end, rebuild the installer
    (it was last built before the third session's changes).

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
