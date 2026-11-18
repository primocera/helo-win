// Pictures of the island, drawn with HTML and CSS after the app's own look (app/src/renderer/src/island/island.css,
// Views.tsx, Panel.tsx and the smoke-test screenshots). Each mock sits at the top centre of a <Desktop>.
//
// Sizes are the app's own pixel sizes multiplied by --u, which shrinks the island to fit its desktop box (see the CSS).
// No hooks and no handlers: these render the same on the server and in the browser, in server and client components.
// (The question card you can answer lives in AgentQuestion.tsx, a client component built from these parts.)
import type { CSSProperties, ReactNode } from "react";
import { drawMap } from "@/lib/map/draw";
import { foldRows, nowParts } from "@/lib/map/feed";
import { classify, clean, formatMs, shortModel } from "@/lib/map/classify";
import { setupFrom } from "@/lib/map/setup";
import type { Board, Entry, StationId } from "@/lib/map/types";
import shared from "./shared.module.css";
import s from "./IslandMocks.module.css";

// ---- icons: Phosphor Icons, fill weight (MIT, @phosphor-icons/core 2.1.1), as the app draws them ----------------
// (app/src/renderer/src/common/icons.tsx). Each is the inside of a 256 x 256 SVG filled with currentColor.

const PATHS = {
  home: <path d="M224,120v96a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V164a4,4,0,0,0-4-4H108a4,4,0,0,0-4,4v52a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V120a16,16,0,0,1,4.69-11.31l80-80a16,16,0,0,1,22.62,0l80,80A16,16,0,0,1,224,120Z" />,
  agents: <path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm-91,94.25-40,32a8,8,0,1,1-10-12.5L107.19,128,75,102.25a8,8,0,1,1,10-12.5l40,32a8,8,0,0,1,0,12.5ZM176,168H136a8,8,0,0,1,0-16h40a8,8,0,0,1,0,16Z" />,
  map: <path d="M200,152a31.84,31.84,0,0,0-19.53,6.68l-23.11-18A31.65,31.65,0,0,0,160,128c0-.74,0-1.48-.08-2.21l13.23-4.41A32,32,0,1,0,168,104c0,.74,0,1.48.08,2.21l-13.23,4.41A32,32,0,0,0,128,96a32.59,32.59,0,0,0-5.27.44L115.89,81A32,32,0,1,0,96,88a32.59,32.59,0,0,0,5.27-.44l6.84,15.4a31.92,31.92,0,0,0-8.57,39.64L73.83,165.44a32.06,32.06,0,1,0,10.63,12l25.71-22.84a31.91,31.91,0,0,0,37.36-1.24l23.11,18A31.65,31.65,0,0,0,168,184a32,32,0,1,0,32-32Zm0-64a16,16,0,1,1-16,16A16,16,0,0,1,200,88ZM80,56A16,16,0,1,1,96,72,16,16,0,0,1,80,56ZM56,208a16,16,0,1,1,16-16A16,16,0,0,1,56,208Zm144-8a16,16,0,1,1,16-16A16,16,0,0,1,200,200Z" />,
  timer: <path d="M128,40a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,40Zm45.66,61.66-40,40a8,8,0,0,1-11.32-11.32l40-40a8,8,0,0,1,11.32,11.32ZM96,16a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,16Z" />,
  clipboard: <path d="M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm32,128H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Z" />,
  notes: <path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H156.69A15.92,15.92,0,0,0,168,219.31L219.31,168A15.92,15.92,0,0,0,224,156.69V48A16,16,0,0,0,208,32ZM96,88h64a8,8,0,0,1,0,16H96a8,8,0,0,1,0-16Zm32,80H96a8,8,0,0,1,0-16h32a8,8,0,0,1,0,16ZM96,136a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm64,68.69V160h44.7Z" />,
  shelf: <path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V168H76.69L96,187.32A15.89,15.89,0,0,0,107.31,192h41.38A15.86,15.86,0,0,0,160,187.31L179.31,168H208v40Z" />,
  calendar: <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,48H48V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24Z" />,
  mic: <path d="M80,128V64a48,48,0,0,1,96,0v64a48,48,0,0,1-96,0Zm128,0a8,8,0,0,0-16,0,64,64,0,0,1-128,0,8,8,0,0,0-16,0,80.11,80.11,0,0,0,72,79.6V240a8,8,0,0,0,16,0V207.6A80.11,80.11,0,0,0,208,128Z" />,
  bell: <path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216Z" />,
  system: <path d="M32,80a8,8,0,0,1,8-8H77.17a28,28,0,0,1,53.66,0H216a8,8,0,0,1,0,16H130.83a28,28,0,0,1-53.66,0H40A8,8,0,0,1,32,80Zm184,88H194.83a28,28,0,0,0-53.66,0H40a8,8,0,0,0,0,16H141.17a28,28,0,0,0,53.66,0H216a8,8,0,0,0,0-16Z" />,
  lock: <path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96Z" />,
  settings: <path d="M237.94,107.21a8,8,0,0,0-3.89-5.4l-29.83-17-.12-33.62a8,8,0,0,0-2.83-6.08,111.91,111.91,0,0,0-36.72-20.67,8,8,0,0,0-6.46.59L128,41.85,97.88,25a8,8,0,0,0-6.47-.6A111.92,111.92,0,0,0,54.73,45.15a8,8,0,0,0-2.83,6.07l-.15,33.65-29.83,17a8,8,0,0,0-3.89,5.4,106.47,106.47,0,0,0,0,41.56,8,8,0,0,0,3.89,5.4l29.83,17,.12,33.63a8,8,0,0,0,2.83,6.08,111.91,111.91,0,0,0,36.72,20.67,8,8,0,0,0,6.46-.59L128,214.15,158.12,231a7.91,7.91,0,0,0,3.9,1,8.09,8.09,0,0,0,2.57-.42,112.1,112.1,0,0,0,36.68-20.73,8,8,0,0,0,2.83-6.07l.15-33.65,29.83-17a8,8,0,0,0,3.89-5.4A106.47,106.47,0,0,0,237.94,107.21ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z" />,
  pause: <path d="M216,48V208a16,16,0,0,1-16,16H160a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h40A16,16,0,0,1,216,48ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Z" />,
  play: <path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z" />,
  next: <path d="M208,40V216a8,8,0,0,1-16,0V146.77L72.43,221.55A15.95,15.95,0,0,1,48,208.12V47.88A15.95,15.95,0,0,1,72.43,34.45L192,109.23V40a8,8,0,0,1,16,0Z" />,
  previous: <path d="M208,47.88V208.12a16,16,0,0,1-24.43,13.43L64,146.77V216a8,8,0,0,1-16,0V40a8,8,0,0,1,16,0v69.23L183.57,34.45A15.95,15.95,0,0,1,208,47.88Z" />,
  contrast: <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM40,128a88.1,88.1,0,0,1,88-88V216A88.1,88.1,0,0,1,40,128Z" />,
  sun: <path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm8,24a64,64,0,1,0,64,64A64.07,64.07,0,0,0,128,64ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z" />,
  close: <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm37.66,130.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />,
  folder: <path d="M216,72H131.31L104,44.69A15.88,15.88,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.41,15.41,0,0,0,39.39,216h177.5A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72ZM40,56H92.69l16,16H40Z" />,
  file: <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM152,88V44l44,44Z" />,
  check: <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z" />,
  shuffle: <path d="M237.66,178.34a8,8,0,0,1,0,11.32l-24,24A8,8,0,0,1,200,208V192a72.15,72.15,0,0,1-57.65-30.14l-41.72-58.4A56.1,56.1,0,0,0,55.06,80H32a8,8,0,0,1,0-16H55.06a72.12,72.12,0,0,1,58.59,30.15l41.72,58.4A56.08,56.08,0,0,0,200,176V160a8,8,0,0,1,13.66-5.66ZM143,107a8,8,0,0,0,11.16-1.86l1.2-1.67A56.08,56.08,0,0,1,200,80V96a8,8,0,0,0,13.66,5.66l24-24a8,8,0,0,0,0-11.32l-24-24A8,8,0,0,0,200,48V64a72.15,72.15,0,0,0-57.65,30.14l-1.2,1.67A8,8,0,0,0,143,107Zm-30,42a8,8,0,0,0-11.16,1.86l-1.2,1.67A56.1,56.1,0,0,1,55.06,176H32a8,8,0,0,0,0,16H55.06a72.12,72.12,0,0,0,58.59-30.15l1.2-1.67A8,8,0,0,0,113,149Z" />,
  repeat: <path d="M24,128A72.08,72.08,0,0,1,96,56h96V40a8,8,0,0,1,13.66-5.66l24,24a8,8,0,0,1,0,11.32l-24,24A8,8,0,0,1,192,88V72H96a56.06,56.06,0,0,0-56,56,8,8,0,0,1-16,0Zm200-8a8,8,0,0,0-8,8,56.06,56.06,0,0,1-56,56H64V168a8,8,0,0,0-13.66-5.66l-24,24a8,8,0,0,0,0,11.32l24,24A8,8,0,0,0,64,216V200h96a72.08,72.08,0,0,0,72-72A8,8,0,0,0,224,120Z" />,
  speaker: <path d="M160,32.25V223.69a8.29,8.29,0,0,1-3.91,7.18,8,8,0,0,1-9-.56l-65.57-51A4,4,0,0,1,80,176.16V79.84a4,4,0,0,1,1.55-3.15l65.57-51a8,8,0,0,1,10,.16A8.27,8.27,0,0,1,160,32.25ZM60,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H60a4,4,0,0,0,4-4V84A4,4,0,0,0,60,80Zm126.77,20.84a8,8,0,0,0-.72,11.3,24,24,0,0,1,0,31.72,8,8,0,1,0,12,10.58,40,40,0,0,0,0-52.88A8,8,0,0,0,186.74,100.84Zm40.89-26.17a8,8,0,1,0-11.92,10.66,64,64,0,0,1,0,85.34,8,8,0,1,0,11.92,10.66,80,80,0,0,0,0-106.66Z" />,
  cup: <path d="M208,80H32a8,8,0,0,0-8,8v48a96.3,96.3,0,0,0,32.54,72H32a8,8,0,0,0,0,16H208a8,8,0,0,0,0-16H183.46a96.59,96.59,0,0,0,27-40.09A40,40,0,0,0,248,128v-8A40,40,0,0,0,208,80Zm24,48a24,24,0,0,1-17.2,23,95.78,95.78,0,0,0,1.2-15V97.38A24,24,0,0,1,232,120ZM112,56V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0Zm32,0V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0ZM80,56V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0Z" />,
  reset: <path d="M224,128a96,96,0,0,1-94.71,96H128A95.38,95.38,0,0,1,62.1,197.8a8,8,0,0,1,11-11.63A80,80,0,1,0,71.43,71.39a3.07,3.07,0,0,1-.26.25L60.63,81.29l17,17A8,8,0,0,1,72,112H24a8,8,0,0,1-8-8V56A8,8,0,0,1,29.66,50.3L49.31,70,60.25,60A96,96,0,0,1,224,128Z" />,
};

