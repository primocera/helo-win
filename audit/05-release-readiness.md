# Release readiness

What would cause the biggest problems once people pay for this.

## R1 — Store configuration is not set (Blocker, Confirmed)

`src/main/config.ts`: `buyUrl` is `https://example.com/buy`, `storeId` and `productId` are `null`. `wrongProduct()` in `license.ts` only checks IDs that are set, so today **any valid Lemon Squeezy licence key from any store activates the app**. `site/lib/product.ts` has the same placeholder link.

Fix: set all three, and make the build fail when they are unset in a packaged build.

## R2 — Unsigned installer (Blocker for sales, Confirmed)

SmartScreen warns on every download. Combined with the hidden PowerShell helper (A2) and clipboard access, antivirus products are likely to flag it. A code-signing certificate, and submitting the installer to Microsoft for reputation, are needed before a public launch.

## R3 — No updates (High, Confirmed)

There is no auto-update and no "new version" check. Claude Code and Codex change their hook formats often, and the browser extension depends on page markup. A shipped copy that breaks cannot be fixed without the user finding and reinstalling a new build. `electron-updater` with the existing NSIS target is the standard answer; it needs R2 first.

## R4 — Uninstall leaves things behind (High, Confirmed)

- Hooks and status line in `~/.claude/settings.json` and `~/.codex/hooks.json` (B2).
- The whole data folder, including clipboard history (S12).
- The "start with Windows" entry should be checked too.

## R5 — The browser extension cannot be installed by normal users (Medium, Confirmed)

"Load unpacked" needs developer mode and shows a warning at every browser start. Either publish to the Chrome Web Store and Edge Add-ons or leave the web-chat feature out of the first release and the site copy.

## R6 — No release checklist (Medium)

Suggested, in order: clean tree and tagged commit; `typecheck`, `test`, `build`; `--selftest` with no other copy running; `--smoke` and look at the card screenshots; install the built installer on a clean Windows account; connect, approve one command, answer one question, approve one plan; disconnect and confirm the settings file matches the original; uninstall and confirm nothing is left.

## R7 — The site and the app disagree (Medium, Confirmed)

| Site says | App does |
| --- | --- |
| Connecting "adds three hooks" | Adds four hooks and, unless you have your own, a status line |
| Battery alerts: not shipped | Built |
| Only the licence key leaves the PC | Lyrics (opt-in) send track names to lrclib.net; the calendar fetches the address you give it |
| Nothing about questions, plans, edit lines, monitor controls | Built on 2026-11-14 |

## R8 — Names are placeholders (Low)

"Helo" and "Blink" are marked as placeholders in `src/shared/brand.ts`. The name is baked into things that are hard to change after release: the `appId` `app.helo.island`, the data folder, the `/helo/hook` paths that hook detection matches on, `.helo-backup` files and the extension name. Choose the final name before the first paid install, or plan a migration.

## R9 — Legal and store basics (Low)

No licence text, privacy policy or terms are in the repository. A payment provider and the extension stores will ask for a privacy policy; S14 shows the current wording is incomplete.
