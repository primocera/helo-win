"use client";

// What moves as the page scrolls: the parts of each section ease in when they come on screen, and the key phrases of
// a `data-scroll-light` paragraph light up one after another as it passes. Without scripts, or with reduced motion,
// nothing is hidden and nothing moves: the classes that hide things are only added here.
import { useEffect } from "react";

export default function ScrollEffects() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // ---- parts easing in. The first section (the hero) is on screen at the start and is left alone.
    const parts = Array.from(
      document.querySelectorAll<HTMLElement>("main > section:not(:first-of-type) > div > *, main > section:not(:first-of-type) > :not(div)"),
    ).filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.9);
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("reveal-in");
          seen.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    for (const el of parts) {
      el.classList.add("reveal");
      seen.observe(el);
    }

    // ---- phrases lighting up
    const paragraphs = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-light]"));
    for (const p of paragraphs) p.classList.add("scroll-light");
    let frame = 0;
    const light = () => {
      frame = 0;
      for (const p of paragraphs) {
        const r = p.getBoundingClientRect();
        const h = window.innerHeight;
        // 0 when the paragraph's top reaches 85% of the screen, 1 when its bottom reaches 45%.
        const progress = Math.min(1, Math.max(0, (h * 0.85 - r.top) / (r.height + h * 0.4)));
        const phrases = p.querySelectorAll("strong");
        phrases.forEach((s, i) => s.classList.toggle("lit", progress >= (i + 0.5) / phrases.length));
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(light);
    };
    light();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      seen.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      for (const el of parts) el.classList.remove("reveal", "reveal-in");
      for (const p of paragraphs) p.classList.remove("scroll-light");
    };
  }, []);
  return null;
}
