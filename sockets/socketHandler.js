const GameLogic = require("../controllers/gameLogic");
const helper = require("../utils/helper");

const connectedSockets = new Map();

exports.socketHandler = (io, createGameRoom, hasGameRoom, getGameRoom, deleteGameRoom, findRoomBySocketId) => {
  io.on("connection", (socket) => {
    console.log("New player connected:", socket.id);
    connectedSockets.set(socket.id, socket);

    socket.on("createRoom", async (data) => handleCreateRoom(socket, io, data, createGameRoom));
    socket.on("searchSession", async (data) => handleSearchSession(socket, io, data, hasGameRoom, getGameRoom));
    socket.on("joinGame", async (data) => handleJoinGame(socket, io, data, hasGameRoom, getGameRoom));
    socket.on("selectPlaylist", async (data) => handleSelectPlaylist(socket, io, data,  hasGameRoom, getGameRoom));
    socket.on("startGame", async (data) => handleStartGame(socket, io, data, hasGameRoom, getGameRoom));
    socket.on("getQuestion", (data) => handleGetQuestion(socket, data));
    socket.on("submitAnswer", (data) => handleSubmitAnswer(socket, io, data, hasGameRoom, getGameRoom));
    socket.on("onGameEndGetSongList", (data) => handleEndGame(socket, io, data, getGameRoom));
    socket.on("disconnect", async () => handleDisconnect(socket, io, findRoomBySocketId, deleteGameRoom));
    socket.on("hostDisconnect", async () => handleHostDisconnect(socket, io, findRoomBySocketId, deleteGameRoom));
  });
};

// Room handling functions
const handleCreateRoom = async (socket, io, data, createGameRoom) => {
  const { accessToken } = data;
  if (accessToken) {
    const roomCode = helper.generateRoomCode();
    createGameRoom(roomCode, accessToken)
    socket.join(roomCode);
    io.to(socket.id).emit("roomCreated", { roomCode });
    console.log(`Room ${roomCode} created.`);
  }
};

const handleSearchSession = async (socket, io, data, hasGameRoom, getGameRoom) => {
  const { roomCode } = data;
  if (!hasGameRoom(roomCode)) {
    io.to(socket.id).emit("roomNotFound");
    return;
  }

  const room = getGameRoom(roomCode);
  socket.join(roomCode);
  
  if (!room.isGameStarted) {
    console.log(`id ${socket.id} search session`);
    io.to(roomCode).emit("getSession", {
      userList: room.userList,
      accessToken: room.sessionAccessToken,
    });
  } else {
    io.to(roomCode).emit("gameInProgress", { roomCode });
  }
};

const handleJoinGame = async (socket, io, data, hasGameRoom, getGameRoom) => {
  const { roomCode, username, avatarDataUri } = data;
  if (!hasGameRoom(roomCode)) {
    io.to(socket.id).emit("roomNotFound");
    return;
  }

  const room = getGameRoom(roomCode);
  const matchingPlayers = room.userList.filter((player) => player.id === socket.id);

  if (matchingPlayers.length >= 0) {
    const matchUsernameIndex = room.userList.findIndex(
      (player) => player.username === username
    );

    if (matchUsernameIndex !== -1) {
      if (room.userList[matchUsernameIndex].host && !connectedSockets.has(room.userList[matchUsernameIndex].id)) {
        room.userList[matchUsernameIndex].id = socket.id;
      }
    } else {
      room.userList.push({
        id: socket.id,
        avatarDataUri: avatarDataUri,
        username: username,
        host: room.userList.length === 0,
        score: 0,
      });
    }

    io.to(roomCode).emit("getPlayer", room.userList);
    if (room.tempSelectedPlaylistId !== "") {
      io.to(roomCode).emit("onSelectedPlaylist", room.tempSelectedPlaylistId);
    }
    console.log(`Player ${username} joined room ${roomCode}`);
  }
};

const handleSelectPlaylist = async (socket, io, data, hasGameRoom, getGameRoom) => {
  const { roomCode, playlistId } = data;
  if (!hasGameRoom(roomCode)) {
    io.to(socket.id).emit("roomNotFound");
    return;
  }

  const room = getGameRoom(roomCode);
  const matchingPlayers = room.userList.filter((player) => player.id === socket.id);

  if (matchingPlayers.length >= 0) {
    const matchUsernameIndex = room.userList.findIndex(
      (player) => matchingPlayers[0] && matchingPlayers[0].username && player.username === matchingPlayers[0].username
    );

    if (matchUsernameIndex !== -1 && room.userList[matchUsernameIndex].host) {
      room.tempSelectedPlaylistId = playlistId;
      io.to(roomCode).emit("onSelectedPlaylist", room.tempSelectedPlaylistId);
      console.log(`id ${socket.id} set playlist id roomCode: ${roomCode}`, room.tempSelectedPlaylistId);
    }
  }
};

