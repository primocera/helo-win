"use client";

// The end of the page, exactly as halo-mac.com's finale (site.js "finale", js/island.js): when this section is 40% on
// screen, the island at the top springs open into a huge black shape that swallows the screen (SwiftUI-style springs,
// sp(0.44, 0.8) for its size and sp(0.5, 0.86) for its scale); 0.6 s later the page jumps to this card, whose lines rise
// in one by one, and the island springs back down to its resting size, overshooting a little as it lands, then scales
// back into the nav. It stays plain black. Then Blink, big on the card, winks, smiles and plays the app's "done" sound
// (lib/blink.ts), and a moment later melts where he sits, with a splash, into a short pink line, the line the island
// becomes over a window ("Out of the way"). Browsers only let a page make sound after the visitor has clicked or tapped
// it, so without that it is silent. With reduced motion the card simply shows, and Blink smiles without the sound or
// the splash.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { product } from "@/lib/product";
import { CALM, DONE, FINALE_EVENT, playDone, shape } from "@/lib/blink";
import { spring } from "@/lib/spring";
import meet from "./MeetBlinkSection.module.css";
import WindowsMark from "./WindowsMark";
import PhoneBuyNote from "./PhoneBuyNote";
import styles from "./EndSection.module.css";

type Stage = "hidden" | "shown" | "wink" | "done" | "splash";

/** His right eye (on the viewer's left) shut in a wink: a short line arching up, like his happy eyes but flatter. */
const WINK_EYE = shape(14, 12.8, 3.3, 1.5, -1.5);

/** Where each drop of the splash flies, as a share of Blink's width (x) and height (y, up is negative). */
const DROPS = [
  { x: -0.62, y: -0.55, s: 0.07 },
  { x: -0.38, y: -0.85, s: 0.05 },
  { x: -0.12, y: -0.7, s: 0.04 },
  { x: 0.16, y: -0.9, s: 0.06 },
  { x: 0.42, y: -0.6, s: 0.05 },
  { x: 0.66, y: -0.42, s: 0.07 },
  { x: -0.8, y: -0.2, s: 0.04 },
  { x: 0.84, y: -0.18, s: 0.04 },
];

