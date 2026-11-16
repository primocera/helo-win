# helo-win

Two separate projects live in this repo.

## app/ — Helo (an island at the top of your Windows screen)

A black island attached to the top (or bottom) edge of the screen, with Blink,
a small face beside it. Hover it to open a panel with one icon per feature.
Electron + React + TypeScript, built with electron-vite. "Helo" and "Blink" are
placeholder names kept in `src/shared/brand.ts`.

    cd app
    npm install
    npm run build    # compile main, preload and the two pages into out/
    npm start        # run the built app (tray icon → Settings, Connect Claude Code)
    npm run dev      # development mode with hot reload
    npm test         # unit tests (vitest)
    npm run typecheck
    npm run dist     # Windows installer (NSIS, unsigned) into dist/

Two test modes run with a temporary data folder and temporary agent config
files (they never touch `~/.claude` or `~/.codex`):

    npm run build
    node_modules/electron/dist/electron.exe . --smoke=<folder>        # screenshots of every view, with sample data
    node_modules/electron/dist/electron.exe . --selftest=<file.json>  # checks the real Windows integrations

### Features

| Area | What it does | How |
| --- | --- | --- |
| Agents | Allow / Always allow / Deny cards for Claude Code and Codex CLI, with a queue; red/green changed lines on Claude Code's Edit and Write cards; answer Claude Code's multiple-choice questions and approve or reject its plans from the island (or send either back to the terminal); "finished" and "needs your answer" banners; Alt+Shift+Y / Alt+Shift+N (not Ctrl+Alt, which is AltGr on many keyboards). Gemini CLI and Cursor are watch-only: working, finished (with the start of the last answer), and for Gemini CLI "needs your answer"; their approvals stay in the terminal or in Cursor | Claude Code HTTP hooks (questions and plans are answered with `updatedInput`, as the hooks docs describe); Codex command hooks that `curl.exe` the same local endpoint; Gemini CLI command hooks in `~/.gemini/settings.json` (`BeforeAgent`, `AfterAgent`, `Notification`, `AfterTool`) and Cursor command hooks in `~/.cursor/hooks.json` (`beforeSubmitPrompt`, `afterAgentResponse`, `stop`), turned into Helo's own events by `src/main/agent-events.ts`. Neither documents a hook that can answer its approval prompt |
| Work map | A panel tab with a live map of what Claude Code is using: You, Model, Memory, Files, Shell, Network, Browser, Agents, Skills, with pulses for each call and the rows of what it did. Names only, never contents | The drawing, classifier and rows are lot-map's (MIT, copied into `src/shared/map/`); the board is built in `src/main/workmap.ts` from extra Claude Code HTTP hooks (`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `SubagentStart`, `SubagentStop`, `PreCompact`) and the status line. Model steps are inferred from the gaps between tool calls; the Hooks station stays quiet because a hook cannot see other hooks |
| Browser chats | Blink "thinks" while Claude or ChatGPT writes an answer on the web; a "finished answering" banner if you were looking elsewhere | The extension in `extension/` (Chrome/Edge, load unpacked) posts to the local endpoint with its own pairing code |
| Startup apps | Lists the apps that open when you sign in to Windows and switches them on or off | The same `StartupApproved` flags Task Manager uses (`reg.exe`); all-users entries are read-only |
| Usage rings | Claude 5-hour and weekly limits | `rate_limits` from Claude Code's documented status line input (Pro/Max/Ultra plans); only added if you have no status line of your own |
| Now Playing | Title, artist, artwork, play/pause/next/previous, seek bar when the app allows it, optional synced lyrics | Windows media sessions (WinRT) through the helper; lyrics from lrclib.net (off by default) |
| Focus timer | Focus/break countdown in the pill, banner when a phase ends | |
| Clipboard history | Text and images, click to copy back, clear, size cap; skips copies password managers mark as private | Stored in the app's data folder |
| Notes | A scratchpad, saved as you type | |
| File shelf | Drop files on the island, drag them out into any app, convert images (PNG/JPG/WebP); new screenshots are added by themselves | Keeps paths, not copies; `fs.watch` on Pictures\Screenshots (Win+PrtScn and Snipping Tool autosave; Win+Shift+S only copies, so it lands in clipboard history instead) |
| Finished alerts | Browser downloads finished; Steam game downloaded/updated; an app you pick closed or went quiet (an estimate) | `fs.watch` on Downloads and Steam's `appmanifest_*.acf`; CPU of the process tree for the app watch |
| System | Keep awake, volume HUD and slider, battery alerts, Bluetooth device battery levels, microphone/camera in use, external monitor brightness, contrast and input switching | Electron power save blocker; Core Audio, GetSystemPowerStatus, the privacy consent store and DDC/CI (VCP 0x10, 0x12, 0x60) through the helper; Bluetooth levels from the device property Windows itself shows, read by a short PowerShell run every 5 minutes |
| Notifications | Other apps' Windows notifications as a banner, with a switch per app (an app is listed after its first notification); nothing is saved; skipped while an agent card or a "needs your answer" banner is up | `UserNotificationListener` (WinRT) through the helper, read once a second. On the development PC (Windows 10 22H2) access is already allowed for an unpackaged app; where Windows says "Unspecified" the helper asks once |
| Calendar | Next events from a private iCal (.ics) address, reminder 5 minutes before | ical.js (handles repeats and time zones) |
| Blink | Face beside the island: calm, happy (hover), thinking (agent working or app watch), needs you, done, napping, something broke; eyes follow the pointer | SVG paths that morph between moods |
| Settings | Turn each feature on/off, start with Windows (installed app), which display, top or bottom edge, license | |

