// Simple WebSocket signaling server for WebRTC
// Usage: npm run signal
// Connect clients to: ws://localhost:3001?room=<roomId>

const http = require('http');
const WebSocket = require('ws');
const url = require('url');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// roomId -> Set<WebSocket>
const rooms = new Map();

function getRoom(ws) {
  return ws.__roomId || 'default';
}

wss.on('connection', (ws, req) => {
  const { query } = url.parse(req.url, true);
  const roomId = (query.room || 'default').toString();
  ws.__roomId = roomId;

  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId).add(ws);

  ws.on('message', (data) => {
    // Relay any JSON payload to other peers in the same room
    let payload;
    try { payload = JSON.parse(data.toString()); } catch { return; }
    const peers = rooms.get(getRoom(ws)) || new Set();
    for (const peer of peers) {
      if (peer !== ws && peer.readyState === WebSocket.OPEN) {
        peer.send(JSON.stringify(payload));
      }
    }
  });

  ws.on('close', () => {
    const peers = rooms.get(getRoom(ws));
    if (peers) {
      peers.delete(ws);
      if (peers.size === 0) rooms.delete(getRoom(ws));
    }
  });
});

const PORT = process.env.SIGNAL_PORT ? Number(process.env.SIGNAL_PORT) : 3001;
server.listen(PORT, () => {
  console.log(`Signaling server listening on ws://localhost:${PORT}`);
});