export default function EndSection() {
  const ref = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<Stage>("hidden");

  useEffect(() => {
    const end = ref.current;
    if (!end) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    let frame = 0;
    let cover: HTMLElement | null = null;

    // The card is up: a wink (one eye shut for about 400 ms, with a little tilt of the head), the smile and the
    // sound, and he melts with a splash into a pink line.
    const show = () => {
      setStage("shown");
      // The nav island stays plain black from here on, like Halo's.
      window.dispatchEvent(new CustomEvent(FINALE_EVENT));
      if (reduce) {
        later(600, () => setStage("done"));
        return;
      }
      later(1500, () => setStage("wink"));
      later(1920, () => setStage("shown"));
      later(2250, () => {
        setStage("done");
        playDone();
      });
      later(3570, () => setStage("splash"));
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const island = document.querySelector<HTMLElement>("[data-nav-island]");
        if (reduce || !island) {
          show();
          return;
        }
        // Halo's numbers: the island's resting size and its "fill" size (js/island.js S.fill), the scale that makes
        // the fill cover the screen, and the scale the nav draws the island at (0.62 on screens 760 px and under).
        const vw = document.documentElement.clientWidth;
        const vh = window.innerHeight;
        const base = vw <= 760 ? 0.62 : 1;
        const k = Math.max(vw / 1560, vh / 1030, base) * 1.08;
        const IDLE = [282, 32, 13];
        const FILL = [1560, 1030, 44];
        const size = spring(0.44, 0.8);
        const scale = spring(0.5, 0.86);
        const c = document.createElement("div");
        c.className = styles.cover;
        // It starts as the island itself: its face and bars, which fade out as it grows, the way Halo's island
        // content goes (opacity to 0, scale 0.94, blur 6px, 0.2 s, power2.out; js/island.js "to").
        const content = document.createElement("div");
        content.className = styles.coverContent;
        content.innerHTML = island.innerHTML;
        c.append(content);
        document.body.append(c);
        void content.offsetWidth;
        content.classList.add(styles.coverGone);
        cover = c;
        const draw = (dims: number[], s: number) => {
          c.style.width = `${dims[0]}px`;
          c.style.height = `${dims[1]}px`;
          c.style.borderRadius = `0 0 ${dims[2]}px ${dims[2]}px`;
          c.style.transform = `translateX(-50%) scale(${s})`;
        };
        const mix = (a: number[], b: number[], p: number) => a.map((v, i) => v + (b[i] - v) * p);
        const t0 = performance.now();
        let landed = false;
        let back = IDLE;
        const tick = (now: number) => {
          const t = (now - t0) / 1000;
          if (t < 0.6) {
            // Open: the island springs up to the fill, scaled to cover the screen.
            draw(mix(IDLE, FILL, size.ease(Math.min(1, t / size.duration))), base + (k - base) * scale.ease(Math.min(1, t / scale.duration)));
          } else {
            if (!landed) {
              landed = true;
              back = mix(IDLE, FILL, size.ease(Math.min(1, t / size.duration)));
              window.scrollTo({ top: end.offsetTop, behavior: "instant" });
              show();
            }
            // Back: it springs down to its resting size (overshooting a little), and from 0.35 s scales back into
            // the nav over half a second.
            const tb = t - 0.6;
            const dims = mix(back, IDLE, size.ease(Math.min(1, tb / size.duration)));
            const q = Math.min(1, Math.max(0, (tb - 0.35) / 0.5));
            const eased = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
            draw(dims, k + (base - k) * eased);
            if (tb >= Math.max(size.duration, 0.85)) {
              c.remove();
              cover = null;
              frame = 0;
              return;
            }
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(end);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      if (frame) cancelAnimationFrame(frame);
      cover?.remove();
    };
  }, []);

  const smiling = stage === "done" || stage === "splash";
  const face = smiling ? DONE : CALM;
  return (
    <section
      ref={ref}
      id="buy"
      className={`${styles.end} ${stage !== "hidden" ? styles.shown : ""}`}
      aria-labelledby="end-title"
    >
      <div className={styles.inner}>
        {/* The same square tile, glow and border as in "Meet Blink" (MeetBlinkSection.module.css), at the same size. */}
        <div className={`${meet.stage} ${styles.stage}`}>
          <div className={meet.tile}>
            <div
              className={`${styles.blink} ${stage === "splash" ? styles.splash : ""}`}
              role="img"
              aria-label={
                stage === "splash"
                  ? `${product.mascot}, now a pink line`
                  : `${product.mascot}, ${smiling ? "smiling" : "calm"}`
              }
            >
              <svg
                className={`${styles.face} ${stage === "wink" ? styles.winking : ""} ${smiling ? styles.happy : ""}`}
                viewBox="4 3 32 24"
                aria-hidden="true"
              >
                <g className={styles.blush}>
                  <rect x="5.4" y="16.2" width="5" height="1.8" rx="0.9" />
                  <rect x="29.6" y="16.2" width="5" height="1.8" rx="0.9" />
                </g>
                <g className={styles.eyes}>
                  <path d={stage === "wink" ? WINK_EYE : face.eyes[0]} />
                  <path d={face.eyes[1]} />
                </g>
                <path d={face.mouth} />
              </svg>
              {DROPS.map((d, i) => (
                <i
                  key={i}
                  className={styles.drop}
                  style={
                    { "--dx": d.x, "--dy": d.y, "--ds": d.s } as CSSProperties
                  }
                  aria-hidden="true"
                />
              ))}
              <span className={styles.line} aria-hidden="true" />
            </div>
          </div>
        </div>
        <p id="end-title" className={styles.word}>
          {product.name}
        </p>
        <p className={styles.tag}>{product.tagline}.</p>
        <p className={styles.offer}>
          <b>{product.price}</b>
        </p>
        <div>
          <a className={styles.buy} href={product.buyUrl}>
            Buy
          </a>
          <PhoneBuyNote dark />
        </div>
        <p className={styles.fine}>
          One-time purchase. {product.trialDays}-day free trial.{" "}
          <WindowsMark>{product.requirements}.</WindowsMark>
          <br />
          Coming to Mac in 2027: macOS 15 or later, Apple silicon and Intel.
        </p>
      </div>
    </section>
  );
}
