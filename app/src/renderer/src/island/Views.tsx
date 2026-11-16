// The compact island states: idle pill, banner, permission card, HUD.
// All text from hooks, media or files is rendered as React text (never HTML).
import { useEffect, useRef, useState } from 'react';
import { Icon, Mark } from '../common/icons';
import { relativeTime } from '../../../shared/time';
import type { Banner, BannerKind, Behavior, DiffView, Hud, IslandState, PermissionView } from '../../../shared/types';

const STILL = [0.3, 0.3, 0.3, 0.3];

/**
 * A small level meter. It steps about 6 times a second from a timer instead of
 * a 60 fps CSS animation: every frame of a transparent window costs a full
 * repaint on Windows, so this keeps idle CPU low while music plays.
 */
export function Bars({ playing }: { playing: boolean }) {
  const [levels, setLevels] = useState(STILL);
  useEffect(() => {
    if (!playing) {
      setLevels(STILL);
      return;
    }
    const t = window.setInterval(() => {
      setLevels((prev) => prev.map((v, i) => {
        const target = 0.25 + Math.random() * (i === 1 || i === 2 ? 0.75 : 0.55);
        return Math.round((v * 0.35 + target * 0.65) * 20) / 20;
      }));
    }, 160);
    return () => window.clearInterval(t);
  }, [playing]);
  return (
    <span className={`bars ${playing ? 'playing' : ''}`} aria-hidden="true">
      {levels.map((v, i) => <i key={i} style={{ transform: `scaleY(${v})` }} />)}
    </span>
  );
}

export function IdleView({ state, now }: { state: IslandState; now: number }) {
  const playing = state.media?.status === 'Playing';
  const t = state.timer;
  const timerOn = state.settings.features.timer && t.running && t.endsAt != null;
  const left = timerOn ? Math.max(0, t.endsAt! - now) : 0;
  const micOn = state.privacy.microphone.length > 0 || state.privacy.camera.length > 0;
  const trial = state.license.state === 'trial' ? `Trial · ${state.license.daysLeft}d` : state.license.state === 'expired' ? 'Trial ended' : '';
  return (
    <div className="idle">
      <Mark size={15} />
      <span className="idle-middle">
        {timerOn ? (
          <span className={`idle-chip ${t.phase}`}>
            <Icon name="timer" size={12} />
            {formatShort(left)}
          </span>
        ) : trial && !playing ? (
          <span className="idle-trial">{trial}</span>
        ) : null}
      </span>
      {state.finished.watch && <Icon name="eye" size={13} className="idle-watch" />}
      {micOn && <span className="mic-dot" title="Microphone or camera in use" />}
      {state.keepAwake && <Icon name="cup" size={13} className="idle-awake" />}
      <Bars playing={playing} />
    </div>
  );
}

