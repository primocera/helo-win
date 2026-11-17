// Blink's calm and done faces and the app's "done" sound, shared by the nav island and the end card.
// Faces: the shapes in app/src/renderer/src/island/Blink.tsx (as in sections/IslandMocks.tsx), on a 40 x 30 box.
// Sound: app/src/renderer/src/island/sound.ts, two sine notes (E5, then B5 0.13 s later), each fading over half a second.

const K = 0.5523;

/** Closed shape around (cx, cy): `top` bulges up by that much, `bottom` bulges down. */
export function shape(cx: number, cy: number, rx: number, top: number, bottom: number): string {
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

export type FaceShapes = { eyes: [string, string]; mouth: string };

export const CALM: FaceShapes = {
  eyes: [shape(14, 12, 3.3, 2.5, 2.5), shape(26, 12, 3.3, 2.5, 2.5)],
  mouth: shape(20, 19.6, 2.6, -1.5, 1.5),
};

export const DONE: FaceShapes = {
  eyes: [shape(14, 12.6, 3.3, 2.4, -2.4), shape(26, 12.6, 3.3, 2.4, -2.4)],
  mouth: shape(20, 18.8, 3.4, 0, 3.4),
};

/**
 * The app's done sound. Browsers only let a page make sound after the visitor has clicked or tapped it, so before that
 * this stays silent.
 */
export function playDone() {
  let ctx: AudioContext;
  try {
    ctx = new AudioContext();
  } catch {
    return;
  }
  const go = () => {
    const t0 = ctx.currentTime + 0.03;
    for (const [freq, at] of [
      [659.25, 0],
      [987.77, 0.13],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.55);
    }
    window.setTimeout(() => void ctx.close().catch(() => {}), 1200);
  };
  if (ctx.state === "running") go();
  else
    ctx
      .resume()
      .then(() => (ctx.state === "running" ? go() : void ctx.close()))
      .catch(() => void ctx.close().catch(() => {}));
}

/** Sent on window by the end card once the island has swallowed the page; the nav island then stays plain black. */
export const FINALE_EVENT = "helo-finale";
