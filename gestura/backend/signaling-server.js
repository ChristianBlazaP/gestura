const WebSocket = require("ws");
const PORT = process.env.PORT || 3001;

const wss = new WebSocket.Server({ port: PORT });

console.log(`✅ Signaling server running on port ${PORT}`);

const rooms = {};

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://localhost`);
  const roomId = url.searchParams.get("room") || "default";

  if (!rooms[roomId]) rooms[roomId] = [];
  rooms[roomId].push(ws);

  console.log(`🔌 New client in room: ${roomId}`);

  ws.on("message", (data) => {
    rooms[roomId].forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data.toString());
      }
    });
  });

  ws.on("close", () => {
    rooms[roomId] = rooms[roomId].filter((c) => c !== ws);
    console.log(`❌ Client left room: ${roomId}`);
  });
});
