// The islands for "Take a closer look", drawn after the app's own look like those in IslandMocks.tsx:
// - the closed island (IdleView), with the song or lyric line (.idle-song) and the timer, mic and keep-awake marks;
// - the volume HUD (HudView; mode 'hud', 300 by 40 px, radius 16 in App.tsx and island.css);
// - Now Playing with shuffle and repeat, the Calendar, Focus timer and Agents tabs (Panel.tsx).
// Icons come from IslandMocks.tsx (Phosphor fill, as the app draws them).
// Sizes are the app's pixels times --u. No role or label here: the section's picture carries the description.
// No hooks and no handlers, so these render the same on the server and in the browser.
import { useWorkMap } from "./WorkMapSection";
import type { CSSProperties, ReactNode } from "react";
import { Bars, Blink, Icon, Mark, Panel, Ring } from "./IslandMocks";
import s from "./IslandMocks.module.css";
import c from "./CloserLookMocks.module.css";

// ---- the frame: the island at the top of the desktop, with Blink beside it ----------------------------------------

type Size = {
  /** Island width in the app's pixels, wide and narrow. */
  w: [number, number];
  /** About how tall the island is, wide and narrow. */
  h: [number, number];
  /** Below which desktop width the narrow layout is used (and Blink is left out). */
  bp?: 640;
};

/** The app's corner radius for each mode (island.css). */
const RADIUS = { idle: 14, hud: 16, panel: 26 } as const;

/**
 * Like the Island in IslandMocks.tsx, plus the HUD's radius, and `max`: the largest scale for this island, so the
 * small closed island and the HUD can be drawn bigger than the panels on the same desktop.
 */