### Layout

- `src/main/` — main process. `index.ts` wires everything; `bridge.ts` (local hook endpoint on 127.0.0.1 with a bearer token), `hooks-install.ts` (Claude Code, Codex, Gemini CLI and Cursor config, with `.helo-backup`), `agent-events.ts` (Gemini CLI and Cursor events turned into Helo's), `workmap.ts` (the work map's board, from hook events), `license.ts` (7-day trial, Lemon Squeezy key), `winhelper.ts` (client for the helper), `finished*.ts`, `clipboard-history.ts`, `shelf.ts`, `timer.ts`, `calendar.ts`, `lyrics.ts`, `system.ts`, `smoke.ts` (test modes), `config.ts` (price, store IDs).
- `src/preload/index.ts` — the only API the pages get (`window.helo`); context isolation and sandbox on, no Node in pages.
- `src/renderer/` — React pages: `island.html` (the island) and `settings.html`.
- `src/shared/` — types and small helpers used on both sides. `shared/map/` is lot-map's code (see its README and LICENSE).
- `resources/winhelper.ps1` — one long-lived PowerShell 5.1 process (WinRT + C# compiled by Windows' own .NET Framework) that speaks JSON lines over stdio and exits when the app does. No native npm modules.
- `test/` — unit tests for the bridge, hook installers, license, settings, timer, clipboard, calendar, lyrics, Steam/download/app-watch logic and the helper protocol.

### Things you need to do

- **Store:** set `buyUrl`, `storeId` and `productId` in `src/main/config.ts` once the Lemon Squeezy product exists (activation limit 3 is set on the product).
- **Claude Code:** Settings → AI agents → Connect. This edits `~/.claude/settings.json` (a backup is kept). New sessions pick it up.
- **Codex CLI:** Connect, then run `/hooks` in Codex once and trust the hooks; Codex skips hooks it has not been told to trust.
- **Gemini CLI and Cursor:** Connect in Settings. Neither is installed on the development PC, so these two were built from the published hook docs and checked with unit tests and the real hook commands (through `cmd.exe` and PowerShell), not against a live session. Try each once before release.
- **Code signing:** the installer is unsigned, so SmartScreen warns until you sign it with a code-signing certificate.

### Not included

OpenCode (its plugin docs do not say whether a plugin may wait for the user's answer), hold-to-talk dictation, and typing a free-text answer or plan feedback on the island (those go to the terminal). Not testable on the development PC: laptop screen brightness (desktop PC), Bluetooth battery levels (no connected device reports one), and actually switching a monitor's input (reading it is tested; switching was not tried because it can blank the screen).

## game/ — Plaza (foundations for an original 2D hangout game)

Rooms by invite link, avatars with colours, click-to-walk, chat bubbles and
two areas joined by a door.

    cd game
    npm install
    npm start        # http://localhost:3000  (add ?room=myroom for a private room)
    npm test
