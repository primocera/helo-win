"use client";

// A number that counts up from 0 when it comes into view, after halo-mac.com's [data-count] (js/site.js): it counts,
// easing out (1 - (1 - p)^3), then gives a small pop (scale 1.12 back to 1 on sp(0.35, 0.55)). Slower than Halo's
// 700 ms, and only once the number is well inside the screen, so it is seen; it counts again each time it comes back
// into view. With `pauseAt`, it counts to that number, stops there for half a second, then ticks up one at a time to
// `to`, as if there turned out to be more. The server renders the final number, so it reads right without scripts; with reduced motion it stays put.
import { useEffect, useRef } from "react";
import { spring } from "@/lib/spring";

const COUNT_MS = 1800;
/** With a pause: the run up to it, the stop, and each step after it. */
const RUN_MS = 1300;
const HOLD_MS = 550;
const STEP_MS = 420;

export default function CountUp({ to, pauseAt, className }: { to: number; pauseAt?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const n = ref.current;
    if (!n || to === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const pop = spring(0.35, 0.55);
    const run = () => {
      cancelAnimationFrame(frame);
      const t0 = performance.now();
      const stop = pauseAt !== undefined && pauseAt < to ? pauseAt : to;
      const run = stop === to ? COUNT_MS : RUN_MS;
      const count = (now: number) => {
        const t = now - t0;
        const p = Math.min(1, Math.max(0, t / run));
        let value = Math.round(stop * (1 - (1 - p) ** 3));
        if (p >= 1 && stop < to) value = Math.min(to, stop + Math.max(0, Math.floor((t - run - HOLD_MS) / STEP_MS) + 1));
        n.textContent = String(value);
        if (value < to || p < 1) {
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
    // In view: the number is inside the screen, away from its top and bottom tenth. The observer also reports while
    // the number changes width as it counts, so a count starts only when it was out of view before.
    let inView = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting === inView) return;
        inView = e.isIntersecting;
        if (inView) run();
        else {
          cancelAnimationFrame(frame);
          n.textContent = "0";
          n.style.transform = "";
        }
      },
      { threshold: 1, rootMargin: "-10% 0px -10% 0px" },
    );
    // The line it sits in, not the number itself: the pop scales the number past its own box.
    io.observe(n.parentElement ?? n);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      n.textContent = String(to);
      n.style.transform = "";
    };
  }, [to, pauseAt]);
  return (
    <span ref={ref} className={className}>
      {to}
    </span>
  );
}
