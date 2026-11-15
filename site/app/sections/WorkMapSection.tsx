"use client";

// The work map section: the app's own map drawing (lib/map, from lot-map), playing a short scripted session on a loop.
// The boards are built the way the app builds them from Claude Code hook events (app/src/main/workmap.ts), with the
// tool calls classified by the same code, so the picture and the rows are the real ones.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { product } from "@/lib/product";
import { drawMap } from "@/lib/map/draw";
import { foldRows, nowParts } from "@/lib/map/feed";
import { classify, clean, formatMs, shortModel } from "@/lib/map/classify";
import { setupFrom, type Setup } from "@/lib/map/setup";
import type { Board, Entry, StationId, Status } from "@/lib/map/types";
import styles from "./WorkMapSection.module.css";

const GROUND = "#0a0d14";
const OPTIONS = { memoryServers: "memory", theme: "dark", colors: `background=${GROUND}` };
const MOTION = setupFrom(OPTIONS);
const STILL = setupFrom({ ...OPTIONS, motion: "reduced" });
const MODEL = "claude-opus-5-5";

/** How long one run of the session takes before it starts over. */
const LOOP_MS = 20_000;
/** As many rows as the list keeps room for. */
const ROWS = 8;

type Frame = { at: number; board: Board };

/**
 * The scripted session, as a board after each moment something happens. Times are on the loop's own clock, from 0.
 * The steps follow WorkMap in the app: the model works from the message, or from the end of the last tool call,
 * until the next tool call or the answer.
 */
function buildSession(): { frames: Frame[]; first: number } {
  const { t } = MOTION;
  const frames: Frame[] = [];
  let at = 0;
  let seq = 0;
  let step = 0;
  let stepId: string | undefined;
  let board: Board = { entries: [], counts: {}, model: MODEL };

  const snap = () => frames.push({ at, board });
  const begin = (station: StationId, label: string, more: Partial<Pick<Entry, "from" | "status" | "mark">> = {}): string => {
    const status = more.status ?? "run";
    const entry: Entry = {
      id: `e${++seq}`,
      station,
      label: clean(label),
      from: more.from ?? "core",
      startedAt: at,
      status,
      ...(status === "run" ? {} : { endedAt: at }),
      ...(more.mark ? { mark: more.mark } : {}),
    };
    board = { ...board, entries: [...board.entries, entry], counts: { ...board.counts, [station]: (board.counts[station] ?? 0) + 1 } };
    return entry.id;
  };
  const finish = (id: string, status: Status = "ok") => {
    board = { ...board, entries: board.entries.map((e) => (e.id === id && e.status === "run" ? { ...e, status, endedAt: at } : e)) };
  };
  const tool = (name: string, input: Record<string, unknown>): string => {
    const seen = classify(name, input, MOTION);
    return begin(seen.station, seen.label);
  };
  const startStep = () => {
    step += 1;
    stepId = begin("model", `${shortModel(MODEL)} · ${t.step(step)}`);
    board = { ...board, step };
  };
  const endStep = () => {
    if (stepId !== undefined) finish(stepId);
    stepId = undefined;
  };

  // You send a message; a hook puts three memory records in front of it; the model starts.
  begin("you", t.newMessage, { from: "inbound", status: "ok" });
  snap();
  at = 450;
  begin("hooks", t.addedMemory(t.toMessage), { status: "ok" });
  snap();
  at = 850;
  begin("memory", t.records(3, "#12 #48 #7"), { from: "inbound", status: "ok" });
  board = { ...board, pushed: 1 };
  snap();
  at = 1300;
  startStep();
  snap();
  const first = frames.length - 1;

  // It reads the code.
  at = 3500;
  endStep();
  const grep = tool("Grep", { pattern: "total(" });
  const read = tool("Read", { file_path: "C:\\code\\shop-api\\src\\cart.ts" });
  snap();
  at = 4100;
  finish(grep);
  snap();
  at = 4500;
  finish(read);
  startStep();
  snap();

  // It looks something up.
  at = 5900;
  endStep();
  const lookup = tool("WebFetch", { url: "https://docs.example.com/rounding" });
  snap();
  at = 6900;
  finish(lookup);
  startStep();
  snap();

  // It edits the file.
  at = 8300;
  endStep();
  const edit = tool("Edit", { file_path: "C:\\code\\shop-api\\src\\cart.ts" });
  snap();
  at = 8900;
  finish(edit);
  startStep();
  snap();

  // It runs the tests.
  at = 10_100;
  endStep();
  const test = tool("Bash", { command: "npm test", description: "Run the tests" });
  snap();
  at = 13_300;
  finish(test);
  startStep();
  snap();

  // The answer is ready.
  at = 14_900;
  endStep();
  begin("you", t.answerReady, { status: "ok", mark: "done" });
  snap();

  return { frames, first };
}

