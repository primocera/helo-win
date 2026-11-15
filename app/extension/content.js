// Runs on claude.ai and chatgpt.com. Watches whether an answer is being
// written and tells the background script when that starts and stops.
// It reads nothing from the conversation except the page title.

const SITE = location.hostname === 'claude.ai' ? 'claude' : 'chatgpt';
const CHECK_MS = 700;
// An answer counts as finished once nothing has been generating for this long
// (answers pause briefly between steps, e.g. while a tool runs).
const QUIET_MS = 2000;
const HEARTBEAT_MS = 20000;

/** True while the site shows its "stop" control or marks a message as streaming. */
function isGenerating() {
  if (document.querySelector('[data-is-streaming="true"]')) return true; // claude.ai
  if (document.querySelector('button[data-testid="stop-button"]')) return true; // chatgpt.com
  for (const button of document.querySelectorAll('button[aria-label]')) {
    const label = button.getAttribute('aria-label').trim().toLowerCase();
    if (label === 'stop' || /^stop (response|responding|generating|streaming|answering)/.test(label)) return true;
  }
  return false;
}

function send(state) {
  try {
    chrome.runtime.sendMessage({
      type: 'helo-state',
      site: SITE,
      state,
      title: document.title.slice(0, 120),
      focused: document.visibilityState === 'visible' && document.hasFocus(),
    }).catch(() => {});
  } catch {
    // The extension was reloaded or removed; this copy of the script can do nothing more.
    clearInterval(timer);
  }
}

let working = false;
let quietSince = 0;
let lastSent = 0;

const timer = setInterval(() => {
  const now = Date.now();
  if (isGenerating()) {
    quietSince = 0;
    if (!working || now - lastSent >= HEARTBEAT_MS) {
      working = true;
      lastSent = now;
      send('working');
    }
    return;
  }
  if (!working) return;
  if (!quietSince) {
    quietSince = now;
    return;
  }
  if (now - quietSince >= QUIET_MS) {
    working = false;
    quietSince = 0;
    send('done');
  }
}, CHECK_MS);

// Closing or leaving the page mid-answer: say so, or Helo would keep "thinking".
window.addEventListener('pagehide', () => {
  if (working) send('gone');
});
