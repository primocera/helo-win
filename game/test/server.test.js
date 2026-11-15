const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { createServer } = require('../server');

// A client that queues messages so tests can await them in order.
function client(port, join) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const queue = [];
  const waiters = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (waiters.length) waiters.shift()(msg);
    else queue.push(msg);
  });
  ws.on('open', () => ws.send(JSON.stringify({ t: 'join', ...join })));
  return {
    send: (msg) => ws.send(JSON.stringify(msg)),
    next: () => (queue.length ? Promise.resolve(queue.shift()) : new Promise((r) => waiters.push(r))),
    pending: () => queue.length,
  };
}

test('players in a room see each other, move, chat and change areas', async () => {
  const server = createServer();
  const port = await server.listen(0);
  try {
    const page = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(page.status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/../server.js`)).status, 404);

    const ana = client(port, { room: 'abc', name: '  Ana\u0007  ', body: 'red' });
    const anaWelcome = await ana.next();
    assert.equal(anaWelcome.t, 'welcome');
    assert.equal(anaWelcome.you.name, 'Ana');
    assert.equal(anaWelcome.you.body, '#4f8cff'); // invalid colour falls back
    assert.equal(anaWelcome.area, 'plaza');

    const ben = client(port, { room: 'abc', name: 'Ben' });
    const benWelcome = await ben.next();
    assert.deepEqual(benWelcome.players.map((p) => p.name), ['Ana']);
    assert.equal((await ana.next()).player.name, 'Ben');

    // Someone in another room is invisible to this one.
    const zoe = client(port, { room: 'other', name: 'Zoe' });
    assert.equal((await zoe.next()).players.length, 0);

    ben.send({ t: 'move', x: 99999, y: -5 });
    assert.deepEqual(await ana.next(), { t: 'move', id: benWelcome.id, x: 940, y: 60 });
    assert.deepEqual(await ben.next(), { t: 'move', id: benWelcome.id, x: 940, y: 60 }); // the mover sees it too

    ben.send({ t: 'chat', text: '  hi\nthere  ' });
    assert.deepEqual(await ana.next(), { t: 'chat', id: benWelcome.id, text: 'hi there' });
    assert.equal((await ben.next()).t, 'chat');

    // The door only works from inside the doorway.
    ben.send({ t: 'door', index: 0 });
    ben.send({ t: 'move', x: 900, y: 260 });
    assert.equal((await ana.next()).t, 'move');
    assert.equal((await ben.next()).t, 'move');
    ben.send({ t: 'door', index: 0 });
    assert.deepEqual(await ana.next(), { t: 'remove', id: benWelcome.id });
    const cafe = await ben.next();
    assert.equal(cafe.area, 'cafe');
    assert.equal(cafe.players.length, 0);

    // Chat stays inside an area.
    await new Promise((r) => setTimeout(r, 550));
    ben.send({ t: 'chat', text: 'anyone here?' });
    assert.equal((await ben.next()).text, 'anyone here?');
    assert.equal(ana.pending(), 0);
    assert.equal(zoe.pending(), 0);
  } finally {
    await server.close();
  }
});
