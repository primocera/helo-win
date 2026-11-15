// Blink, the mascot: a small white-on-black face beside the island. Every feature is a
// closed 4-curve path with the same structure in every mood, so the CSS `d`
// transition morphs between moods instead of swapping drawings. An "arc" is
// the same path with its two halves laid on one curve (zero area, stroke only).
import { useEffect, useState, type CSSProperties } from 'react';
import type { Face } from '../../../shared/types';

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
  ].join('');
}

interface Pose {
  eye: [rx: number, top: number, bottom: number];
  eyeY: number;
  mouth: [cx: number, cy: number, rx: number, top: number, bottom: number];
  blush: number;
  tilt: number;
  track: boolean;
}

// Eyes: wide ovals (wider than tall). Mouth: arcs or small filled shapes.
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

export const FACE_LABELS: Record<Face, string> = {
  calm: 'Calm',
  happy: 'Happy to see you',
  listening: 'Listening',
  thinking: 'Thinking',
  needsYou: 'Needs you',
  done: 'Done',
  napping: 'Napping',
  broken: 'Something broke',
};

const dStyle = (d: string): CSSProperties => ({ d: `path("${d}")` }) as CSSProperties;

const BLINKS: Face[] = ['calm', 'listening', 'needsYou'];

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

export function BlinkFace({ face, look = { x: 0, y: 0 }, size = 20, still = false }: { face: Face; look?: { x: number; y: number }; size?: number; still?: boolean }) {
  const blinking = useBlink(!still && BLINKS.includes(face));
  const p = blinking ? { ...POSES[face], eye: [POSES[face].eye[0], 0.4, 0.4] as Pose['eye'] } : POSES[face];
  const lx = p.track ? look.x * 1.7 : 0;
  const ly = p.track ? look.y * 1.2 : 0;
  const [rx, top, bottom] = p.eye;
  return (
    <svg className={`blink-face face-${face}`} width={(size * 40) / 30} height={size} viewBox="0 0 40 30" aria-label={FACE_LABELS[face]} role="img">
      <g className="blink-head" style={{ transform: `rotate(${p.tilt}deg)` }}>
        <g className="blink-blush" style={{ opacity: p.blush }}>
          <rect x="5.4" y="16.2" width="5" height="1.8" rx="0.9" />
          <rect x="29.6" y="16.2" width="5" height="1.8" rx="0.9" />
        </g>
        <g className="blink-eyes" style={{ transform: `translate(${lx.toFixed(2)}px, ${ly.toFixed(2)}px)` }}>
          <g className="blink-eyes-drift">
            <path className="blink-part" style={dStyle(shape(14, p.eyeY, rx, top, bottom))} />
            <path className="blink-part" style={dStyle(shape(26, p.eyeY, rx, top, bottom))} />
          </g>
        </g>
        <path className="blink-part" style={dStyle(shape(...p.mouth))} />
        {face === 'napping' && (
          <text className="blink-z" x="33" y="7">z</text>
        )}
      </g>
    </svg>
  );
}
