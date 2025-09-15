// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://your-frontend-url.vercel.app"], 
    methods: ["GET", "POST"]
  }
});

// socket.io events
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("join-room", (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });

  socket.on("offer-sent", (offer, room) => {
    socket.to(room).emit("offer-received", offer);
  });

  socket.on("answer-sent", (answer, room) => {
    socket.to(room).emit("answer-received", answer);
  });

  socket.on("ice-candidate-sent", (candidate, room) => {
    socket.to(room).emit("ice-candidate-received", candidate);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server running on port ${PORT}`);
});
