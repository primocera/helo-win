// The expanded island: a row of feature icons, then the selected section.
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Icon } from '../common/icons';
import { Bars } from './Views';
import { WorkMapView } from './WorkMap';
import { formatClock, formatRemaining, relativeTime, eventWhen } from '../../../shared/time';
import { livePosition, lineAt } from '../../../shared/playback';
import type { CalendarEvent, ClipItem, ConvertFormat, IslandState, PanelTab, SessionSource, ShelfItem, WatchCondition, WatchTarget } from '../../../shared/types';
import { AGENT_NAMES } from '../../../shared/types';

const TABS: { id: PanelTab; icon: string; label: string; feature: (f: IslandState['settings']['features']) => boolean }[] = [
  { id: 'media', icon: 'home', label: 'Home', feature: () => true },
  { id: 'agents', icon: 'agents', label: 'Agents', feature: (f) => f.agents || f.usage },
  { id: 'map', icon: 'map', label: 'Work map', feature: (f) => f.map },
  { id: 'timer', icon: 'timer', label: 'Focus timer', feature: (f) => f.timer },
  { id: 'clipboard', icon: 'clipboard', label: 'Clipboard', feature: (f) => f.clipboard },
  { id: 'notes', icon: 'notes', label: 'Notes', feature: (f) => f.notes },
  { id: 'shelf', icon: 'shelf', label: 'File shelf', feature: (f) => f.shelf },
  { id: 'calendar', icon: 'calendar', label: 'Calendar', feature: (f) => f.calendar },
  { id: 'finished', icon: 'bell', label: 'Finished alerts', feature: (f) => f.downloads || f.steam || f.watchApp },
  { id: 'system', icon: 'system', label: 'System', feature: (f) => f.keepAwake || f.battery || f.privacy || f.hud || f.displays },
];

export function visibleTabs(state: IslandState) {
  return TABS.filter((t) => t.feature(state.settings.features));
}

