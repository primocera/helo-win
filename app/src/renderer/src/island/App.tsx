import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent } from 'react';
import { useIslandState, useNow } from './store';
import { IdleView, BannerView, CardView, HudView, MenuView } from './Views';
import { Panel, visibleTabs } from './Panel';
import { BlinkFace, FACE_LABELS } from './Blink';
import { playChime } from './sound';
import { idleSong } from '../../../shared/playback';
import { faceFor, strongestMood, watchMood } from '../../../shared/face';
import type { Behavior, ConvertFormat, Face, IslandState, PanelTab, SmokeView } from '../../../shared/types';

type Mode = 'idle' | 'banner' | 'card' | 'hud' | 'panel' | 'menu';

const WIDTH: Record<Mode, number> = { idle: 214, banner: 440, card: 488, hud: 300, panel: 648, menu: 396 };
const FIXED_HEIGHT: Partial<Record<Mode, number>> = { idle: 34, banner: 62, hud: 40, menu: 44 };
/** The closed island with a song title in it. */
const SONG_WIDTH = 320;
const OPEN_DELAY = 220;
// While idle and locked in place the island lets clicks through to what is under it
// (browser tabs, title bars). Resting the pointer on it this long opens the panel instead.
// Unlocked, it waits as long, so there is time to take hold of it.
const PEEK_DELAY = 500;
/** The work map is drawn at its full size, so its panel is wider. */
const MAP_WIDTH = 820;
/** The pointer goes this far with the button down before the island follows it. */
const DRAG_START = 4;
const CLOSE_DELAY = 420;

