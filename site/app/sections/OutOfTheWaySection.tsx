// Out of the way: the island over a maximised browser. What the app does, and where:
// - windowUnder (app/src/shared/face.ts) says whether the window in front reaches under the closed island; applyTucked
//   (app/src/main/index.ts) turns that into state.tucked when settings.display.tuck is on (it is by default).
// - While tucked and idle, the island is a 76 by 5 px line (TUCKED in app/src/renderer/src/island/App.tsx) with a faint
//   ring, no ears and no Blink (.stage.tucked in island.css). It is black, or the accent colour while an agent works
//   (.stage.tucked.busy). The site shows the rose accent here.
// - Clicks go through the line; resting the pointer on it for PEEK_DELAY (500 ms) opens the panel.
// - A banner or a card is not idle, so it shows at full size, with Blink, and the line comes back after.
// Settings, General, "Shrink to a line over windows" (SettingsApp.tsx) is the switch.
import { product } from "@/lib/product";
import { Blink, Desktop, Icon, Mark } from "./IslandMocks";
import mock from "./IslandMocks.module.css";
import shared from "./shared.module.css";
import styles from "./OutOfTheWaySection.module.css";

const TABS = [
  { title: "Fix cart rounding · Pull request #482", tint: "#24292f" },
  { title: "Cart total is off by a cent · Issue #477", tint: "#24292f" },
  { title: "Intl.NumberFormat - JavaScript | MDN", tint: "#1b1b1b" },
  { title: "Deployments · shop-api", tint: "#5b5bd6" },
];

const STEPS = [
  "At rest at the top of the screen.",
  "A window reaches under it.",
  "It steps back to a line. The tab below still takes the click.",
  "Claude is working: the line takes your accent colour.",
  "Finished. The banner grows out of the line.",
  "Then it is a line again.",
];

function Browser() {
  return (
    <div className={styles.window}>
      <div className={styles.strip}>
        {TABS.map((tab, i) => (
          <span key={tab.title} className={`${styles.tab} ${styles[`tab${i + 1}`] ?? ""}`}>
            <i className={styles.favicon} style={{ background: tab.tint }} />
            <span className={styles.tabTitle}>{tab.title}</span>
            <span className={styles.tabClose}>×</span>
          </span>
        ))}
        <span className={styles.newTab}>+</span>
        <span className={styles.controls}>
          <span className={styles.minimise} />
          <span className={styles.restore} />
          <span className={styles.close} />
        </span>
      </div>
      <div className={styles.toolbar}>
        <span className={styles.nav} />
        <span className={styles.nav} />
        <span className={styles.nav} />
        <span className={styles.address}>
          <span className={`${styles.url} ${styles.urlA}`}>github.com/you/shop-api/pull/482</span>
          <span className={`${styles.url} ${styles.urlB}`}>developer.mozilla.org/docs/Web/JavaScript/Intl</span>
        </span>
      </div>
      <div className={styles.page}>
        <div className={`${styles.pageBody} ${styles.pageA}`}>
          <span className={styles.h} style={{ width: "46%" }} />
          <span className={styles.l} style={{ width: "28%" }} />
          <span className={styles.box} />
          <span className={styles.l} style={{ width: "72%" }} />
          <span className={styles.l} style={{ width: "64%" }} />
          <span className={styles.box} />
          <span className={styles.l} style={{ width: "52%" }} />
        </div>
        <div className={`${styles.pageBody} ${styles.pageB}`}>
          <span className={styles.h} style={{ width: "38%" }} />
          <span className={styles.l} style={{ width: "80%" }} />
          <span className={styles.l} style={{ width: "74%" }} />
          <span className={styles.code} />
          <span className={styles.l} style={{ width: "58%" }} />
          <span className={styles.l} style={{ width: "76%" }} />
          <span className={styles.l} style={{ width: "69%" }} />
          <span className={styles.code} />
        </div>
      </div>
      <svg className={styles.pointer} viewBox="0 0 14 20" aria-hidden="true">
        <path d="M1 1v15.5l4-3.6 2.6 5.8 2.6-1.2-2.6-5.6H13Z" />
        <circle className={styles.ripple} cx="1" cy="1" r="6" />
      </svg>
    </div>
  );
}

