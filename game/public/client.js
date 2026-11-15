const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');

const SPEED = 240; // pixels per second
const BUBBLE_MS = 5000;

const room = (new URLSearchParams(location.search).get('room') || 'lobby').toLowerCase();
$('room-line').textContent = `Room: ${room}. Share the invite link to bring friends.`;
$('name').value = localStorage.getItem('plaza-name') || '';

let ws = null;
let myId = null;
let area = null;
let areas = {};
let doorSent = false;
const players = new Map(); // id -> { name, body, skin, x, y, tx, ty, bubble, bubbleUntil }

function addPlayer(p) {
  players.set(p.id, { ...p, tx: p.x, ty: p.y, bubble: '', bubbleUntil: 0 });
}

function setStatus() {
  $('status').textContent = area ? `${areas[area].name} · ${players.size} here` : '';
}

const onMessage = {
  welcome(msg) {
    myId = msg.id;
    area = msg.area;
    areas = msg.areas;
    doorSent = false;
    players.clear();
    addPlayer(msg.you);
    msg.players.forEach(addPlayer);
  },
  add(msg) { addPlayer(msg.player); },
  remove(msg) { players.delete(msg.id); },
  move(msg) {
    const p = players.get(msg.id);
    if (p) { p.tx = msg.x; p.ty = msg.y; }
  },
  chat(msg) {
    const p = players.get(msg.id);
    if (p) { p.bubble = msg.text; p.bubbleUntil = performance.now() + BUBBLE_MS; }
  },
  full() { alert('This room is full. Try another room.'); },
};

function connect(profile) {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'join', room, ...profile })));
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (onMessage[msg.t]) onMessage[msg.t](msg);
    setStatus();
  });
  ws.addEventListener('close', () => { $('status').textContent = 'Disconnected. Reload to rejoin.'; });
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

$('join').addEventListener('submit', (event) => {
  event.preventDefault();
  localStorage.setItem('plaza-name', $('name').value);
  $('join').hidden = true;
  $('game').hidden = false;
  connect({ name: $('name').value, body: $('body-color').value, skin: $('skin-color').value });
  requestAnimationFrame(frame);
});

canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.round((event.clientX - rect.left) * (canvas.width / rect.width));
  const y = Math.round((event.clientY - rect.top) * (canvas.height / rect.height));
  doorSent = false;
  send({ t: 'move', x, y });
});

$('chat-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const text = $('chat').value.trim();
  if (text) send({ t: 'chat', text });
  $('chat').value = '';
});

$('invite').addEventListener('click', async () => {
  await navigator.clipboard.writeText(`${location.origin}/?room=${room}`);
  $('invite').textContent = 'Copied!';
  setTimeout(() => { $('invite').textContent = 'Copy invite link'; }, 1500);
});

function step(dt) {
  for (const p of players.values()) {
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const dist = Math.hypot(dx, dy);
    const travel = SPEED * dt;
    if (dist <= travel) { p.x = p.tx; p.y = p.ty; } else { p.x += (dx / dist) * travel; p.y += (dy / dist) * travel; }
  }
  // Walking into a doorway and stopping there takes you to the next area.
  const me = players.get(myId);
  if (!me || doorSent || me.x !== me.tx || me.y !== me.ty) return;
  const index = areas[area].doors.findIndex((d) => me.x >= d.x && me.x <= d.x + d.w && me.y >= d.y && me.y <= d.y + d.h);
  if (index >= 0) {
    doorSent = true;
    send({ t: 'door', index });
  }
}

function drawArea() {
  const a = areas[area];
  ctx.fillStyle = a.floor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(0, 0, canvas.width, 44);
  ctx.fillStyle = '#fff';
  ctx.font = '600 18px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(a.name, 16, 29);
  for (const d of a.doors) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = '#fff';
    ctx.font = '13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`→ ${d.label}`, d.x + d.w / 2, d.y - 8);
  }
}

function drawPlayer(p, now) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 2, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.body;
  ctx.beginPath();
  ctx.roundRect(p.x - 12, p.y - 34, 24, 34, 8);
  ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 44, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '13px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = p.id === myId ? '#ffe27a' : '#fff';
  ctx.fillText(p.name, p.x, p.y + 20);

  if (now < p.bubbleUntil) {
    const text = p.bubble.length > 60 ? `${p.bubble.slice(0, 59)}…` : p.bubble;
    const width = Math.min(ctx.measureText(text).width + 18, 420);
    const left = Math.min(Math.max(p.x - width / 2, 6), canvas.width - width - 6);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(left, p.y - 92, width, 26, 10);
    ctx.fill();
    ctx.fillStyle = '#14161c';
    ctx.fillText(text, left + width / 2, p.y - 74, width - 12);
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (area) {
    step(dt);
    drawArea();
    [...players.values()].sort((a, b) => a.y - b.y).forEach((p) => drawPlayer(p, now));
  }
  requestAnimationFrame(frame);
}
