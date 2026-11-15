"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { product } from "@/lib/product";
import styles from "./MeetBlinkSection.module.css";

// ---- Blink's face --------------------------------------------------------------------------
// Copied from the app, not imported: Turbopack does not resolve files outside the site/ root.
// Keep in step with:
//   - Face type: app/src/shared/types.ts
//   - shape(), POSES, FACE_LABELS, BLINKS, the blink timer and the SVG layout:
//     app/src/renderer/src/island/Blink.tsx
//   - stroke, transitions and keyframes (.blink-*): app/src/renderer/src/island/island.css
// Every feature is a closed 4-curve path with the same structure in every mood, so the CSS `d`
// transition morphs between moods. The `d` attribute is also set, for browsers without CSS `d`.

type Face = "calm" | "happy" | "listening" | "thinking" | "needsYou" | "done" | "napping" | "broken";

const K = 0.5523;

/** Closed shape around (cx, cy): `top` bulges up by that much, `bottom` bulges down. */
function shape(cx: number, cy: number, rx: number, top: number, bottom: number): string {
  const f = (n: number) => n.toFixed(2);
  const t = cy - top;
  const b = cy + bottom;
  return [
    `M${f(cx - rx)} ${f(cy)}`,
    `C${f(cx - rx)} ${f(cy - K * top)} ${f(cx - K * rx)} ${f(t)} ${f(cx)} ${f(t)}`,
    `C${f(cx + K * rx)} ${f(t)} ${f(cx + rx)} ${f(cy - K * top)} ${f(cx + rx)} ${f(cy)}`,
    `C${f(cx + rx)} ${f(cy + K * bottom)} ${f(cx + K * rx)} ${f(b)} ${f(cx)} ${f(b)}`,
    `C${f(cx - K * rx)} ${f(b)} ${f(cx - rx)} ${f(cy + K * bottom)} ${f(cx - rx)} ${f(cy)}Z`,
  ].join("");
}

interface Pose {
  eye: [rx: number, top: number, bottom: number];
  eyeY: number;
  mouth: [cx: number, cy: number, rx: number, top: number, bottom: number];
  blush: number;
  tilt: number;
  track: boolean;
}

const POSES: Record<Face, Pose> = {
  calm: { eye: [3.3, 2.5, 2.5], eyeY: 12, mouth: [20, 19.6, 2.6, -1.5, 1.5], blush: 0, tilt: 0, track: true },
  happy: { eye: [3.3, 2.4, -2.4], eyeY: 12.6, mouth: [20, 19.2, 3.8, -2.6, 2.6], blush: 0.75, tilt: 0, track: true },
  listening: { eye: [3.4, 2.7, 2.7], eyeY: 12, mouth: [20.4, 19.8, 2.2, -1.2, 1.2], blush: 0.35, tilt: -10, track: true },
  thinking: { eye: [3.3, 1.7, 1.7], eyeY: 12, mouth: [20, 20.2, 2.8, 0, 0], blush: 0, tilt: 0, track: false },
  needsYou: { eye: [3.7, 3.4, 3.4], eyeY: 11.6, mouth: [20, 21, 1.5, 1.7, 1.7], blush: 0, tilt: 0, track: true },
  done: { eye: [3.3, 2.4, -2.4], eyeY: 12.6, mouth: [20, 18.8, 3.4, 0, 3.4], blush: 0.75, tilt: 0, track: false },
  napping: { eye: [3.1, -1.3, 1.3], eyeY: 12.4, mouth: [20, 20.4, 1.2, -0.6, 0.6], blush: 0, tilt: 0, track: false },
  broken: { eye: [2.5, 2.5, 2.5], eyeY: 12, mouth: [20, 21.4, 3, 1.7, -1.7], blush: 0, tilt: 0, track: false },
};

const FACE_LABELS: Record<Face, string> = {
  calm: "Calm",
  happy: "Happy to see you",
  listening: "Listening",
  thinking: "Thinking",
  needsYou: "Needs you",
  done: "Done",
  napping: "Napping",
  broken: "Something broke",
};

const MOODS = Object.keys(POSES) as Face[];

/** Faces that blink now and then. */
const BLINKS: Face[] = ["calm", "listening", "needsYou"];