const SESSION = buildSession();
const FRAMES = SESSION.frames;
/** Where the first run starts: the model at its first step, as on the app's screenshot. */
const FIRST = SESSION.first;
const FIRST_NOW = FRAMES[FIRST].at + 300;

const toUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const ALT =
  "Work map: Claude in the centre, joined to ten stations around it (You, Model, Memory, Files, Shell, Network, Browser, Agents, Skills, Hooks). The stations Claude is using light up.";

// ---- reduced motion -------------------------------------------------------------------------------

const REDUCE = "(prefers-reduced-motion: reduce)";
function subscribe(onChange: () => void) {
  const m = window.matchMedia(REDUCE);
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}
/** The server and the first render take the still picture, so nothing moves before the page knows it may. */
const useReducedMotion = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCE).matches,
    () => true,
  );

// ---- the section ----------------------------------------------------------------------------------

type View = { index: number; src: string };

export default function WorkMapSection() {
  const reduced = useReducedMotion();
  // Drawn the same on the server and in the browser: the drawing depends only on the board and the given moment.
  const [view, setView] = useState<View>(() => ({ index: FIRST, src: toUrl(drawMap(FRAMES[FIRST].board, FIRST_NOW, STILL)) }));

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let token = 0;

    /** The new picture is decoded before it replaces the old one, so the map does not blink. */
    const show = (index: number, now: number, setup: Setup, unique: boolean) => {
      const mine = ++token;
      // A comment after the drawing makes each run's picture a new image, so its animations start afresh.
      const url = toUrl(drawMap(FRAMES[index].board, now, setup) + (unique ? `<!--${mine}-->` : ""));
      const img = new Image();
      img.src = url;
      img
        .decode()
        .catch(() => {})
        .then(() => {
          if (live && mine === token) setView((v) => (v.src === url ? v : { index, src: url }));
        });
    };

    if (reduced) {
      show(FIRST, FIRST_NOW, STILL, false);
    } else {
      const play = (index: number, now: number) => {
        show(index, now, MOTION, true);
        const isLast = index === FRAMES.length - 1;
        const nextAt = isLast ? LOOP_MS : FRAMES[index + 1].at;
        timer = setTimeout(() => (isLast ? play(0, 0) : play(index + 1, nextAt)), nextAt - now);
      };
      play(FIRST, FIRST_NOW);
    }
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [reduced]);

  const board = FRAMES[view.index].board;
  const { t } = MOTION;

  const rows = useMemo(() => {
    // How long the answer took, from the message to it.
    const turnMs = new Map<string, number>();
    let askedAt: number | undefined;
    for (const x of board.entries) {
      if (x.station === "you" && x.from === "inbound" && x.mark === undefined) askedAt = x.startedAt;
      if (x.mark === "done" && askedAt !== undefined) {
        turnMs.set(x.id, x.startedAt - askedAt);
        askedAt = undefined;
      }
    }
    return foldRows(board.entries, ROWS).map(({ entry, times, tookMs }) => {
      const whole = turnMs.get(entry.id);
      return {
        id: entry.id,
        isRunning: entry.status === "run",
        mark: entry.status === "run" ? "●" : "·",
        station: t.stations[entry.station],
        label: `${entry.label}${times > 1 ? `  +${times - 1}` : ""}`,
        took:
          entry.endedAt === undefined
            ? t.running
            : whole !== undefined && whole > 0
              ? formatMs(whole, t)
              : tookMs > 0
                ? formatMs(tookMs, t)
                : "",
      };
    });
  }, [board, t]);

  const now = nowParts(board, t);

  return (
    <section className={styles.section} aria-labelledby="work-map-title">
      <div className={styles.inner}>
        <div className={styles.head}>
          <h2 id="work-map-title">See what your agent is touching</h2>
          <p>
            The work map in {product.name} is a live picture of what Claude Code is using right now: files, the shell,
            the network, memory and subagents. It is fed by Claude Code&apos;s own hooks and never leaves your PC.
          </p>
        </div>

        <div className={styles.map}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URL that animates by itself, not a photo to optimise */}
          <img src={view.src} alt={ALT} width={460} height={430} draggable={false} />
        </div>

        <div className={styles.feed}>
          <div className={styles.now}>
            <span className={styles.what}>{now.what}</span>
            {now.meter && <span className={styles.meter}>{now.meter}</span>}
          </div>
          <ol className={styles.rows} aria-label="What Claude Code did, newest first">
            {rows.map((r) => (
              <li key={r.id} className={r.isRunning ? styles.run : undefined}>
                <span className={styles.mark} aria-hidden="true">
                  {r.mark}
                </span>
                <span className={styles.station}>{r.station}</span>
                <span className={styles.label}>{r.label}</span>
                <span className={styles.took}>{r.took}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
