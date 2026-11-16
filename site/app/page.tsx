import Link from "next/link";
import styles from "./page.module.css";
import shared from "./sections/shared.module.css";
import { faq, product, utilities, type Feature } from "@/lib/product";
import HighlightsSection from "./sections/HighlightsSection";
import AgentsSection from "./sections/AgentsSection";
import ScrollEffects from "./sections/ScrollEffects";
import NavIsland from "./sections/NavIsland";
import IntroSection from "./sections/IntroSection";
import MeetBlinkSection from "./sections/MeetBlinkSection";
import WorkMapSection from "./sections/WorkMapSection";
import MonitorSection from "./sections/MonitorSection";
import NumbersSection from "./sections/NumbersSection";
import PrivacySection from "./sections/PrivacySection";
import TechSpecsSection from "./sections/TechSpecsSection";

// The public build lists only what the app really does today.
const showAll = process.env.NODE_ENV !== "production";
const visible = (list: Feature[]) => list.filter((f) => showAll || f.shipped);

function Tag({ feature }: { feature: Feature }) {
  return feature.shipped ? null : <span className={styles.tag}>not built yet</span>;
}

export default function Home() {
  const extra = visible(utilities);

  return (
    <>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <a className={styles.brand} href="#top">
            {product.name}
          </a>
          <a className={styles.buySmall} href={product.buyUrl}>
            Buy
          </a>
        </div>
        <NavIsland />
      </header>

      <main id="top">
        <section className={styles.hero}>
          <h1 className={styles.title}>{product.name}</h1>
          <p className={styles.sub}>{product.tagline}</p>
          <p className={styles.lead}>
            The top of your screen has been doing nothing. {product.name} puts your coding agents, your music and
            everything you are waiting on in it.
          </p>

          <div className={`${shared.desktop} ${styles.screen}`} aria-hidden="true">
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

          <a className={styles.buy} href={product.buyUrl}>
            Buy for {product.price}
          </a>
          <p className={styles.small}>
            One-time purchase · {product.trialDays}-day free trial · {product.requirements}
          </p>
        </section>

        <HighlightsSection />

        <IntroSection />

        <AgentsSection />

        <MeetBlinkSection />

        <WorkMapSection />

        <MonitorSection />

        <NumbersSection />

        {extra.length > 0 && (
          <section className={styles.dark} aria-labelledby="small-things">
            <div className={shared.wrap}>
              <h2 id="small-things" className={styles.darkTitle}>
                And the small things.
              </h2>
              <ul className={styles.grid}>
                {extra.map((f) => (
                  <li key={f.title} className={styles.tile}>
                    <h3>
                      {f.title} <Tag feature={f} />
                    </h3>
                    <p>{f.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

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

        <section className={styles.closing}>
          <h2 className={styles.closingTitle}>
            {product.price}. <span className={shared.gradientDark}>Once.</span>
          </h2>
          <p className={styles.closingText}>
            Try it free for {product.trialDays} days. One key for up to {product.maxPcs} PCs.
          </p>
          <a className={styles.buy} href={product.buyUrl}>
            Buy {product.name}
          </a>
        </section>
      </main>
      <ScrollEffects />

      <footer className={styles.footer}>
        <nav className={styles.footerLinks} aria-label="Footer">
          <a href="#specs">Tech specs</a>
          <a href="#questions">Questions</a>
          <Link href="/changelog">Changelog</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
        © {product.name}. Made by an independent developer.
      </footer>
    </>
  );
}
