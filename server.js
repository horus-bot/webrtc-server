const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// Explicit CORS policy
const allowedOrigins = [
  "http://localhost:3000",          
  "https://manjiseva-7fnr.vercel.app",
  "https://doctor-dashboard-nu.vercel.app",
];

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
  credentials: true
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("join-room", (roomKey) => {
    socket.join(roomKey);
    console.log(`User joined room: ${roomKey}`);
  });

  socket.on("offer-sent", ({ offer, roomKey }) => {
    socket.to(roomKey).emit("offer-received", offer);
  });

  socket.on("answer-sent", ({ answer, roomKey }) => {
    socket.to(roomKey).emit("answer-received", answer);
  });

  socket.on("ice-candidate-sent", ({ candidate, roomKey }) => {
    socket.to(roomKey).emit("ice-candidate-received", candidate);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Signaling server running on port ${PORT}`);
});