export type IconName = keyof typeof PATHS;

/** A size in the app's pixels, scaled with the island. */
const px = (n: number) => `calc(${n} * var(--u))`;

export function Icon({ name, size, className }: { name: IconName; size: number; className?: string }) {
  return (
    <svg
      className={`${s.icon} ${className ?? ""}`}
      style={{ width: px(size), height: px(size) }}
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/** The app's mark: a mint tile with the island-face glyph cut out. */
export function Mark() {
  return (
    <svg className={s.icon} style={{ width: px(15), height: px(15) }} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="0" y="0" width="16" height="16" rx="4.4" fill="var(--accent)" />
      <circle cx="5.6" cy="8" r="1.7" fill="#04120d" />
      <rect x="8.4" y="7.25" width="3.6" height="1.5" rx="0.75" fill="#04120d" />
    </svg>
  );
}

// ---- Blink, still: four of its faces (shapes from MeetBlinkSection / the app's Blink.tsx) -----------------------

export type Face = "calm" | "thinking" | "needsYou" | "done";

const K = 0.5523;
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

const FACES: Record<Face, { eye: [number, number, number]; eyeY: number; mouth: [number, number, number, number, number]; blush: number }> = {
  calm: { eye: [3.3, 2.5, 2.5], eyeY: 12, mouth: [20, 19.6, 2.6, -1.5, 1.5], blush: 0 },
  thinking: { eye: [3.3, 1.7, 1.7], eyeY: 12, mouth: [20, 20.2, 2.8, 0, 0], blush: 0 },
  needsYou: { eye: [3.7, 3.4, 3.4], eyeY: 11.6, mouth: [20, 21, 1.5, 1.7, 1.7], blush: 0 },
  done: { eye: [3.3, 2.4, -2.4], eyeY: 12.6, mouth: [20, 18.8, 3.4, 0, 3.4], blush: 0.75 },
};

export function Blink({ face, className }: { face: Face; className?: string }) {
  const p = FACES[face];
  const [rx, top, bottom] = p.eye;
  return (
    <span className={`${s.blink} ${className ?? ""}`}>
      <svg className={s.face} viewBox="0 0 40 30" aria-hidden="true" data-face={face}>
        {p.blush > 0 && (
          <g opacity={p.blush} fill="var(--accent)">
            <rect x="5.4" y="16.2" width="5" height="1.8" rx="0.9" />
            <rect x="29.6" y="16.2" width="5" height="1.8" rx="0.9" />
          </g>
        )}
        <g className={s.eyes}>
          <path className={s.facePart} d={shape(14, p.eyeY, rx, top, bottom)} />
          <path className={s.facePart} d={shape(26, p.eyeY, rx, top, bottom)} />
        </g>
        <path className={s.facePart} d={shape(...p.mouth)} />
      </svg>
    </span>
  );
}

// ---- the desktop and the island's frame -------------------------------------------------------------------------

/**
 * The wallpaper a mock island sits on. Give it an `aspect` (or a `height`), or set `--desk-aspect` from the section's
 * CSS; its height must not come from its content. A section can also set `--island-max` (largest scale, e.g. 1.15px),
 * `--island-fit` (share of the width the island may take) and `--island-hfit` (share of the height).
 */
export function Desktop({
  children,
  aspect,
  height,
  className,
  style,
}: {
  children?: ReactNode;
  aspect?: string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`${shared.desktop} ${s.desk} ${className ?? ""}`}
      style={{ ...(aspect ? { aspectRatio: aspect } : {}), ...(height !== undefined ? { height } : {}), ...style }}
    >
      {children}
    </div>
  );
}

type Size = {
  /** Island width in the app's pixels, wide and narrow. */
  w: [number, number];
  /** About how tall the island is, wide and narrow; used to keep it inside a short desktop. */
  h: [number, number];
  /** Below which desktop width the narrow layout is used. */
  bp?: 540 | 640;
};

const MODE = { idle: s.rIdle, banner: s.rBanner, card: s.rCard, panel: s.rPanel } as const;

function Island({
  mode,
  size,
  face = "calm",
  label,
  className,
  children,
}: {
  mode: keyof typeof MODE;
  size: Size;
  face?: Face;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const vars = {
    "--iw-w": size.w[0],
    "--iw-n": size.w[1],
    "--ih-w": size.h[0],
    "--ih-n": size.h[1],
  } as CSSProperties;
  const narrow = size.bp === 540 ? s.n540 : size.bp === 640 ? s.n640 : "";
  return (
    <div className={`${s.top} ${narrow} ${className ?? ""}`} style={vars} role="img" aria-label={label}>
      <Blink face={face} />
      <div className={`${s.island} ${MODE[mode]}`}>{children}</div>
    </div>
  );
}

/** The level meter beside a playing track (still heights; it moves gently unless motion is reduced). */
export function Bars() {
  return (
    <span className={s.bars} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

// ---- idle ---------------------------------------------------------------------------------------------------------

/** The resting pill: the mark, a focus timer counting down, and the meter of a playing track. */
export function MockIdle({ timer = "24:10" }: { timer?: string }) {
  return (
    <Island mode="idle" size={{ w: [214, 214], h: [34, 34] }} label={`The island at rest, with a focus timer at ${timer} and music playing`}>
      <div className={s.idle}>
        <Mark />
        <span className={s.idleMiddle}>
          <span className={s.idleChip}>
            <Icon name="timer" size={12} />
            {timer}
          </span>
        </span>
        <Bars />
      </div>
    </Island>
  );
}

// ---- banner -------------------------------------------------------------------------------------------------------

/**
 * "Finished in <project>" with the start of the agent's last message, as format.ts builds it from the Stop hook.
 * The app adds " · <time worked>" when the agent worked for 5 seconds or more (main/index.ts); `took` = "" leaves it off.
 */
export function MockDoneBanner({
  project = "shop-api",
  took = "3m 12s",
  message = "All 18 tests pass. I also fixed the rounding in the cart total.",
}: {
  project?: string;
  took?: string;
  message?: string;
}) {
  const title = `Finished in ${project}${took ? ` · ${took}` : ""}`;
  return (
    <Island
      mode="banner"
      face="done"
      size={{ w: [440, 340], h: [62, 62], bp: 540 }}
      label={`A banner on the island: ${title}. ${message}`}
    >
      <div className={s.banner}>
        <span className={`${s.appIcon} ${s.kindDone}`}>
          <Icon name="check" size={17} />
        </span>
        <span className={s.bannerLines}>
          <span className={s.bannerTitle}>{title}</span>
          <span className={s.bannerText}>{message}</span>
        </span>
        <span className={s.bannerTime}>now</span>
      </div>
    </Island>
  );
}

// ---- agent cards --------------------------------------------------------------------------------------------------

const AGENT_NAME = { claude: "Claude Code", codex: "Codex" } as const;

export function CardHead({ agent, label, project, more }: { agent: keyof typeof AGENT_NAME; label: string; project: string; more: number }) {
  return (
    <div className={s.cardHead}>
      <span className={`${s.appIcon} ${s.appIconSmall} ${agent === "claude" ? s.agentClaude : s.agentCodex}`}>
        <Icon name="agents" size={14} />
      </span>
      <span className={s.cardAgent}>{AGENT_NAME[agent]}</span>
      <span className={s.cardTool}>{label}</span>
      {project && <span className={s.cardProject}>{project}</span>}
      {more > 0 && <span className={s.cardMore}>+{more} more</span>}
    </div>
  );
}

/**
 * A permission request. "Always allow" appears only when Claude Code offers a rule to add, so it is off for Codex.
 */
export function MockPermission({
  agent = "claude",
  tool = "Bash",
  project = "shop-api",
  command = "npm test -- --coverage",
  more = 0,
  always = true,
}: {
  agent?: keyof typeof AGENT_NAME;
  tool?: string;
  project?: string;
  command?: string;
  more?: number;
  always?: boolean;
}) {
  const showAlways = always && agent === "claude";
  return (
    <Island
      mode="card"
      face="needsYou"
      size={{ w: [488, 360], h: [140, 160], bp: 540 }}
      label={`A ${AGENT_NAME[agent]} request on the island: ${tool} in ${project}, ${command}. Buttons: Deny, ${showAlways ? "Always allow, " : ""}Allow.`}
    >
      <div className={s.card}>
        <CardHead agent={agent} label={tool} project={project} more={more} />
        <div className={s.summary}>{command}</div>
        <div className={s.actions}>
          <span className={s.btn}>
            Deny <kbd className={s.kbd}>Alt Shift N</kbd>
          </span>
          {showAlways && <span className={`${s.btn} ${s.ghost}`}>Always allow</span>}
          <span className={`${s.btn} ${s.primary}`}>
            Allow <kbd className={s.kbd}>Alt Shift Y</kbd>
          </span>
        </div>
      </div>
    </Island>
  );
}

export type MockOption = { label: string; text?: string };

/** One of Claude Code's multiple-choice questions, with the way back to the terminal and a way to type your own. */
export function MockQuestion({
  project = "shop-api",
  header = "Cache",
  question = "Where should the session cache live?",
  options = [
    { label: "In memory", text: "Fastest. Cleared when the server restarts." },
    { label: "Redis", text: "Shared by every instance of the service." },
  ],
}: {
  project?: string;
  header?: string;
  question?: string;
  options?: MockOption[];
}) {
  const h = 150 + 54 * options.length;
  return (
    <Island
      mode="card"
      face="needsYou"
      size={{ w: [488, 360], h: [h, h + 30], bp: 540 }}
      label={`A Claude Code question on the island: ${question} Options: ${options.map((o) => o.label).join(", ")}. Or answer in the terminal.`}
    >
      <div className={s.card}>
        <CardHead agent="claude" label="Question" project={project} more={0} />
        <div className={s.question}>
          {header && <span className={s.questionHeader}>{header}</span>}
          <span className={s.questionText}>{question}</span>
        </div>
        <div className={s.options}>
          {options.map((o) => (
            <span key={o.label} className={s.option}>
              <span className={s.optionLabel}>{o.label}</span>
              {o.text && <span className={s.optionText}>{o.text}</span>}
            </span>
          ))}
        </div>
        <div className={s.actions}>
          <span className={`${s.btn} ${s.ghost}`}>In terminal</span>
          <span className={`${s.btn} ${s.ghost}`}>Type an answer</span>
        </div>
      </div>
    </Island>
  );
}

// ---- the open panel -----------------------------------------------------------------------------------------------

const TABS: IconName[] = ["home", "agents", "map", "timer", "clipboard", "notes", "shelf", "calendar", "bell", "system"];

export function Panel({ active, busy, children }: { active: IconName; busy?: boolean; children: ReactNode }) {
  return (
    <div className={s.panel}>
      <div className={s.toolbar}>
        {TABS.map((t) => (
          <span key={t} className={`${s.tool} ${t === active ? s.toolOn : ""}`}>
            <Icon name={t} size={15} />
          </span>
        ))}
        <span className={s.toolbarGap} />
        {busy && <span className={`${s.dot} ${s.dotWorking}`} />}
        <span className={s.tool}>
          <Icon name="lock" size={15} />
        </span>
        <span className={s.tool}>
          <Icon name="settings" size={15} />
        </span>
      </div>
      <div className={s.body}>{children}</div>
    </div>
  );
}

export function Ring({ value, label, sub }: { value: number; label: string; sub: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const tone = value >= 90 ? s.hot : value >= 70 ? s.warm : s.ok;
  return (
    <span className={s.ring}>
      <svg className={s.ringSvg} viewBox="0 0 58 58" aria-hidden="true">
        <circle cx="29" cy="29" r={r} className={s.ringTrack} />
        <circle cx="29" cy="29" r={r} className={`${s.ringFill} ${tone}`} strokeDasharray={`${((value / 100) * c).toFixed(2)} ${c.toFixed(2)}`} transform="rotate(-90 29 29)" />
      </svg>
      <span className={s.ringValue}>{value}%</span>
      <span className={s.ringLabel}>{label}</span>
      <span className={s.ringSub}>{sub}</span>
    </span>
  );
}

type Mood = "working" | "waiting" | "done";
const MOOD_TEXT: Record<Mood, string> = { working: "Working", waiting: "Waiting for you", done: "Done" };
const MOOD_DOT: Record<Mood, string> = { working: s.dotWorking, waiting: s.dotWaiting, done: s.dotDone };

/** `jump`: the session's window can be found, so the row has Open, or Answer (orange) while it waits for you. */
export type MockSession = { project: string; agent: "Claude" | "Codex"; mood: Mood; since: string; jump?: boolean };

/** The Agents tab: Claude's 5-hour and weekly limits as rings, and the latest sessions. */
export function MockAgentsTab({
  model = "Opus 5.5",
  fiveHour = 27,
  week = 54,
  sessions = [
    { project: "shop-api", agent: "Claude", mood: "working", since: "now" },
    { project: "docs-site", agent: "Claude", mood: "waiting", since: "now", jump: true },
    { project: "landing-page", agent: "Codex", mood: "done", since: "4m" },
  ],
}: {
  model?: string;
  fiveHour?: number;
  week?: number;
  sessions?: MockSession[];
}) {
  return (
    <Island
      mode="panel"
      size={{ w: [648, 400], h: [176 + 31 * sessions.length, 270 + 31 * sessions.length], bp: 640 }}
      label={`The Agents tab: Claude usage ${fiveHour}% of 5 hours and ${week}% of the week, and sessions ${sessions
        .map((x) => `${x.project} (${x.agent}, ${MOOD_TEXT[x.mood]}${x.jump && x.mood === "waiting" ? ", with an Answer button" : ""})`)
        .join(", ")}`}
    >
      <Panel active="agents" busy={sessions.some((x) => x.mood === "working")}>
        <div className={`${s.row} ${s.agentsRow}`}>
          <div className={`${s.tile} ${s.usage}`}>
            <div className={s.label}>
              Claude usage
              {model && <span className={s.modelChip}>{model}</span>}
            </div>
            <div className={s.rings}>
              <Ring value={fiveHour} label="5 hours" sub="resets in 3h 12m" />
              <Ring value={week} label="Week" sub="resets in 4d" />
            </div>
          </div>
          <div className={`${s.tile} ${s.grow}`}>
            <div className={s.label}>Sessions</div>
            <div className={s.sessions}>
              {sessions.map((x) => (
                <div key={x.project} className={s.session}>
                  <span className={`${s.dot} ${MOOD_DOT[x.mood]}`} />
                  <span className={s.sessionName}>{x.project}</span>
                  <span className={s.sessionAgent}>{x.agent}</span>
                  <span className={s.sessionMood}>
                    {MOOD_TEXT[x.mood]} · {x.since}
                  </span>
                  {x.jump && <span className={`${s.go} ${x.mood === "waiting" ? s.goAnswer : ""}`}>{x.mood === "waiting" ? "Answer" : "Open"}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>
    </Island>
  );
}

/** Now Playing on the Home tab: artwork, title, artist, the seek bar and the controls. */
export function MockMedia({
  title = "Harbour Lights",
  artist = "The Quiet Rooms",
  elapsed = "1:48",
  left = "-2:05",
  progress = 46,
}: {
  title?: string;
  artist?: string;
  elapsed?: string;
  left?: string;
  progress?: number;
}) {
  return (
    <Island
      mode="panel"
      size={{ w: [520, 400], h: [196, 196], bp: 640 }}
      label={`Now playing on the island: ${title} by ${artist}, ${elapsed} in, with previous, pause and next buttons`}
    >
      <Panel active="home">
        <div className={`${s.tile} ${s.media}`}>
          <div className={s.mediaTop}>
            <span className={s.art}>
              <svg viewBox="0 0 42 42" aria-hidden="true">
                <defs>
                  <linearGradient id="mock-art" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#3b2f6b" />
                    <stop offset="0.6" stopColor="#c0607a" />
                    <stop offset="1" stopColor="#f2b36b" />
                  </linearGradient>
                </defs>
                <rect width="42" height="42" fill="url(#mock-art)" />
                <circle cx="21" cy="27" r="9" fill="#ffd9a0" opacity="0.9" />
                <path d="M0 31h42v11H0Z" fill="#1d2440" />
                <path d="M6 34h8M18 36h12M30 33h6" stroke="#ffd9a0" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
              </svg>
            </span>
            <span className={s.mediaText}>
              <span className={s.mediaTitle}>{title}</span>
              <span className={s.mediaArtist}>{artist}</span>
            </span>
            <Bars />
          </div>
          <div className={s.scrub}>
            <span className={s.time}>{elapsed}</span>
            <span className={s.track}>
              <span className={s.trackFill} style={{ width: `${progress}%` }} />
            </span>
            <span className={`${s.time} ${s.timeEnd}`}>{left}</span>
          </div>
          <div className={s.controls}>
            <span className={s.ctl}>
              <Icon name="previous" size={16} />
            </span>
            <span className={`${s.ctl} ${s.ctlBig}`}>
              <Icon name="pause" size={18} />
            </span>
            <span className={s.ctl}>
              <Icon name="next" size={16} />
            </span>
          </div>
        </div>
      </Panel>
    </Island>
  );
}

export type MockShelfItem = { name: string; size: string; folder?: boolean; image?: boolean };

/** The file shelf: parked files, with PNG / JPG / WEBP conversion on images. */
export function MockShelf({
  items = [
    { name: "logo.png", size: "214 KB", image: true },
    { name: "invoice.pdf", size: "86 KB" },
    { name: "assets", size: "Folder", folder: true },
  ],
}: {
  items?: MockShelfItem[];
}) {
  return (
    <Island
      mode="panel"
      size={{ w: [648, 400], h: [160, 170], bp: 640 }}
      label={`The file shelf on the island holding ${items.map((i) => i.name).join(", ")}`}
    >
      <Panel active="shelf">
        <div className={s.listHead}>
          <span className={`${s.label} ${s.labelFlat}`}>Drag a file out to use it</span>
          <span className={s.link}>Clear</span>
        </div>
        <div className={s.shelfGrid}>
          {items.map((it) => (
            <div key={it.name} className={s.shelfItem}>
              <span className={s.shelfIcon}>
                <Icon name={it.folder ? "folder" : "file"} size={22} />
              </span>
              <span className={s.shelfName}>{it.name}</span>
              <span className={s.shelfSize}>{it.size}</span>
              <span className={s.shelfActions}>
                {it.image && (
                  <>
                    <span className={s.chip}>PNG</span>
                    <span className={s.chip}>JPG</span>
                    <span className={s.chip}>WEBP</span>
                  </>
                )}
                <span className={s.iconBtn}>
                  <Icon name="close" size={12} />
                </span>
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </Island>
  );
}

const INPUTS = ["DP 1", "DP 2", "HDMI 1", "HDMI 2", "USB-C"];

/** An external monitor in the System tab: brightness, contrast and input over DDC/CI. */
export function MockDisplays({
  name = "Generic PnP Monitor",
  brightness = 65,
  contrast = 50,
  input = "HDMI 1",
}: {
  name?: string;
  brightness?: number;
  contrast?: number;
  input?: string;
}) {
  return (
    <Island
      mode="panel"
      size={{ w: [648, 400], h: [190, 215], bp: 640 }}
      label={`Monitor controls on the island: ${name}, brightness ${brightness}, contrast ${contrast}, input ${input}`}
    >
      <Panel active="system">
        <div className={s.tile}>
          <div className={s.label}>Displays (DDC/CI)</div>
          <div className={s.sliderRow}>
            <Icon name="sun" size={14} />
            <span className={s.displayName}>{name}</span>
            <span className={s.track}>
              <span className={s.trackFill} style={{ width: `${brightness}%` }} />
            </span>
            <span className={s.sliderValue}>{brightness}</span>
          </div>
          <div className={s.sliderRow}>
            <Icon name="contrast" size={14} />
            <span className={s.displayName}>Contrast</span>
            <span className={s.track}>
              <span className={s.trackFill} style={{ width: `${contrast}%` }} />
            </span>
            <span className={s.sliderValue}>{contrast}</span>
          </div>
          <div className={s.inputRow}>
            <span className={s.displayName}>Input</span>
            {INPUTS.map((i) => (
              <span key={i} className={`${s.inputChip} ${i === input ? s.inputOn : ""}`}>
                {i}
              </span>
            ))}
          </div>
        </div>
      </Panel>
    </Island>
  );
}

// ---- the work map tab: one still frame of the app's own drawing ------------------------------------------------

const MAP_SETUP = setupFrom({ memoryServers: "memory", theme: "dark", background: "transparent", motion: "reduced" });
const MAP_MODEL = "claude-opus-5-5";
const MAP_ROWS = 7;

type MapPicture = { src: string; what: string; rows: { id: string; run: boolean; station: string; label: string; took: string }[] };
let mapPicture: MapPicture | null = null;

/** A short session (read, look up, edit, run the tests), built the way the app builds its board from hook events. */
function buildMap(): MapPicture {
  const { t } = MAP_SETUP;
  const entries: Entry[] = [];
  const counts: Partial<Record<StationId, number>> = {};
  let seq = 0;
  const add = (station: StationId, label: string, startedAt: number, endedAt?: number, from: Entry["from"] = "core") => {
    entries.push({
      id: `m${++seq}`,
      station,
      label: clean(label),
      from,
      startedAt,
      status: endedAt === undefined ? "run" : "ok",
      ...(endedAt === undefined ? {} : { endedAt }),
    });
    counts[station] = (counts[station] ?? 0) + 1;
  };
  const tool = (name: string, input: Record<string, unknown>, startedAt: number, endedAt?: number) => {
    const seen = classify(name, input, MAP_SETUP);
    add(seen.station, seen.label, startedAt, endedAt);
  };
  const step = (n: number, from: number, to: number) => add("model", `${shortModel(MAP_MODEL)} · ${t.step(n)}`, from, to);

  add("you", t.newMessage, 0, 0, "inbound");
  step(1, 300, 1900);
  tool("Grep", { pattern: "total(" }, 1900, 2300);
  tool("Read", { file_path: "C:\\code\\shop-api\\src\\cart.ts" }, 1900, 2400);
  step(2, 2400, 3300);
  tool("WebFetch", { url: "https://docs.example.com/rounding" }, 3300, 4200);
  step(3, 4200, 5100);
  tool("Edit", { file_path: "C:\\code\\shop-api\\src\\cart.ts" }, 5100, 5600);
  step(4, 5600, 6500);
  tool("Bash", { command: "npm test", description: "Run the tests" }, 6500);

  const board: Board = { entries, counts, model: MAP_MODEL, step: 4 };
  const now = 7600;
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(drawMap(board, now, MAP_SETUP))}`;
  const rows = foldRows(board.entries, MAP_ROWS).map(({ entry, times, tookMs }) => ({
    id: entry.id,
    run: entry.status === "run",
    station: t.stations[entry.station],
    label: `${entry.label}${times > 1 ? `  +${times - 1}` : ""}`,
    took: entry.endedAt === undefined ? t.running : tookMs > 0 ? formatMs(tookMs, t) : "—",
  }));
  return { src, what: nowParts(board, t).what, rows };
}

/** The work map tab with Claude Code running the tests. On a narrow desktop only the map is shown. */
export function MockMap({ project = "shop-api" }: { project?: string }) {
  mapPicture ??= buildMap();
  const m = mapPicture;
  return (
    <Island
      mode="panel"
      size={{ w: [706, 404], h: [413, 413], bp: 640 }}
      label="The work map tab: Claude in the centre, joined to stations for You, Model, Memory, Files, Shell, Network, Browser, Agents, Skills and Hooks, with Shell lit while the tests run"
    >
      <Panel active="map" busy>
        <div className={s.wm}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a generated SVG drawing, not a photo to optimise */}
          <img className={s.wmMap} src={m.src} alt="" width={460} height={430} draggable={false} />
          <div className={s.wmSide}>
            <div className={s.wmNow}>
              <span className={s.wmWhat}>{m.what}</span>
              <span className={s.wmMeter}>{project}</span>
            </div>
            <div className={s.wmRows}>
              {m.rows.map((r) => (
                <div key={r.id} className={`${s.wmRow} ${r.run ? s.wmRun : ""}`}>
                  <span className={s.wmMark}>{r.run ? "●" : "·"}</span>
                  <span className={s.wmStation}>{r.station}</span>
                  <span className={s.wmLabel}>{r.label}</span>
                  <span className={s.wmTook}>{r.took}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>
    </Island>
  );
}