function formatShort(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const BANNER_ICON: Record<BannerKind, string> = {
  done: 'check',
  input: 'question',
  info: 'info',
  warn: 'alert',
  timer: 'timer',
  battery: 'battery',
  calendar: 'calendar',
  privacy: 'mic',
  download: 'download',
  steam: 'gamepad',
  app: 'bell',
  notify: 'bell',
};

export function BannerView({ banner, now }: { banner: Banner; now: number }) {
  return (
    <div
      className={`banner ${banner.clickable ? 'clickable' : ''}`}
      onClick={banner.clickable ? () => window.helo.bannerClick() : undefined}
      title={banner.clickable ? (banner.jump ? 'Click to go to its window' : banner.kind === 'input' ? 'Click to dismiss' : 'Click to open') : undefined}
    >
      <span className={`app-icon kind-${banner.kind}`}>
        <Icon name={BANNER_ICON[banner.kind]} size={17} />
      </span>
      <span className="banner-lines">
        <span className="banner-title">{banner.title}</span>
        {banner.text && <span className="banner-text">{banner.text}</span>}
      </span>
      <span className="banner-time">{relativeTime(banner.at ?? now, now)}</span>
    </div>
  );
}

/** How long a card ignores clicks after it appears or changes, so a click meant for the app underneath cannot answer it. */
const ARM_MS = 500;

/** Wraps click handlers so they do nothing until the card (or this step of it) has been on screen for ARM_MS. */
function useArmed(key: string): <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => void {
  const shownAt = useRef({ key, at: Date.now() });
  if (shownAt.current.key !== key) shownAt.current = { key, at: Date.now() };
  return (fn) => (...args) => {
    if (Date.now() - shownAt.current.at >= ARM_MS) fn(...args);
  };
}

const AGENT_NAME = { claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini CLI', cursor: 'Cursor' } as const;

function CardHead({ request, more, label }: { request: PermissionView; more: number; label: string }) {
  return (
    <div className="card-head">
      <span className={`app-icon small agent-${request.agent}`}>
        <Icon name="agents" size={14} />
      </span>
      <span className="card-agent">{AGENT_NAME[request.agent]}</span>
      <span className="card-tool">{label}</span>
      {request.project && <span className="card-project">{request.project}</span>}
      {more > 0 && <span className="card-more">+{more} more</span>}
    </div>
  );
}

const DIFF_SIGN = { add: '+', del: '−', same: ' ' } as const;

function DiffBox({ diff }: { diff: DiffView }) {
  return (
    <div className="diff">
      <div className="diff-head">
        <span className="diff-file">{diff.file}</span>
        {diff.added > 0 && <span className="diff-added">+{diff.added}</span>}
        {diff.removed > 0 && <span className="diff-removed">−{diff.removed}</span>}
      </div>
      <div className="diff-lines">
        {diff.lines.map((l, i) => (
          <div key={i} className={`diff-line ${l.kind}`}>
            <span className="diff-sign">{DIFF_SIGN[l.kind]}</span>
            <span className="diff-text">{l.text || ' '}</span>
          </div>
        ))}
        {diff.more > 0 && <div className="diff-more">{diff.more} more changed {diff.more === 1 ? 'line' : 'lines'}</div>}
      </div>
    </div>
  );
}

/** The longest answer or feedback a card accepts (the main process cuts at the same length). */
const MAX_TYPED = 2000;

/**
 * A text field on a card. The island never takes the keyboard by itself: it does while this
 * field is on screen (the user clicked to get it), and gives it back when the field goes.
 * Enter sends, Shift+Enter is a new line, Esc cancels.
 */
function TypeBox({ value, onChange, onSend, onCancel, placeholder }: { value: string; onChange: (v: string) => void; onSend: () => void; onCancel: () => void; placeholder: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    window.helo.typing(true);
    ref.current?.focus();
    return () => window.helo.typing(false);
  }, []);
  return (
    <textarea
      ref={ref}
      className="card-type"
      rows={2}
      maxLength={MAX_TYPED}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      // A click after the keyboard went elsewhere brings it back.
      onMouseDown={() => window.helo.typing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          if (value.trim()) onSend();
        }
      }}
    />
  );
}

/** One question at a time; the answers go back to Claude Code when the last one is picked. */
function QuestionCard({ request, more }: { request: PermissionView; more: number }) {
  const questions = request.questions ?? [];
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<string[][]>(() => questions.map(() => []));
  const [typed, setTyped] = useState<string[]>(() => questions.map(() => ''));
  const [writing, setWriting] = useState(false);
  const q = questions[Math.min(step, questions.length - 1)];
  const last = step >= questions.length - 1;
  const chosen = picks[step] ?? [];
  const own = (typed[step] ?? '').trim();
  const armed = useArmed(`${request.id}:${step}`);

  const goTo = (n: number) => {
    setStep(n);
    setWriting(Boolean(typed[n]));
  };
  const advance = (next: string[][], text: string[] = typed) => {
    if (last) window.helo.answer(request.id, next, text);
    else goTo(step + 1);
  };
  const pick = (label: string) => {
    const next = picks.map((p, i) => (i !== step ? p : q.multi ? (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]) : [label]));
    setPicks(next);
    if (q.multi) return;
    // Picking an option on a pick-one question drops anything typed for it.
    const text = typed.map((t, i) => (i === step ? '' : t));
    setTyped(text);
    advance(next, text);
  };
  const stopWriting = () => {
    setTyped(typed.map((t, i) => (i === step ? '' : t)));
    setWriting(false);
  };

  return (
    <div className="card">
      <CardHead request={request} more={more} label={questions.length > 1 ? `Question ${step + 1} of ${questions.length}` : 'Question'} />
      <div className="question">
        {q.header && <span className="question-header">{q.header}</span>}
        <span className="question-text">{q.question}</span>
        {q.multi && <span className="question-hint">Pick one or more</span>}
      </div>
      <div className="options">
        {q.options.map((o) => (
          <button
            key={o.label}
            type="button"
            className={`option ${chosen.includes(o.label) ? 'on' : ''}`}
            aria-pressed={chosen.includes(o.label)}
            onClick={armed(() => pick(o.label))}
          >
            <span className="option-label">{o.label}</span>
            {o.description && <span className="option-text">{o.description}</span>}
          </button>
        ))}
      </div>
      {writing && (
        <TypeBox
          value={typed[step] ?? ''}
          onChange={(v) => setTyped(typed.map((t, i) => (i === step ? v : t)))}
          onSend={() => advance(picks)}
          onCancel={stopWriting}
          placeholder={q.multi ? 'Add your own answer. Enter sends, Esc cancels.' : 'Your own answer. Enter sends, Esc cancels.'}
        />
      )}
      <div className="card-actions">
        {step > 0 && <button type="button" className="btn ghost" onClick={() => goTo(step - 1)}>Back</button>}
        <button type="button" className="btn ghost" title="Answer this question in the terminal instead" onClick={() => window.helo.skip(request.id)}>
          In terminal
        </button>
        {writing
          ? <button type="button" className="btn ghost" onClick={stopWriting}>Cancel</button>
          : <button type="button" className="btn ghost" title="Write an answer that is not in the list" onClick={armed(() => setWriting(true))}>Type an answer</button>}
        {(q.multi || writing) && (
          <button type="button" className="btn primary" disabled={!chosen.length && !own} onClick={armed(() => advance(picks))}>
            {last ? 'Send' : 'Next'}
          </button>
        )}
      </div>
    </div>
  );
}

