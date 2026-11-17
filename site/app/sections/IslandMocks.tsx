// Pictures of the island, drawn with HTML and CSS after the app's own look (app/src/renderer/src/island/island.css,
// Views.tsx, Panel.tsx and the smoke-test screenshots). Each mock sits at the top centre of a <Desktop>.
//
// Sizes are the app's own pixel sizes multiplied by --u, which shrinks the island to fit its desktop box (see the CSS).
// No hooks and no handlers: these render the same on the server and in the browser, in server and client components.
import type { CSSProperties, ReactNode } from "react";
import { drawMap } from "@/lib/map/draw";
import { foldRows, nowParts } from "@/lib/map/feed";
import { classify, clean, formatMs, shortModel } from "@/lib/map/classify";
import { setupFrom } from "@/lib/map/setup";
import type { Board, Entry, StationId } from "@/lib/map/types";
import shared from "./shared.module.css";
import s from "./IslandMocks.module.css";

// ---- icons: the app's own line icons (app/src/renderer/src/common/icons.tsx) ------------------------------------

const PATHS = {
  home: (
    <>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6.5 10v8.5h11V10" />
    </>
  ),
  agents: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="3.5" />
      <path d="m7.5 10 2.5 2-2.5 2" />
      <path d="M12.5 14.5h4" />
    </>
  ),
  map: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="4" r="1.6" />
      <circle cx="19" cy="15.5" r="1.6" />
      <circle cx="5" cy="15.5" r="1.6" />
      <path d="M12 9V5.6M14.6 13.4l3 1.4M9.4 13.4l-3 1.4" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="6.5" />
      <path d="M12 13.5V10" />
      <path d="M10 3.5h4" />
      <path d="m17.5 7 1.3-1.3" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5.5" y="5" width="13" height="15.5" rx="2.5" />
      <rect x="9" y="3.5" width="6" height="3" rx="1.2" />
      <path d="M9 11h6M9 14.5h4" />
    </>
  ),
  notes: (
    <>
      <path d="M6 4.5h8.5L18.5 8.5V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V6A1.5 1.5 0 0 1 6 4.5Z" />
      <path d="M8 11h7M8 14.5h7M8 18h4" />
    </>
  ),
  shelf: (
    <>
      <path d="M3.5 13.5 6 6.5h12l2.5 7" />
      <path d="M3.5 13.5V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-4.5h-5a3.5 3.5 0 0 1-7 0Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2H5Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  system: (
    <>
      <path d="M5 7h6M15 7h4M5 17h2M11 17h8" />
      <circle cx="13" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  settings: (
    <>
      <path d="M10.3 3.5h3.4l.5 2.4 1.6.9 2.3-.8 1.7 2.9-1.8 1.6v1.9l1.8 1.6-1.7 2.9-2.3-.8-1.6.9-.5 2.4h-3.4l-.5-2.4-1.6-.9-2.3.8-1.7-2.9L6 13V11L4.2 9.4l1.7-2.9 2.3.8 1.6-.9Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  pause: (
    <>
      <rect x="6.5" y="5.5" width="3.8" height="13" rx="1" fill="currentColor" />
      <rect x="13.7" y="5.5" width="3.8" height="13" rx="1" fill="currentColor" />
    </>
  ),
  next: (
    <>
      <path d="M4.5 6.5v11l7.5-5.5Z" fill="currentColor" />
      <path d="M12 6.5v11l7.5-5.5Z" fill="currentColor" />
    </>
  ),
  previous: (
    <>
      <path d="M19.5 6.5v11L12 12Z" fill="currentColor" />
      <path d="M12 6.5v11L4.5 12Z" fill="currentColor" />
    </>
  ),
  contrast: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6" />
    </>
  ),
  close: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
  folder: <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18Z" />,
  file: (
    <>
      <path d="M7 3.5h7l4.5 4.5v11A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M13.5 3.5V8.5h5" />
    </>
  ),
  check: <path d="m5.5 12.5 4.5 4.5 8.5-9.5" />,
};

type IconName = keyof typeof PATHS;

/** A size in the app's pixels, scaled with the island. */
const px = (n: number) => `calc(${n} * var(--u))`;

export function Icon({ name, size }: { name: IconName; size: number }) {
  return (
    <svg
      className={s.icon}
      style={{ width: px(size), height: px(size) }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
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

// ---- Blink, still: three of its faces (shapes from MeetBlinkSection / the app's Blink.tsx) -----------------------

type Face = "calm" | "needsYou" | "done";

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
  needsYou: { eye: [3.7, 3.4, 3.4], eyeY: 11.6, mouth: [20, 21, 1.5, 1.7, 1.7], blush: 0 },
  done: { eye: [3.3, 2.4, -2.4], eyeY: 12.6, mouth: [20, 18.8, 3.4, 0, 3.4], blush: 0.75 },
};

export function Blink({ face, className }: { face: Face; className?: string }) {
  const p = FACES[face];
  const [rx, top, bottom] = p.eye;
  return (
    <span className={`${s.blink} ${className ?? ""}`}>
      <svg className={s.face} viewBox="0 0 40 30" aria-hidden="true">
        {p.blush > 0 && (
          <g opacity={p.blush} fill="var(--accent)">
            <rect x="5.4" y="16.2" width="5" height="1.8" rx="0.9" />
            <rect x="29.6" y="16.2" width="5" height="1.8" rx="0.9" />
          </g>
        )}
        <path className={s.facePart} d={shape(14, p.eyeY, rx, top, bottom)} />
        <path className={s.facePart} d={shape(26, p.eyeY, rx, top, bottom)} />
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

function CardHead({ agent, label, project, more }: { agent: keyof typeof AGENT_NAME; label: string; project: string; more: number }) {
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

/** One of Claude Code's multiple-choice questions, with the way back to the terminal. */
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
          <span className={`${s.btn} ${s.ghost}`}>Answer in terminal</span>
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

export type MockSession = { project: string; agent: "Claude" | "Codex"; mood: Mood; since: string };

/** The Agents tab: Claude's 5-hour and weekly limits as rings, and the latest sessions. */
export function MockAgentsTab({
  model = "Opus 5.5",
  fiveHour = 27,
  week = 54,
  sessions = [
    { project: "shop-api", agent: "Claude", mood: "working", since: "now" },
    { project: "docs-site", agent: "Claude", mood: "waiting", since: "now" },
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
        .map((x) => `${x.project} (${x.agent}, ${MOOD_TEXT[x.mood]})`)
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
