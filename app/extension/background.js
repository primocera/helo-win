// Forwards "answering / finished" messages from the chat pages to the Helo
// app on this PC (127.0.0.1 only). Nothing is sent anywhere else.

/** A pairing code looks like "47615-<48 hex characters>": Helo's local port and a secret. */
function parsePairing(code) {
  const m = /^(\d{2,5})-([0-9a-f]{32,128})$/i.exec(String(code || '').trim());
  if (!m) return null;
  const port = Number(m[1]);
  return port > 0 && port < 65536 ? { port, token: m[2] } : null;
}

// Helo listens on 47615, or on one of the next ten ports when that one is taken.
const PORTS = Array.from({ length: 11 }, (_, i) => 47615 + i);
let lastPairTry = 0;

/**
 * Asks Helo for the pairing code. Helo gives it only to an extension, and only for a few
 * minutes after "Add to Edge / Chrome" or "Connect" in its Settings.
 */
async function autoPair(force = false) {
  const now = Date.now();
  if (!force && now - lastPairTry < 3000) return null;
  lastPairTry = now;
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/helo/pair`, { signal: AbortSignal.timeout(800) });
      if (!res.ok) continue;
      const { code } = await res.json();
      if (parsePairing(code)) {
        await chrome.storage.local.set({ pairing: code });
        return code;
      }
    } catch {
      // Nothing on this port, or not Helo.
    }
  }
  return null;
}

async function send(pair, body) {
  try {
    const res = await fetch(`http://127.0.0.1:${pair.port}/helo/web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pair.token}` },
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, error: 'Helo did not accept the pairing code. Copy it again from Helo.' };
    return res.ok ? { ok: true } : { ok: false, error: `Helo answered with an error (${res.status}).` };
  } catch {
    return { ok: false, error: 'Helo is not running on this PC.' };
  }
}

async function post(body) {
  const { pairing } = await chrome.storage.local.get('pairing');
  const pair = parsePairing(pairing);
  const result = pair ? await send(pair, body) : { ok: false, error: 'Not connected yet. In Helo, open Settings, AI agents, and click Connect.' };
  if (result.ok) return result;
  // Not paired, the code is old, or Helo moved to another port: try to pair again.
  const fresh = parsePairing(await autoPair());
  return fresh ? send(fresh, body) : result;
}

// Right after it is added from the store, Helo's Settings is waiting for it: pair now, and a few more times
// in case Helo was still starting.
chrome.runtime.onInstalled.addListener(() => {
  for (const ms of [0, 5000, 15000, 30000]) {
    setTimeout(async () => {
      const { pairing } = await chrome.storage.local.get('pairing');
      if (!parsePairing(pairing)) autoPair(true);
    }, ms);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || typeof msg !== 'object') return false;
  if (msg.type === 'helo-state' && sender.tab) {
    post({ site: msg.site, state: msg.state, title: msg.title, focused: Boolean(msg.focused), id: String(sender.tab.id) });
    return false;
  }
  if (msg.type === 'helo-test') {
    post({ state: 'ping' }).then(async (result) => reply({ ...result, pairing: (await chrome.storage.local.get('pairing')).pairing || '' }));
    return true; // reply asynchronously
  }
  return false;
});
