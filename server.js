const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const config = require("./config");
const spotifyRoutes = require("./routes/spotifyRoutes");
const socket = require("./sockets/socketHandler");
const { createGameRoom, hasGameRoom, getGameRoom, deleteGameRoom, findRoomBySocketId } = require('./models/gameRoom');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: config.constant.ORIGIN_DOMAIN,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

// Middleware
app.use(
  cors({
    origin: config.constant.ORIGIN_DOMAIN,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Routes
app.use("/", spotifyRoutes);

// Socket.IO Connection

socket.socketHandler(io, createGameRoom, hasGameRoom, getGameRoom, deleteGameRoom, findRoomBySocketId);

server.listen(config.constant.PORT, () => {
  console.log(`Server is running on port ${config.constant.PORT}`);
});
