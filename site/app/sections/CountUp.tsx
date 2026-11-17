"use client";

// A number that counts up from 0 when it comes into view, as halo-mac.com's [data-count] (js/site.js): once 60% of it
// is on screen it counts for 700 ms, easing out (1 - (1 - p)^3), then gives a small pop (scale 1.12 back to 1 on
// sp(0.35, 0.55)). The server renders the final number, so it reads right without scripts; with reduced motion it
// stays put.
import { useEffect, useRef } from "react";
import { spring } from "@/lib/spring";

export default function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const n = ref.current;
    if (!n || to === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    n.textContent = "0";
    let frame = 0;
    const pop = spring(0.35, 0.55);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const count = (now: number) => {
          const p = Math.min(1, Math.max(0, (now - t0) / 700));
          n.textContent = String(Math.round(to * (1 - (1 - p) ** 3)));
          if (p < 1) {
            frame = requestAnimationFrame(count);
            return;
          }
          const t1 = now;
          const settle = (later: number) => {
            const q = Math.min(1, (later - t1) / 1000 / pop.duration);
            n.style.transform = q < 1 ? `scale(${1.12 - 0.12 * pop.ease(q)})` : "";
            if (q < 1) frame = requestAnimationFrame(settle);
          };
          frame = requestAnimationFrame(settle);
        };
        frame = requestAnimationFrame(count);
      },
      { threshold: 0.6 },
    );
    io.observe(n);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      n.textContent = String(to);
      n.style.transform = "";
    };
  }, [to]);
  return (
    <span ref={ref} style={{ display: "inline-block" }}>
      {to}
    </span>
  );
}
