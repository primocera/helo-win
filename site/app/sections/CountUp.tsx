"use client";

// A number that counts up from 0 when it comes into view, after halo-mac.com's [data-count] (js/site.js): it counts,
// easing out (1 - (1 - p)^3), then gives a small pop (scale 1.12 back to 1 on sp(0.35, 0.55)). Slower than Halo's
// 700 ms, and only once the number is well inside the screen, so it is seen; it counts again each time it comes back
// into view. The server renders the final number, so it reads right without scripts; with reduced motion it stays put.
import { useEffect, useRef } from "react";
import { spring } from "@/lib/spring";

const COUNT_MS = 1800;

export default function CountUp({ to, className }: { to: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const n = ref.current;
    if (!n || to === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const pop = spring(0.35, 0.55);
    const run = () => {
      cancelAnimationFrame(frame);
      const t0 = performance.now();
      const count = (now: number) => {
        const p = Math.min(1, Math.max(0, (now - t0) / COUNT_MS));
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
    };
    n.textContent = "0";
    // In view: the number is inside the middle of the screen (not the top or bottom fifth).
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) run();
        else {
          cancelAnimationFrame(frame);
          n.textContent = "0";
          n.style.transform = "";
        }
      },
      { threshold: 1, rootMargin: "-20% 0px -20% 0px" },
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
    <span ref={ref} className={className}>
      {to}
    </span>
  );
}
