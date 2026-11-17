"use client";

// The question card in "Built for AI agents", which the visitor can answer. It works as the app's QuestionCard does
// (app/src/renderer/src/island/Views.tsx): pick an option and it is sent; or "Type an answer", write one and press
// Enter or Send (Shift+Enter is a new line, Esc cancels); or send the question back to the terminal. Then the card
// closes, Blink thinks while the agent works, and a "Finished in <project>" banner comes up, the way the app's Stop
// hook banner does (format.ts). "Ask again" puts the question back.
//
// What the visitor types is only ever React text (never HTML), cut to MAX_TYPED in the field and SHOWN on the banner.
// The first render is the question card, the same on the server and in the browser. Reduced motion: the same states
// and timings, with no transitions (see the CSS).
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Bars, Blink, CardHead, Desktop, Icon, Mark, type Face } from "./IslandMocks";
import s from "./IslandMocks.module.css";
import q from "./AgentQuestion.module.css";

const PROJECT = "landing-page";
const HEADER = "Layout";
const QUESTION = "Which layout should the pricing page use?";

const OPTIONS = [
  {
    label: "Two columns",
    text: "Monthly and lifetime side by side",
    done: "Pricing now shows both plans side by side.",
  },
  {
    label: "Toggle",
    text: "One card with a monthly-lifetime switch",
    done: "Pricing is now one card with a plan switch.",
  },
  {
    label: "Single plan",
    text: "Just the lifetime price",
    done: "Pricing now shows just the lifetime price.",
  },
];

/** The longest answer the field takes, and how much of it the banner repeats. */
const MAX_TYPED = 200;
const SHOWN = 48;
/** How long the agent "works" before the banner; the app adds the time worked once it is 5 seconds or more. */
const WORK_MS = 5200;
const TOOK = "5s";

/** The island's widths in the app's pixels: the card (also the scale), the resting pill and the banner. */
const CARD_W: [number, number] = [488, 360];
/** About how tall the card is with the answer field open, wide and narrow. */
const CARD_H: [number, number] = [380, 400];

type Phase =
  | { kind: "ask"; writing: boolean }
  | { kind: "working"; picked: string; reply: string }
  | { kind: "done"; picked: string; reply: string }
  | { kind: "terminal" };

/** One line, no runs of spaces, at most SHOWN characters. */
function shorten(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > SHOWN ? `${one.slice(0, SHOWN - 1).trimEnd()}…` : one;
}

