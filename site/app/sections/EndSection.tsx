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
import { CALM, DOCKED_EVENT, DONE, FINALE_EVENT, playDone } from "@/lib/blink";
import styles from "./EndSection.module.css";

type Stage = "hidden" | "shown" | "blink" | "done" | "splash" | "travel" | "burst";

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
  const runnerRef = useRef<HTMLSpanElement>(null);
  const [stage, setStage] = useState<Stage>("hidden");

  useEffect(() => {
    const end = ref.current;
    const card = cardRef.current;
    if (!end || !card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Two endings while we choose: the line stays on top of the square, or (?ending=top) flies on up to the top edge
    // of the screen and takes the island's place.
    const flyTop = new URLSearchParams(window.location.search).get("ending") === "top";
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    let flyer: HTMLElement | null = null;

    const flyUp = () => {
      const runner = runnerRef.current;
      if (!runner) return;
      const r = runner.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const f = document.createElement("div");
      f.className = styles.flyer;
      document.body.append(f);
      flyer = f;
      runner.style.visibility = "hidden";
      const round = `${r.height}px`;
      const anim = f.animate(
        [
          { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: round },
          // Up it goes, stretched long by the speed, then it lands flat against the top edge.
          {
            left: `${vw / 2 - r.height / 2}px`,
            top: `${r.top * 0.35}px`,
            width: `${r.height}px`,
            height: `${r.width * 1.1}px`,
            borderRadius: round,
            offset: 0.55,
          },
          { left: `${vw / 2 - r.width / 2}px`, top: "0px", width: `${r.width}px`, height: `${r.height}px`, borderRadius: `0 0 ${round} ${round}` },
        ],
        { duration: 700, easing: "cubic-bezier(0.5, 0, 0.2, 1)", fill: "forwards" },
      );
      anim.onfinish = () => {
        // Docked in the middle of the top edge, whatever the window's width.
        f.classList.add(styles.docked);
        f.style.cssText = `width:${r.width}px;height:${r.height}px;border-radius:0 0 ${round} ${round}`;
        anim.cancel();
        window.dispatchEvent(new CustomEvent(DOCKED_EVENT));
      };
    };

    // The card rises in once you have scrolled through the dark to it. Then: a blink, the smile and the sound; he
    // melts with a splash into a pink line; the line goes round an invisible square around him (to its right side,
    // standing up, then to its top, lying down, as the island sits on a screen's edge); white sparks burst out of it
    // (and, with ?ending=top, it flies on up to the top of the screen). The page stays black.
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
        later(4200, () => setStage("travel"));
        later(5750, () => {
          setStage("burst");
          if (flyTop) flyUp();
        });
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
      flyer?.remove();
    };
  }, []);

  const melted = stage === "splash" || stage === "travel" || stage === "burst";
  const moving = stage === "travel" || stage === "burst";
  const bursting = stage === "burst";
  const smiling = stage === "done" || melted;
  const face = smiling ? DONE : CALM;
  return (
    <section
      ref={ref}
      id="buy"
      className={`${styles.end} ${stage !== "hidden" ? styles.shown : ""}`}
      aria-labelledby="end-title"
    >
      <div ref={cardRef} className={styles.inner}>
        <div
          className={`${styles.blink} ${melted ? styles.splash : ""} ${moving ? styles.travel : ""} ${bursting ? styles.burst : ""}`}
          role="img"
          aria-label={melted ? `${product.mascot}, now a pink line` : `${product.mascot}, ${smiling ? "smiling" : "calm"}`}
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
          {/* The line on its way round the square, and the splash out of it when it lands on top. */}
          <span ref={runnerRef} className={styles.runner} aria-hidden="true" />
          {DROPS.map((d, i) => (
            <i
              key={`out-${i}`}
              className={styles.drop2}
              style={{ "--dx": d.x * 1.5, "--dy": d.y * 1.3, "--ds": d.s } as CSSProperties}
              aria-hidden="true"
            />
          ))}
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
