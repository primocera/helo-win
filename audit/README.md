# Helo (island app) audit — 2026-11-15

Scope: `app/` only (main process, preload, renderer, Windows helper, browser extension) plus the parts of `site/` that describe the app. `game/` is out of scope.

Nothing was changed. Every finding has an ID so later sessions can refer to it.

How sure each finding is:

- **Confirmed** — read directly in the code.
- **Likely** — follows from the code, but needs a manual check on a real machine.
- **Unverified** — depends on behaviour of Claude Code or Windows that the code alone cannot show.

## Files

| File | What is in it |
| --- | --- |
| [01-security-and-trust.md](01-security-and-trust.md) | Approvals, the local endpoint, licensing, user data |
| [02-bugs-and-edge-cases.md](02-bugs-and-edge-cases.md) | Things that are wrong or will break |
| [03-architecture-and-debt.md](03-architecture-and-debt.md) | Structure, weak assumptions, decisions worth reversing |
| [04-tests-and-reliability.md](04-tests-and-reliability.md) | Missing tests, diagnostics, process |
| [05-release-readiness.md](05-release-readiness.md) | What blocks selling it |
| [../NEXT_SESSION.md](../NEXT_SESSION.md) | Ordered task list and context for the next session |

## Priority order

Do these before adding features.

| # | ID | Finding | Why it matters |
| --- | --- | --- | --- |
| 1 | P1 | The repository has zero commits | One bad edit or disk problem loses everything; no way to see what changed |
| 2 | S1 | Ctrl+Alt+Y / Ctrl+Alt+N are also AltGr+Y / AltGr+N | Typing `}` on a Slovenian or Croatian keyboard can deny (or allow) an agent request |
| 3 | S2 | Cards show a cut-down command, and Allow approves the whole thing | The dangerous part of a long command can be off-screen |
| 4 | S3 | A card can appear under the pointer mid-click | An accidental Allow, at the top-centre of the screen where browser tabs are |
| 5 | R1 | Store IDs are unset and the buy link is `example.com` | Any Lemon Squeezy key from any seller activates the app |
| 6 | B1 | The "backup" of `~/.claude/settings.json` is overwritten on every write | After the second write the original file is gone |
| 7 | B2 | Uninstalling leaves the hooks and status line in Claude Code's settings | Dead status line and failing hooks on a PC that no longer has the app |
| 8 | T1 | The packaged app logs nothing | A customer's problem cannot be diagnosed |
| 9 | S4 | Clipboard history keeps passwords when the helper is down, and stores everything unencrypted | The most sensitive data the app holds |
| 10 | A1 | `src/main/index.ts` is one 1,600-line file of shared mutable state | The part with the most logic is the part with no tests |
| 11 | B3 | One banner slot: any banner replaces "Claude needs your answer" | The alert the product is sold on can vanish |
| 12 | A2 | The PowerShell helper compiles C# at every start with `-ExecutionPolicy Bypass` | Antivirus flags, and it cannot run at all on locked-down PCs |

Everything else is in the numbered files, each with its own importance rating.

## What is in good shape

Worth knowing so it is not re-audited:

- Renderer isolation: sandbox on, context isolation on, no Node in pages, navigation and new windows blocked, a strict content security policy, and every IPC channel checks which window sent it.
- The local endpoint listens on 127.0.0.1 only, compares tokens in constant time, caps the body at 1 MB, and gives the browser extension a separate secret that cannot answer agent requests.
- Hook installation keeps other hooks, refuses to overwrite a settings file it cannot parse, and writes through a temporary file.
- `reg.exe` and `curl.exe` are run with argument arrays, never through a shell string built from user data.
- Pure logic (bridge, hook installer, license, settings, timer, clipboard, calendar, lyrics, downloads) has 83 unit tests.
