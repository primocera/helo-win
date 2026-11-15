"use client";

// "Get the highlights": a carousel of the island's main features, one mock island per card.
// Slides advance every few seconds, unless paused with the button, hovered, focused, off-screen, or the visitor
// asked for reduced motion. They also scroll and snap by touch, and arrow keys move them when the track has focus.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { product } from "@/lib/product";
import { Desktop, MockDisplays, MockDoneBanner, MockMap, MockMedia, MockPermission, MockShelf } from "./IslandMocks";
import shared from "./shared.module.css";
import styles from "./HighlightsSection.module.css";

type Slide = { id: string; title: string; text: string; mock: ReactNode };

const SLIDES: Slide[] = [
  {
    id: "permission",
    title: "Allow it from the island.",
    text: "When Claude Code or Codex wants to run something, the request opens at the top of your screen. Deny, allow, or always allow.",
    mock: <MockPermission />,
  },
  {
    id: "done",
    title: "Know when it is done.",
    text: "A banner tells you which project finished, how long it took, and how the agent's last message begins.",
    mock: <MockDoneBanner />,
  },
  {
    id: "map",
    title: "See what it is touching.",
    text: "The work map shows the files, commands and sites Claude Code is using as it works. Names only, never contents.",
    mock: <MockMap />,
  },
  {
    id: "music",
    title: "Your music, up top.",
    text: "Title, artwork and controls for whatever Windows is playing.",
    mock: <MockMedia />,
  },
  {
    id: "shelf",
    title: "Park files on the island.",
    text: "Drop files in, drag them out into any app, or turn an image into a PNG, JPG or WebP.",
    mock: <MockShelf />,
  },
  {
    id: "displays",
    title: "Monitor settings, one hover away.",
    text: "Brightness, contrast and input for external monitors that support DDC/CI.",
    mock: <MockDisplays />,
  },
];

/** How long a slide stays before the next one; the progress bar's animation in the CSS lasts as long. */
const SLIDE_MS = 5000;

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (cb: () => void) => {
  const m = window.matchMedia(REDUCE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
/** True on the server and during hydration, so nothing moves before the page knows it may. */
const useReducedMotion = () => useSyncExternalStore(subscribeMotion, () => window.matchMedia(REDUCE).matches, () => true);

export default function HighlightsSection() {
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  const running = !reduced && playing && !hovering && !focused && visible;

  // Only advance while at least half of the cards are on screen.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /** Where slide `i` starts, as a scroll position of the track. */
  const offsetOf = (track: HTMLDivElement, i: number) => {
    const slides = track.children;
    const first = slides[0] as HTMLElement | undefined;
    const slide = slides[i] as HTMLElement | undefined;
    return first && slide ? slide.offsetLeft - first.offsetLeft : 0;
  };

  const goTo = useCallback(
    (i: number) => {
      const track = trackRef.current;
      const n = SLIDES.length;
      const next = ((i % n) + n) % n;
      setIndex(next);
      if (track) track.scrollTo({ left: offsetOf(track, next), behavior: reduced ? "auto" : "smooth" });
    },
    [reduced],
  );

  // After a swipe or a scroll settles, the slide nearest the start becomes the current one.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const max = track.scrollWidth - track.clientWidth;
        if (track.scrollLeft >= max - 2) {
          setIndex(SLIDES.length - 1);
          return;
        }
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < SLIDES.length; i++) {
          const d = Math.abs(offsetOf(track, i) - track.scrollLeft);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        setIndex(best);
      }, 120);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      track.removeEventListener("scroll", onScroll);
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") goTo(Math.min(SLIDES.length - 1, index + 1));
    else if (e.key === "ArrowLeft") goTo(Math.max(0, index - 1));
    else if (e.key === "Home") goTo(0);
    else if (e.key === "End") goTo(SLIDES.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <section className={`${shared.section} ${shared.white} ${styles.section}`} aria-labelledby="highlights-title">
      <div className={shared.wrap}>
        <h2 id="highlights-title" className={`${shared.headline} ${styles.title}`}>
          Get the highlights.
        </h2>
      </div>

      <div
        ref={trackRef}
        className={styles.track}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={`What ${product.name} does. Use the arrow keys to move between slides.`}
        onKeyDown={onKeyDown}
        // Keyboard focus pauses; a mouse click on the track does not (hovering already does).
        onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible"))}
        onBlur={() => setFocused(false)}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
        onPointerLeave={() => setHovering(false)}
      >
        {SLIDES.map((slide, i) => (
          <div
            key={slide.id}
            className={styles.slide}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${SLIDES.length}`}
          >
            <Desktop className={styles.card}>
              {slide.mock}
              <p className={styles.caption}>
                <strong>{slide.title}</strong> {slide.text}
              </p>
            </Desktop>
          </div>
        ))}
      </div>

      <div className={styles.controls}>
        <div className={styles.dots}>
          {SLIDES.map((slide, i) => {
            const current = i === index;
            return (
              <button
                key={slide.id}
                type="button"
                className={`${styles.dot} ${current ? styles.current : ""}`}
                aria-label={`Slide ${i + 1}: ${slide.title}`}
                aria-current={current ? "true" : undefined}
                onClick={() => goTo(i)}
              >
                <span className={styles.dotShape}>
                  {current && (
                    <span
                      // A new element for each slide, so its fill starts from empty.
                      key={`${slide.id}-${reduced ? "still" : "moving"}`}
                      className={reduced ? styles.fillFull : styles.fill}
                      style={reduced ? undefined : { animationDuration: `${SLIDE_MS}ms`, animationPlayState: running ? "running" : "paused" }}
                      onAnimationEnd={reduced ? undefined : () => goTo(index + 1)}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {!reduced && (
          <button
            type="button"
            className={styles.play}
            aria-label={playing ? "Pause the slides" : "Play the slides"}
            onClick={() => setPlaying((p) => !p)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {playing ? (
                <>
                  <rect x="7" y="6" width="3.4" height="12" rx="1" />
                  <rect x="13.6" y="6" width="3.4" height="12" rx="1" />
                </>
              ) : (
                <path d="M8.5 6.2v11.6a.8.8 0 0 0 1.2.7l9-5.8a.8.8 0 0 0 0-1.4l-9-5.8a.8.8 0 0 0-1.2.7Z" />
              )}
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
