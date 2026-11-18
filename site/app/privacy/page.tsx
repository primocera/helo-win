// The privacy page. Every statement here is what the app's code does today:
// - license: app/src/main/license.ts        - lyrics: app/src/main/lyrics.ts
// - calendar: app/src/main/calendar.ts      - agent bridge: app/src/main/bridge.ts (127.0.0.1 only)
// - agent files: app/src/main/hooks-install.ts
// Change this page in the same commit as any change to what the app stores or sends.
import type { Metadata } from "next";
import Link from "next/link";
import { product } from "@/lib/product";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: `Privacy: ${product.name}`,
  description: `What ${product.name} keeps on your PC and the few things it sends.`,
};

export default function PrivacyPage() {
  const n = product.name;
  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/">
        ← {n}
      </Link>
      <h1 className={styles.title}>Privacy</h1>
      <p className={styles.updated}>Last updated 16 November 2026. Applies to {n} 0.1.</p>

      <p>
        {n} has no account and no sign-in. It does not collect usage data, and it has no analytics or crash reporting.
        This page lists everything it keeps and everything it sends.
      </p>

      <h2>What stays on your PC</h2>
      <ul>
        <li>Your settings, notes, clipboard history, the list of files on the shelf and your license key.</li>
        <li>
          Clipboard history holds the text and images you copy. A copy is forgotten after a day (you can change the
          time) unless you pin it, and you can pause the history or clear it. It skips copies that a password manager
          marks as private. It is stored in {n}&apos;s data folder, encrypted with Windows&apos; data protection for
          your account.
        </li>
        <li>
          A log file of errors, for the &quot;Copy diagnostics&quot; button in Settings. It never holds clipboard
          text, notification text, license keys or the tokens your agents use, and it is not sent anywhere: you
          paste it yourself if you ask for help.
        </li>
        <li>
          What your coding agents ask and report. Claude Code, Codex CLI, Gemini CLI and Cursor send their events to{" "}
          {n} on your own machine (address 127.0.0.1). Other computers cannot reach it, and {n} sends none of it on.
        </li>
        <li>The work map shows the names of files and tools. It does not keep file contents.</li>
        <li>
          Codex&apos;s usage limits. Codex CLI writes them into its own session files on your PC, and {n} reads them
          from there for the usage rings. It looks only at those lines, not at the conversation, and keeps nothing.
        </li>
        <li>
          Notifications from other apps. {n} reads them from Windows to show them in the island. It shows each one
          once and does not save it. It remembers only the names of the apps, for the per-app switches.
        </li>
        <li>
          Dictation, if you turn it on. While you hold the key, Windows&apos; own speech recognition listens on your PC
          and {n} types the words where your cursor is. The sound and the words are not sent anywhere or kept.
        </li>
      </ul>

      <h2>What {n} sends</h2>
      <ul>
        <li>
          <strong>License check.</strong> When you activate a key, {n} sends the key and your PC&apos;s name to Lemon
          Squeezy, the store. It checks the key again when it starts, once a week has passed since the last check.
        </li>
        <li>
          <strong>Lyrics, if you turn them on.</strong> They are off at first. When on, each song&apos;s title and
          artist, and its album and length when known, go to lrclib.net.
        </li>
        <li>
          <strong>Calendar, if you add one.</strong> {n} fetches the calendar address you pasted, every 15 minutes.
        </li>
      </ul>
      <p>{n} makes no other connections.</p>

      <h2>What {n} changes on your PC</h2>
      <p>
        Connecting an agent adds hooks to that agent&apos;s own settings file, and for Claude Code a status line unless
        you have your own. A backup of the file is kept beside it. Disconnecting removes only what {n} added.
        Uninstalling removes it too, and asks whether to delete {n}&apos;s data folder or keep it.
      </p>

      <h2>Buying</h2>
      <p>
        Payment is handled by Lemon Squeezy. They receive your payment details and email address and send you the
        license key. {n} never sees your payment details.
      </p>

      <h2>This website</h2>
      <p>
        This site sets no cookies and runs no analytics. It is hosted by Vercel, which keeps ordinary server logs of
        requests.
      </p>
    </main>
  );
}
