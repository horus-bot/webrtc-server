const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// Allow all origins
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",   // <--- allow all origins
    methods: ["GET", "POST"]
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
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
