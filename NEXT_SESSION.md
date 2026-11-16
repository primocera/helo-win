# Next session

Written 2026-11-16, after the fourth session. Read this first, then `TODO.md` (the full list, with tick boxes). The reasoning behind the finding IDs (S1, B3, R2, ...) is in `audit/`.

## Where things stand

- **Everything is committed and pushed to `main`.** The site deploys from `main` to https://helo-win.vercel.app.
- **Checks on 2026-11-16 (fourth session):** `npm run typecheck`, `npm test` (203 tests) and `npm run build` pass in `app/`; `npm run lint` and `npm run build` pass in `site/`.
- **The installer was rebuilt at the end of the fourth session** and holds everything below: `app/dist/Helo-Setup-0.1.0.exe` (unsigned). It has not been installed or uninstalled by hand yet.
- **The app that is running on this PC is an old one.** A development copy (`electron .` in `app/`) has been running since 2026-11-15 19:07 and I left it alone. Quit it from the tray and run `npm start` in `app/` (or install the new installer) to see anything built on 2026-11-16.
- **The user tested the app on 2026-11-16** before the second, third and fourth sessions' changes were built, so everything under "Not yet tried" is still open.

## Built in the fourth session (2026-11-16)

Nine items, one commit each. All are unit-tested; what was and was not tried by hand is said for each.

