const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

io.on('connection', socket => {
  console.log('New client', socket.id);

  socket.on('join-room', room => {
    socket.join(room);
    console.log(`${socket.id} joined ${room}`);
  });

  socket.on('offer-sent', (offer, room) =>
    socket.to(room).emit('offer-received', offer)
  );

  socket.on('answer-sent', (answer, room) =>
    socket.to(room).emit('answer-received', answer)
  );

  socket.on('ice-candidate-sent', (candidate, room) =>
    socket.to(room).emit('ice-candidate-received', candidate)
  );
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Signalling server on ${PORT}`));
