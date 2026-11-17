"use client";

// "Take a closer look": one desktop with the island at its top, and a list of features beside it (below it on a
// phone). Opening a feature shows it on the island; one is open at a time, and closing it leaves the island at rest.
//
// Every sentence is something the app does today. Where it is proven:
// - Music: NowPlaying in app/src/renderer/src/island/Panel.tsx (artwork, title, controls; shuffle and repeat only
//   when m.canShuffle / m.canRepeat); the media sessions in app/resources/winhelper.ps1.
// - Your day: upcomingEvents in app/src/main/calendar.ts (7 days ahead); refreshCalendar every 900 ticks and
//   calendarReminders (5 minutes before, timed events only) in app/src/main/index.ts; MEETING_HOSTS in calendar.ts;
//   the Join button in EventRow (Panel.tsx).
// - Lyrics: fetchLyrics in app/src/main/lyrics.ts; lyrics: false in DEFAULT_FEATURES (app/src/main/settings.ts);
//   idleSong in app/src/shared/playback.ts; the lyric line in NowPlaying (Panel.tsx).
// - At a glance: IdleView in app/src/renderer/src/island/Views.tsx (song, timer chip, mic dot, keep-awake cup).
// - Volume and brightness: showHud (1.6 s) in app/src/main/index.ts; HudView in Views.tsx; Get-Brightness reads the
//   built-in panel through WmiMonitorBrightness in app/resources/winhelper.ps1.
// - Focus timer: timer defaults in settings.ts; tick and isLongBreak in app/src/main/timer.ts; the banner in
//   timerTick (index.ts); the lengths in Settings (SettingsApp.tsx).
// - Coding agents: Agents in Panel.tsx (sessions, moods, rings, the Claude/Codex pick); parseUsage in
//   app/src/main/agents.ts; app/src/main/codex-usage.ts.
import { useEffect, useState, type ReactNode } from "react";
import { Desktop } from "./IslandMocks";
import { MockAgents, MockCalendar, MockGlance, MockHud, MockLyricLine, MockMusic, MockResting, MockTimer } from "./CloserLookMocks";
import shared from "./shared.module.css";
import styles from "./CloserLookSection.module.css";

type Item = {
  id: string;
  title: string;
  /** What the picture shows while this item is open, for screen readers. */
  picture: string;
  mock: ReactNode;
};

const ITEMS: Item[] = [
  {
    id: "music",
    title: "Music from any app",
    picture: "The island open on Now Playing: Harbour Lights by The Quiet Rooms, 1:48 in, with shuffle, previous, pause, next and repeat.",
    mock: <MockMusic />,
  },
  {
    id: "day",
    title: "Your day",
    picture: "The island open on the calendar: a design review in 12 minutes with a Join button, a 1:1 at 4:30 PM, and two events on Wednesday.",
    mock: <MockCalendar />,
  },
  {
    id: "lyrics",
    title: "Lyrics",
    picture: "The closed island showing the line being sung, beside the playing bars.",
    mock: <MockLyricLine />,
  },
  {
    id: "glance",
    title: "At a glance",
    picture: "The closed island with the focus timer at 18:42, an amber microphone dot, a cup for keep awake, and the playing bars.",
    mock: <MockGlance />,
  },
  {
    id: "volume",
    title: "Volume and brightness",
    picture: "The island showing the volume at 64.",
    mock: <MockHud />,
  },
  {
    id: "timer",
    title: "Focus timer",
    picture: "The island open on the focus timer: 18:42 left to focus, and 3 focus sessions today.",
    mock: <MockTimer />,
  },
  {
    id: "agents",
    title: "Coding agents",
    picture: "The island open on Agents: Claude usage at 27% of 5 hours and 54% of the week, and four sessions, one working, one waiting for you and two done.",
    mock: <MockAgents />,
  },
];

const RESTING = {
  id: "resting",
  picture: "The island at rest at the top of the screen, showing the song that is playing.",
  mock: <MockResting />,
};

const LAYERS = [RESTING, ...ITEMS];

/** What the picture shows in turn while nothing is pressed: the closed island's own looks. */
const IDLE_CYCLE = ["resting", "glance", "volume", "lyrics"];


function Sign() {
  return (
    <span className={styles.sign} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M12 4.5v15M4.5 12h15" />
      </svg>
    </span>
  );
}

export default function CloserLookSection() {
  const [open, setOpen] = useState<string | null>(null);
  // Nothing pressed: the picture steps through the closed island's looks by itself.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (open || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 2600);
    return () => window.clearInterval(id);
  }, [open]);
  const idle = IDLE_CYCLE[tick % IDLE_CYCLE.length];
  const shown = ITEMS.find((item) => item.id === open) ?? LAYERS.find((layer) => layer.id === idle) ?? RESTING;

  return (
    <section className={`${shared.grey} ${shared.section}`} aria-labelledby="closer-title">
      <div className={shared.wrap}>
        <h2 id="closer-title" className={`${shared.headline} ${styles.title}`}>
          Take a closer look.
        </h2>

        <div className={styles.layout}>
          <Desktop className={styles.picture}>
            <div className={styles.scene} role="img" aria-label={shown.picture}>
              {LAYERS.map((layer) => (
                <div key={layer.id} className={`${styles.layer} ${layer.id === shown.id ? styles.shown : ""}`}>
                  {layer.mock}
                </div>
              ))}
            </div>
          </Desktop>

          <ul className={styles.list}>
            {ITEMS.map((item) => {
              const isOpen = item.id === open;
              return (
                <li key={item.id} className={`${styles.item} ${isOpen ? styles.open : ""}`}>
                  <button
                    type="button"
                    className={styles.button}
                    aria-pressed={isOpen}
                    onClick={() => setOpen(isOpen ? null : item.id)}
                  >
                    <Sign />
                    {item.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