- **A sound when an agent needs you** (gap 2). Two soft notes, made in the island's page with WebAudio (`src/renderer/src/island/sound.ts`; no sound file). It plays when a card appears and when a "needs your answer" banner shows, at most once in 1.5 seconds (`shouldChime` in `src/main/sound.ts`). Settings, AI agents, Sound: a switch, a volume slider with a Play button, and "Also in fullscreen". `settings.sound` is not a feature switch, so the site's count stays 22. Not heard by me: press Play in Settings.
- **Agents tab: the file being edited and an Answer button** (gap 3). `ChangeTracker` (`src/main/changes.ts`) remembers the file of the last Edit, Write, MultiEdit or NotebookEdit call per Claude Code session, from the work map's tool events and from permission requests; it is shown while the session is working or waiting. A session whose window is known gets a button: "Answer" when it waits, "Open" otherwise (`session:jump`). Seen in a screenshot with sample data; not on a live session.
- **`helo://` links** (gap 10). `src/main/links.ts` says what a link may ask for: `helo://banner?title=..&text=..`, `helo://timer/start|pause|reset|skip` (start takes `?minutes=1..180`), `helo://awake/on|off|toggle`, `helo://shelf/add?path=C:\..`, `helo://open/<tab>`. Anything else is refused. A shelf link only shows a banner with the path; the file is added when the user clicks. Network paths are refused. At most 8 links in 10 seconds. The installed app registers itself for the scheme at start (`syncLinkHandler` in `index.ts`), and `--disconnect-all` (the uninstaller) takes that out. Settings, General, Scripts has the switch. Not tried by hand: it needs the installed app. In development a link can be passed as an argument: `electron . "helo://timer/start"` while the app runs.
- **Right-click menu and "step aside"** (gap 13). Right-click the island or the face: Settings, Step aside 1 min, Hide, Quit (`MenuView` in `Views.tsx`; it is drawn in the island, not a Windows menu, because the island never takes focus). The tray menu has the same, and "Show the island" while it is hidden. A card still shows while the island is away (`stepAside` and `applyFullscreen` in `index.ts`). Seen in a screenshot; the right-click itself was not tried by hand.
- **Music: shuffle, repeat, and the song beside the closed island** (gap 15). The helper reads and sets shuffle and repeat through Windows' media session (`Invoke-Media` in `winhelper.ps1`); the buttons show only for apps that allow it. Reading was run on this PC (Edge reports neither, as expected); setting them was not tried, because nothing here allows it. Try with Spotify. The closed island grows to fit the title, or the lyric line when synced lyrics are on (`idleSong` in `src/shared/playback.ts`); Settings, Features, Now Playing has the switch. The timer's countdown takes that space when it runs.
- **Calls** (gap 9). The System tab lists each app that is using the microphone or camera with how long it has been on (the start time is Windows' own, from the registry), an "Open" button that brings that app forward (`Activate-ConsentApp` in the helper: by exe path, or by package name for Store apps), and "Mute microphone". The mute is for every app: Windows has no supported way to mute one app's microphone. Clicking the "Microphone on" banner also goes to the app. The helper's new commands were run on this PC with names that do not exist (they answer "no"). This PC has no microphone or camera plugged in, so the mute and a real call were not tried.
- **Codex usage rings** (gap 5). Codex CLI writes its limits into its own session files (`~/.codex/sessions/.../rollout-*.jsonl`, `token_count` lines); `src/main/codex-usage.ts` reads the newest one at start, every five minutes and when a Codex run ends. The Agents tab gets a Claude / Codex switch above the rings once Codex has limits that still hold. The format was taken from a real file on this PC (a free plan: one weekly window, last used in April, so nothing shows here now). The privacy page says that these files are read.
- **Document conversion** (gap 11). Markdown and Word (.docx) to HTML or PDF, HTML and text to PDF, from chips on the shelf (`src/main/documents.ts`, `printPdf` and `convertDocument` in `index.ts`, `src/shared/convert.ts`). Two new dependencies: `marked` and `mammoth`. The PDF is printed by a hidden window that runs no scripts and can load only files from the document's own folder. A real Markdown file with a picture, a table and a script was converted on this PC (`--smoke` now does this each time and leaves `sample.pdf` beside the screenshots): the picture is in, the script did not run. A .docx was not tried with a real file. Nothing is written as Word.
- **Blink joined to the island** (asked for by the user during the session). Settings, Features, Blink, "Join it to the island": the face becomes the left end of the island, in one piece, instead of sitting beside it with a gap. Off by default. It is all in the stylesheet (`.stage.joined` in `island.css`); `display.joined` is the setting. Seen in screenshots closed, with a banner, open, at the bottom edge and floating; not tried by hand.

Also: `--smoke` now takes screenshots of the menu, of sessions with a file and an Answer button, of a call in the System tab, and of the Codex switch; the settings screenshots are taken in an order that no longer shows the wrong page.

## Built earlier on 2026-11-16

First session: Gemini CLI and Cursor connections (watch only), notifications from other apps, card safety (S1, S2, S3), lines changed, privacy page. Second session: banner queue (B3), port fallback (S7), log file and Copy diagnostics (T1), uninstall cleanup (B2, R4), typing on a card (A5), clipboard safety (S12), licence protection (S10, S11), calendar Join, long break, low disk space, tech specs and changelog on the site. Third session: click a banner to go to the session's window, click a notification to open its app. The details are in the git log and in `TODO.md`.

## Not yet tried

Everything here was built and unit-tested but not used by hand. A live Claude Code session and fifteen minutes with the new build cover most of it.

From the fourth session:

- **The sound:** Settings, AI agents, Play. Then a real card. Is it the right loudness at 60?
- **Right-click the island:** each of the four buttons. Does the island come back after a minute?
- **A `helo://` link** from the installed app: `start helo://banner?title=Hi` in a terminal, then `helo://shelf/add?path=...` and click the banner.
- **Shuffle and repeat** with Spotify, and the song title beside the closed island.
- **A call** (Zoom, Teams or Meet in a browser): the duration, "Open", and "Mute microphone".
- **Codex rings** after a Codex run.
- **Convert a .docx** to PDF from the shelf.
- **The Answer button** on a session that waits in the terminal.

From before:

- **The installer:** install it, then uninstall it. Check that the hooks leave `~/.claude/settings.json`, that it asks about the data folder, and that an update over an existing install leaves both alone.
- **Typing on a card (A5):** a real Claude Code question and a real plan. Does the text field take the keyboard, and does focus go back to the terminal after sending?
- **"Needs your answer" coming back** after "Copied" or a download banner covers it.
- **Click a banner** to go to the terminal, and a real Slack or Outlook notification to open its app.
- **Copy diagnostics** and **Show log file** in Settings, General, Help.
- **Clipboard:** the Pause button in the tab, and that the old history is still there after the first start.
- **Calendar Join** with a real feed that has Zoom, Meet or Teams links, and the banner a minute before.
- **Low disk space** banner on screen (set the limit above the free space to see it).
- **Port fallback:** only with care. It rewrites the real hook files when 47615 is taken.
- Gemini CLI and Cursor against a live session. Neither is installed on this PC.
- The half-second click guard on cards, and the Alt+Shift+Y / Alt+Shift+N shortcuts.
- Notifications on Windows 11 or a clean account.
- The lines-changed count on a live Claude Code session.

## Gaps against halo-mac.com that are still open

Checked on 2026-11-16 against the home page and the changelog (Halo 3.0.2). The numbers are the ones used before.

- 4. **OpenCode connection.** Waits on OpenCode being installed here (see "Needs you" in `TODO.md`).
- 7. **"Never twice":** hide Windows' own banner while the island shows the notification. Not looked into yet. Check first whether Windows lets an app do this at all; if it does not, say so in the FAQ and drop it. (My guess, not checked: an app can remove a notification, which also deletes it from the notification centre, but cannot just hide the banner.)
- 8. **Camera check a minute before a meeting** (a mirror with a Join button). Not built: it turns the camera on by itself, so it should be off until the user asks for it, and this PC has no camera to try it on. See "Needs you".
- 12. **Hold-to-talk dictation.** Waits on the user's decision.
- 14. **Timer set by dragging a ruler**, up to three hours.
- 16. **Updates** (R3; signing comes first, R2).
- 17. **Languages.** Halo is in eight. Helo is in English.
- 18. **Show on several displays.**
- 19. **Look:** glass, tint, corner and shadow controls. Helo has two accent colours.

Site (all wait on the user): the film, quotes from buyers, the terms page, and a pricing section with a working buy link.

Not gaps, so do not build them: Halo's lock screen controls and its notch options are for Macs; Helo has a 7-day trial, the work map and Steam and app-watch alerts, which Halo does not.

## Do next, in this order

1. **Timer set by dragging** (gap 14): a ruler in the timer tab, 1 minute to 3 hours. `helo://timer/start?minutes=` already starts a session of any length; the same path can serve the ruler.
2. **"Never twice"** (gap 7): find out, then build it or write the FAQ line.
3. **Show on several displays** (gap 18). One island window per display; start from `targetDisplay` and `placeIsland` in `index.ts`.
4. **Look** (gap 19): more accent colours first, then corner and shadow.
5. **Camera check** (gap 8), once the user has said yes and there is a camera to try it with.
6. **OpenCode** (gap 4), once it is installed.
7. **CI** (P2): a GitHub Actions workflow for typecheck, tests and build on Windows. Not added yet because pushing a workflow file may need a token with the `workflow` permission; try it and see.
8. Still open from the audit: precompile the helper's C# (A2), `safeStorage` async calls, a visible status line when the app is closed (B2), the packaged build failing on unset store IDs (R1, once the store exists).
9. **Languages** (gap 17): a big job; ask which languages first.

## Prompt for the next session

Paste this to start:

    Read NEXT_SESSION.md and TODO.md in C:\Users\primo\helo-win, then carry on
    down "Do next, in this order" in NEXT_SESSION.md, starting with item 1
    (set the timer by dragging). These are the gaps against halo-mac.com that
    are still open. Work through as many items as you can without stopping to
    ask. After each item: run typecheck, tests and build, tick it in TODO.md,
    commit and push to main. Keep NEXT_SESSION.md up to date as you go. Keep
    the site's copy (site/lib/product.ts, the changelog and the privacy page)
    in step with what you build. Run things for me instead of telling me the
    command. If something needs my decision, pick the sensible default, note
    it in TODO.md under "Needs you", and keep going. At the end, rebuild the
    installer.

## Waiting on the user

The name, the Lemon Squeezy product (store IDs and buy link), a support email, the terms details (seller name, refund rule, governing law), where the installer is hosted, and a code-signing certificate. The terms page and the download button wait on these. Details, and the choices made for the user in the fourth session, are at the top of `TODO.md`.

## Useful commands

Run in `app/`:

    npm run typecheck                                                # about a minute and a half
    npm test
    npm run build
    npm start                                                        # run the built app
    npm run dist                                                     # installer into dist/
    node_modules/electron/dist/electron.exe . --smoke=<folder>       # screenshots with sample data, and a sample PDF
    node_modules/electron/dist/electron.exe . --selftest=<file.json> # real Windows integrations; quit the normal app first

Run in `site/`: `npm run lint`, `npm run build`. Read `site/AGENTS.md` before changing the site: this Next.js version differs from older ones, and its docs are in `site/node_modules/next/dist/docs/`.
