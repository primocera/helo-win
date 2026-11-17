"use client";

// The end of the page, after halo-mac.com's finale (site.js "finale", site.css .end), but driven by your scrolling: as
// this section comes up, the island at the top grows down over the page while the section's black rises to meet it.
// Then you scroll through plain dark to the card, whose lines rise in one by one, and the island stays plain black. Then Blink, big on the card, blinks, smiles and plays the
// app's "done" sound (lib/blink.ts), and a moment later melts where he sits, with a splash, into a short pink line,
// the line the island becomes over a window ("Out of the way"). Browsers only let a page make sound after the visitor
// has clicked or tapped it, so without that it is silent. With reduced motion the card simply shows, and Blink smiles
// without the sound or the splash.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { product } from "@/lib/product";
import { CALM, DONE, FINALE_EVENT, playDone } from "@/lib/blink";
import styles from "./EndSection.module.css";

type Stage = "hidden" | "shown" | "blink" | "done" | "splash";

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
  const cardRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>("hidden");

  useEffect(() => {
    const end = ref.current;
    const card = cardRef.current;
    if (!end || !card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

    // The card rises in once you have scrolled through the dark to it. Then: a blink, the smile and the sound, and
    // he melts with a splash into a pink line.
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setStage("shown");
        if (reduce) {
          later(600, () => setStage("done"));
          return;
        }
        later(1500, () => setStage("blink"));
        later(1680, () => {
          setStage("done");
          playDone();
        });
        later(3000, () => setStage("splash"));
      },
      { threshold: 0.5 },
    );
    io.observe(card);

    const island = document.querySelector<HTMLElement>("[data-nav-island]");
    if (reduce || !island) {
      return () => {
        io.disconnect();
        timers.forEach((t) => window.clearTimeout(t));
      };
    }

    // A black shape grows out of the nav island as you scroll, in step with your scrolling, while the black of this
    // section rises from below. They meet when the section's top reaches the top of the screen: the page is swallowed.
    // Scroll back up and it shrinks back into the island.
    const cover = document.createElement("div");
    cover.className = styles.cover;
    cover.style.display = "none";
    document.body.append(cover);
    let told = false;
    let frame = 0;
    const update = () => {
      frame = 0;
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh - end.getBoundingClientRect().top) / vh));
      if (p <= 0 || p >= 1) {
        cover.style.display = "none";
        if (p >= 1 && !told) {
          told = true;
          // The nav island stays plain black from here on, like Halo's.
          window.dispatchEvent(new CustomEvent(FINALE_EVENT));
        }
        return;
      }
      const e = p * p * (3 - 2 * p);
      const r = island.getBoundingClientRect();
      const corner = r.height * 0.4 * (1 - e);
      cover.style.display = "block";
      cover.style.left = `${r.left * (1 - e)}px`;
      cover.style.top = `${r.top * (1 - e)}px`;
      cover.style.width = `${r.width + (vw - r.width) * e}px`;
      cover.style.height = `${r.height + (vh - r.height) * e}px`;
      cover.style.borderRadius = `0 0 ${corner}px ${corner}px`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      cover.remove();
    };
  }, []);

  const smiling = stage === "done" || stage === "splash";
  const face = smiling ? DONE : CALM;
  return (
    <section ref={ref} id="buy" className={`${styles.end} ${stage !== "hidden" ? styles.shown : ""}`} aria-labelledby="end-title">
      <div ref={cardRef} className={styles.inner}>
        <div
          className={`${styles.blink} ${stage === "splash" ? styles.splash : ""}`}
          role="img"
          aria-label={stage === "splash" ? `${product.mascot}, now a pink line` : `${product.mascot}, ${smiling ? "smiling" : "calm"}`}
        >
          <svg
            className={`${styles.face} ${stage === "blink" ? styles.blinking : ""} ${smiling ? styles.happy : ""}`}
            viewBox="4 3 32 24"
            aria-hidden="true"
          >
            <g className={styles.blush}>
              <rect x="5.4" y="16.2" width="5" height="1.8" rx="0.9" />
              <rect x="29.6" y="16.2" width="5" height="1.8" rx="0.9" />
            </g>
            <g className={styles.eyes}>
              <path d={face.eyes[0]} />
              <path d={face.eyes[1]} />
            </g>
            <path d={face.mouth} />
          </svg>
          {DROPS.map((d, i) => (
            <i
              key={i}
              className={styles.drop}
              style={{ "--dx": d.x, "--dy": d.y, "--ds": d.s } as CSSProperties}
              aria-hidden="true"
            />
          ))}
          <span className={styles.line} aria-hidden="true" />
        </div>
        <p id="end-title" className={styles.word}>
          {product.name}
        </p>
        <p className={styles.tag}>{product.tagline}.</p>
        <p className={styles.offer}>
          <b>{product.price}</b>
        </p>
        <a className={styles.buy} href={product.buyUrl}>
          Buy
        </a>
        <p className={styles.fine}>
          One-time purchase. {product.trialDays}-day free trial. {product.requirements}.
        </p>
      </div>
    </section>
  );
}
