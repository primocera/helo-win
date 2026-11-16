import { useEffect, useState, type ReactNode } from 'react';
import { Icon, Mark } from '../common/icons';
import { MASCOT_NAME } from '../../../shared/brand';
import type { AgentName, FeatureFlags, SettingsInfo, StartupApp } from '../../../shared/types';

type Section = 'general' | 'features' | 'startup' | 'agents' | 'license';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: 'settings' },
  { id: 'features', label: 'Features', icon: 'system' },
  { id: 'startup', label: 'Startup apps', icon: 'bolt' },
  { id: 'agents', label: 'AI agents', icon: 'agents' },
  { id: 'license', label: 'License', icon: 'lock' },
];

type Patch = Record<string, unknown>;

export function SettingsApp() {
  const [info, setInfo] = useState<SettingsInfo | null>(null);
  const [section, setSection] = useState<Section>('general');

  useEffect(() => {
    window.helo.settingsInfo().then(setInfo);
    return window.helo.onSettingsSection((s) => {
      if (SECTIONS.some((x) => x.id === s)) setSection(s as Section);
      window.helo.settingsInfo().then(setInfo);
    });
  }, []);

  useEffect(() => {
    if (info) document.title = `${info.appName} Settings`;
  }, [info]);

  if (!info) return null;
  const update = async (patch: Patch) => setInfo(await window.helo.updateSettings(patch));

  return (
    <div className="settings">
      <nav className="nav">
        <div className="brand">
          <Mark size={22} />
          <span>{info.appName}</span>
        </div>
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" className={`nav-item ${section === s.id ? 'active' : ''}`} onClick={() => setSection(s.id)}>
            <Icon name={s.icon} size={16} />
            {s.label}
          </button>
        ))}
        <div className="nav-foot">Version {info.version}</div>
      </nav>
      <main className="content">
        {section === 'general' && <General info={info} update={update} setInfo={setInfo} />}
        {section === 'features' && <Features info={info} update={update} />}
        {section === 'startup' && <StartupApps />}
        {section === 'agents' && <Agents info={info} update={update} setInfo={setInfo} />}
        {section === 'license' && <License info={info} setInfo={setInfo} />}
      </main>
    </div>
  );
}

function Group({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="group">
      <h2>{title}</h2>
      <div className="group-box">{children}</div>
      {note && <p className="group-note">{note}</p>}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="row">
      <div className="row-text">
        <div className="row-label">{label}</div>
        {hint && <div className="row-hint">{hint}</div>}
      </div>
      {children && <div className="row-control">{children}</div>}
    </div>
  );
}

function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

function NumberField({ value, min, max, onChange, suffix, label }: { value: number; min: number; max: number; onChange: (n: number) => void; suffix?: string; label: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
    else setText(String(value));
  };
  return (
    <span className="number">
      <input aria-label={label} inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
      {suffix && <span>{suffix}</span>}
    </span>
  );
}

/** A 0-100 slider that saves when the user lets go. */
function VolumeSlider({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      type="range"
      className="slider"
      min={0}
      max={100}
      step={5}
      value={v}
      aria-label="Sound volume"
      onChange={(e) => setV(Number(e.target.value))}
      onPointerUp={() => onCommit(v)}
      onKeyUp={() => onCommit(v)}
    />
  );
}

// ---- Startup apps --------------------------------------------------------------

function StartupApps() {
  const [apps, setApps] = useState<StartupApp[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    window.helo.listStartupApps().then(setApps, (err: Error) => {
      setApps([]);
      setError(`Could not read the startup list: ${err.message}`);
    });
  }, []);

  const toggle = async (app: StartupApp, on: boolean) => {
    setBusy(app.id);
    const result = await window.helo.setStartupApp(app.id, on);
    setApps(result.apps);
    setError(result.ok ? '' : result.error || 'That did not work.');
    setBusy('');
  };

  const mine = (apps ?? []).filter((a) => a.canChange);
  const everyone = (apps ?? []).filter((a) => !a.canChange);
  const row = (app: StartupApp) => (
    <div className="row" key={app.id}>
      {app.icon ? <img className="app-icon" src={app.icon} alt="" /> : <span className="app-icon blank" />}
      <div className="row-text">
        <div className="row-label">{app.name}</div>
        <div className="row-hint clip" title={app.detail}>{app.detail}</div>
      </div>
      <div className="row-control">
        <Switch label={`Start ${app.name} with Windows`} on={app.enabled} disabled={!app.canChange || busy === app.id} onChange={(v) => toggle(app, v)} />
      </div>
    </div>
  );

  return (
    <>
      <h1>Startup apps</h1>
      {error && <p className="agent-note">{error}</p>}
      {apps === null && <p className="row-hint">Reading the startup list…</p>}
      {apps !== null && (
        <Group title="Start when you sign in" note="Switching an app off keeps it installed; it just no longer opens by itself. Changes apply the next time you sign in.">
          {mine.length ? mine.map(row) : <Row label="No startup apps" hint="Nothing is set to open when you sign in." />}
        </Group>
      )}
      {everyone.length > 0 && (
        <Group title="Set for every user of this PC" note="These need administrator rights. Change them in Task Manager → Startup apps.">
          {everyone.map(row)}
        </Group>
      )}
    </>
  );
}

