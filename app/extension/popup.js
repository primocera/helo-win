const code = document.getElementById('code');
const status = document.getElementById('status');

function show(text, ok) {
  status.textContent = text;
  status.className = ok ? 'ok' : 'bad';
}

async function test() {
  const result = await chrome.runtime.sendMessage({ type: 'helo-test' });
  if (result && result.pairing && !code.value) code.value = result.pairing;
  if (result && result.ok) show('Connected to Helo.', true);
  else show((result && result.error) || 'Could not reach Helo.', false);
}

chrome.storage.local.get('pairing').then(({ pairing }) => {
  if (pairing) code.value = pairing;
  test();
});

document.getElementById('save').addEventListener('click', async () => {
  await chrome.storage.local.set({ pairing: code.value.trim() });
  test();
});
