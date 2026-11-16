# To do before launch

Written 2026-11-16. Everything found missing in the launch check and in the comparison with halo-mac.com (checked again the same day against Halo 3.0.2; the ordered list is in `NEXT_SESSION.md`).
Finding IDs (S1, R2, ...) point to `audit/`. Tick a box when the item is built and checked.

## Needs you (I cannot do these)

- [ ] **Final name.** "Helo" and "Blink" are placeholders. The name is in the app ID, the data folder, the hook paths and the backup files (R8).
- [ ] **Lemon Squeezy product.** Then set `buyUrl`, `storeId`, `productId` in `app/src/main/config.ts` and `buyUrl` in `site/lib/product.ts` (R1).
- [ ] **Support email address** for the site footer, privacy page and terms.
- [ ] **Terms: seller name, refund rule, governing law.** The page is drafted once these are known.
- [ ] **Where the installer is hosted** (the site has no download; the trial needs one).
- [ ] **Code-signing certificate** (R2). Needed before auto-update.
- [x] **Try on a live session:** you tested the app on 2026-11-16 and reported that the map and everything else works.
- [ ] **Try Gemini CLI and Cursor once** (built from their docs; neither is installed on this PC).
- [ ] **Install OpenCode on this PC** (`npm i -g opencode-ai`), or say I may. The OpenCode connection needs it to see the real permission payloads; I skipped it for now.
- [ ] **Install the new installer, then uninstall it** (`app/dist/Helo-Setup-0.1.0.exe`). Check that the hooks leave `~/.claude/settings.json` and that it asks about your data. I did not run it on this PC because it would touch your real setup.
- [ ] **Try on a live Claude Code session:** type an answer to a question, send feedback on a plan, and see "needs your answer" come back after another banner. The list is under "Not yet tried" in `NEXT_SESSION.md`.
- [ ] **Two choices I made for you; say if you want them changed.** Deleting the licence file still restarts the trial. A licensed PC that stays offline keeps working (Halo stops after two weeks offline).
- [ ] **Dictation:** build hold-to-talk, or leave it to Windows' own (Win+H)? I left it out.
- [ ] **Restart the app to see the fourth session's work.** A development copy has been running since 2026-11-15 evening; I did not close it. Quit it from the tray, then `npm start` in `app/`, or install `app/dist/Helo-Setup-0.1.0.exe`.
- [ ] **Try the fourth session's features once:** the sound (Settings, AI agents, Play), right-click the island, a `helo://` link, shuffle and repeat with Spotify, a call (duration, Open, Mute microphone), Codex rings after a Codex run, a .docx to PDF. The list is under "Not yet tried" in `NEXT_SESSION.md`. This PC has no microphone or camera plugged in, so the call parts are untried.
- [ ] **Choices I made for you in the fourth session; say if you want them changed.**
  - The sound is on, at volume 60, and also plays in fullscreen (a switch turns that off).
  - `helo://` links are on. A link can show a banner, run the timer, keep awake, offer a file to the shelf (added only after a click) or open a tab.
  - "Hide" in the right-click menu lasts until "Show the island" in the tray menu, or until the app starts again. A card from an agent still shows.
  - "Mute microphone" mutes it for every app, because Windows has no supported per-app mute.
  - The song's title shows in the closed island while music plays (a switch turns that off).
  - Documents convert to HTML and PDF only. Nothing is written as Word.
  - Two new dependencies: `marked` (Markdown) and `mammoth` (Word files).
- [ ] **Camera check before a meeting:** build it? It would turn the camera on by itself a minute before a meeting, so I would ship it switched off. Not built; there is also no camera on this PC to try it with.
- [ ] **Install on a clean Windows account** and run the release checklist (R6).
- [ ] **Film, testimonials** for the site.

## App: safety of the main feature

- [x] Shortcuts that AltGr cannot produce (S1)
- [x] Cards show the whole command; Allow is blocked while part of it is cut off (S2)
- [x] Clicks ignored for half a second after a card appears or changes (S3)
- [x] "Needs your answer" banner comes back after a short banner replaces it (B3)
- [x] Port fallback when 47615 is taken (S7)

