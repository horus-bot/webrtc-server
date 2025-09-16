// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// Allowed origins for CORS (update with your frontends)
const allowedOrigins = [
  "http://localhost:3000",
  "https://manjiseva-7fnr.vercel.app",
  "https://doctor-dashboard-nu.vercel.app",
  "https://sih-saksham-h7v6.vercel.app",
];

// Enable CORS for Express HTTP requests
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
}));

const server = http.createServer(app);

// Initialize Socket.IO with CORS and transports
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ['websocket', 'polling'], // fallback if websocket fails
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("✅ A user connected:", socket.id);

  // Join a room
  socket.on("join-room", (roomKey) => {
    socket.join(roomKey);
    console.log(`🚪 User ${socket.id} joined room: ${roomKey}`);
  });

  // Offer sent from doctor
  socket.on("offer-sent", ({ offer, roomKey }) => {
    if (!offer || !roomKey) return;
    socket.to(roomKey).emit("offer-received", { offer });
    console.log(`📨 Offer sent to room: ${roomKey}`);
  });

  // Answer sent from patient
  socket.on("answer-sent", ({ answer, roomKey }) => {
    if (!answer || !roomKey) return;
    socket.to(roomKey).emit("answer-received", { answer });
    console.log(`📨 Answer sent to room: ${roomKey}`);
  });

  // ICE candidate sent
  socket.on("ice-candidate-sent", ({ candidate, roomKey }) => {
    if (!candidate || !roomKey) return;
    socket.to(roomKey).emit("ice-candidate-received", { candidate });
    // Optional: log ICE candidate events
    // console.log(`🧩 ICE candidate sent to room: ${roomKey}`);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

// Listen on environment port or 5000
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Signaling server running on port ${PORT}`);
});
