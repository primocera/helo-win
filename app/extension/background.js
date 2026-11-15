// Forwards "answering / finished" messages from the chat pages to the Helo
// app on this PC (127.0.0.1 only). Nothing is sent anywhere else.

/** A pairing code looks like "47615-<48 hex characters>": Helo's local port and a secret. */
function parsePairing(code) {
  const m = /^(\d{2,5})-([0-9a-f]{32,128})$/i.exec(String(code || '').trim());
  if (!m) return null;
  const port = Number(m[1]);
  return port > 0 && port < 65536 ? { port, token: m[2] } : null;
}

async function post(body) {
  const { pairing } = await chrome.storage.local.get('pairing');
  const pair = parsePairing(pairing);
  if (!pair) return { ok: false, error: 'Not paired yet.' };
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

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || typeof msg !== 'object') return false;
  if (msg.type === 'helo-state' && sender.tab) {
    post({ site: msg.site, state: msg.state, title: msg.title, focused: Boolean(msg.focused), id: String(sender.tab.id) });
    return false;
  }
  if (msg.type === 'helo-test') {
    post({ state: 'ping' }).then(reply);
    return true; // reply asynchronously
  }
  return false;
});