function PlanCard({ request, more, onDecide }: { request: PermissionView; more: number; onDecide: (id: string, b: Behavior) => void }) {
  const armed = useArmed(request.id);
  const [writing, setWriting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const send = () => window.helo.decide(request.id, 'deny', feedback.trim());
  return (
    <div className="card">
      <CardHead request={request} more={more} label="Plan" />
      <div className="plan">{request.plan || 'The plan text was not sent. Read it in the terminal.'}</div>
      {writing && (
        <TypeBox
          value={feedback}
          onChange={setFeedback}
          onSend={send}
          onCancel={() => setWriting(false)}
          placeholder="What should change? Enter sends, Esc cancels."
        />
      )}
      {writing ? (
        <div className="card-actions">
          <button type="button" className="btn ghost" onClick={() => setWriting(false)}>Cancel</button>
          <button type="button" className="btn primary" disabled={!feedback.trim()} title="Rejects the plan and tells Claude what to change" onClick={armed(send)}>
            Send feedback
          </button>
        </div>
      ) : (
        <div className="card-actions">
          <button type="button" className="btn" title="Claude keeps planning and asks what to change" onClick={armed(() => onDecide(request.id, 'deny'))}>
            Reject <kbd>Alt Shift N</kbd>
          </button>
          <button type="button" className="btn ghost narrow" title="Reject the plan and say what should change" onClick={armed(() => setWriting(true))}>
            Feedback
          </button>
          <button type="button" className="btn ghost narrow" title="Choose in the terminal" onClick={() => window.helo.skip(request.id)}>
            In terminal
          </button>
          <button type="button" className="btn primary" onClick={armed(() => onDecide(request.id, 'allow'))}>
            Approve <kbd>Alt Shift Y</kbd>
          </button>
        </div>
      )}
    </div>
  );
}

export function CardView({ request, more, onDecide }: { request: PermissionView; more: number; onDecide: (id: string, b: Behavior) => void }) {
  if (request.kind === 'question' && request.questions?.length) return <QuestionCard key={request.id} request={request} more={more} />;
  if (request.kind === 'plan') return <PlanCard key={request.id} request={request} more={more} onDecide={onDecide} />;
  return <ToolCard key={request.id} request={request} more={more} onDecide={onDecide} />;
}

function ToolCard({ request, more, onDecide }: { request: PermissionView; more: number; onDecide: (id: string, b: Behavior) => void }) {
  const armed = useArmed(request.id);
  return (
    <div className="card">
      <CardHead request={request} more={more} label={request.tool} />
      {request.diff ? <DiffBox diff={request.diff} /> : <div className="card-summary">{request.summary || 'No details'}</div>}
      {request.summaryCut && !request.diff && <div className="card-cut">This is longer than the card can show. Read the rest in the terminal before you allow it.</div>}
      <div className="card-actions">
        <button type="button" className="btn" onClick={armed(() => onDecide(request.id, 'deny'))}>
          Deny <kbd>Alt Shift N</kbd>
        </button>
        {request.always && (
          <button type="button" className="btn ghost" title={`Allow and add the rule ${request.always}`} onClick={armed(() => onDecide(request.id, 'always'))}>
            Always allow
          </button>
        )}
        <button type="button" className="btn primary" onClick={armed(() => onDecide(request.id, 'allow'))}>
          Allow {!request.summaryCut && <kbd>Alt Shift Y</kbd>}
        </button>
      </div>
    </div>
  );
}

export function HudView({ hud }: { hud: Hud }) {
  const icon = hud.kind === 'brightness' ? 'sun' : hud.muted || hud.level === 0 ? 'mute' : 'speaker';
  return (
    <div className="hud">
      <Icon name={icon} size={16} />
      <span className="hud-track">
        <span className="hud-fill" style={{ width: `${hud.muted ? 0 : hud.level}%` }} />
      </span>
      <span className="hud-value">{hud.muted ? 'Muted' : `${hud.level}`}</span>
    </div>
  );
}
