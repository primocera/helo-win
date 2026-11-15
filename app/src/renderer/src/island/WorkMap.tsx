// The work map tab: a live picture of what Claude Code is using, with the rows of what it did beside it.
// The drawing, the rows and the words come from shared/map (lot-map); the board is built in the main process.
import { useEffect, useMemo, useState } from 'react';
import { drawMap } from '../../../shared/map/draw';
import { foldRows, nowParts } from '../../../shared/map/feed';
import { formatMs } from '../../../shared/map/classify';
import { EMPTY_BOARD, MAP_SETUP } from '../../../shared/workmap';
import type { IslandState } from '../../../shared/types';
import type { Board } from '../../../shared/map/types';

const ROWS = 12;

/**
 * The drawing as an image. It animates by itself (SMIL inside the SVG), so it is drawn again only when the board
 * changes. An <img> cannot run scripts or load anything, whatever a label says. The new picture is decoded before it
 * replaces the old one, so the map does not blink.
 */
function useMapImage(board: Board): string {
  const [src, setSrc] = useState('');
  useEffect(() => {
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(drawMap(board, Date.now(), MAP_SETUP))}`;
    let live = true;
    const img = new Image();
    img.src = url;
    img.decode().catch(() => {}).then(() => {
      if (live) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [board]);
  return src;
}

export function WorkMapView({ state }: { state: IslandState }) {
  const board = state.map?.board ?? EMPTY_BOARD;
  const src = useMapImage(board);
  const { t } = MAP_SETUP;

  const rows = useMemo(() => {
    // How long each answer took, from the person's message to it.
    const turnMs = new Map<string, number>();
    let askedAt: number | undefined;
    for (const x of board.entries) {
      if (x.station === 'you' && x.from === 'inbound' && x.mark === undefined) askedAt = x.startedAt;
      if (x.mark === 'done' && askedAt !== undefined) {
        turnMs.set(x.id, x.startedAt - askedAt);
        askedAt = undefined;
      }
    }
    return foldRows(board.entries, ROWS).map(({ entry, times, tookMs }) => {
      const isSwitch = entry.mark === 'switch';
      const whole = turnMs.get(entry.id);
      return {
        id: entry.id,
        mark: isSwitch ? '◆' : entry.status === 'run' ? '●' : entry.status === 'ok' ? '·' : '✕',
        tone: isSwitch || entry.status === 'run' ? 'run' : entry.status === 'ok' ? 'ok' : 'bad',
        station: t.stations[entry.station],
        label: `${entry.label}${times > 1 ? `  +${times - 1}` : ''}`,
        took: entry.endedAt === undefined ? t.running : whole !== undefined && whole > 0 ? formatMs(whole, t) : tookMs > 0 ? formatMs(tookMs, t) : '—',
      };
    });
  }, [board, t]);

  const now = nowParts(board, t);
  const connected = state.agents.claude.connected;
  return (
    <div className="wm">
      <div className="wm-map">{src && <img src={src} alt={`${t.title}. ${now.what}`} draggable={false} />}</div>
      <div className="wm-side">
        <div className="wm-now">
          <span className="wm-what">{now.what}</span>
          {state.map?.project && <span className="wm-meter">{state.map.project}</span>}
        </div>
        {rows.length === 0 ? (
          <div className="wm-empty">
            {connected
              ? 'Nothing yet. Send a message in a new Claude Code session and its work shows up here.'
              : 'Connect Claude Code in Settings → AI agents to see its work here.'}
          </div>
        ) : (
          <div className="wm-rows">
            {rows.map((r) => (
              <div key={r.id} className={`wm-row wm-${r.tone}`}>
                <span className="wm-mark">{r.mark}</span>
                <span className="wm-station">{r.station}</span>
                <span className="wm-label" title={r.label}>{r.label}</span>
                <span className="wm-took">{r.took}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
