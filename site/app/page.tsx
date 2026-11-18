import Link from "next/link";
import styles from "./page.module.css";
import shared from "./sections/shared.module.css";
import { faq, product } from "@/lib/product";
import HighlightsSection from "./sections/HighlightsSection";
import NotificationsSection from "./sections/NotificationsSection";
import DictationSection from "./sections/DictationSection";
import AgentsSection from "./sections/AgentsSection";
import CloserLookSection from "./sections/CloserLookSection";
import ScrollEffects from "./sections/ScrollEffects";
import NavIsland from "./sections/NavIsland";
import IntroSection from "./sections/IntroSection";
import OutOfTheWaySection from "./sections/OutOfTheWaySection";
import MeetBlinkSection from "./sections/MeetBlinkSection";
import WorkMapSection from "./sections/WorkMapSection";
import MonitorSection from "./sections/MonitorSection";
import NumbersSection from "./sections/NumbersSection";
import PrivacySection from "./sections/PrivacySection";
import TechSpecsSection from "./sections/TechSpecsSection";
import SmallThingsSection from "./sections/SmallThingsSection";
import EndSection from "./sections/EndSection";
import WindowsMark from "./sections/WindowsMark";
import PhoneBuyNote from "./sections/PhoneBuyNote";
import { CALM } from "@/lib/blink";

export default function Home() {
  return (
    <>
      {/* The top of the page, as halo-mac.com's: a global bar with the app's mark and Buy, and a ribbon with the news.
          Both scroll away; the bar below them sticks. */}
      <div className={styles.gn}>
        <nav className={styles.gnInner} aria-label="Main">
          <a className={styles.gnLogo} href="#top" aria-label={product.name}>
            <svg viewBox="4 3 32 24" aria-hidden="true">
              <path d={CALM.eyes[0]} />
              <path d={CALM.eyes[1]} />
              <path d={CALM.mouth} />
            </svg>
          </a>
          <a className={styles.gnBuy} href={product.buyUrl}>
            Buy
          </a>
        </nav>
      </div>
      <p className={styles.ribbon}>
        {product.name} 1.0 is here: answer Claude Code and Codex from the island, and watch a live map of what your
        agent is touching. <a href={product.buyUrl}>Buy now ›</a>
      </p>

      <header className={styles.nav}>
        <div className={styles.navInner}>
          <a className={styles.brand} href="#top">
            {product.name}
          </a>
          <a className={styles.buySmall} href={product.buyUrl}>
            Buy
          </a>
        </div>
      </header>
      {/* The island hangs from the top of the screen at all times, over the bars, as Halo's #notch does. */}
      <div className={styles.islandBar}>
        <NavIsland />
      </div>

      <main id="top">
        <section className={styles.hero}>
          <p className={styles.new}>New in 1.0: answer your coding agents from the island, and see what they are touching</p>
          <h1 className={styles.title}>{product.name}</h1>
          <p className={styles.sub}>{product.tagline}</p>
          <p className={styles.lead}>
            The top of your screen has been doing nothing. {product.name} puts your coding agents, your music and
            everything you are waiting on in it.
          </p>

          {/* A laptop, as halo-mac.com's hero (.mac, .mac-screen, .mac-base). */}
          <div className={styles.mac} aria-hidden="true">
            <div className={styles.macScreen}>
              <div className={`${shared.desktop} ${styles.screen}`}>
                <div className={styles.island}>
                  <div className={styles.cardHead}>
                    <span className={styles.tool}>Bash</span>
                    <span className={styles.project}>my-project</span>
                  </div>
                  <code className={styles.command}>npm install &amp;&amp; npm run build</code>
                  <div className={styles.actions}>
                    <span className={styles.deny}>Deny</span>
                    <span className={styles.allow}>Allow</span>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.macBase} />
          </div>

          <a className={styles.buy} href={product.buyUrl}>
            Buy for {product.price}
          </a>
          <PhoneBuyNote />
          <p className={styles.small}>
            One-time purchase · <WindowsMark>{product.requirements}</WindowsMark>
          </p>
        </section>

        <HighlightsSection />

        <NotificationsSection />

        <DictationSection />

        <MeetBlinkSection />

        <WorkMapSection />

        <SmallThingsSection />

        <AgentsSection />

        <IntroSection />

        <OutOfTheWaySection />

        <NumbersSection />

        <CloserLookSection />

        <MonitorSection />

        <PrivacySection />

        <TechSpecsSection />

        <section className={styles.faq} aria-labelledby="questions">
          <div className={shared.wrap}>
            <h2 id="questions" className={styles.faqTitle}>
              Questions
            </h2>
            {faq.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <EndSection />
      </main>
      <ScrollEffects />

      <footer className={styles.footer}>
        <nav className={styles.footerLinks} aria-label="Footer">
          <a href="#specs">Tech specs</a>
          <a href="#questions">Questions</a>
          <Link href="/changelog">Changelog</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
        © {product.name}
      </footer>
    </>
  );
}
