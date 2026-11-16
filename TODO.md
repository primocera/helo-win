# To do before launch

Written 2026-11-16. Everything found missing in the launch check and in the comparison with halo-mac.com.
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
- [ ] Agents tab shows the file a session is editing
- [ ] Click the finished banner to jump to the terminal
- [ ] Codex usage rings

## App: release

- [x] Log file and "Copy diagnostics" in Settings (T1)
- [x] Uninstall removes the hooks and asks about the data folder (B2, R4)
- [x] Clipboard history: expiry, pause switch, encrypted on disk (S12)
- [x] Licence file protected with `safeStorage`; timeouts on licence calls (S10, S11)
- [ ] Packaged build fails when store IDs are unset (R1)
- [ ] Auto-update or a new-version check (R3)
- [ ] Rebuild the installer (the one in `app/dist` is from 13 Nov)
- [ ] Move clipboard encryption to `safeStorage`'s async calls (Electron 45 marks the ones used as deprecated; they still work)
- [ ] Precompile the Windows helper's C# (A2)
- [ ] Browser extension: publish to the stores, or drop web chats from the first release (R5)
- [ ] CI: type check, tests, build (P2)

## App: features Halo has

- [ ] Calendar: Join button for Zoom, Meet and Teams links; banner a minute before
- [x] Clipboard: search, filters, pins (already built; checked 2026-11-16)
- [ ] Focus timer: long break
- [ ] Disk-space warning
- [ ] Camera check before a call
- [ ] Document conversion on the shelf (PDF, Markdown, Word)
- [ ] `helo://` links for scripts
- [x] Notifications from other apps, with a switch per app (works without a Store package; checked with a real toast)
- [ ] Notifications: click the banner to open the app that sent it
- [ ] Notifications: try on Windows 11 and on a clean account (does Windows ask for permission there?)
- [ ] Hold-to-talk dictation
- [ ] More languages

## Site

- [x] Privacy page
- [ ] Terms page (waits on "Needs you")
- [x] Footer with links
- [x] `robots.txt`, `sitemap.xml`, share image and social tags
- [ ] Download button for the trial (waits on hosting)
- [ ] Tech specs section
- [ ] Changelog page
- [ ] More FAQ questions (fullscreen, which agents, do I need Claude Code)
- [x] Deploy the updated copy (pushed to main on 2026-11-16)