// ---- General -------------------------------------------------------------------

function General({ info, update, setInfo }: { info: SettingsInfo; update: (p: Patch) => void; setInfo: (i: SettingsInfo) => void }) {
  const d = info.settings.display;
  const [copyNote, setCopyNote] = useState('');
  const copyDiagnostics = async () => {
    const r = await window.helo.copyDiagnostics();
    setCopyNote(r.ok ? 'Copied. Paste it into your message.' : `Could not copy: ${r.error ?? 'unknown error'}`);
    setTimeout(() => setCopyNote(''), 4000);
  };
  return (
    <>
      <h1>General</h1>
      <Group title="Startup">
        <Row label="Start with Windows" hint={info.canStartWithWindows ? 'Open the island when you sign in.' : 'Available in the installed app.'}>
          <Switch label="Start with Windows" on={info.startWithWindows} disabled={!info.canStartWithWindows} onChange={async (v) => setInfo(await window.helo.setStartWithWindows(v))} />
        </Row>
      </Group>
      <Group title="Placement">
        <Row label="Display" hint="Which screen the island sits on.">
          <select
            value={d.monitor === 'primary' ? 'primary' : String(d.monitor)}
            onChange={(e) => update({ display: { monitor: e.target.value === 'primary' ? 'primary' : Number(e.target.value) } })}
          >
            <option value="primary">Main display</option>
            {info.displays.map((x) => (
              <option key={x.id} value={String(x.id)}>{x.label}{x.primary ? ' · main' : ''}</option>
            ))}
          </select>
        </Row>
        <Row label="Screen edge" hint="Bottom keeps it above the taskbar.">
          <div className="segmented">
            {(['top', 'bottom'] as const).map((edge) => (
              <button key={edge} type="button" className={!d.position && d.edge === edge ? 'active' : ''} onClick={() => update({ display: { edge, position: null } })}>
                {edge === 'top' ? 'Top' : 'Bottom'}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Lock position" hint={d.position ? 'You moved the island. Pick a screen edge above to put it back.' : 'Unlocked, you can drag the island anywhere. The lock is also in the panel\'s top row.'}>
          <Switch label="Lock position" on={d.locked} onChange={(v) => update({ display: { locked: v } })} />
        </Row>
        <Row label="Accent colour" hint="The colour of the playing bars, the timer and other highlights.">
          <div className="segmented">
            {([['mint', 'Mint'], ['rose', 'Rose']] as const).map(([value, label]) => (
              <button key={value} type="button" className={d.accent === value ? 'active' : ''} onClick={() => update({ display: { accent: value } })}>
                {label}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Open the panel" hint="On click, the island no longer opens by itself when the pointer passes over it.">
          <div className="segmented">
            {([['hover', 'On hover'], ['click', 'On click']] as const).map(([value, label]) => (
              <button key={value} type="button" className={d.open === value ? 'active' : ''} onClick={() => update({ display: { open: value } })}>
                {label}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Hide in fullscreen" hint="Steps aside for games and fullscreen video. A waiting Allow/Deny request still shows.">
          <Switch label="Hide in fullscreen" on={d.hideInFullscreen} onChange={(v) => update({ display: { hideInFullscreen: v } })} />
        </Row>
        <Row label="Show only the face" hint="Hides the pill until something happens, so it stays out of the way of browser tabs. Rest the pointer on the face to open the panel.">
          <div className="segmented">
            {([['never', 'Never'], ['browsers', 'In browsers'], ['always', 'Always']] as const).map(([value, label]) => (
              <button key={value} type="button" className={d.compact === value ? 'active' : ''} onClick={() => update({ display: { compact: value } })}>
                {label}
              </button>
            ))}
          </div>
        </Row>
      </Group>
      <Group title="Scripts">
        <Row
          label={`${info.appName.toLowerCase()}:// links`}
          hint={<>Lets a script or a shortcut show a banner, start the timer, keep the screen awake, offer a file to the shelf or open a tab. For example: <code>start {info.appName.toLowerCase()}://timer/start?minutes=25</code>. A link can do those five things and nothing else, and a file is only added after you click.</>}
        >
          <Switch label="Links from scripts" on={info.settings.links.on} onChange={(v) => update({ links: { on: v } })} />
        </Row>
      </Group>
      <Group title="Help">
        <Row
          label="Diagnostics"
          hint={copyNote || 'Copies the version, what is switched on, the connection states and the last lines of the log, to paste into a message when something does not work. It holds no tokens, license keys, clipboard items or notification text.'}
        >
          <button type="button" className="button" onClick={copyDiagnostics}>Copy diagnostics</button>
          <button type="button" className="button" onClick={() => window.helo.openLogFolder()}>Show log file</button>
        </Row>
      </Group>
    </>
  );
}

// ---- Features --------------------------------------------------------------------

function FeatureRow({ info, update, k, label, hint, children }: { info: SettingsInfo; update: (p: Patch) => void; k: keyof FeatureFlags; label: string; hint: ReactNode; children?: ReactNode }) {
  const on = info.settings.features[k];
  return (
    <>
      <Row label={label} hint={hint}>
        <Switch label={label} on={on} onChange={(v) => update({ features: { [k]: v } })} />
      </Row>
      {on && children && <div className="subrows">{children}</div>}
    </>
  );
}

function Features({ info, update }: { info: SettingsInfo; update: (p: Patch) => void }) {
  const s = info.settings;
  const [ics, setIcs] = useState(s.calendar.icsUrl);
  const [calMsg, setCalMsg] = useState('');
  useEffect(() => setIcs(s.calendar.icsUrl), [s.calendar.icsUrl]);
  const p = { info, update };
  return (
    <>
      <h1>Features</h1>
      <Group title="Island">
        <FeatureRow {...p} k="mascot" label={MASCOT_NAME} hint="A small face beside the island that follows your pointer and shows what your agents are doing." />
        <FeatureRow {...p} k="hud" label="Volume HUD" hint="Show volume changes in the island (and brightness on laptops that report it)." />
      </Group>
      <Group title="Media">
        <FeatureRow {...p} k="media" label="Now Playing" hint="Title, artwork and controls for whatever Windows is playing.">
          <Row label="Show the song in the closed island" hint="The title while music plays, or the line being sung when synced lyrics are on.">
            <Switch label="Song in the closed island" on={s.display.title} onChange={(v) => update({ display: { title: v } })} />
          </Row>
        </FeatureRow>
        <FeatureRow {...p} k="lyrics" label="Synced lyrics" hint="Looks up lyrics on lrclib.net. This sends the song title and artist to that site." />
      </Group>
      <Group title="Productivity">
        <FeatureRow {...p} k="timer" label="Focus timer" hint="Focus and break sessions with a countdown in the island.">
          <Row label="Focus length"><NumberField label="Focus minutes" value={s.timer.focusMin} min={1} max={180} suffix="min" onChange={(n) => update({ timer: { focusMin: n } })} /></Row>
          <Row label="Break length"><NumberField label="Break minutes" value={s.timer.breakMin} min={1} max={60} suffix="min" onChange={(n) => update({ timer: { breakMin: n } })} /></Row>
          <Row label="Long break length"><NumberField label="Long break minutes" value={s.timer.longBreakMin} min={1} max={120} suffix="min" onChange={(n) => update({ timer: { longBreakMin: n } })} /></Row>
          <Row label="Long break after" hint="0 turns the long break off."><NumberField label="Focus sessions before a long break" value={s.timer.longEvery} min={0} max={12} suffix="sessions" onChange={(n) => update({ timer: { longEvery: n } })} /></Row>
        </FeatureRow>
        <FeatureRow {...p} k="clipboard" label="Clipboard history" hint="Keeps recent copies on this PC only, encrypted on disk. Password managers that mark their copies as private are skipped. A password copied from a web page is not marked, so pause before copying one, or remove it from the list.">
          <Row label="Pause" hint="Nothing new is saved while this is on.">
            <Switch label="Pause clipboard history" on={s.clipboard.paused} onChange={(v) => update({ clipboard: { paused: v } })} />
          </Row>
          <Row label="Forget copies after" hint="Pinned copies are kept.">
            <select value={String(s.clipboard.expireHours)} onChange={(e) => update({ clipboard: { expireHours: Number(e.target.value) } })}>
              {[[1, '1 hour'], [8, '8 hours'], [24, '1 day'], [168, '1 week'], [0, 'Never']].map(([hours, label]) => (
                <option key={hours} value={String(hours)}>{label}</option>
              ))}
              {![1, 8, 24, 168, 0].includes(s.clipboard.expireHours) && <option value={String(s.clipboard.expireHours)}>{s.clipboard.expireHours} hours</option>}
            </select>
          </Row>
          <Row label="Keep up to"><NumberField label="Clipboard items" value={s.clipboard.maxItems} min={5} max={200} suffix="items" onChange={(n) => update({ clipboard: { maxItems: n } })} /></Row>
          <Row label="Include images"><Switch label="Include images" on={s.clipboard.images} onChange={(v) => update({ clipboard: { images: v } })} /></Row>
          <Row label="Clear history" hint="Deletes all saved clips."><button type="button" className="button" onClick={() => window.helo.clipClear()}>Clear</button></Row>
        </FeatureRow>
        <FeatureRow {...p} k="notes" label="Notes" hint="A quick scratchpad, saved on this PC." />
        <FeatureRow {...p} k="shelf" label="File shelf" hint="Drop files on the island and drag them out later.">
          <Row label="Put new screenshots on the shelf"><Switch label="Add screenshots to shelf" on={s.shelf.screenshots} onChange={(v) => update({ shelf: { screenshots: v } })} /></Row>
        </FeatureRow>
        <FeatureRow {...p} k="converter" label="Image converter" hint="Convert images on the shelf between PNG, JPG and WebP." />
      </Group>
      <Group title="System">
        <FeatureRow {...p} k="keepAwake" label="Keep awake" hint="A switch in the island that stops the screen from sleeping." />
        <FeatureRow {...p} k="battery" label="Battery" hint="Plugged in, unplugged, full and low battery alerts, plus the battery level of connected Bluetooth devices that report one.">
          <Row label="Low battery at"><NumberField label="Low battery percent" value={s.battery.lowPercent} min={5} max={50} suffix="%" onChange={(n) => update({ battery: { lowPercent: n } })} /></Row>
        </FeatureRow>
        <FeatureRow {...p} k="disk" label="Low disk space" hint="Warns when the Windows drive is nearly full. Click the warning to see what is using the space.">
          <Row label="Warn below"><NumberField label="Free gigabytes" value={s.disk.lowGb} min={1} max={500} suffix="GB" onChange={(n) => update({ disk: { lowGb: n } })} /></Row>
        </FeatureRow>
        <FeatureRow {...p} k="notifications" label="Notifications from other apps" hint="Shows other apps' Windows notifications as a banner in the island. They are shown once and not saved. An app appears below after its first notification.">
          {Object.keys(s.notifications.apps).sort((a, b) => a.localeCompare(b)).map((name) => (
            <Row key={name} label={name}>
              <Switch label={`Notifications from ${name}`} on={s.notifications.apps[name]} onChange={(v) => update({ notifications: { apps: { ...s.notifications.apps, [name]: v } } })} />
            </Row>
          ))}
        </FeatureRow>
        <FeatureRow {...p} k="privacy" label="Microphone & camera indicator" hint="Shows when an app starts using the microphone or camera." />
        <FeatureRow {...p} k="displays" label="Monitor controls" hint="Brightness, contrast and input switching for external monitors that support DDC/CI." />
      </Group>
      <Group title="Finished alerts" note="Windows has no general signal for “a game finished loading”, so the app watch is an estimate based on CPU use.">
        <FeatureRow {...p} k="downloads" label="Downloads" hint="Tells you when a browser download in your Downloads folder finishes. Click the alert to show the file.">
          <Row label="Also put finished downloads on the file shelf"><Switch label="Add downloads to shelf" on={s.finished.addToShelf} onChange={(v) => update({ finished: { addToShelf: v } })} /></Row>
        </FeatureRow>
        <FeatureRow {...p} k="steam" label="Steam" hint="Tells you when a game finishes downloading or updating. Reads Steam's local files only; no login." />
        <FeatureRow {...p} k="watchApp" label="Watch an app" hint="From the island, pick an open app and get told when it closes, or when it has stopped being busy (an estimate)." />
      </Group>
      <Group title="Calendar">
        <FeatureRow {...p} k="calendar" label="Next event" hint="Upcoming events from a calendar's private iCal (.ics) address. Events with a Zoom, Meet, Teams or Webex link get a Join button and a banner a minute before.">
          <div className="ics">
            <input
              type="url"
              placeholder="https://calendar.example.com/private/basic.ics"
              value={ics}
              spellCheck={false}
              onChange={(e) => setIcs(e.target.value)}
            />
            <button
              type="button"
              className="button primary"
              onClick={async () => {
                setCalMsg('Loading…');
                await update({ calendar: { icsUrl: ics } });
                const r = await window.helo.refreshCalendar();
                setCalMsg(r.ok ? 'Calendar loaded.' : r.error || 'Could not load the calendar.');
              }}
            >
              Save
            </button>
          </div>
          <p className="row-hint pad">
            Google Calendar: Settings → your calendar → “Secret address in iCal format”. Outlook: Settings → Calendar → Shared calendars → Publish. The address is stored on this PC only.
            {calMsg && <><br /><strong>{calMsg}</strong></>}
          </p>
        </FeatureRow>
      </Group>
    </>
  );
}

// ---- Agents ----------------------------------------------------------------------

function AgentCard({ agent, title, info, setInfo, children }: { agent: AgentName; title: string; info: SettingsInfo; setInfo: (i: SettingsInfo) => void; children?: ReactNode }) {
  const st = info.agents[agent];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggle = async () => {
    setBusy(true);
    setError('');
    const r = await window.helo.connectAgent(agent, !st.connected);
    setBusy(false);
    setInfo(r.info);
    if (!r.ok) setError(r.error || 'Something went wrong.');
  };
  return (
    <div className="agent">
      <div className="agent-head">
        <span className={`agent-badge ${agent}`}><Icon name="agents" size={16} /></span>
        <div className="agent-text">
          <div className="row-label">{title}</div>
          <div className={`status ${st.connected ? 'ok' : ''}`}>{st.connected ? 'Connected' : 'Not connected'}</div>
        </div>
        <button type="button" className={`button ${st.connected ? '' : 'primary'}`} disabled={busy} onClick={toggle}>
          {st.connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
      {children}
      {(st.note || error) && <p className="agent-note">{error || st.note}</p>}
    </div>
  );
}

function Agents({ info, update, setInfo }: { info: SettingsInfo; update: (p: Patch) => void; setInfo: (i: SettingsInfo) => void }) {
  const f = info.settings.features;
  const snd = info.settings.sound;
  return (
    <>
      <h1>AI agents</h1>
      <Group title="Answer your agents from the island" note="Connecting adds hooks to the agent's own settings file (a backup is kept next to it). Disconnecting removes only the hooks this app added.">
        <Row label="Agent requests and alerts" hint="Allow/Deny cards, “needs your answer” and “finished” banners.">
          <Switch label="Agent requests" on={f.agents} onChange={(v) => update({ features: { agents: v } })} />
        </Row>
      </Group>
      <Group title="Sound">
        <Row label="Play a sound when an agent needs you" hint="Two soft notes when a card appears or an agent waits for your answer in the terminal.">
          <Switch label="Sound when an agent needs you" on={snd.on} onChange={(v) => update({ sound: { on: v } })} />
        </Row>
        {snd.on && (
          <div className="subrows">
            <Row label="Volume">
              <VolumeSlider value={snd.volume} onCommit={(n) => update({ sound: { volume: n } })} />
              <button type="button" className="button" onClick={() => window.helo.testSound()}>Play</button>
            </Row>
            <Row label="Also in fullscreen" hint="Off, a game or a fullscreen video is never interrupted by the sound. The card still shows.">
              <Switch label="Sound in fullscreen" on={snd.fullscreen} onChange={(v) => update({ sound: { fullscreen: v } })} />
            </Row>
          </div>
        )}
      </Group>
      <AgentCard agent="claude" title="Claude Code" info={info} setInfo={setInfo}>
        <p className="row-hint">Writes HTTP hooks to ~/.claude/settings.json. New Claude Code sessions pick them up.</p>
        <Row label="Usage rings" hint="5-hour and weekly limits from Claude Code's status line (Pro, Max and Ultra plans). Adds a short status line unless you already have your own.">
          <Switch label="Usage rings" on={f.usage} onChange={(v) => update({ features: { usage: v } })} />
        </Row>
        <Row label="Work map" hint="A live map in the island of what Claude Code is using: files, shell, network, memory, subagents. Adds hooks for tool calls; Helo only watches them and never holds a call up. Shows names only, never file contents.">
          <Switch label="Work map" on={f.map} onChange={(v) => update({ features: { map: v } })} />
        </Row>
      </AgentCard>
      <AgentCard agent="codex" title="Codex CLI" info={info} setInfo={setInfo}>
        <p className="row-hint">Writes command hooks to ~/.codex/hooks.json. Codex asks you to review new hooks: run /hooks in Codex once and trust them.</p>
      </AgentCard>
      <AgentCard agent="gemini" title="Gemini CLI" info={info} setInfo={setInfo}>
        <p className="row-hint">Writes command hooks to ~/.gemini/settings.json. Shows working, needs you and finished. Gemini CLI has no hook that can answer its approval prompt, so you still allow or deny in the terminal.</p>
      </AgentCard>
      <AgentCard agent="cursor" title="Cursor" info={info} setInfo={setInfo}>
        <p className="row-hint">Writes command hooks to ~/.cursor/hooks.json. Shows working and finished for Cursor's agent. Approvals stay in Cursor.</p>
      </AgentCard>
      <WebChat info={info} />
      <div className="agent muted-card">
        <div className="row-label">OpenCode</div>
        <p className="row-hint">Not supported yet. Its plugin documentation does not say whether a plugin may wait for your answer, so Allow/Deny could not be made reliable.</p>
      </div>
    </>
  );
}

function WebChat({ info }: { info: SettingsInfo }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(info.webPairingCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="agent">
      <div className="agent-head">
        <div className="agent-text">
          <div className="row-label">Claude and ChatGPT in the browser</div>
          <div className="row-hint">{MASCOT_NAME} thinks while an answer is being written, and a banner tells you when it is done if you have switched to another tab or app.</div>
        </div>
      </div>
      <ol className="steps">
        <li>In Chrome or Edge, open the Extensions page and turn on Developer mode.</li>
        <li>Choose "Load unpacked" and pick the extension folder.</li>
        <li>Click the extension's icon and paste the pairing code.</li>
      </ol>
      <div className="row">
        <div className="row-control">
          <button type="button" className="button" onClick={() => window.helo.openExtensionFolder()}>Open extension folder</button>
          <button type="button" className="button" onClick={copy}>{copied ? 'Copied' : 'Copy pairing code'}</button>
        </div>
      </div>
      <p className="row-hint">The extension talks only to this app on your PC. It sends the chat's title and whether an answer is in progress, nothing from the conversation.</p>
    </div>
  );
}

// ---- License ---------------------------------------------------------------------

function License({ info, setInfo }: { info: SettingsInfo; setInfo: (i: SettingsInfo) => void }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const status = info.license;
  const licensed = status.state === 'licensed';
  const run = async (action: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true);
    setMsg({ text: 'Contacting the license server…', ok: true });
    const r = await action();
    setBusy(false);
    setInfo(await window.helo.settingsInfo());
    setMsg(r.ok ? { text: done, ok: true } : { text: r.error || 'Something went wrong.', ok: false });
  };
  return (
    <>
      <h1>License</h1>
      <div className="license-status">
        <Mark size={36} />
        <div>
          <div className="license-title">
            {licensed ? 'Licensed. Thank you!' : status.state === 'trial' ? `Free trial: ${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'} left` : 'Your free trial has ended'}
          </div>
          <div className="row-hint">Buy once for {info.price}, no subscription. One key works on up to 3 PCs.</div>
        </div>
      </div>
      {licensed ? (
        <Group title="This PC">
          <Row label="Move your key to another PC" hint="Deactivate it here first.">
            <button type="button" className="button" disabled={busy} onClick={() => run(() => window.helo.deactivateLicense(), 'This PC was deactivated.')}>Deactivate this PC</button>
          </Row>
        </Group>
      ) : (
        <Group title="License key" note="Your license key arrives by email after you buy.">
          <div className="ics">
            <input
              className="mono"
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              spellCheck={false}
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run(() => window.helo.activateLicense(key), 'Activated.')}
            />
            <button type="button" className="button primary" disabled={busy} onClick={() => run(() => window.helo.activateLicense(key), 'Activated.')}>Activate</button>
          </div>
          <div className="pad">
            <button type="button" className="button" onClick={() => window.helo.buy()}>Buy {info.appName} · {info.price}</button>
          </div>
        </Group>
      )}
      {msg && <p className={`message ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</p>}
    </>
  );
}
