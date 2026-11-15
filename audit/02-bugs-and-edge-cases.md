# Bugs and edge cases

All file names are under `app/`.

## Claude Code integration

### B1 — The settings backup is overwritten on every write (High, Confirmed)

`writeSettings()` in `src/main/hooks-install.ts` copies the current file to `settings.json.helo-backup` before each write. Connect, then toggle the usage rings, or reconnect, and the backup is now a copy that already contains Helo's hooks. The user's original file is gone.

Fix: keep the first backup (write it only if it does not exist), or keep dated backups and prune to the last few.

### B2 — Uninstalling leaves hooks and the status line behind (High, Confirmed)

`electron-builder.yml` has no uninstall step. After removal, Claude Code still has four HTTP hooks that fail on every event and a status line command that prints nothing. The same happens if the user simply stops running the app: the status line goes blank with no explanation.

Fix: an NSIS uninstall macro that runs the app with a `--disconnect` flag (or a small script) to strip the hooks; and make the status line command fall back to something visible when the app is not running.

### B3 — One banner slot (High, Confirmed)

`showBanner()` holds a single banner. "Claude needs your answer" is meant to stay until clicked, but any later banner replaces it: "Copied" (1.5 s), "Screenshot added to the shelf", a download, a battery alert. When the short one expires the slot is empty and the waiting alert is lost. The mascot still shows "needs you", but the text is gone.

Fix: a small priority queue. Sticky banners return after a transient one finishes.

### B4 — Denying marks the session as finished (Low, Confirmed)

`settle()` records a `Stop` event on deny, so the agents tab shows the session as done and the mascot celebrates. After a deny Claude normally carries on working. Record `PermissionResolved` for both outcomes.

### B5 — A question at the front blocks the shortcuts for everything behind it (Low, Confirmed)

The shortcuts act on the first queued request. When that is a question, `settle()` ignores them, so tool requests queued behind it cannot be answered by keyboard either.

### B6 — Whether the card closes when the user answers in the terminal (Medium, Unverified)

The card is removed only when the hook's HTTP connection closes. If Claude Code keeps the connection open after the user answers in the terminal, the card stays for up to 280 seconds and a late click does nothing. Needs one live check; if it stays, close the card on the next `PostToolUse`/`UserPromptSubmit` for that session.

### B7 — Corrupt local files are replaced silently (Medium, Confirmed)

`readJson()` returns the fallback on any error. A damaged `settings.json` becomes defaults and is saved over. A damaged `bridge.json` produces a new token, which silently disconnects Claude Code, Codex and the browser extension. Keep the bad file aside as `.corrupt` and tell the user.

### B8 — Two writers on `~/.claude/settings.json` (Low, Confirmed)

Claude Code writes that file too (for example when it saves an "always allow" rule). Helo reads, changes and writes with no check that the file is unchanged in between. Re-read and compare just before the rename.

## Windows helper

### B9 — The helper gives up for good (Medium, Confirmed)

After 5 failed restarts the status is `failed` until the app is restarted. Media, volume, privacy, clipboard exclusion, displays and window focus all stop. Nothing retries later (for example after sleep/resume, a common cause of the pipe dying), and the only sign is the mascot's "broken" face.

Fix: retry on a slow timer and on `powerMonitor` resume; say in the System tab what stopped working.

### B10 — One slow command stalls everything in the helper (Medium, Confirmed)

The helper is a single loop. A DDC/CI read can take seconds per monitor, and `refreshDisplays()` now makes three of them (brightness, contrast, input). During that time media, volume and clipboard events wait, and other requests can hit their 8-second timeout. Read all three codes in one call, and cache the monitor list.

### B11 — Monitor index can change between listing and setting (Low, Confirmed)

`ddc-set` addresses a monitor by its position in a fresh enumeration. Plugging or unplugging a display between the list and the set changes the wrong monitor. Address monitors by a stable identifier.

### B12 — Input switching has no way back (Medium, Confirmed)

Clicking an input the PC is not connected to can leave that screen dark, and the island may be on that screen. There is no confirmation and no timed revert. Add a confirm step and switch back automatically if the user does not confirm within a few seconds.

## Island window

### B13 — A crashing renderer reloads forever (Low, Confirmed)

`render-process-gone` reloads at once with no limit or delay. A crash that repeats (for example a huge image sent for conversion) becomes a tight loop.

### B14 — Image conversion can exhaust the renderer (Low, Confirmed)

`convertImage()` allows 60 MB files and sends the bytes over IPC to the island page, which decodes them on a canvas. A 60 MB JPEG can decode to gigabytes. Limit by pixel count, not file size. Animated GIFs silently become one frame.

### B15 — Constant polling (Medium, Confirmed)

Running all the time: pointer check every 150 ms, cursor position every 66 ms, foreground app through the helper every second, the helper's own 100 ms loop, and now a PowerShell process every 5 minutes for Bluetooth that took 10.7 seconds on the development PC. For an always-on utility this is the battery and fan cost users notice. Poll the cursor only while the pointer is near the island, and read Bluetooth only while the System tab is open (plus a slow background refresh).

### B16 — Screenshot watcher edge cases (Low, Confirmed)

`ScreenshotWatcher` treats any new `.png`/`.jpg` name as a new screenshot. Renaming or moving an image into the folder adds it to the shelf and shows a banner; so does a OneDrive sync that drops many files at once (each gets a banner, subject to B3).

## Smaller items

- **B17** — Notes are cut at 100,000 characters without telling the user (`notes:save`).
- **B18** — `calendar.ts` registers every feed's time zones in a global service on every refresh; it never clears them.
- **B19** — `--smoke` and `--selftest` work in the packaged app. Harmless, but they should be development-only.
- **B20** — The self-test's focus check fails while a normal copy of the app is running (seen twice on 2026-11-14; the second run's "after" window belonged to the running instance on port 47615). Likely cause, not proven. Test modes skip the single-instance lock, so the two copies also compete for the global shortcuts.