export default function AgentQuestion({ className }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "ask", writing: false });
  const [typed, setTyped] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const firstOption = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const again = useRef<HTMLButtonElement>(null);
  /** Set when the visitor did something here, so focus follows the island and never jumps in from elsewhere. */
  const follow = useRef(false);
  const fieldId = useId();

  // The agent works for a while, then finishes.
  useEffect(() => {
    if (phase.kind !== "working") return;
    const t = window.setTimeout(() => {
      // Focus moves on to "Ask again" only if it is still here (on the status line).
      follow.current = Boolean(root.current?.contains(document.activeElement));
      setPhase({ kind: "done", picked: phase.picked, reply: phase.reply });
    }, WORK_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Keep the keyboard with the island as it changes: the field, the status line, "Ask again", the first option.
  useEffect(() => {
    if (!follow.current) return;
    const target =
      phase.kind === "ask"
        ? phase.writing
          ? field.current
          : firstOption.current
        : phase.kind === "working"
          ? status.current
          : again.current;
    target?.focus({ preventScroll: true });
  }, [phase]);

  const act = (next: Phase) => {
    // A tap does not focus a button in every browser, so opening the field or asking again always takes focus.
    follow.current = next.kind === "ask" || Boolean(root.current?.contains(document.activeElement));
    setPhase(next);
  };

  const pick = (o: (typeof OPTIONS)[number]) => {
    setTyped("");
    act({ kind: "working", picked: o.label, reply: o.done });
  };
  const own = typed.trim();
  const sendTyped = () => {
    if (!own) return;
    const short = shorten(own);
    setTyped("");
    act({ kind: "working", picked: short, reply: `Done: “${short}”` });
  };
  const stopWriting = () => {
    setTyped("");
    act({ kind: "ask", writing: false });
  };
  const reset = () => act({ kind: "ask", writing: false });

  const asking = phase.kind === "ask";
  const writing = asking && phase.writing;
  const face: Face = phase.kind === "working" ? "thinking" : phase.kind === "done" ? "done" : "needsYou";
  const title = `Finished in ${PROJECT} · ${TOOK}`;

  const vars = {
    "--iw-w": CARD_W[0],
    "--iw-n": CARD_W[1],
    "--ih-w": CARD_H[0],
    "--ih-n": CARD_H[1],
  } as CSSProperties;
  const shape =
    phase.kind === "ask" ? `${s.rCard} ${q.wCard}` : phase.kind === "done" ? `${s.rBanner} ${q.wBanner}` : `${s.rIdle} ${q.wIdle}`;

  return (
    <div ref={root} className={q.root}>
      <Desktop className={className}>
        <div className={`${s.top} ${s.n540} ${q.live}`} style={vars}>
          <Blink face={face} className={asking || phase.kind === "done" ? "" : q.blinkShown} />
          <div className={`${s.island} ${q.island} ${shape}`} role="group" aria-label={asking ? "A Claude Code question on the island" : "The island"}>
            {asking && (
              <div key="ask" className={`${s.card} ${q.enter}`}>
                <CardHead agent="claude" label="Question" project={PROJECT} more={0} />
                <div className={s.question}>
                  <span className={s.questionHeader}>{HEADER}</span>
                  <span className={s.questionText}>{QUESTION}</span>
                </div>
                <div className={s.options}>
                  {OPTIONS.map((o, i) => (
                    <button
                      key={o.label}
                      ref={i === 0 ? firstOption : undefined}
                      type="button"
                      className={`${s.option} ${q.option}`}
                      onClick={() => pick(o)}
                    >
                      <span className={s.optionLabel}>{o.label}</span>
                      <span className={s.optionText}>{o.text}</span>
                    </button>
                  ))}
                </div>
                {writing && (
                  <>
                    <label htmlFor={fieldId} className={q.hidden}>
                      Your own answer
                    </label>
                    <textarea
                      ref={field}
                      id={fieldId}
                      className={q.field}
                      rows={2}
                      maxLength={MAX_TYPED}
                      value={typed}
                      placeholder="Your own answer. Enter sends, Esc cancels."
                      spellCheck={false}
                      autoComplete="off"
                      enterKeyHint="send"
                      onChange={(e) => setTyped(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          stopWriting();
                        } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          sendTyped();
                        }
                      }}
                    />
                  </>
                )}
                <div className={s.actions}>
                  <button type="button" className={`${s.btn} ${s.ghost} ${q.btn} ${q.ghostBtn}`} onClick={() => act({ kind: "terminal" })}>
                    In terminal
                  </button>
                  {writing ? (
                    <>
                      <button type="button" className={`${s.btn} ${s.ghost} ${q.btn} ${q.ghostBtn}`} onClick={stopWriting}>
                        Cancel
                      </button>
                      <button type="button" className={`${s.btn} ${s.primary} ${q.btn} ${q.primaryBtn}`} disabled={!own} onClick={sendTyped}>
                        Send
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={`${s.btn} ${s.ghost} ${q.btn} ${q.ghostBtn}`}
                      onClick={() => act({ kind: "ask", writing: true })}
                    >
                      Type an answer
                    </button>
                  )}
                </div>
              </div>
            )}

            {(phase.kind === "working" || phase.kind === "terminal") && (
              <div key="idle" className={`${s.idle} ${q.enter}`} aria-hidden="true">
                <Mark />
                <span className={s.idleMiddle} />
                <Bars />
              </div>
            )}

            {phase.kind === "done" && (
              <div key="done" className={`${s.banner} ${q.enter}`}>
                <span className={`${s.appIcon} ${s.kindDone}`}>
                  <Icon name="check" size={17} />
                </span>
                <span className={s.bannerLines}>
                  <span className={s.bannerTitle}>{title}</span>
                  <span className={s.bannerText}>{phase.reply}</span>
                </span>
                <span className={s.bannerTime}>now</span>
              </div>
            )}
          </div>
        </div>
      </Desktop>

      <div className={q.statusRow}>
        <p ref={status} className={q.status} tabIndex={-1} aria-live="polite">
          {phase.kind === "ask" &&
            (writing ? "Enter sends. Shift+Enter is a new line. Esc cancels." : "Try it: pick an answer, or type your own.")}
          {phase.kind === "working" && (
            <>
              <span className={q.pulse} aria-hidden="true" />
              Working on “{phase.picked}”
              <span className={q.hidden}>. Claude Code is working in {PROJECT}.</span>
            </>
          )}
          {phase.kind === "done" && (
            <>
              <span className={`${q.pulse} ${q.pulseDone}`} aria-hidden="true" />
              Finished
              <span className={q.hidden}>
                {" "}in {PROJECT} after {TOOK}. {phase.reply}
              </span>
            </>
          )}
          {phase.kind === "terminal" && "Sent back to the terminal, to answer there."}
        </p>
        {(phase.kind === "done" || phase.kind === "terminal") && (
          <button ref={again} type="button" className={q.again} onClick={reset}>
            Ask again
          </button>
        )}
      </div>
    </div>
  );
}