// Blink and the island run together into the line and back out of it. While they touch, this filter blurs their
// outline and cuts it sharp again, so the two black shapes join with a soft neck (the "goo" trick; the shapes are
// drawn crisp on top of it). Only on during those moments, so the line keeps its own thin ring the rest of the time.
function Goo() {
  return (
    <svg className={styles.defs} aria-hidden="true" focusable="false">
      <filter
        id="tuck-goo"
        filterUnits="userSpaceOnUse"
        x="-400"
        y="-60"
        width="1200"
        height="260"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
      </filter>
    </svg>
  );
}

function TuckedIsland() {
  return (
    <div className={styles.top}>
      <Blink face="calm" className={styles.blinkCalm} />
      <Blink face="done" className={styles.blinkDone} />
      <div className={`${mock.island} ${styles.island}`}>
        <div className={styles.clip}>
          {/* The accent spreading along the line from where Blink went in, one glint passing along it, and the black
              running back along it when the agent finishes. */}
          <span className={styles.fill} />
          <span className={styles.glint} />
          <span className={styles.ink} />
          <div className={`${styles.layer} ${styles.idleLayer}`}>
            <div className={mock.idle}>
              <Mark />
            </div>
          </div>
          <div className={`${styles.layer} ${styles.bannerLayer}`}>
            <div className={mock.banner}>
              <span className={`${mock.appIcon} ${mock.kindDone}`}>
                <Icon name="check" size={17} />
              </span>
              <span className={mock.bannerLines}>
                <span className={mock.bannerTitle}>Finished in shop-api · 3m 12s</span>
                <span className={mock.bannerText}>Fixed the rounding in the cart total. All 18 tests pass.</span>
              </span>
              <span className={mock.bannerTime}>now</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OutOfTheWaySection() {
  return (
    <section id="film" className={`${shared.black} ${shared.section}`} aria-labelledby="tuck-title">
      <div className={`${shared.wrap} ${shared.center}`}>
        <p className={shared.eyebrow}>Out of the way</p>
        <h2 id="tuck-title" className={shared.headline}>
          Over your tabs. <span className={shared.gradient}>Never on them.</span>
        </h2>
        <p className={shared.lead}>
          The top of the screen is where your browser keeps its tabs. So when the window you are working in reaches
          under the island, {product.name} shrinks to a thin line at the edge, and your clicks go straight through to
          the tabs and title bar below.
        </p>

        <figure className={styles.figure}>
          {/* A PC monitor on a stand around the picture. */}
          <div className={styles.pcBezel}>
          <Desktop className={styles.desk}>
            <div
              className={styles.scene}
              role="img"
              aria-label="A browser window fills the screen. Blink, the island's face, slips into the island as it shrinks to a thin line above the tabs; the line turns pink while Claude works, and Blink pops back out with a Finished banner before both shrink back."
            >
              <Browser />
              <Goo />
              <TuckedIsland />
            </div>
          </Desktop>
          </div>
          <div className={styles.pcNeck} aria-hidden="true" />
          <div className={styles.pcBase} aria-hidden="true" />
          <figcaption className={styles.steps}>
            {STEPS.map((step, i) => (
              <span key={step} className={`${styles.step} ${styles[`step${i + 1}`] ?? ""}`}>
                {step}
              </span>
            ))}
          </figcaption>
        </figure>

        <ul className={styles.points}>
          <li>
            <h3 className={shared.pointTitle}>Clicks go through</h3>
            <p className={shared.pointText}>
              The line takes no clicks. Switch tabs, or grab the title bar and move the window, right under it.
            </p>
          </li>
          <li>
            <h3 className={shared.pointTitle}>There when it matters</h3>
            <p className={shared.pointText}>
              Black while nothing is happening, your accent colour while an agent works. A banner or a request still
              opens the full island.
            </p>
          </li>
          <li>
            <h3 className={shared.pointTitle}>Half a second away</h3>
            <p className={shared.pointText}>
              Rest the pointer on the line for half a second and the panel opens. It is on from the start; Settings,
              General, &ldquo;Shrink to a line over windows&rdquo; turns it off.
            </p>
          </li>
        </ul>
      </div>
    </section>
  );
}
