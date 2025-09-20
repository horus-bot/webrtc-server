/**
 * server.js — Robust Socket.IO signaling server for WebRTC
 *
 * Features:
 * - Normalizes offer/answer shapes and emits { offer } / { answer } (consistent payload)
 * - Forwards ICE candidates as raw RTCIceCandidateInit objects (no wrapping)
 * - Join/leave room acknowledgements
 * - Defensive input validation and logging
 * - CORS configuration that works for localhost + deployed frontends
 * - pingInterval/pingTimeout tuned for idle hosts
 *
 * Usage:
 *   PORT=5000 ALLOWED_ORIGINS="http://localhost:3000,https://yourapp.vercel.app" node server.js
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

// Configuration (override via environment variables if needed)
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  
   "https://manjiseva-7fnr.vercel.app",
   "https://doctor-pwa-app-s6rs.vercel.app/",
];
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : DEFAULT_ALLOWED_ORIGINS;

const PORT = process.env.PORT || 5000;
const SOCKET_PING_INTERVAL = 25000; // ms
const SOCKET_PING_TIMEOUT = 60000; // ms

// Basic health endpoint (optional)
app.get("/", (req, res) => res.send("Signaling server OK"));

// Enable CORS for Express
app.use(
  cors({
    origin(origin, callback) {
      // allow non-browser requests (e.g. curl/postman) where origin is undefined
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS policy: Origin not allowed"), false);
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  })
);

const server = http.createServer(app);

// Initialize Socket.IO with sensible defaults & transport fallbacks
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS policy: Origin not allowed"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingInterval: SOCKET_PING_INTERVAL,
  pingTimeout: SOCKET_PING_TIMEOUT,
  maxHttpBufferSize: 1e6, // 1MB (safe default)
});

/**
 * Helper: get room size (number of sockets in the room)
 */
function getRoomSize(room) {
  const s = io.sockets.adapter.rooms.get(room);
  return s ? s.size : 0;
}

/**
 * Normalize an SDP payload
 * Accepts either:
 *   - { offer: { sdp, type } }
 *   - { sdp, type } (raw)
 * Returns the normalized object or null if invalid.
 */
function normalizeSDP(payload) {
  if (!payload) return null;
  // If payload has .sdp and .type — assume it's raw SDP object
  if (payload.sdp && payload.type) {
    return { sdp: payload.sdp, type: payload.type };
  }
  // If wrapped: { offer: { sdp, type } } or { answer: {...} }
  if (payload.offer && payload.offer.sdp && payload.offer.type) {
    return payload.offer;
  }
  if (payload.answer && payload.answer.sdp && payload.answer.type) {
    return payload.answer;
  }
  return null;
}

/**
 * Validate ICE candidate shape (lightweight)
 */
function isValidIceCandidate(candidate) {
  if (!candidate || typeof candidate !== "object") return false;
  // must at least have the 'candidate' string property
  return typeof candidate.candidate === "string";
}

/* ---------- Socket.IO handlers ---------- */
io.on("connection", (socket) => {
  console.log(`✅ socket connected: ${socket.id} (transport=${socket.conn.transport.name})`);

  // Join a room (ack callback optional)
  socket.on("join-room", (roomKey, ack) => {
    try {
      if (!roomKey || typeof roomKey !== "string") {
        if (typeof ack === "function") ack({ ok: false, message: "Invalid roomKey" });
        return;
      }
      socket.join(roomKey);
      const size = getRoomSize(roomKey);
      console.log(`🚪 ${socket.id} joined room=${roomKey} (size=${size})`);
      if (typeof ack === "function") ack({ ok: true, room: roomKey, peers: size - 1 });
    } catch (err) {
      console.error("Error in join-room:", err);
      if (typeof ack === "function") ack({ ok: false, message: "Server error" });
    }
  });

  // Leave a room explicitly
  socket.on("leave-room", (roomKey, ack) => {
    try {
      socket.leave(roomKey);
      const size = getRoomSize(roomKey);
      console.log(`⬅️ ${socket.id} left room=${roomKey} (size=${size})`);
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      console.error("Error in leave-room:", err);
      if (typeof ack === "function") ack({ ok: false, message: "Server error" });
    }
  });

  // Doctor -> Offer
  socket.on("offer-sent", (payload) => {
    try {
      const { roomKey } = payload || {};
      const sdp = normalizeSDP(payload);
      if (!sdp || !roomKey) {
        console.warn("offer-sent: invalid payload", payload);
        return;
      }

      // Relay a normalized, consistent object so clients can rely on { offer }
      socket.to(roomKey).emit("offer-received", { offer: sdp });
      console.log(`📨 offer relayed from ${socket.id} to room=${roomKey}`);
    } catch (err) {
      console.error("Error relaying offer:", err);
    }
  });

  // Patient -> Answer
  socket.on("answer-sent", (payload) => {
    try {
      const { roomKey } = payload || {};
      const sdp = normalizeSDP(payload);
      if (!sdp || !roomKey) {
        console.warn("answer-sent: invalid payload", payload);
        return;
      }

      socket.to(roomKey).emit("answer-received", { answer: sdp });
      console.log(`📨 answer relayed from ${socket.id} to room=${roomKey}`);
    } catch (err) {
      console.error("Error relaying answer:", err);
    }
  });

  // ICE candidate forwarding — IMPORTANT: forward as raw RTCIceCandidateInit object (do NOT double-wrap)
  socket.on("ice-candidate-sent", (payload) => {
    try {
      const { candidate, roomKey } = payload || {};
      // Accept the candidate whether it's passed directly (payload has candidate) or nested
      const incoming = candidate ?? payload; // if client emitted the candidate directly, payload may be candidate object
      if (!roomKey || !isValidIceCandidate(incoming)) {
        console.warn("ice-candidate-sent: invalid payload", payload);
        return;
      }

      // Forward the candidate object unchanged
      socket.to(roomKey).emit("ice-candidate-received", incoming);
      // (no console spam for every candidate, but minimal trace)
      // console.log(`🧩 ICE candidate relayed to ${roomKey}`);
    } catch (err) {
      console.error("Error relaying ICE candidate:", err);
    }
  });

  // Optional: ping/pong or custom health event
  socket.on("ping-server", (cb) => {
    if (typeof cb === "function") cb({ ok: true, time: Date.now() });
  });

  // Handle disconnect
  socket.on("disconnect", (reason) => {
    console.log(`❌ socket disconnected: ${socket.id} (${reason})`);
    // optionally: broadcast to rooms that this socket left (application-specific)
  });
});

/* ---------- Start server ---------- */
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Signaling server listening on port ${PORT}`);
  console.log("Allowed origins:", allowedOrigins.join(", "));
});
