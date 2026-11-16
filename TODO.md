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
- [ ] Codex usage rings

## App: release

- [x] Log file and "Copy diagnostics" in Settings (T1)
- [x] Uninstall removes the hooks and asks about the data folder (B2, R4)
- [x] Clipboard history: expiry, pause switch, encrypted on disk (S12)
- [x] Licence file protected with `safeStorage`; timeouts on licence calls (S10, S11)
- [ ] Packaged build fails when store IDs are unset (R1)
- [ ] Auto-update or a new-version check (R3)
- [x] Rebuild the installer (`app/dist/Helo-Setup-0.1.0.exe`, built 2026-11-16, unsigned)
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
- [ ] Calls: how long an app has had the microphone, click to return to the meeting, mute
- [ ] Document conversion on the shelf (PDF, Markdown, Word)
- [ ] `helo://` links for scripts
- [x] Notifications from other apps, with a switch per app (works without a Store package; checked with a real toast)
- [x] Notifications: click the banner to open the app that sent it
- [ ] Notifications: hide Windows' own banner while the island shows it, if Windows allows it
- [ ] Notifications: try on Windows 11 and on a clean account (does Windows ask for permission there?)
- [ ] Hold-to-talk dictation (see "Needs you")
- [ ] More languages (Halo has eight)
- [ ] Right-click menu on the island (Settings, Hide, Quit) and "step aside for a minute"
- [ ] Timer: set the length by dragging, up to three hours
- [ ] Music: shuffle and repeat, and the title or lyric line beside the closed island
- [ ] Show the island on more than one display
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