function Frame({ mode, size, max, children }: { mode: keyof typeof RADIUS; size: Size; max?: string; children: ReactNode }) {
  const vars = {
    "--iw-w": size.w[0],
    "--iw-n": size.w[1],
    "--ih-w": size.h[0],
    "--ih-n": size.h[1],
    ...(max ? { "--island-max": max } : {}),
    // An open panel is the close-up: it takes the whole width, without Blink beside it.
    ...(mode === "panel" ? { "--side": 0 } : {}),
  } as CSSProperties;
  const shape = mode === "idle" ? s.rIdle : mode === "panel" ? s.rPanel : "";
  return (
    <div className={`${s.top} ${size.bp === 640 ? s.n640 : ""}`} style={vars}>
      {mode !== "panel" && <Blink face="calm" />}
      <div className={`${s.island} ${shape}`} style={{ "--r": `calc(${RADIUS[mode]} * var(--u))` } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}

/** Every island is drawn as large as the picture allows (a close-up of the top of the screen), the small ones too. */
const SMALL_MAX = "4px";
const IDLE: Size = { w: [214, 214], h: [34, 34] };

// ---- the closed island ------------------------------------------------------------------------------------------

/** At rest with music playing: the song's title beside the bars (idleSong in app/src/shared/playback.ts). */
export function MockResting({ song = "Harbour Lights", max = SMALL_MAX }: { song?: string; max?: string }) {
  return (
    <Frame mode="idle" size={IDLE} max={max}>
      <div className={s.idle}>
        <Mark />
        <span className={s.idleMiddle}>
          <span className={c.idleSong}>{song}</span>
        </span>
        <Bars />
      </div>
    </Frame>
  );
}

/** With synced lyrics on, the line being sung takes the title's place. */
export function MockLyricLine({ line = "Keep the lights on low" }: { line?: string }) {
  return <MockResting song={line} />;
}

/** The focus timer counting down, an app using the microphone (the amber dot) and keep awake on (the cup). */
export function MockGlance({ timer = "18:42" }: { timer?: string }) {
  return (
    <Frame mode="idle" size={IDLE} max={SMALL_MAX}>
      <div className={s.idle}>
        <Mark />
        <span className={s.idleMiddle}>
          <span className={s.idleChip}>
            <Icon name="timer" size={12} />
            {timer}
          </span>
        </span>
        <span className={c.micDot} />
        <Icon name="cup" size={13} className={c.awake} />
        <Bars />
      </div>
    </Frame>
  );
}

// ---- the volume HUD ---------------------------------------------------------------------------------------------

export function MockHud({ level = 64 }: { level?: number }) {
  return (
    <Frame mode="hud" size={{ w: [300, 300], h: [40, 40] }} max={SMALL_MAX}>
      <div className={c.hud}>
        <Icon name="speaker" size={16} />
        <span className={c.hudTrack}>
          <span className={c.hudFill} style={{ width: `${level}%` }} />
        </span>
        <span className={c.hudValue}>{level}</span>
      </div>
    </Frame>
  );
}

// ---- Home: Now Playing with shuffle and repeat ------------------------------------------------------------------

export function MockMusic({
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
    <Frame mode="panel" size={{ w: [520, 400], h: [200, 200] }}>
      <Panel active="home">
        <div className={`${s.tile} ${s.media}`}>
          <div className={s.mediaTop}>
            <span className={s.art}>
              <svg viewBox="0 0 42 42" aria-hidden="true">
                <defs>
                  <linearGradient id="closer-look-art" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#3b2f6b" />
                    <stop offset="0.6" stopColor="#c0607a" />
                    <stop offset="1" stopColor="#f2b36b" />
                  </linearGradient>
                </defs>
                <rect width="42" height="42" fill="url(#closer-look-art)" />
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
            <span className={`${s.ctl} ${c.mode} ${c.modeOn}`}>
              <Icon name="shuffle" size={15} />
            </span>
            <span className={s.ctl}>
              <Icon name="previous" size={16} />
            </span>
            <span className={`${s.ctl} ${s.ctlBig}`}>
              <Icon name="pause" size={18} />
            </span>
            <span className={s.ctl}>
              <Icon name="next" size={16} />
            </span>
            <span className={`${s.ctl} ${c.mode}`}>
              <Icon name="repeat" size={15} />
            </span>
          </div>
        </div>
      </Panel>
    </Frame>
  );
}

// ---- the Calendar tab -------------------------------------------------------------------------------------------

export type MockEvent = { title: string; sub: string; chip: string; join?: boolean };
export type MockDay = { day: string; events: MockEvent[] };

/** Events grouped by day (Calendar in Panel.tsx). Join shows within 15 minutes of a meeting with a call link. */
export function MockCalendar({
  days = [
    {
      day: "TODAY",
      events: [
        { title: "Design review", sub: "2:00 PM", chip: "in 12 min", join: true },
        { title: "1:1 with Sam", sub: "4:30 PM · Room 3", chip: "4:30 PM" },
      ],
    },
    {
      day: "WED, NOV 19",
      events: [
        { title: "Sprint planning", sub: "10:00 AM · Microsoft Teams Meeting", chip: "10:00 AM" },
        { title: "Dentist", sub: "5:15 PM", chip: "5:15 PM" },
      ],
    },
  ],
}: {
  days?: MockDay[];
}) {
  return (
    <Frame mode="panel" size={{ w: [648, 400], h: [272, 272] }}>
      <Panel active="calendar">
        <div className={c.calList}>
          {days.map((d) => (
            <div key={d.day} className={c.calGroup}>
              <div className={c.eventDay}>{d.day}</div>
              {d.events.map((e) => (
                <div key={e.title} className={c.eventRow}>
                  <span className={c.eventBar} />
                  <span className={c.eventText}>
                    <span className={c.eventTitle}>{e.title}</span>
                    <span className={c.eventSub}>{e.sub}</span>
                  </span>
                  {e.join && <span className={c.eventJoin}>Join</span>}
                  <span className={c.eventChip}>{e.chip}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Panel>
    </Frame>
  );
}

// ---- the Focus timer tab ----------------------------------------------------------------------------------------

export function MockTimer({ left = "18:42", progress = 25, done = 3 }: { left?: string; progress?: number; done?: number }) {
  return (
    <Frame mode="panel" size={{ w: [648, 400], h: [204, 204] }}>
      <Panel active="timer">
        <div className={c.cardRow}>
          <div className={`${s.tile} ${s.grow} ${c.timer}`}>
            <div className={c.timerPhase}>Focus</div>
            <div className={c.timerClock}>{left}</div>
            <div className={c.timerBar}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className={s.controls}>
              <span className={s.ctl}>
                <Icon name="reset" size={16} />
              </span>
              <span className={`${s.ctl} ${s.ctlBig}`}>
                <Icon name="pause" size={18} />
              </span>
              <span className={s.ctl}>
                <Icon name="next" size={16} />
              </span>
            </div>
          </div>
          <div className={s.tile}>
            <div className={s.label}>Today</div>
            <div className={c.stat}>{done}</div>
            <div className={c.muted}>focus session{done === 1 ? "" : "s"}</div>
            <div className={c.tiny}>25 min focus · 5 min break</div>
            <div className={c.tiny}>15 min long break every 4</div>
          </div>
        </div>
      </Panel>
    </Frame>
  );
}

// ---- the Agents tab, with Codex's limits to pick from -----------------------------------------------------------

type Mood = "working" | "waiting" | "done";
const MOOD_TEXT: Record<Mood, string> = { working: "Working", waiting: "Waiting for you", done: "Done" };
const MOOD_DOT: Record<Mood, string> = { working: s.dotWorking, waiting: s.dotWaiting, done: s.dotDone };

export type MockAgentSession = { project: string; agent: string; mood: Mood; since: string; jump?: boolean };

export function MockAgents({
  model = "Opus 5.5",
  fiveHour = 27,
  week = 54,
  sessions = [
    { project: "shop-api", agent: "Claude", mood: "working", since: "now", jump: true },
    { project: "docs-site", agent: "Codex", mood: "waiting", since: "now", jump: true },
    { project: "landing-page", agent: "Gemini", mood: "done", since: "4m" },
    { project: "mobile-app", agent: "Cursor", mood: "done", since: "12m" },
  ],
}: {
  model?: string;
  fiveHour?: number;
  week?: number;
  sessions?: MockAgentSession[];
}) {
  return (
    <Frame mode="panel" size={{ w: [648, 400], h: [176 + 31 * sessions.length, 270 + 31 * sessions.length] }}>
      <Panel active="agents" busy={sessions.some((x) => x.mood === "working")}>
        <div className={`${s.row} ${s.agentsRow}`}>
          <div className={`${s.tile} ${s.usage}`}>
            <div className={s.label}>
              <span className={c.pick}>
                <span className={`${c.pickOption} ${c.pickOn}`}>Claude</span>
                <span className={c.pickOption}>Codex</span>
              </span>
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
                  {x.jump && (
                    <span className={`${s.go} ${x.mood === "waiting" ? s.goAnswer : ""}`}>
                      {x.mood === "waiting" ? "Answer" : "Open"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>
    </Frame>
  );
}

/** The work map tab: the app's own map drawing, playing the same session as the work map section. */
export function MockMap() {
  const view = useWorkMap();
  return (
    <Frame mode="panel" size={{ w: [648, 400], h: [470, 470] }}>
      <Panel active="map" busy>
        <div className={`${s.tile} ${c.mapTile}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URL that animates by itself */}
          <img className={c.mapImage} src={view.src} alt="" width={460} height={430} draggable={false} />
        </div>
      </Panel>
    </Frame>
  );
}
