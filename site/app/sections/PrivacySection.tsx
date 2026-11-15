// What the app keeps and what it sends, as the code does it today (see audit/01-security-and-trust.md, S12 to S14):
// - license check: app/src/main/license.ts (api.lemonsqueezy.com, on activation and at start once 7 days have passed)
// - lyrics: app/src/main/lyrics.ts (lrclib.net, title, artist, album and length; off by default in settings.ts)
// - calendar: app/src/main/calendar.ts (the address you paste, every 15 minutes from the tick in index.ts)
// - the agent bridge: app/src/main/bridge.ts (127.0.0.1 only)
// The main process makes no other network requests.
import { product } from "@/lib/product";
import shared from "./shared.module.css";
import styles from "./PrivacySection.module.css";

function Lock() {
  return (
    <svg className={styles.lock} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M20 28v-7a12 12 0 0 1 24 0v7" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <rect x="12" y="27" width="40" height="30" rx="8" fill="currentColor" />
      <circle cx="32" cy="39.5" r="4" fill="#f5f5f7" />
      <rect x="30.25" y="41" width="3.5" height="8" rx="1.75" fill="#f5f5f7" />
    </svg>
  );
}

export default function PrivacySection() {
  return (
    <section className={`${shared.grey} ${shared.section}`} aria-labelledby="privacy-title">
      <div className={`${shared.wrap} ${shared.center}`}>
        <Lock />
        <h2 id="privacy-title" className={shared.headline}>
          No account. <span className={shared.gradientDark}>Few connections.</span>
        </h2>
        <p className={shared.lead}>
          Here is what {product.name} keeps and what it sends, so you do not have to guess.
        </p>

        <ul className={styles.points}>
          <li>
            <h3 className={shared.pointTitle}>Nothing to sign up for</h3>
            <p className={shared.pointText}>
              You never make an account or sign in. Buying gets you a license key, and that is all {product.name}{" "}
              needs.
            </p>
          </li>
          <li>
            <h3 className={shared.pointTitle}>Kept on this PC</h3>
            <p className={shared.pointText}>
              Notes, clipboard history, the file shelf and your settings are saved on this PC. Clipboard history stays
              until you clear it. The bridge your coding agents talk to listens on this machine only.
            </p>
          </li>
          <li>
            <h3 className={shared.pointTitle}>The few things it sends</h3>
            <p className={shared.pointText}>
              Your license key goes to the store when you activate it, and again at start once a week has passed.
              Synced lyrics are off until you turn them on; then each song&apos;s title and artist, with album and
              length when known, go to lrclib.net. A calendar address you paste is fetched every 15 minutes. {product.name}{" "}
              sends nothing else.
            </p>
          </li>
        </ul>
      </div>
    </section>
  );
}