const handleStartGame = async (socket, io, data, hasGameRoom, getGameRoom) => {
  const { roomCode } = data;
  if (!hasGameRoom(roomCode)) {
    io.to(socket.id).emit("roomNotFound");
    return;
  }

  const room = getGameRoom(roomCode);
  if (!room.isGameStarted) {
    room.isGameStarted = true;
    console.log(`startGame roomCode: ${roomCode}`);
    await GameLogic.handleStartGameQuestion(roomCode);
    setTimeout(() => {
      console.log(`getQuestion on start roomCode: ${roomCode}`);
      GameLogic.handleGetQuestion(roomCode, io);
    }, 11000);
    io.to(roomCode).emit("onStartGameCountDown");
  }
};

const handleGetQuestion = (socket, data) => {
  const { roomCode } = data;
  GameLogic.handleGetQuestion(roomCode);
};

const handleSubmitAnswer = (socket, io, data, hasGameRoom, getGameRoom) => {
  const { roomCode, answer, timeRemain } = data;
  if (!hasGameRoom(roomCode)) {
    io.to(socket.id).emit("roomNotFound");
    return;
  }

  const room = getGameRoom(roomCode);
  const matchingPlayers = room.userList.filter((player) => player.id === socket.id);

  if (matchingPlayers.length >= 0) {
    const matchUsernameIndex = room.userList.findIndex(
      (player) => matchingPlayers[0] && matchingPlayers[0].username && player.username === matchingPlayers[0].username
    );

    if (matchUsernameIndex !== -1) {
      if (room.randomQuestionData[room.currentQuestion - 1].correctAnswer === answer) {
        const roundScore = Math.ceil(
          100 + ((timeRemain / room.questionTimer) * 50 * room.currentQuestion * room.roundPlayerCorrectCount) / room.userList.length
        );
        room.userList[matchUsernameIndex].score += roundScore;
        room.userList.sort((a, b) => b.score - a.score);
        room.roundPlayerCorrectCount -= 1;

        io.to(socket.id).emit("onSubmitAnswer", {
          id: room.currentQuestion,
          roundScore,
          isCorrect: true,
        });
      } else {
        io.to(socket.id).emit("onSubmitAnswer", {
          id: room.currentQuestion,
          roundScore: 0,
          isCorrect: false,
        });
      }
    }
  }
};

const handleEndGame = (socket, io, data, getGameRoom) => {
  const { roomCode } = data;
  const room = getGameRoom(roomCode);
  if (room.isGameStarted) {
    GameLogic.resetGame(roomCode, io);
  }
};

const handleDisconnect = async (socket, io, findRoomBySocketId, deleteGameRoom) => {
  console.log("Player disconnected:", socket.id);
  const roomInfo = findRoomBySocketId(socket.id);

  if (roomInfo) {
    const { roomCode, roomData } = roomInfo;
    const player = roomData.userList.find((p) => p.id === socket.id);

    if (!player.host) {
      roomData.userList = roomData.userList.filter((p) => p.id !== socket.id);
      io.to(roomCode).emit("getPlayer", roomData.userList);
      console.log(`Player ${socket.id} removed from room ${roomCode}.`);
    } else {
      if (roomData.userList.length === 0) {
        deleteGameRoom(roomCode);
        io.in(roomCode).socketsLeave(roomCode);
      }
    }
  }

  connectedSockets.delete(socket.id);
};

const handleHostDisconnect = async (socket, io, findRoomBySocketId, deleteGameRoom) => {
  const roomInfo = findRoomBySocketId(socket.id);
  if (roomInfo) {
    const { roomCode } = roomInfo;
    console.log(`Host ${socket.id} explicitly disconnected. Closing room ${roomCode}.`);
    io.to(roomCode).emit("hostDisconnected");
    deleteGameRoom(roomCode); // Remove the room
    io.in(roomCode).socketsLeave(roomCode); // Disconnect all players in the room
  }
};
