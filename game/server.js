// Plaza: a small 2D hangout world. One process serves the page and the
// WebSocket. Players join a room by code (the invite link), walk around,
// chat, and move between areas through doors.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer } = require('ws');

const WORLD = { width: 960, height: 540 };
const MAX_PLAYERS_PER_ROOM = 30;
const CHAT_MAX = 200;
const CHAT_GAP_MS = 500;

// Each door leads to another area and says where the player arrives there.
const AREAS = {
  plaza: {
    name: 'Plaza',
    floor: '#2f6f4f',
    spawn: { x: 480, y: 300 },
    doors: [{ x: 880, y: 220, w: 60, h: 100, to: 'cafe', label: 'Café', arrive: { x: 130, y: 270 } }],
  },
  cafe: {
    name: 'Café',
    floor: '#6b4a3a',
    spawn: { x: 480, y: 300 },
    doors: [{ x: 20, y: 220, w: 60, h: 100, to: 'plaza', label: 'Plaza', arrive: { x: 830, y: 270 } }],
  },
};

const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/client.js': ['client.js', 'text/javascript; charset=utf-8'],
};

function cleanName(raw) {
  const name = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16);
  return name || 'Guest';
}

function cleanColor(raw, fallback) {
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : fallback;
}

function cleanRoom(raw) {
  const room = String(raw ?? '').toLowerCase();
  return /^[a-z0-9]{1,12}$/.test(room) ? room : 'lobby';
}

function clamp(n, min, max) {
  return Math.min(Math.max(Number(n) || 0, min), max);
}

function inside(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function createServer() {
  const rooms = new Map(); // room code -> Map(id -> player)
  let nextId = 1;

  const server = http.createServer((req, res) => {
    const entry = FILES[new URL(req.url, 'http://x').pathname];
    if (req.method !== 'GET' || !entry) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-cache' });
    fs.createReadStream(path.join(__dirname, 'public', entry[0])).pipe(res);
  });

  const wss = new WebSocketServer({ server, maxPayload: 2048 });

  const publicView = (p) => ({ id: p.id, name: p.name, body: p.body, skin: p.skin, x: p.x, y: p.y });
  const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };

  function broadcast(player, msg, includeSelf = false) {
    for (const other of rooms.get(player.room).values()) {
      if (other.area !== player.area) continue;
      if (other === player && !includeSelf) continue;
      send(other.ws, msg);
    }
  }

  // Tells the player what is in their area, and tells that area they arrived.
  function enterArea(player) {
    const others = [...rooms.get(player.room).values()]
      .filter((p) => p !== player && p.area === player.area)
      .map(publicView);
    send(player.ws, { t: 'welcome', id: player.id, room: player.room, world: WORLD, area: player.area, areas: AREAS, you: publicView(player), players: others });
    broadcast(player, { t: 'add', player: publicView(player) });
  }

  const handlers = {
    move(player, msg) {
      player.x = clamp(msg.x, 20, WORLD.width - 20);
      player.y = clamp(msg.y, 60, WORLD.height - 20);
      // The mover gets it too: the server's clamped position is the one everyone uses.
      broadcast(player, { t: 'move', id: player.id, x: player.x, y: player.y }, true);
    },
    chat(player, msg) {
      const now = Date.now();
      if (now - player.lastChat < CHAT_GAP_MS) return;
      const text = String(msg.text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, CHAT_MAX);
      if (!text) return;
      player.lastChat = now;
      broadcast(player, { t: 'chat', id: player.id, text }, true);
    },
    door(player, msg) {
      const door = AREAS[player.area].doors[msg.index];
      if (!door || !inside(player, door)) return; // must be standing in the doorway
      broadcast(player, { t: 'remove', id: player.id });
      player.area = door.to;
      player.x = door.arrive.x;
      player.y = door.arrive.y;
      enterArea(player);
    },
  };

  wss.on('connection', (ws) => {
    let player = null;

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;

      if (!player) {
        if (msg.t !== 'join') return;
        const room = cleanRoom(msg.room);
        if (!rooms.has(room)) rooms.set(room, new Map());
        if (rooms.get(room).size >= MAX_PLAYERS_PER_ROOM) {
          send(ws, { t: 'full' });
          ws.close();
          return;
        }
        const spawn = AREAS.plaza.spawn;
        player = {
          id: nextId++,
          ws,
          room,
          area: 'plaza',
          name: cleanName(msg.name),
          body: cleanColor(msg.body, '#4f8cff'),
          skin: cleanColor(msg.skin, '#f2c9a0'),
          x: spawn.x + Math.round((Math.random() - 0.5) * 120),
          y: spawn.y + Math.round((Math.random() - 0.5) * 80),
          lastChat: 0,
        };
        rooms.get(room).set(player.id, player);
        enterArea(player);
        return;
      }

      if (Object.hasOwn(handlers, msg.t)) handlers[msg.t](player, msg);
    });

    ws.on('close', () => {
      if (!player) return;
      broadcast(player, { t: 'remove', id: player.id });
      const members = rooms.get(player.room);
      members.delete(player.id);
      if (!members.size) rooms.delete(player.room);
    });
  });

  return {
    listen: (port) => new Promise((resolve) => server.listen(port, () => resolve(server.address().port))),
    close: () => new Promise((resolve) => {
      for (const client of wss.clients) client.terminate();
      server.close(() => resolve());
    }),
  };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port).then((p) => console.log(`Plaza is running at http://localhost:${p}`));
}

module.exports = { createServer };
