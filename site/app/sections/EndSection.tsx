"use client";

// The end of the page, after halo-mac.com's finale (site.js "finale", site.css .end): when this card scrolls in, the
// island at the top grows until it covers the page, the page lands on this black card, and the island shrinks back
// into the nav while the card's lines rise in one by one. Then Blink, big on the card, blinks, smiles and plays the
// app's "done" sound (lib/blink.ts). Browsers only let a page make sound after the visitor has clicked or tapped it,
// so without that it is silent. With reduced motion the card simply shows, and Blink smiles without the sound.
import { useEffect, useRef, useState } from "react";
import { product } from "@/lib/product";
import { CALM, DONE, FINALE_EVENT, playDone } from "@/lib/blink";
import styles from "./EndSection.module.css";

type Stage = "hidden" | "shown" | "blink" | "done";

export default function EndSection() {
  const ref = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<Stage>("hidden");

  useEffect(() => {
    const end = ref.current;
    if (!end) return;
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    // After the card is up: a blink, then the smile and the sound.
    const celebrate = () => {
      later(1500, () => setStage("blink"));
      later(1680, () => {
        setStage("done");
        playDone();
      });
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setStage("shown");
          later(600, () => setStage("done"));
          return;
        }
        const island = document.querySelector<HTMLElement>("[data-nav-island]");
        if (!island) {
          setStage("shown");
          celebrate();
          return;
        }
        // A black shape over the nav island that grows to cover the page, like Halo's notch swallowing it.
        const r = island.getBoundingClientRect();
        const cover = document.createElement("div");
        cover.className = styles.cover;
        document.body.append(cover);
        const corner = `${Math.round(r.height * 0.4)}px`;
        const small = {
          left: `${r.left}px`,
          top: `${r.top}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
          borderRadius: `0 0 ${corner} ${corner}`,
        };
        const big = {
          left: "0px",
          top: "0px",
          width: `${window.innerWidth}px`,
          height: `${window.innerHeight}px`,
          borderRadius: "0 0 0 0",
        };
        const grow = cover.animate([small, big], { duration: 500, easing: "cubic-bezier(0.32, 1.1, 0.5, 1)", fill: "forwards" });
        grow.onfinish = () => {
          later(100, () => {
            window.scrollTo({ top: end.offsetTop, behavior: "instant" });
            setStage("shown");
            // The nav island stays plain black from here on, like Halo's.
            window.dispatchEvent(new CustomEvent(FINALE_EVENT));
            const r2 = island.getBoundingClientRect();
            const home = { ...small, left: `${r2.left}px`, top: `${r2.top}px` };
            const shrink = cover.animate([big, home], { duration: 500, delay: 350, easing: "cubic-bezier(0.45, 0, 0.55, 1)", fill: "forwards" });
            shrink.onfinish = () => cover.remove();
            celebrate();
          });
        };
      },
      { threshold: 0.4 },
    );
    io.observe(end);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      document.querySelectorAll(`.${styles.cover}`).forEach((el) => el.remove());
    };
  }, []);

  const face = stage === "done" ? DONE : CALM;
  return (
    <section ref={ref} id="buy" className={`${styles.end} ${stage !== "hidden" ? styles.shown : ""}`} aria-labelledby="end-title">
      <div className={styles.inner}>
        <svg
          className={`${styles.face} ${stage === "blink" ? styles.blinking : ""} ${stage === "done" ? styles.happy : ""}`}
          viewBox="4 3 32 24"
          role="img"
          aria-label={`${product.mascot}, ${stage === "done" ? "smiling" : "calm"}`}
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
