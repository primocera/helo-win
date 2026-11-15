# Security and trust

The app's most dangerous power is approving what a coding agent may run. Findings about that come first.

## Approvals

### S1 — The global shortcuts fire on AltGr (High, Likely)

`syncShortcuts()` in `src/main/index.ts` registers `Control+Alt+Y` and `Control+Alt+N` system-wide while a card is waiting. Windows treats AltGr as Ctrl+Alt, so AltGr+N and AltGr+Y match. On Slovenian and Croatian layouts AltGr+N types `}`; other layouts use AltGr with other letters. Someone typing code while a card is up can deny or allow it without knowing. The key press is also swallowed, so the character never reaches the editor.

- Verify: with a card showing, press AltGr+N on a layout that has AltGr.
- Fix: choose a combination that AltGr cannot produce (for example Ctrl+Shift+F9 style, or Win-based), make it configurable, and consider making Allow need a deliberate key while Deny stays easy.

### S2 — Approving something you cannot fully see (High, Confirmed)

- `summarize()` in `src/main/format.ts` collapses whitespace and cuts at 400 characters; `.card-summary` in `island.css` then clamps to 3 lines (roughly 180 characters). A command such as `npm test && <long padding> && curl … | sh` shows only its harmless start.
- Plan text is cut at 6,000 characters in `permissionView()` with no sign that it was cut.
- `summarize()` shows only the first of `command`, `file_path`, `url`, `pattern`, `query`. For other tools (MCP tools, `Agent`) it shows clipped JSON.
- Collapsing whitespace hides newlines, so a multi-line script reads as one line.

Fix: make the summary scrollable instead of clamped, show a clear "N more characters" marker, and when the text is cut, either show all of it on demand or disable the Allow shortcut for that card.

### S3 — A card can appear under the pointer (High, Likely)

The island sits at the top-centre of the screen, where browser tabs and title bars are. When a card arrives, the window grows and becomes clickable as soon as the pointer is over it. A click already on its way lands on Allow, Always allow or an answer option. Question cards answer on a single click.

Fix: ignore clicks on a card for a short time after it appears (about 500 ms) and after it changes to the next queued card.

### S4 — "Always allow" hides how far the rule reaches (Medium, Confirmed)

`alwaysAllowSuggestion()` takes the first allow rule Claude Code suggests, whatever its `destination` (`session`, `localSettings`, `projectSettings`, `userSettings`). The button shows the rule only in a tooltip and never the scope. One click can add a rule for every project.

Fix: show the rule and the scope on the card ("for this project", "everywhere"), and consider offering only `session` and `localSettings`.

### S5 — Rejecting a plan is undocumented behaviour (Medium, Unverified)

The hooks documentation says how to approve `ExitPlanMode` from a hook but not what a deny does. The island sends a deny with a message. Needs one live session to confirm Claude keeps planning rather than stopping or looping.

### S6 — A malformed question becomes a normal Allow/Deny card whose Allow does nothing (Low, Confirmed)

If `AskUserQuestion` input does not match the documented shape, `permissionView()` falls back to `kind: 'tool'`. The bridge then turns Allow into "no decision". The card closes and the question appears in the terminal, which looks like the click was ignored. Show "Answer in terminal" only for that case.

## The local endpoint

### S7 — Fixed port with no fallback, and the token is sent to whoever holds it (Medium, Confirmed)

The port is saved once (47615). If another program has it, `bridgeError` is set and nothing works until the user frees it. Meanwhile Claude Code keeps posting hook events, with the bearer token, to that other program.

Fix: on a busy port, pick a free one, save it, and rewrite the hooks. Add a cheap identity check (for example a `GET /helo/hello` that the installer can test) before trusting a port.

### S8 — The token sits in plain text in three places (Low, Confirmed)

`bridge.json`, `~/.claude/settings.json` (often kept in dotfile repositories) and the Codex and status-line command lines, which other processes of the same user can read. The token only lets a local program post events and fake cards, so the impact is spoofed alerts, not approvals. Worth documenting; offer "regenerate token" in Settings.

### S9 — Requests over 1 MB are dropped silently (Low, Confirmed)

A `Write` of a large file gets a 413. Claude Code treats that as a non-blocking error and asks in the terminal, so the island shows nothing. Either raise the cap for the hook route or show a banner saying the request was too large for a card.

## Licensing and payment

### S10 — The licence can be forged or reset by editing one file (Low for a $9.99 app, Confirmed)

In `src/main/license.ts`:

- Deleting `license.json` restarts the 7-day trial.
- `status()` returns licensed whenever the file has any `key` and `instanceId`. Setting `validatedAt` far in the future skips revalidation forever.
- Being offline (or blocking the store's host) keeps a revoked key working indefinitely.

This is acceptable for a small one-time purchase, but it should be a decision, not an accident. A cheap improvement: store the licence with Electron `safeStorage` (Windows DPAPI) and treat a `validatedAt` in the future as invalid.

### S11 — Licence calls have no timeout and assume JSON (Medium, Confirmed)

`post()` uses `fetch` with no abort and calls `res.json()` directly. A hanging connection leaves the Activate button waiting; an HTML error page throws a parser error that is shown to the user as-is. `license.json` is also written with a plain `writeFileSync`, unlike every other file, so a crash mid-write resets the trial.

See R1 in [05-release-readiness.md](05-release-readiness.md) for the unset store IDs, which is the serious licensing problem.

## User data

### S12 — Clipboard history (High, Confirmed)

- Password managers are skipped only through the helper's exclusion flag. `pollClipboardFallback()` runs when the helper is not running and captures text with no such check. The helper gives up permanently after 5 restarts, so this path is reachable.
- The exclusion flag only covers apps that set it. Passwords copied from a web page, tokens from a terminal and one-time codes are stored.
- Everything is plain text and PNG files in the data folder, with no expiry, and the installer keeps the folder on uninstall (`deleteAppDataOnUninstall: false`).

Fix: do not capture at all without the exclusion signal; add an expiry (for example 24 hours for unpinned clips) and a pause switch; encrypt the index with `safeStorage`; ask on uninstall whether to remove data.

### S13 — Calendar address (Low, Confirmed)

The private iCal address is a secret. `cleanIcsUrl()` accepts `http://`, which sends it unencrypted. The 5 MB limit is checked after the whole response is downloaded. Require https and stop reading at the limit.

### S14 — The site's privacy answer is incomplete (Medium, Confirmed)

`site/lib/product.ts` says only the licence key leaves the PC. With lyrics on, track titles and artists go to lrclib.net; with a calendar set, the app fetches that address. Both are opt-in, but the answer should list them.

## Browser extension

### S15 — Brittle and over-broad page detection (Medium, Confirmed)

`extension/content.js` treats any button whose label is exactly "stop" or starts with "stop response/generating/…" as "an answer is being written". A voice or audio "Stop" button will read as working. The selectors depend on markup the sites change often, and nothing reports when they stop matching. Add a self-check ("no state seen for N answers") and keep the selectors in one table.

### S16 — Load-unpacked only (see R5)

Chrome shows a developer-mode warning on every start and Edge does similar. This is a distribution problem, covered in the release file.
