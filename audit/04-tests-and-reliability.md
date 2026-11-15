# Tests, diagnostics and process

## Process

### P1 — No commits (Critical, Confirmed)

`git status` shows every folder as untracked and the history is empty. There is no way to undo a change, compare versions or find when a bug appeared. `app/dist/` holds an installer built before the latest features, with nothing to say which code it contains.

Do first: commit the current state, then commit per finding fixed.

### P2 — No lint and no CI (Medium, Confirmed)

`app/` has type checking and tests but no linter, and nothing runs them automatically. A GitHub Actions job on `windows-latest` running `npm run typecheck`, `npm test` and `npm run build` takes minutes to add.

## Diagnostics

### T1 — The packaged app logs nothing (High, Confirmed)

`log()` in `index.ts` prints only when not packaged. Every `catch` that logs is silent for real users: helper failures, hook write errors, DDC errors, watcher errors. There is no log file, no "copy diagnostics" button, no crash reporting.

Fix: a rotating log file in the data folder (a few hundred KB), with tokens and clipboard text never written to it, and a "Copy diagnostics" button in Settings that includes the app version, helper status, port and connection states.

### T2 — Failures are invisible in the interface (Medium)

The mascot's "broken" face is the only signal for a dead helper or a busy port. Give each failure a sentence in Settings and in the affected tab.

## Missing tests

Ordered by how much damage a regression would do.

| # | What | Why it is not covered now | How to cover it |
| --- | --- | --- | --- |
| 1 | `settle()`: which reply each card kind produces, that a question is never plain-allowed, that a plan echo matches the input | Lives in `index.ts` | After the A1 split, unit tests on `requests.ts` |
| 2 | The queue: two requests, abort of the first, shortcut targets | Same | Same |
| 3 | Banner priority (B3) | Same | Unit tests on the new `banners.ts` |
| 4 | Hook file round trips with real-world settings: comments absent, BOM, other tools' hooks, an existing status line, repeated connect/disconnect leaves the file byte-identical | Partly covered | Add a "connect then disconnect returns the original" property test and a backup test for B1 |
| 5 | Licence: timeouts, non-JSON answers, forged `validatedAt`, wrong store | Happy paths only | Extend `core.test.ts` with a fake `fetch` |
| 6 | Card rendering: long commands, 4 questions, multi-select, long option text, 60-line diff | Screenshots only, looked at by hand | Component tests with Vitest and jsdom, or compare smoke screenshots against saved ones |
| 7 | The helper protocol against the real script | Only in the self-test, which needs a desktop | Keep in the self-test; run it before each release |
| 8 | Browser extension detection | None | Saved HTML snippets from both sites and a test of `isGenerating()` |
| 9 | Clipboard: nothing captured when the exclusion signal is unavailable (S12) | None | Unit test once the rule exists |

## The self-test

`--selftest` is valuable: it drives the real helper, the real hook commands through `cmd.exe`, PowerShell and Git Bash, and the real window. Weaknesses:

- It fails when a normal copy of the app is running (B20). Make it refuse to start in that case, or isolate the shortcuts and focus checks.
- It is run by hand. Add it to a release checklist (see R6).
- One check, panel focus hand-back, failed twice on 2026-11-14. Unresolved; find out whether it passes with no other copy running.

## Never tested on real hardware or a live session

State plainly in release notes until done:

- Questions, plan approval and plan rejection against a live Claude Code session (the local endpoint format is tested; Claude Code's reaction is not).
- Bluetooth battery levels (no device on the development PC reports one).
- Monitor contrast and input switching (reads are exercised; no write was tried).
- Laptop brightness, battery alerts on a real battery.
- Screenshots arriving on the shelf from a real Win+PrtScn.
- AltGr keyboards (S1), high-DPI and mixed-DPI multi-monitor placement, sleep and resume.