/** Blinks every few seconds (a timer, so nothing animates between blinks). */
function useBlink(active: boolean) {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!active) return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setClosed(true);
        t = window.setTimeout(() => {
          setClosed(false);
          loop();
        }, 140);
      }, 3500 + Math.random() * 4000);
    };
    loop();
    return () => window.clearTimeout(t);
  }, [active]);
  return active && closed;
}

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (cb: () => void) => {
  const m = window.matchMedia(REDUCE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
/** True until the browser says otherwise, so the server render and hydration are still. */
const useReducedMotion = () =>
  useSyncExternalStore(subscribeMotion, () => window.matchMedia(REDUCE).matches, () => true);

const dStyle = (d: string): CSSProperties => ({ d: `path("${d}")` }) as CSSProperties;

function Part({ d }: { d: string }) {
  return <path className={styles.part} d={d} style={dStyle(d)} />;
}

function BlinkFace({
  face,
  look = { x: 0, y: 0 },
  blinking = false,
  className,
  labelled = true,
}: {
  face: Face;
  look?: { x: number; y: number };
  blinking?: boolean;
  className?: string;
  /** false when a visible label next to the face already names the mood. */
  labelled?: boolean;
}) {
  const pose = POSES[face];
  const p = blinking ? { ...pose, eye: [pose.eye[0], 0.4, 0.4] as Pose["eye"] } : pose;
  const lx = p.track ? look.x * 1.7 : 0;
  const ly = p.track ? look.y * 1.2 : 0;
  const [rx, top, bottom] = p.eye;
  const a11y = labelled ? { role: "img", "aria-label": FACE_LABELS[face] } : { "aria-hidden": true };
  return (
    // The app draws on a 0 0 40 30 box with room around the face for its tiny size. Here the box
    // is trimmed to the face (same 4:3 ratio) so the drawing fills the space it is given; the
    // napping "z" and the listening tilt may reach past it (overflow is visible).
    <svg className={`${styles.face} ${className ?? ""}`} data-face={face} viewBox="4 3 32 24" {...a11y}>
      <g className={styles.head} style={{ transform: `rotate(${p.tilt}deg)` }}>
        <g className={styles.blush} style={{ opacity: p.blush }}>
          <rect x="5.4" y="16.2" width="5" height="1.8" rx="0.9" />
          <rect x="29.6" y="16.2" width="5" height="1.8" rx="0.9" />
        </g>
        <g className={styles.eyes} style={{ transform: `translate(${lx.toFixed(2)}px, ${ly.toFixed(2)}px)` }}>
          <g className={styles.drift}>
            <Part d={shape(14, p.eyeY, rx, top, bottom)} />
            <Part d={shape(26, p.eyeY, rx, top, bottom)} />
          </g>
        </g>
        <Part d={shape(...p.mouth)} />
        {face === "napping" && (
          <text className={styles.z} x="33" y="7">
            z
          </text>
        )}
      </g>
    </svg>
  );
}

// ---- The section ---------------------------------------------------------------------------

/** What the big face does on its own: a small day of agent work, then a nap. */
const CYCLE: { face: Face; ms: number }[] = [
  { face: "calm", ms: 5000 },
  { face: "thinking", ms: 4500 },
  { face: "done", ms: 3000 },
  { face: "calm", ms: 4000 },
  { face: "needsYou", ms: 3200 },
  { face: "happy", ms: 2600 },
  { face: "calm", ms: 4500 },
  { face: "napping", ms: 6500 },
];

type Pointer = { x: number; y: number; near: boolean };

const clamp = (n: number) => Math.max(-1, Math.min(1, n));

export default function MeetBlinkSection() {
  const reduced = useReducedMotion();
  const tileRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [pointer, setPointer] = useState<Pointer | null>(null);
  const hovering = pointer !== null;

  // Cycle through moods while nobody is pointing at the section.
  useEffect(() => {
    if (reduced || hovering) return;
    const t = window.setTimeout(() => setStep((s) => (s + 1) % CYCLE.length), CYCLE[step].ms);
    return () => window.clearTimeout(t);
  }, [reduced, hovering, step]);

  const face: Face = reduced ? "calm" : pointer ? (pointer.near ? "happy" : "calm") : CYCLE[step].face;
  const blinking = useBlink(!reduced && BLINKS.includes(face));

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (reduced || e.pointerType === "touch" || !tileRef.current) return;
    const r = tileRef.current.getBoundingClientRect();
    const reach = r.width * 1.4;
    const x = Math.round(clamp((e.clientX - (r.left + r.width / 2)) / reach) * 100) / 100;
    const y = Math.round(clamp((e.clientY - (r.top + r.height / 2)) / reach) * 100) / 100;
    const pad = 24;
    const near = e.clientX > r.left - pad && e.clientX < r.right + pad && e.clientY > r.top - pad && e.clientY < r.bottom + pad;
    setPointer((p) => (p && p.x === x && p.y === y && p.near === near ? p : { x, y, near }));
  };

  const onPointerLeave = () => {
    setPointer(null);
    setStep(0);
  };

  return (
    <section className={styles.section} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <div className={styles.stage}>
        <div ref={tileRef} className={styles.tile}>
          <BlinkFace face={face} look={pointer ?? undefined} blinking={blinking} className={styles.big} />
        </div>
      </div>

      <p className={styles.kicker}>
        {product.name} {product.mascot}
      </p>
      <h2 className={styles.title}>
        Meet <span className={styles.name}>{product.mascot}.</span>
      </h2>
      <p className={styles.text}>
        {product.mascot} sits beside the island. Its eyes follow your pointer, and it smiles when you come near. It
        shows what your agents are up to: thinking while one works, wide-eyed when one needs an answer, pleased when
        one is done, worried when something breaks, and asleep when nothing has happened for a while.
      </p>

      <ul className={styles.moods}>
        {MOODS.map((m) => (
          <li key={m} className={styles.mood}>
            <BlinkFace face={m} labelled={false} className={styles.small} />
            <span className={styles.label}>{FACE_LABELS[m]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