## App: agents

- [x] Gemini CLI connection (working, needs you, finished)
- [x] Cursor connection (working, finished, error)
- [ ] OpenCode connection (needs OpenCode installed here to test; its docs leave the payloads out)
- [x] Type a free answer or plan feedback on the island (A5)
- [x] Finished banner and Agents tab show lines changed
- [x] Click the finished banner to jump to the terminal (also "needs your answer" and the card's "In terminal" button)
- [x] A sound when an agent needs you (permission, question, plan, "needs your answer"); switch, volume and "Also in fullscreen" in Settings, AI agents
- [x] Agents tab shows the file a session is editing (Claude Code), and an Answer button on a session that waits (Open on the others) when its window is known
- [x] Codex usage rings (read from the limits Codex writes into its own session files; checked against a real file on this PC)

## App: release

- [x] Log file and "Copy diagnostics" in Settings (T1)
- [x] Uninstall removes the hooks and asks about the data folder (B2, R4)
- [x] Clipboard history: expiry, pause switch, encrypted on disk (S12)
- [x] Licence file protected with `safeStorage`; timeouts on licence calls (S10, S11)
- [ ] Packaged build fails when store IDs are unset (R1)
- [ ] Auto-update or a new-version check (R3)
- [x] Rebuild the installer (`app/dist/Helo-Setup-0.1.0.exe`, rebuilt at the end of the fourth session on 2026-11-16, unsigned)
- [ ] A visible status line in Claude Code when the app is not running (B2, second half)
- [ ] Move clipboard encryption to `safeStorage`'s async calls (Electron 45 marks the ones used as deprecated; they still work)
- [ ] Precompile the Windows helper's C# (A2)
- [ ] Browser extension: publish to the stores, or drop web chats from the first release (R5)
- [ ] CI: type check, tests, build (P2)

## App: features Halo has

- [x] Calendar: Join button for Zoom, Meet and Teams links; banner a minute before
- [x] Clipboard: search, filters, pins (already built; checked 2026-11-16)
- [x] Focus timer: long break
- [x] Disk-space warning
- [ ] Camera check a minute before a meeting, with the Join button
- [x] Calls: how long an app has had the microphone or camera, click to return to it, and a microphone mute (for every app; Windows has no supported per-app microphone mute)
- [x] Document conversion on the shelf: Markdown and Word (.docx) to HTML or PDF, HTML and text to PDF (nothing is written as Word)
- [x] `helo://` links for scripts: banner, timer, awake, shelf (after a click), open a tab; switch in Settings, General
- [x] Notifications from other apps, with a switch per app (works without a Store package; checked with a real toast)
- [x] Notifications: click the banner to open the app that sent it
- [ ] Notifications: hide Windows' own banner while the island shows it, if Windows allows it
- [ ] Notifications: try on Windows 11 and on a clean account (does Windows ask for permission there?)
- [ ] Hold-to-talk dictation (see "Needs you")
- [ ] More languages (Halo has eight)
- [x] Right-click menu on the island (Settings, Step aside 1 min, Hide, Quit); the same in the tray menu, with "Show the island"
- [ ] Timer: set the length by dragging, up to three hours
- [x] Music: shuffle and repeat (in apps that let Windows change them), and the title or lyric line beside the closed island
- [ ] Show the island on more than one display
- [x] Blink can be joined to the island as one piece (Settings, Features, Blink; off by default)
- [ ] Look: more than two accent colours (Halo has glass, tint, corners, shadow)

## Site

- [x] Privacy page
- [ ] Terms page (waits on "Needs you")
- [x] Footer with links
- [x] `robots.txt`, `sitemap.xml`, share image and social tags
- [ ] Download button for the trial (waits on hosting)
- [x] Tech specs section
- [x] Changelog page
- [x] More FAQ questions (fullscreen, which agents, do I need Claude Code)
- [x] Deploy the updated copy (pushed to main on 2026-11-16)
