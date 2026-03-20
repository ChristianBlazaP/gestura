require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const WebSocket = require("ws");
const db = require("./db");

const app = express();
const server = http.createServer(app);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const corsOptions = {
  origin: FRONTEND_ORIGIN.split(","),
  credentials: true,
};

// =========================
// CORE MIDDLEWARE
// =========================
app.use(cors(corsOptions));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.options("*", cors(corsOptions));

// =========================
// SIMPLE ROOM STORAGE
// =========================
const rooms = {}; // { ROOMID: { users: [] } }
const wsRooms = new Map(); // { ROOMID: Set<WebSocket> }

// =========================
// REST API ROUTES
// =========================
const authRoutes = require("./routes/authRoutes");
const guardianRoutes = require("./routes/guardianRoutes");
const telemetryRoutes = require("./routes/telemetryRoutes");
const datasetRoutes = require("./routes/datasetRoutes");
const profileRoutes = require("./routes/profile");
const friendsRoutes = require("./routes/friends");
const meetingRoutes = require("./routes/meet");
const learningRoutes = require("./routes/learningRoutes");
const usersRoutes = require("./routes/users");
const feedbackRoutes = require("./routes/feedback");
const predictRoutes = require("./routes/predict");
const adminRoutes = require("./routes/adminRoutes");
const recordingRoutes = require("./routes/recordings");

// Simple in-memory room state for WebRTC signaling (socket.io)
const socketRooms = {};

app.use("/auth", authRoutes);
app.use("/api/guardian", guardianRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/dataset", datasetRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/meet", meetingRoutes);
app.use("/api/learning", learningRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/predict", predictRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/recordings", recordingRoutes);

// =========================
// CREATE ROOM ENDPOINT
// =========================
app.get("/create-room", (req, res) => {
  let roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  while (rooms[roomCode]) {
    roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  rooms[roomCode] = { users: [] };

  console.log("Room created:", roomCode);
  res.json({ room: roomCode });
});

// =========================
// ROOM LANDING URL (OPTIONAL)
// allows link: /meet/PASAY12
// =========================
app.get("/meet/:roomId", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =========================
// WEBRTC SIGNALING (Socket.IO)
// =========================
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Join a room
  socket.on("join-room", (roomCode) => {
    socket.join(roomCode);

    if (!socketRooms[roomCode]) {
      socketRooms[roomCode] = new Set();
    }
    socketRooms[roomCode].add(socket.id);

    console.log(`User ${socket.id} joined room ${roomCode}`);

    socket.to(roomCode).emit("user-joined", socket.id);
  });

  // WebRTC signaling packets
  socket.on("signal", (data) => {
    socket.to(data.room).emit("signal", {
      from: socket.id,
      signal: data.signal,
    });
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    // remove from rooms
    Object.keys(socketRooms).forEach((room) => {
      if (socketRooms[room].has(socket.id)) {
        socketRooms[room].delete(socket.id);
        socket.to(room).emit("user-left", socket.id);
        if (socketRooms[room].size === 0) {
          delete socketRooms[room];
        }
      }
    });
  });
});

// =========================
// LIGHTWEIGHT WS SIGNALING (browser WebSocket)
// =========================
const wss = new WebSocket.Server({ server, path: "/ws" });

function broadcastRoom(roomCode, sender, payload) {
  const peers = wsRooms.get(roomCode);
  if (!peers) return;
  const data = JSON.stringify(payload);
  peers.forEach((peer) => {
    if (peer !== sender && peer.readyState === WebSocket.OPEN) {
      peer.send(data);
    }
  });
}

wss.on("connection", (socket, req) => {
  const params = new URLSearchParams((req.url || "").split("?")[1] || "");
  const roomCode = (params.get("room") || "").toUpperCase();

  if (!roomCode) {
    socket.close(1008, "Room code required");
    return;
  }

  if (!wsRooms.has(roomCode)) wsRooms.set(roomCode, new Set());
  const peers = wsRooms.get(roomCode);
  peers.add(socket);

  socket.send(JSON.stringify({ type: "room-info", peers: peers.size - 1 }));
  broadcastRoom(roomCode, socket, { type: "peer-joined" });

  socket.on("message", (data) => {
    try {
      const payload = JSON.parse(data.toString());
      if (!payload.type) return;
      // relay signaling + chat
      if (
        payload.type === "offer" ||
        payload.type === "answer" ||
        payload.type === "ice-candidate" ||
        payload.type === "chat" ||
        payload.type === "live-label" ||
        payload.type === "confirmed-letter" ||
        payload.type === "letters" ||
        payload.type === "clear-letters"
      ) {
        broadcastRoom(roomCode, socket, payload);
      }
    } catch (err) {
      console.error("WS message error:", err);
    }
  });

  socket.on("close", () => {
    const set = wsRooms.get(roomCode);
    if (!set) return;
    set.delete(socket);
    broadcastRoom(roomCode, socket, { type: "peer-left" });
    if (set.size === 0) wsRooms.delete(roomCode);
  });
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Backend API + signaling running on port ${PORT}`);
});