function useConverter() {
  useEffect(() => window.helo.onConvertJob(async ({ id, bytes, mime, to }) => {
    try {
      const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas.');
      if (to === 'jpeg') {
        // JPEG has no transparency: put transparent pixels on white.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const blob = await canvas.convertToBlob({ type: `image/${to satisfies ConvertFormat}`, quality: 0.92 });
      if (blob.type !== `image/${to}`) throw new Error(`This system cannot write ${to.toUpperCase()}.`);
      window.helo.convertDone(id, { bytes: new Uint8Array(await blob.arrayBuffer()) });
    } catch (err) {
      window.helo.convertDone(id, { error: err instanceof Error ? err.message : 'Could not read that image.' });
    }
  }), []);
}

export function App() {
  const state = useIslandState();
  const [hovered, setHovered] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  // The right-click menu: Settings, step aside, hide, quit.
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>('media');
  const [smoke, setSmoke] = useState<(SmokeView & { backdrop?: boolean }) | null>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [lastActivity, setLastActivity] = useState(() => Date.now());
  const [fileOver, setFileOver] = useState(false);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  // A press that may become a drag, and whether it has.
  const press = useRef<{ x: number; y: number; id: number; dragging: boolean } | null>(null);
  const draggedAt = useRef(0);
  const [dragging, setDragging] = useState(false);
  useConverter();

  // The accent colour the person chose (the stylesheet's own is mint).
  const accent = state?.settings.display.accent;
  useEffect(() => {
    if (accent === 'rose') document.documentElement.style.setProperty('--mint', '#ff8fb4');
    else document.documentElement.style.removeProperty('--mint');
  }, [accent]);

  useEffect(() => window.helo.onSound((v) => playChime(v.volume)), []);
  useEffect(() => window.helo.onSmoke((v) => setSmoke(v as SmokeView & { backdrop?: boolean })), []);
  useEffect(() => window.helo.onCursor((v) => {
    setLook(v);
    setLastActivity(Date.now());
  }), []);

  const clearTimers = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    openTimer.current = closeTimer.current = null;
  };

  const closePanel = useCallback(() => {
    clearTimers();
    setPanelOpen(false);
    setMenuOpen(false);
    setFileOver(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, []);

  useEffect(() => window.helo.onCollapse(() => {
    closePanel();
    setHovered(false);
    window.helo.hover(false);
  }), [closePanel]);

  // A helo://open link: the panel opens on that tab, as if the pointer had come to it.
  useEffect(() => window.helo.onOpenTab((t) => {
    clearTimers();
    setTab(t);
    setPanelOpen(true);
    window.helo.hover(true);
  }), []);

  // Tell the main process when the panel opens or closes (focusability).
  useEffect(() => {
    window.helo.panel(panelOpen);
  }, [panelOpen]);

  const forcedPanel = smoke?.panel ?? null;
  const showPanel = forcedPanel !== null || panelOpen;
  const activeTab: PanelTab = forcedPanel ?? tab;

  let mode: Mode = 'idle';
  if (state) {
    if (state.requests.length && state.settings.features.agents) mode = 'card';
    else if ((menuOpen || smoke?.menu) && forcedPanel === null) mode = 'menu';
    else if (showPanel) mode = 'panel';
    else if (state.hud && state.settings.features.hud) mode = 'hud';
    else if (state.banner) mode = 'banner';
  }

  // Ask for a big window only while the panel, the card or the face sheet is shown.
  const needsFull = mode === 'panel' || mode === 'card' || Boolean(smoke?.faces);
  useEffect(() => {
    window.helo.size(needsFull ? 'full' : 'compact');
  }, [needsFull]);

  // When the card takes over, the panel closes.
  useEffect(() => {
    if (mode === 'card' && panelOpen) setPanelOpen(false);
  }, [mode, panelOpen]);

  // Hidden tabs (feature switched off) fall back to Home.
  useEffect(() => {
    if (state && !visibleTabs(state).some((t) => t.id === tab)) setTab('media');
  }, [state, tab]);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContentHeight(Math.ceil(el.scrollHeight)));
    ro.observe(el);
    setContentHeight(Math.ceil(el.scrollHeight));
    return () => ro.disconnect();
  }, [mode]);

  // Always ticking, slowly: the face needs the time to know when to nap or stop celebrating.
  const now = useNow(Boolean(state), mode === 'panel' ? 250 : 1000);

  if (!state) return null;

  const onEnter = () => {
    setHovered(true);
    setLastActivity(Date.now());
    if (press.current?.dragging) return;
    // Idle and locked in place: stay click-through for a moment, so the tab underneath can be clicked.
    // Click-to-open, or free to move: the island catches the pointer at once.
    const clickToOpen = state.settings.display.open === 'click';
    const resting = mode === 'idle' && !panelOpen && !clickToOpen;
    const peeking = resting && state.settings.display.locked;
    if (!peeking) window.helo.hover(true);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    if (!panelOpen && mode !== 'card' && mode !== 'menu' && !openTimer.current && !clickToOpen) {
      openTimer.current = window.setTimeout(() => {
        openTimer.current = null;
        // A missed mouseleave must not open the panel: check the pointer is really still here.
        if (peeking && !document.querySelector('.island:hover, .blink:hover')) {
          setHovered(false);
          return;
        }
        window.helo.hover(true);
        setPanelOpen(true);
      }, resting ? PEEK_DELAY : OPEN_DELAY);
    }
  };

  const openOnClick = () => {
    if (Date.now() - draggedAt.current < 300) return; // the click that ends a drag
    if (state.settings.display.open === 'click' && mode === 'idle' && !panelOpen) setPanelOpen(true);
  };

  // Moving the island: unlocked, it is held by the pill, the face or the empty part of the panel's top row.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (state.settings.display.locked || e.button !== 0 || smoke) return;
    const at = e.target as HTMLElement;
    const handle = e.currentTarget.classList.contains('blink') || mode === 'idle' || (at.closest('.toolbar') !== null && at.closest('button') === null);
    if (handle) press.current = { x: e.screenX, y: e.screenY, id: e.pointerId, dragging: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.dragging || Math.hypot(e.screenX - p.x, e.screenY - p.y) < DRAG_START) return;
    p.dragging = true;
    setDragging(true);
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = null;
    e.currentTarget.setPointerCapture(p.id);
    window.helo.hover(true);
    window.helo.drag(true);
  };
  const onPointerEnd = () => {
    const p = press.current;
    press.current = null;
    if (!p?.dragging) return;
    draggedAt.current = Date.now();
    setDragging(false);
    window.helo.drag(false);
  };
  const dragHandlers = { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onLostPointerCapture: onPointerEnd };

  const onLeave = () => {
    if (press.current?.dragging) return;
    setHovered(false);
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = null;
    const typing = panelRef.current?.contains(document.activeElement) && (document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLInputElement);
    if (typing) return; // stay open while typing; closes when the window loses focus
    window.helo.hover(false);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setPanelOpen(false);
      setMenuOpen(false);
      setFileOver(false);
    }, CLOSE_DELAY);
  };

  // Right-click on the island or the face: the menu takes the panel's place.
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    if (mode === 'card' || smoke) return;
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = null;
    window.helo.hover(true);
    setPanelOpen(false);
    setMenuOpen(true);
  };

  const onDragEnter = (e: DragEvent) => {
    if (!state.settings.features.shelf || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    clearTimers();
    setTab('shelf');
    setPanelOpen(true);
    setFileOver(true);
  };
  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setFileOver(false);
    if (state.settings.features.shelf && e.dataTransfer.files.length) window.helo.shelfAdd(Array.from(e.dataTransfer.files));
  };

  const decide = (id: string, b: Behavior) => window.helo.decide(id, b);
  // While music plays the closed island is wider, to fit the song's title.
  const song = mode === 'idle' ? idleSong(state, now) : '';
  const width = mode === 'panel' && activeTab === 'map' ? MAP_WIDTH : song ? SONG_WIDTH : WIDTH[mode];
  const height = FIXED_HEIGHT[mode] ?? Math.max(60, contentHeight);
  const bottom = state.place.edge === 'bottom';
  const isHover = hovered || Boolean(smoke?.hover);
  // The pointer is close to the face (about 150 px): it looks happy to see you.
  const near = Math.abs(look.x) < 0.38 && Math.abs(look.y) < 0.5;
  // Just the face while idle, when a browser is in front or the user chose it.
  const compact = state.faceOnly && mode === 'idle';
  // Joined, the face is the island's left end. Alone in the middle (face only) there is nothing to join.
  const joined = state.settings.display.joined && state.settings.features.mascot && !compact;
  const brokenNote = state.agents.claude.note.startsWith('Port ');
  const face: Face = faceFor({
    mood: strongestMood(state.agents.mood, watchMood(Boolean(state.finished.watch), state.finished.doneAt, now)),
    hovering: isHover || near,
    listening: false,
    music: state.media?.status === 'Playing',
    focusing: state.timer.running && state.timer.phase === 'focus',
    celebrating: state.banner?.kind === 'done',
    broken: state.helper === 'failed' || brokenNote,
    idleForMs: now - lastActivity,
  });

  return (
    <div className={`stage ${bottom ? 'edge-bottom' : 'edge-top'} ${smoke?.backdrop ? 'backdrop' : ''} ${state.place.floating ? 'floating' : ''} ${dragging ? 'dragging' : ''} ${compact ? 'face-only' : ''} ${joined ? 'joined' : ''}`}>
      {smoke?.faces ? <FaceSheet /> : (
        <>
          {state.settings.features.mascot && (
            <div
              className="blink"
              style={{ right: compact ? 'calc(50% - 24px)' : `calc(50% + ${width / 2 + (joined ? -1 : 10)}px)` }}
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
              onClick={openOnClick}
              onContextMenu={onContextMenu}
              {...dragHandlers}
              title={FACE_LABELS[face]}
            >
              <BlinkFace face={face} look={look} />
            </div>
          )}
          <div
            className={`island mode-${mode}`}
            style={{ width, height }}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onClick={openOnClick}
            onContextMenu={onContextMenu}
            {...dragHandlers}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setFileOver(false); }}
            onDrop={onDrop}
          >
            <div className="island-content" ref={contentRef} key={mode}>
              {mode === 'idle' && <IdleView state={state} now={now} song={song} />}
              {mode === 'banner' && state.banner && <BannerView banner={state.banner} now={now} />}
              {mode === 'card' && <CardView request={state.requests[0]} more={state.requests.length - 1} onDecide={decide} />}
              {mode === 'hud' && state.hud && <HudView hud={state.hud} />}
              {mode === 'menu' && <MenuView onDone={() => setMenuOpen(false)} />}
              {mode === 'panel' && (
                <div ref={panelRef}>
                  <Panel state={state} tab={activeTab} setTab={setTab} now={now} fileOver={fileOver} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FaceSheet() {
  const faces = Object.keys(FACE_LABELS) as Face[];
  return (
    <div className="face-sheet">
      {faces.map((f) => (
        <div key={f} className="face-cell">
          <div className="face-big"><BlinkFace face={f} size={44} /></div>
          <div className="face-small"><BlinkFace face={f} size={18} /></div>
          <div className="face-label">{FACE_LABELS[f]}</div>
        </div>
      ))}
    </div>
  );
}

export type { IslandState };
