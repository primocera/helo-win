import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from 'react';
import { useIslandState, useNow } from './store';
import { IdleView, BannerView, CardView, HudView } from './Views';
import { Panel, visibleTabs } from './Panel';
import { BlinkFace, FACE_LABELS } from './Blink';
import { faceFor, strongestMood, watchMood } from '../../../shared/face';
import type { Behavior, ConvertFormat, Face, IslandState, PanelTab, SmokeView } from '../../../shared/types';

type Mode = 'idle' | 'banner' | 'card' | 'hud' | 'panel';

const WIDTH: Record<Mode, number> = { idle: 214, banner: 440, card: 488, hud: 300, panel: 648 };
const FIXED_HEIGHT: Partial<Record<Mode, number>> = { idle: 34, banner: 62, hud: 40 };
const OPEN_DELAY = 220;
// While idle the island lets clicks through to what is under it (browser tabs,
// title bars). Resting the pointer on it this long opens the panel instead.
const PEEK_DELAY = 500;
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
  useConverter();

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
    setFileOver(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, []);

  useEffect(() => window.helo.onCollapse(() => {
    closePanel();
    setHovered(false);
    window.helo.hover(false);
  }), [closePanel]);

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
    // Idle: stay click-through and fade, so the tab underneath can be seen and clicked.
    // Click-to-open: the island catches the pointer at once and waits for a click.
    const clickToOpen = state.settings.display.open === 'click';
    const peeking = mode === 'idle' && !panelOpen && !clickToOpen;
    if (!peeking) window.helo.hover(true);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    if (!panelOpen && mode !== 'card' && !openTimer.current && !clickToOpen) {
      openTimer.current = window.setTimeout(() => {
        openTimer.current = null;
        // A missed mouseleave must not open the panel: check the pointer is really still here.
        if (peeking && !document.querySelector('.island:hover, .blink:hover')) {
          setHovered(false);
          return;
        }
        window.helo.hover(true);
        setPanelOpen(true);
      }, peeking ? PEEK_DELAY : OPEN_DELAY);
    }
  };

  const openOnClick = () => {
    if (state.settings.display.open === 'click' && mode === 'idle' && !panelOpen) setPanelOpen(true);
  };

  const onLeave = () => {
    setHovered(false);
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = null;
    const typing = panelRef.current?.contains(document.activeElement) && (document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLInputElement);
    if (typing) return; // stay open while typing; closes when the window loses focus
    window.helo.hover(false);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setPanelOpen(false);
      setFileOver(false);
    }, CLOSE_DELAY);
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
  const width = WIDTH[mode];
  const height = FIXED_HEIGHT[mode] ?? Math.max(60, contentHeight);
  const bottom = state.settings.display.edge === 'bottom';
  const isHover = hovered || Boolean(smoke?.hover);
  // The pointer is close to the face (about 150 px): it looks happy to see you.
  const near = Math.abs(look.x) < 0.38 && Math.abs(look.y) < 0.5;
  // Just the face while idle, when a browser is in front or the user chose it.
  const compact = state.faceOnly && mode === 'idle';
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
    <div className={`stage ${bottom ? 'edge-bottom' : 'edge-top'} ${smoke?.backdrop ? 'backdrop' : ''} ${hovered && mode === 'idle' && !panelOpen && state.settings.display.open !== 'click' ? 'peek' : ''} ${compact ? 'face-only' : ''}`}>
      {smoke?.faces ? <FaceSheet /> : (
        <>
          {state.settings.features.mascot && (
            <div
              className="blink"
              style={{ right: compact ? 'calc(50% - 24px)' : `calc(50% + ${width / 2 + 10}px)` }}
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
              onClick={openOnClick}
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
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setFileOver(false); }}
            onDrop={onDrop}
          >
            <div className="island-content" ref={contentRef} key={mode}>
              {mode === 'idle' && <IdleView state={state} now={now} />}
              {mode === 'banner' && state.banner && <BannerView banner={state.banner} now={now} />}
              {mode === 'card' && <CardView request={state.requests[0]} more={state.requests.length - 1} onDecide={decide} />}
              {mode === 'hud' && state.hud && <HudView hud={state.hud} />}
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