export function Panel({ state, tab, setTab, now, fileOver }: { state: IslandState; tab: PanelTab; setTab: (t: PanelTab) => void; now: number; fileOver: boolean }) {
  const tabs = visibleTabs(state);
  const locked = state.license.state === 'expired';
  const fixed = state.settings.display.locked;
  return (
    <div className="panel">
      <div className="toolbar" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            title={t.label}
            className={`tool ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <Icon name={t.icon} size={15} />
          </button>
        ))}
        <span className="toolbar-gap" />
        {state.agents.mood !== 'idle' && <span className={`mood-dot mood-${state.agents.mood}`} title={`Agents: ${state.agents.mood}`} />}
        <button
          type="button"
          className={`tool ${fixed ? '' : 'unlocked'}`}
          aria-pressed={fixed}
          title={fixed ? 'Locked in place. Click to move the island.' : 'Drag the island where you want it, then click to lock it there.'}
          onClick={() => window.helo.setLocked(!fixed)}
        >
          <Icon name={fixed ? 'lock' : 'unlock'} size={15} />
        </button>
        <button type="button" className="tool" title="Settings" onClick={() => window.helo.openSettings()}>
          <Icon name="settings" size={15} />
        </button>
      </div>
      {state.banner && (
        <div className="panel-banner">
          <span className="panel-banner-title">{state.banner.title}</span>
          <span className="panel-banner-text">{state.banner.text}</span>
        </div>
      )}
      <div className="panel-body">
        {locked ? <Locked /> : (
          <>
            {tab === 'media' && <Home state={state} now={now} />}
            {tab === 'agents' && <Agents state={state} now={now} />}
            {tab === 'map' && <WorkMapView state={state} />}
            {tab === 'timer' && <Timer state={state} now={now} />}
            {tab === 'clipboard' && <Clipboard state={state} now={now} />}
            {tab === 'notes' && <Notes initial={state.notes} />}
            {tab === 'shelf' && <Shelf items={state.shelf} fileOver={fileOver} converter={state.settings.features.converter} />}
            {tab === 'calendar' && <Calendar state={state} now={now} />}
            {tab === 'system' && <System state={state} now={now} />}
            {tab === 'finished' && <Finished state={state} now={now} />}
          </>
        )}
      </div>
    </div>
  );
}

function Locked() {
  return (
    <div className="card-row">
      <div className="tile grow center">
        <Icon name="lock" size={20} />
        <div className="tile-title">Your free trial has ended</div>
        <div className="muted">Enter a license key to keep using the island.</div>
        <button type="button" className="btn primary small" onClick={() => window.helo.openSettings('license')}>Enter license key</button>
      </div>
    </div>
  );
}

function Empty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={18} />
      <div className="empty-title">{title}</div>
      <div className="muted">{text}</div>
    </div>
  );
}

// ---- Home: now playing + next event --------------------------------------------

function Home({ state, now }: { state: IslandState; now: number }) {
  const f = state.settings.features;
  return (
    <div className="card-row">
      {f.media && <NowPlaying state={state} now={now} />}
      {f.calendar ? <NextEvent state={state} now={now} /> : !f.media ? <Empty icon="home" title="Nothing here yet" text="Turn on Now Playing or Calendar in Settings." /> : null}
    </div>
  );
}

function NowPlaying({ state, now }: { state: IslandState; now: number }) {
  const m = state.media;
  const [drag, setDrag] = useState<number | null>(null);
  if (!m || (!m.title && !m.artist)) {
    return (
      <div className="tile media grow">
        <Empty icon="music" title="Nothing playing" text="Play music or a video in any app." />
      </div>
    );
  }
  const length = m.endMs - m.startMs;
  const pos = drag ?? livePosition(m, now);
  const lyrics = state.lyrics;
  const lyricIndex = lyrics && lyrics.status === 'synced' ? lineAt(lyrics.lines, pos) : -1;
  const playing = m.status === 'Playing';
  return (
    <div className="tile media grow">
      <div className="media-top">
        <div className="art">{m.art ? <img src={m.art} alt="" /> : <Icon name="music" size={18} />}</div>
        <div className="media-text">
          <div className="media-title">{m.title || 'Unknown title'}</div>
          <div className="media-artist">{m.artist || m.album}</div>
        </div>
        <Bars playing={playing} />
      </div>
      {lyrics && lyrics.status === 'synced' && (
        <div className="lyric">{lyricIndex >= 0 ? lyrics.lines[lyricIndex].text || '♪' : '♪'}</div>
      )}
      {length > 0 && (
        <div className="scrub">
          <span className="time">{formatClock(pos - m.startMs)}</span>
          <input
            type="range"
            min={m.startMs}
            max={m.endMs}
            step={1000}
            value={Math.round(pos)}
            disabled={!m.canSeek}
            aria-label="Position"
            onChange={(e) => setDrag(Number(e.target.value))}
            onPointerUp={() => {
              if (drag != null) window.helo.media('seek', drag);
              setTimeout(() => setDrag(null), 600);
            }}
            style={{ ['--p' as string]: `${((pos - m.startMs) / length) * 100}%` }}
          />
          <span className="time">-{formatClock(m.endMs - pos)}</span>
        </div>
      )}
      <div className="controls">
        {m.canShuffle && (
          <button type="button" className={`ctl mode ${m.shuffle ? 'on' : ''}`} aria-pressed={m.shuffle} onClick={() => window.helo.media('shuffle')} title={m.shuffle ? 'Shuffle is on' : 'Shuffle'}>
            <Icon name="shuffle" size={15} />
          </button>
        )}
        <button type="button" className="ctl" disabled={!m.canPrevious} onClick={() => window.helo.media('previous')} title="Previous">
          <Icon name="previous" size={16} />
        </button>
        <button type="button" className="ctl big" disabled={!(playing ? m.canPause : m.canPlay)} onClick={() => window.helo.media('toggle')} title={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={18} />
        </button>
        <button type="button" className="ctl" disabled={!m.canNext} onClick={() => window.helo.media('next')} title="Next">
          <Icon name="next" size={16} />
        </button>
        {m.canRepeat && (
          <button
            type="button"
            className={`ctl mode ${m.repeat !== 'None' ? 'on' : ''}`}
            aria-pressed={m.repeat !== 'None'}
            onClick={() => window.helo.media('repeat')}
            title={m.repeat === 'Track' ? 'Repeating this track' : m.repeat === 'List' ? 'Repeating the list' : 'Repeat'}
          >
            <Icon name={m.repeat === 'Track' ? 'repeatOne' : 'repeat'} size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function dayLabel(t: number) {
  return new Date(t).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
}

function sameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function NextEvent({ state, now }: { state: IslandState; now: number }) {
  const cal = state.calendar;
  const configured = state.settings.calendar.icsUrl !== '';
  const today = cal.events.filter((e) => sameDay(e.start, now) || (e.start < now && e.end > now));
  const next = cal.events.slice(0, 2);
  return (
    <div className="tile event">
      <div className="event-day">{dayLabel(now)}</div>
      {!configured ? (
        <>
          <div className="tile-title">No calendar yet</div>
          <button type="button" className="link" onClick={() => window.helo.openSettings('features')}>Add an .ics link in Settings</button>
        </>
      ) : cal.error && !cal.events.length ? (
        <>
          <div className="tile-title">Calendar unavailable</div>
          <div className="muted clamp2">{cal.error}</div>
        </>
      ) : (
        <>
          <div className="tile-title">{today.length ? `${today.length} event${today.length === 1 ? '' : 's'} left today` : 'Nothing else today'}</div>
          <div className="event-list">
            {next.map((e) => <EventRow key={`${e.title}${e.start}`} e={e} now={now} compact />)}
          </div>
        </>
      )}
    </div>
  );
}

function EventRow({ e, now, compact }: { e: CalendarEvent; now: number; compact?: boolean }) {
  const live = e.start <= now && e.end > now;
  return (
    <div className={`event-row ${live ? 'live' : ''}`}>
      <span className="event-bar" />
      <span className="event-text">
        <span className="event-title">{e.title}</span>
        <span className="event-sub">
          {compact ? (sameDay(e.start, now) ? '' : `${new Date(e.start).toLocaleDateString([], { weekday: 'short' })} · `) : ''}
          {e.allDay ? 'All day' : `${new Date(e.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
          {e.location ? ` · ${e.location}` : ''}
        </span>
      </span>
      {e.join && !e.allDay && e.start - now <= 15 * 60_000 && (
        <button type="button" className="event-join" title="Open the meeting link" onClick={() => window.helo.joinEvent(e.start, e.title)}>Join</button>
      )}
      <span className={`event-chip ${live ? 'now' : ''}`}>{eventWhen(e.start, e.end, e.allDay, now)}</span>
    </div>
  );
}

function Calendar({ state, now }: { state: IslandState; now: number }) {
  const cal = state.calendar;
  if (!state.settings.calendar.icsUrl) {
    return <Empty icon="calendar" title="Connect a calendar" text="Paste your calendar's private .ics address in Settings → Features." />;
  }
  if (!cal.events.length) {
    return <Empty icon="calendar" title={cal.error ? 'Calendar unavailable' : 'No events this week'} text={cal.error || 'Enjoy the free time.'} />;
  }
  const groups: { day: number; events: CalendarEvent[] }[] = [];
  for (const e of cal.events) {
    const g = groups.find((x) => sameDay(x.day, Math.max(e.start, now)));
    if (g) g.events.push(e);
    else groups.push({ day: Math.max(e.start, now), events: [e] });
  }
  return (
    <div className="scroll-list cal-list">
      {groups.map((g) => (
        <div key={g.day} className="cal-group">
          <div className="event-day">{sameDay(g.day, now) ? 'TODAY' : dayLabel(g.day)}</div>
          {g.events.map((e) => <EventRow key={`${e.title}${e.start}`} e={e} now={now} />)}
        </div>
      ))}
    </div>
  );
}

// ---- Agents ------------------------------------------------------------------

function Ring({ value, label, sub }: { value: number | null; label: string; sub: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  const tone = v >= 90 ? 'hot' : v >= 70 ? 'warm' : 'ok';
  return (
    <div className="ring">
      <svg width="58" height="58" viewBox="0 0 58 58" aria-hidden="true">
        <circle cx="29" cy="29" r={r} className="ring-track" />
        <circle cx="29" cy="29" r={r} className={`ring-fill ${tone}`} strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 29 29)" />
      </svg>
      <span className="ring-value">{value == null ? '–' : `${Math.round(v)}%`}</span>
      <span className="ring-label">{label}</span>
      <span className="ring-sub">{sub}</span>
    </div>
  );
}

function resetsIn(at: number, now: number) {
  if (!at) return '';
  const mins = Math.max(0, Math.round((at - now) / 60_000));
  if (mins < 60) return `resets in ${mins}m`;
  if (mins < 48 * 60) return `resets in ${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `resets in ${Math.round(mins / 1440)}d`;
}

const MOOD_TEXT = { idle: 'Idle', working: 'Working', waiting: 'Waiting for you', done: 'Done' } as const;

const SOURCE_NAME: Record<SessionSource, string> = { claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini CLI', cursor: 'Cursor', 'claude-web': 'Claude chat', 'chatgpt-web': 'ChatGPT chat' };
const SOURCE_TAG: Record<SessionSource, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini', cursor: 'Cursor', 'claude-web': 'Claude · web', 'chatgpt-web': 'ChatGPT · web' };

function Agents({ state, now }: { state: IslandState; now: number }) {
  const a = state.agents;
  const f = state.settings.features;
  const anyConnected = AGENT_NAMES.some((name) => a[name].connected);
  return (
    <div className="card-row">
      {f.usage && (
        <div className="tile usage">
          <div className="tile-label">Claude usage{a.model && <span className="model-chip" title="The model your latest Claude Code session is on">{a.model}</span>}</div>
          {a.usage ? (
            <div className="rings">
              <Ring value={a.usage.fiveHour?.usedPercent ?? null} label="5 hours" sub={a.usage.fiveHour ? resetsIn(a.usage.fiveHour.resetsAt, now) : 'no data'} />
              <Ring value={a.usage.sevenDay?.usedPercent ?? null} label="Week" sub={a.usage.sevenDay ? resetsIn(a.usage.sevenDay.resetsAt, now) : 'no data'} />
            </div>
          ) : (
            <div className="muted small-gap">
              {a.claude.connected
                ? a.claude.note || 'Shows up after Claude Code answers once in a session (Pro, Max and Ultra plans).'
                : 'Connect Claude Code in Settings to see your 5-hour and weekly limits.'}
            </div>
          )}
        </div>
      )}
      <div className="tile grow">
        <div className="tile-label">Sessions</div>
        {a.sessions.length ? (
          <div className="sessions">
            {a.sessions.slice(0, 4).map((s) => (
              <div key={s.key} className="session">
                <span className={`mood-dot mood-${s.mood}`} />
                <span className="session-name">{s.project || SOURCE_NAME[s.agent]}</span>
                <span className="session-agent">{SOURCE_TAG[s.agent]}</span>
                {s.file && <span className="session-file" title={`Editing ${s.file}`}>{s.file}</span>}
                {(s.added || s.removed) ? (
                  <span className="session-lines" title="Lines added and removed since your last prompt">
                    {s.added ? <span className="plus">+{s.added}</span> : null}
                    {s.removed ? <span className="minus">−{s.removed}</span> : null}
                  </span>
                ) : null}
                <span className="session-mood">{MOOD_TEXT[s.mood]}{s.file ? '' : ` · ${relativeTime(s.since, now)}`}</span>
                {s.jump && (
                  <button
                    type="button"
                    className={`session-go ${s.mood === 'waiting' ? 'answer' : ''}`}
                    title={s.mood === 'waiting' ? 'Go to its window and answer' : 'Go to its window'}
                    onClick={() => window.helo.sessionJump(s.key)}
                  >
                    {s.mood === 'waiting' ? 'Answer' : 'Open'}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="muted small-gap">
            {anyConnected ? 'No agent activity yet. Requests and finished tasks show up here.' : 'Not connected to any agent yet.'}
          </div>
        )}
        {!anyConnected && (
          <button type="button" className="btn primary small" onClick={() => window.helo.openSettings('agents')}>Connect an agent</button>
        )}
      </div>
    </div>
  );
}

// ---- Timer ---------------------------------------------------------------------

function Timer({ state, now }: { state: IslandState; now: number }) {
  const t = state.timer;
  const left = t.running && t.endsAt != null ? Math.max(0, t.endsAt - now) : t.remainingMs;
  const total = (t.phase === 'focus' ? t.focusMin : t.longBreak ? t.longBreakMin : t.breakMin) * 60_000;
  const progress = total ? 1 - left / total : 0;
  return (
    <div className="card-row">
      <div className="tile grow timer">
        <div className={`timer-phase ${t.phase}`}>{t.phase === 'focus' ? 'Focus' : t.longBreak ? 'Long break' : 'Break'}</div>
        <div className="timer-clock">{formatRemaining(left)}</div>
        <div className="timer-bar"><span style={{ width: `${progress * 100}%` }} className={t.phase} /></div>
        <div className="controls">
          <button type="button" className="ctl" title="Reset" onClick={() => window.helo.timer('reset')}><Icon name="reset" size={16} /></button>
          <button type="button" className="ctl big" title={t.running ? 'Pause' : 'Start'} onClick={() => window.helo.timer(t.running ? 'pause' : 'start')}>
            <Icon name={t.running ? 'pause' : 'play'} size={18} />
          </button>
          <button type="button" className="ctl" title={t.phase === 'focus' ? 'Skip to break' : 'Skip to focus'} onClick={() => window.helo.timer('skip')}><Icon name="skip" size={16} /></button>
        </div>
      </div>
      <div className="tile">
        <div className="tile-label">Today</div>
        <div className="stat">{t.completedFocus}</div>
        <div className="muted">focus session{t.completedFocus === 1 ? '' : 's'}</div>
        <div className="muted tiny">{t.focusMin} min focus · {t.breakMin} min break</div>
        {t.longEvery > 0 && <div className="muted tiny">{t.longBreakMin} min long break every {t.longEvery}</div>}
      </div>
    </div>
  );
}

// ---- Clipboard -------------------------------------------------------------------

const CLIP_FILTERS: { id: 'all' | ClipItem['type']; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'text', label: 'Text' },
  { id: 'link', label: 'Links' },
  { id: 'color', label: 'Colours' },
  { id: 'image', label: 'Images' },
];

function Clipboard({ state, now }: { state: IslandState; now: number }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | ClipItem['type']>('all');
  const items = state.clipboard;
  const paused = state.settings.clipboard.paused;
  const pause = (
    <button type="button" className="link" title={paused ? 'Save new copies again' : 'Stop saving new copies, for example before copying a password'} onClick={() => window.helo.clipPause(!paused)}>
      {paused ? 'Resume' : 'Pause'}
    </button>
  );
  if (!items.length) {
    return (
      <div className="list-wrap">
        <div className="list-head"><span className="muted">{paused ? 'Paused: new copies are not saved.' : ''}</span>{pause}</div>
        <Empty icon="clipboard" title="Clipboard history is empty" text={paused ? 'Resume to save what you copy.' : 'Text and images you copy show up here.'} />
      </div>
    );
  }
  const q = query.trim().toLowerCase();
  const shown = items.filter((c) => (filter === 'all' || c.type === filter) && (!q || c.text.toLowerCase().includes(q)));
  return (
    <div className="list-wrap">
      <div className="list-head">
        <input className="clip-search" type="text" value={query} placeholder="Search copies" spellCheck={false} maxLength={100} onChange={(e) => setQuery(e.target.value)} />
        {pause}
        <button type="button" className="link" title="Pinned copies are kept" onClick={() => window.helo.clipClear()}>Clear all</button>
      </div>
      {paused && <div className="muted small-gap">Paused: new copies are not saved.</div>}
      <div className="chips">
        {CLIP_FILTERS.filter((f) => f.id === 'all' || items.some((c) => c.type === f.id)).map((f) => (
          <button key={f.id} type="button" className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>
      <div className="scroll-list">
        {shown.length === 0 && <div className="muted small-gap">Nothing matches.</div>}
        {shown.map((c) => (
          <div key={c.id} className={`clip ${c.pinned ? 'pinned' : ''}`} role="button" tabIndex={0} title="Copy again" onClick={() => window.helo.clipCopy(c.id)} onKeyDown={(e) => e.key === 'Enter' && window.helo.clipCopy(c.id)}>
            {c.kind === 'image' && c.thumb ? <img className="clip-thumb" src={c.thumb} alt="" />
              : c.type === 'color' ? <span className="clip-icon clip-swatch" style={{ background: c.text.trim() }} />
              : <span className="clip-icon"><Icon name={c.type === 'link' ? 'download' : 'copy'} size={14} /></span>}
            <span className="clip-text">{c.text}</span>
            <span className="clip-time">{relativeTime(c.at, now)}</span>
            <button type="button" className={`icon-btn pin-btn ${c.pinned ? 'on' : ''}`} title={c.pinned ? 'Unpin' : 'Pin to the top'} onClick={(e) => { e.stopPropagation(); window.helo.clipPin(c.id); }}>
              <Icon name="pin" size={12} />
            </button>
            <button type="button" className="icon-btn" title="Remove" onClick={(e) => { e.stopPropagation(); window.helo.clipRemove(c.id); }}>
              <Icon name="close" size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Notes ------------------------------------------------------------------------

function Notes({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.helo.saveNotes(text);
  }, [text]);
  return (
    <div className="notes">
      <textarea
        value={text}
        placeholder="Jot something down…"
        spellCheck={false}
        maxLength={100_000}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  );
}

// ---- Shelf ---------------------------------------------------------------------------

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

const IMAGE = /\.(png|jpe?g|webp|gif|bmp)$/i;

function Shelf({ items, fileOver, converter }: { items: ShelfItem[]; fileOver: boolean; converter: boolean }) {
  const [message, setMessage] = useState('');
  const convert = async (id: string, to: ConvertFormat) => {
    setMessage('Converting…');
    const r = await window.helo.shelfConvert(id, to);
    setMessage(r.ok ? '' : r.error || 'Conversion failed.');
  };
  return (
    <div className={`shelf ${fileOver ? 'over' : ''}`}>
      {!items.length ? (
        <div className="dropzone">
          <Icon name="shelf" size={20} />
          <div className="empty-title">Drop files here</div>
          <div className="muted">Park files on the island, then drag them out into any app.</div>
        </div>
      ) : (
        <>
          <div className="list-head">
            <span className="tile-label">{fileOver ? 'Drop to add' : 'Drag a file out to use it'}</span>
            {message ? <span className="muted tiny">{message}</span> : <button type="button" className="link" onClick={() => window.helo.shelfClear()}>Clear</button>}
          </div>
          <div className="shelf-grid">
            {items.map((it) => (
              <div
                key={it.id}
                className={`shelf-item ${it.missing ? 'missing' : ''}`}
                draggable={!it.missing}
                onDragStart={(e: DragEvent) => {
                  e.preventDefault();
                  window.helo.shelfDrag(it.id);
                }}
                onDoubleClick={() => window.helo.shelfOpen(it.id)}
                title={it.missing ? `${it.path} (moved or deleted)` : `${it.path}\nDouble-click to show in Explorer`}
              >
                <span className="shelf-icon">{it.icon ? <img src={it.icon} alt="" /> : <Icon name={it.isDirectory ? 'folder' : 'file'} size={22} />}</span>
                <span className="shelf-name">{it.name}</span>
                <span className="shelf-size">{it.missing ? 'Missing' : it.isDirectory ? 'Folder' : formatSize(it.size)}</span>
                <span className="shelf-actions">
                  {converter && IMAGE.test(it.name) && !it.missing && (['png', 'jpeg', 'webp'] as const).map((f) => (
                    <button key={f} type="button" className="chip" title={`Convert to ${f.toUpperCase()}`} onClick={() => convert(it.id, f)}>
                      {f === 'jpeg' ? 'JPG' : f.toUpperCase()}
                    </button>
                  ))}
                  <button type="button" className="icon-btn" title="Remove from shelf" onClick={() => window.helo.shelfRemove(it.id)}>
                    <Icon name="close" size={12} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---- System ----------------------------------------------------------------------------

// The standard monitor inputs (VCP 0x60 values); the same list the main process accepts.
const INPUTS = [
  { value: 0x0f, label: 'DP 1' },
  { value: 0x10, label: 'DP 2' },
  { value: 0x11, label: 'HDMI 1' },
  { value: 0x12, label: 'HDMI 2' },
  { value: 0x1b, label: 'USB-C' },
];

function System({ state, now }: { state: IslandState; now: number }) {
  const f = state.settings.features;
  useEffect(() => {
    if (f.displays) window.helo.refreshDisplays();
  }, [f.displays]);
  const p = state.power;
  const v = state.volume;
  const pr = state.privacy;
  // One row per app: what it is using, and for how long.
  const calls = [...new Set([...pr.microphone, ...pr.camera])].map((name) => ({
    name,
    what: [pr.microphone.includes(name) ? 'mic' : '', pr.camera.includes(name) ? 'camera' : ''].filter(Boolean).join(' + '),
    since: pr.since[name] ?? 0,
  }));
  return (
    <div className="system">
      <div className="card-row">
        {f.hud && (
          <div className="tile grow">
            <div className="tile-label">Volume</div>
            {v && v.level != null ? (
              <div className="slider-row">
                <button type="button" className="icon-btn" title={v.muted ? 'Unmute' : 'Mute'} onClick={() => window.helo.setMute(!v.muted)}>
                  <Icon name={v.muted ? 'mute' : 'speaker'} size={15} />
                </button>
                <LiveSlider value={v.level} onCommit={(n) => window.helo.setVolume(n)} label="Volume" />
                <span className="slider-value">{v.muted ? 'Muted' : v.level}</span>
              </div>
            ) : <div className="muted">{state.helper === 'failed' ? 'Windows helper is not running.' : 'No output device.'}</div>}
          </div>
        )}
        {f.keepAwake && (
          <div className="tile">
            <div className="tile-label">Keep awake</div>
            <button type="button" className={`toggle ${state.keepAwake ? 'on' : ''}`} role="switch" aria-checked={state.keepAwake} onClick={() => window.helo.setKeepAwake(!state.keepAwake)}>
              <Icon name="cup" size={14} />
              {state.keepAwake ? 'Screen stays on' : 'Off'}
            </button>
          </div>
        )}
      </div>
      <div className="card-row">
        {f.battery && (
          <div className="tile">
            <div className="tile-label">Battery</div>
            {p && p.hasBattery ? (
              <div className="battery">
                <Icon name="battery" size={16} />
                <span className="stat-sm">{p.percent}%</span>
                <span className="muted">{p.charging ? 'Charging' : p.pluggedIn ? 'Plugged in' : 'On battery'}</span>
              </div>
            ) : <div className="muted">{p ? 'No battery (desktop PC)' : '–'}</div>}
            {state.bluetooth.map((b) => (
              <div key={b.name} className="battery bt" title={`${b.name} (Bluetooth)`}>
                <Icon name="battery" size={14} />
                <span className="stat-sm">{b.percent}%</span>
                <span className="muted bt-name">{b.name}</span>
              </div>
            ))}
          </div>
        )}
        {f.privacy && (
          <div className="tile grow">
            <div className="tile-label">Microphone &amp; camera</div>
            {calls.length ? (
              <div className="calls">
                {calls.map((c) => (
                  <div key={c.name} className="call">
                    <span className="mic-dot" />
                    <span className="call-name">{c.name}</span>
                    <span className="call-what">{c.what}</span>
                    {c.since > 0 && <span className="call-time" title="How long it has been on">{formatClock(now - c.since)}</span>}
                    <button type="button" className="session-go" title={`Go to ${c.name}`} onClick={() => window.helo.callReturn(c.name)}>Open</button>
                  </div>
                ))}
              </div>
            ) : <div className="muted">Not in use</div>}
            {pr.micMuted != null && (pr.microphone.length > 0 || pr.micMuted) && (
              <button
                type="button"
                className={`toggle mic-mute ${pr.micMuted ? 'on' : ''}`}
                role="switch"
                aria-checked={pr.micMuted}
                title="Mutes the microphone for every app, until you switch it back."
                onClick={() => window.helo.setMicMute(!pr.micMuted)}
              >
                <Icon name="mic" size={14} />
                {pr.micMuted ? 'Microphone muted' : 'Mute microphone'}
              </button>
            )}
          </div>
        )}
      </div>
      {f.displays && state.displays.length > 0 && (
        <div className="card-row">
          <div className="tile grow">
            <div className="tile-label">Displays (DDC/CI)</div>
            {state.displays.map((d) => (
              <div key={d.index} className="display">
                <div className="slider-row">
                  <Icon name="sun" size={14} />
                  <span className="display-name">{d.name}</span>
                  {d.brightness != null ? (
                    <>
                      <LiveSlider value={d.brightness} onCommit={(n) => window.helo.setDisplayBrightness(d.index, n)} label={`${d.name} brightness`} />
                      <span className="slider-value">{d.brightness}</span>
                    </>
                  ) : <span className="muted">Does not support DDC/CI</span>}
                </div>
                {d.contrast != null && (
                  <div className="slider-row">
                    <Icon name="contrast" size={14} />
                    <span className="display-name muted">Contrast</span>
                    <LiveSlider value={d.contrast} onCommit={(n) => window.helo.setDisplayContrast(d.index, n)} label={`${d.name} contrast`} />
                    <span className="slider-value">{d.contrast}</span>
                  </div>
                )}
                {d.input != null && (
                  <div className="input-row">
                    <span className="display-name muted">Input</span>
                    {INPUTS.map((i) => (
                      <button
                        key={i.value}
                        type="button"
                        className={`chip ${d.input === i.value ? 'on' : ''}`}
                        title={d.input === i.value ? 'In use now' : `Switch this monitor to ${i.label}. This screen goes dark if this PC is not plugged into that input.`}
                        onClick={() => { if (d.input !== i.value) window.helo.setDisplayInput(d.index, i.value); }}
                      >
                        {i.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A range input that only sends its value when the user lets go. */
function LiveSlider({ value, onCommit, label }: { value: number; onCommit: (n: number) => void; label: string }) {
  const [local, setLocal] = useState<number | null>(null);
  const shown = local ?? value;
  return (
    <input
      type="range"
      min={0}
      max={100}
      value={shown}
      aria-label={label}
      style={{ ['--p' as string]: `${shown}%` }}
      onChange={(e) => setLocal(Number(e.target.value))}
      onPointerUp={() => {
        if (local != null) onCommit(local);
        setTimeout(() => setLocal(null), 800);
      }}
      onKeyUp={() => {
        if (local != null) onCommit(local);
      }}
    />
  );
}

// ---- Finished alerts --------------------------------------------------------------------

const KIND_ICON = { download: 'download', steam: 'gamepad', app: 'bell' } as const;

function Finished({ state, now }: { state: IslandState; now: number }) {
  const f = state.settings.features;
  const fin = state.finished;
  return (
    <div className="card-row">
      {f.watchApp && <WatchApp state={state} />}
      <div className={`tile ${f.watchApp ? 'recent' : 'grow'}`}>
        <div className="tile-label">Recently finished</div>
        {fin.recent.length ? (
          <div className="recent-list">
            {fin.recent.slice(0, 4).map((r) => (
              <div
                key={r.id}
                className={`recent-row ${r.actionable ? 'clickable' : ''}`}
                onClick={r.actionable ? () => window.helo.openFinished(r.id) : undefined}
                title={r.actionable ? (r.kind === 'download' ? 'Show in Explorer' : 'Open in Steam') : undefined}
              >
                <Icon name={KIND_ICON[r.kind]} size={14} />
                <span className="recent-text">
                  <span className="recent-title">{r.title}</span>
                  <span className="recent-sub">{r.text}</span>
                </span>
                <span className="clip-time">{relativeTime(r.at, now)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted small-gap">Nothing yet.</div>
        )}
        <div className="watching">
          {f.downloads && <span className="pill-note"><Icon name="download" size={11} />Downloads folder</span>}
          {f.steam && <span className="pill-note"><Icon name="gamepad" size={11} />{fin.steamFound ? 'Steam' : 'Steam not found'}</span>}
        </div>
      </div>
    </div>
  );
}

function phaseText(w: NonNullable<IslandState['finished']['watch']>): string {
  if (w.condition === 'exit') return 'waiting for it to close';
  if (w.phase === 'waiting') return 'waiting for it to get busy';
  if (w.phase === 'busy') return 'busy';
  return `quiet for ${Math.floor(w.quietMs / 1000)} s`;
}

function WatchApp({ state }: { state: IslandState }) {
  const w = state.finished.watch;
  const [apps, setApps] = useState<WatchTarget[]>([]);
  const [pid, setPid] = useState<number | null>(null);
  const [condition, setCondition] = useState<WatchCondition>('idle');
  const [error, setError] = useState('');
  const load = () => window.helo.listWindows().then((list) => {
    setApps(list);
    setPid((p) => (p && list.some((a) => a.pid === p) ? p : list[0]?.pid ?? null));
  });
  useEffect(() => {
    if (!w) void load();
  }, [w]);
  if (w) {
    return (
      <div className="tile grow watch">
        <div className="tile-label">Watching</div>
        <div className="watch-app">
          <span className="mood-dot mood-working" />
          <span className="watch-name">{w.name}</span>
          <span className="watch-title">{w.title}</span>
        </div>
        <div className="muted">{w.condition === 'idle' ? 'Until it looks done loading (an estimate)' : 'Until it closes'}: {phaseText(w)}</div>
        <button type="button" className="btn small" onClick={() => window.helo.cancelWatch()}>Stop watching</button>
      </div>
    );
  }
  return (
    <div className="tile grow watch">
      <div className="tile-label">Tell me when an app is done</div>
      <div className="watch-form">
        <select value={pid ?? ''} onChange={(e) => setPid(Number(e.target.value))} aria-label="App" onFocus={() => void load()}>
          {!apps.length && <option value="">No open apps found</option>}
          {apps.map((a) => (
            <option key={a.pid} value={a.pid}>{a.name} · {a.title}</option>
          ))}
        </select>
        <div className="watch-actions">
          <div className="seg">
            <button type="button" className={condition === 'idle' ? 'active' : ''} onClick={() => setCondition('idle')}>Done loading*</button>
            <button type="button" className={condition === 'exit' ? 'active' : ''} onClick={() => setCondition('exit')}>Closes</button>
          </div>
          <button
            type="button"
            className="btn primary small"
            disabled={pid == null}
            onClick={async () => {
              setError('');
              const r = await window.helo.startWatch(pid!, condition);
              if (!r.ok) setError(r.error || 'Could not watch that app.');
            }}
          >
            Watch
          </button>
        </div>
      </div>
      <div className="tiny watch-note">
        {error || '*An estimate: it waits until the app has been busy and then quiet for about 15 seconds, which usually means loading finished. Windows has no direct signal for this.'}
      </div>
    </div>
  );
}
