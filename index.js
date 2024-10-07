const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const axios = require("axios");
const querystring = require("querystring");
const cors = require("cors");

require('dotenv').config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const ORIGIN_DOMAIN = process.env.ORIGIN_DOMAIN;

app.use(
  cors({
    origin: ORIGIN_DOMAIN,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

const io = socketIo(server, {
  cors: {
    origin: ORIGIN_DOMAIN,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

// Spotify credentials
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";

const connectedSockets = new Map();


// Store for all game rooms
const gameRooms = new Map();

// Helper function to generate an 8-character alphanumeric room code
const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

app.get("/auth/spotify", (req, res) => {
  const authUrl = `${SPOTIFY_AUTH_URL}?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${SPOTIFY_REDIRECT_URI}&scope=playlist-read-private%20user-read-private%20streaming`;
  res.redirect(authUrl);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const tokenResponse = await axios.post(
      SPOTIFY_TOKEN_URL,
      querystring.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        client_secret: SPOTIFY_CLIENT_SECRET,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token } = tokenResponse.data;
    res.redirect(
      `http://jojjoeeeeeee.trueddns.com:53387/?access_token=${access_token}`
    );
  } catch (error) {
    res.status(500).send("Error during authentication");
  }
});

app.get("/api/spotify/user", async (req, res) => {
  const { room_code, access_token } = req.query;
  const room = gameRooms.get(room_code);
  try {
    const response = await axios.get(`${SPOTIFY_API_URL}/me`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    console.log("fetch user:", response.data.id);
    if (room.sessionUserId === "") {
      console.log("set user id", response.data.id);
      room.sessionUserId = response.data.id;
    }
    res.json(response.data);
  } catch (error) {
    console.log("fetch user error:", error);
    res.status(500).send("Error fetching user");
  }
});

app.get("/api/spotify/playlists", async (req, res) => {
  const { room_code, access_token } = req.query;
  const room = gameRooms.get(room_code);
  try {
    console.log(
      "fetch playlist:",
      `${SPOTIFY_API_URL}/users/${room.sessionUserId}/playlists`
    );
    const response = await axios.get(
      `${SPOTIFY_API_URL}/users/${room.sessionUserId}/playlists`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).send("Error fetching playlists");
  }
});

const fetchPlaylistTracks = async (room, playlist_id) => {
  const response = await axios.get(
    `${SPOTIFY_API_URL}/playlists/${playlist_id}/tracks`,
    {
      headers: {
        Authorization: `Bearer ${room.sessionAccessToken}`,
      },
    }
  );
  return response.data.items;
};

// Handle starting a game in a specific room
const handleStartGameQuestion = async (roomCode) => {
  const room = gameRooms.get(roomCode);
  room.currentQuestion = 0;

  const itemsData = await fetchPlaylistTracks(room, room.tempSelectedPlaylistId);
  const mappedTracksData = itemsData
    .filter((item) => item.track.preview_url !== null)
    .map((item, index) => ({
      id: index,
      title: item.track.name,
      artist: item.track.artists.map((artist) => artist.name),
      audioUrl: item.track.preview_url,
      image: item.track.album.images[0].url,
    }));

  const randomQuestion = getRandomQuestions(mappedTracksData, 10);
  room.randomQuestionData = randomQuestion;
  room.onlyQuestionData = randomQuestion.map((item) => ({
    id: item.id,
    question: item.question,
    choices: item.choices,
    audioUrl: item.audioUrl,
  }));
};

const getRandomQuestions = (data, numQuestions) => {
  const shuffled = data.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numQuestions).map((song, index) => {
    const askForTitle = Math.random() < 0.5; // Randomly decide whether to ask for title or artist
    const question = askForTitle ? `Guess the artist` : `Guess the song`;

    // Create a set to ensure unique choices
    const choicesSet = new Set();

    // Add the correct answer
    choicesSet.add(askForTitle ? song.artist.join(", ") : song.title);

    // Add random choices
    while (choicesSet.size < 4) {
      const randomSong = data[Math.floor(Math.random() * data.length)];
      const choice = askForTitle
        ? randomSong.artist.join(", ")
        : randomSong.title;

      // Add only if it's unique and not the correct answer
      if (choice !== (askForTitle ? song.artist.join(", ") : song.title)) {
        choicesSet.add(choice);
      }
    }

    const choices = Array.from(choicesSet).sort(() => 0.5 - Math.random());

    return {
      id: index,
      originalId: song.id,
      title: song.title,
      artist: song.artist.join(", "),
      question: question,
      choices: choices,
      correctAnswer: askForTitle ? song.artist.join(", ") : song.title,
      audioUrl: song.audioUrl,
      imageUrl: song.image
    };
  });
};

const handleGetQuestion = async (roomCode) => {
  const room = gameRooms.get(roomCode);

  if (room.currentQuestion < room.onlyQuestionData.length) {
    try {
      console.log(`-----------------\n getQuestion roomCode: ${roomCode}`, room.onlyQuestionData[room.currentQuestion] , `\nanswer roomCode: ${roomCode}`, room.randomQuestionData[room.currentQuestion].correctAnswer, "\n -----------------")
      io.to(roomCode).emit("onGetQuestion", { trivia: room.onlyQuestionData[room.currentQuestion] });
      io.to(roomCode).emit("getPlayer", room.userList);
      room.currentQuestion += 1;
      room.roundPlayerCorrectCount = room.userList.length;

      let timer;
      clearInterval(timer);
      var seconds = room.questionTimer + room.preQuestionTimer + 1;
      timer = setInterval(() => {
        console.log(`countdown roomCode: ${roomCode}`, seconds);
        seconds -= 1;

        if (seconds === 0) {
          handleGetQuestion(roomCode);
          clearInterval(timer);
        }
      }, 1000);

      return () => clearInterval(timer);
    } catch (error) {
      console.error("Error retrieving question:", error);
    }
  } else {
    console.log(`No more questions available. roomCode: ${roomCode}`);
    const [topThree, remaining] = splitTopThree(room.userList)
    io.to(roomCode).emit("onGameEnd", {topPlayers: topThree, players: remaining});
  }
};

const splitTopThree = (sortedArray) => {
  // Ensure the input is sorted in descending order
  if (sortedArray.length === 0) {
    return [[], []]; // Return two empty arrays if the input is empty
  }

  // Extract top three elements
  const topThree = sortedArray.slice(0, 3);
  
  // Extract remaining elements
  const remaining = sortedArray.slice(3);

  return [topThree, remaining];
}

const resetGame = (roomCode) => {
  const room = gameRooms.get(roomCode);
  room.isGameStarted = false;

  io.to(roomCode).emit("onResetGame", {songList: room.randomQuestionData});

  room.randomQuestionData = [];
  room.onlyQuestionData = [];
  room.currentQuestion = 0;
  const updatedUserList = room.userList.map((user) => ({
    ...user,
    score: 0,
  }));
  
  room.userList = updatedUserList;

  setTimeout(() => {
    io.to(roomCode).emit("getPlayer", room.userList);
  }, 800);
};

// Find the room of a particular socket
const findRoomBySocketId = (socketId) => {
  for (const [roomCode, roomData] of gameRooms) {
    const player = roomData.userList.find((user) => user.id === socketId);
    if (player) {
      return { roomCode, roomData };
    }
  }
  return null;
};

io.on("connection", (socket) => {
  console.log("New player connected:", socket.id);
  connectedSockets.set(socket.id, socket);

  socket.on("createRoom", async (data) => {
    const { accessToken } = data;
    if (accessToken) {
      const roomCode = generateRoomCode();
      gameRooms.set(roomCode, {
        userList: [],
        sessionAccessToken: accessToken,
        tempSelectedPlaylistId: "",
        sessionUserId: "",
        isGameStarted: false,
        randomQuestionData: [],
        onlyQuestionData: [],
        currentQuestion: 0,
        preQuestionTimer: 5,
        questionTimer: 15,
        roundPlayerCorrectCount: 0,
      });
      socket.join(roomCode);
      io.to(socket.id).emit("roomCreated", { roomCode });
      console.log(`Room ${roomCode} created.`);
    }
  });

  socket.on("searchSession", async (data) => {
    const { roomCode } = data;
    if (!gameRooms.has(roomCode)) {
      io.to(socket.id).emit("roomNotFound");
      return;
    }

    const room = gameRooms.get(roomCode);

    socket.join(roomCode);
    if (!room.isGameStarted) {
      console.log(`id ${socket.id} search session`);
      io.to(roomCode).emit("getSession", {
        userList: room.userList,
        accessToken: room.sessionAccessToken,
      });
    } else {
      io.to(roomCode).emit("gameInProgress", { roomCode: roomCode });
    }
  });

  socket.on("joinGame", async (data) => {
    const { roomCode, username, avatarDataUri } = data;
    if (!gameRooms.has(roomCode)) {
      io.to(socket.id).emit("roomNotFound");
      return;
    }
    const room = gameRooms.get(roomCode);
    const matchingPlayers = room.userList.filter((player) => player.id === socket.id);
    if (matchingPlayers.length >= 0) {
      const matchUsernameIndex = room.userList.findIndex(
        (player) => player.username === username
      );
      if (matchUsernameIndex !== -1) {
        if (
          room.userList[matchUsernameIndex].host &&
          !connectedSockets.has(room.userList[matchUsernameIndex].id)
        ) {
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
  });

  socket.on("selectPlaylist", async (data) => {
    const { roomCode, playlistId } = data;
    if (!gameRooms.has(roomCode)) {
      io.to(socket.id).emit("roomNotFound");
      return;
    }
    const room = gameRooms.get(roomCode);
    const matchingPlayers = room.userList.filter((player) => player.id === socket.id);
    if (matchingPlayers.length >= 0) {
      const matchUsernameIndex = room.userList.findIndex(
        (player) => matchingPlayers[0] && matchingPlayers[0].username && player.username === matchingPlayers[0].username
      );
      if (matchUsernameIndex !== -1) {
        if (room.userList[matchUsernameIndex].host) {
          room.tempSelectedPlaylistId = playlistId;
          io.to(roomCode).emit("onSelectedPlaylist", room.tempSelectedPlaylistId);
          console.log(
            `id ${socket.id} set playlist id roomCode: ${roomCode}`,
            room.tempSelectedPlaylistId
          );
        }
      }
    }
  });

  socket.on("startGame", async (data) => {
    const { roomCode } = data;
    if (!gameRooms.has(roomCode)) {
      io.to(socket.id).emit("roomNotFound");
      return;
    }
    const room = gameRooms.get(roomCode);
    if (!room.isGameStarted) {
      room.isGameStarted = true;
      console.log(`startGame roomCode: ${roomCode}`);
      await handleStartGameQuestion(roomCode);
      setTimeout(() => {
        console.log(`getQuestion on start roomCode: ${roomCode}`);
        handleGetQuestion(roomCode);
      }, 11000);
      io.to(roomCode).emit("onStartGameCountDown");
    }
  });

  socket.on("getQuestion", (data) => {
    const { roomCode } = data;
    handleGetQuestion(roomCode);
  });

  socket.on("submitAnswer", (data) => {
    const { roomCode, answer, timeRemain } = data;
    if (!gameRooms.has(roomCode)) {
      io.to(socket.id).emit("roomNotFound");
      return;
    }

    const room = gameRooms.get(roomCode);
    const matchingPlayers = room.userList.filter(
      (player) => player.id === socket.id
    );
    if (matchingPlayers.length >= 0) {
      const matchUsernameIndex = room.userList.findIndex(
        (player) => matchingPlayers[0] && matchingPlayers[0].username && player.username === matchingPlayers[0].username
      );
      if (matchUsernameIndex !== -1) {
        if (room.randomQuestionData[room.currentQuestion - 1].correctAnswer === answer) {
          var roundScore = Math.ceil(
            100 +
              ((timeRemain /room. questionTimer) *
                50 *
                room.currentQuestion *
                room.roundPlayerCorrectCount) /
                room.userList.length
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
  });

  socket.on("onGameEndGetSongList", (data) => {
    const { roomCode } = data;
    const room = gameRooms.get(roomCode);
    if (room.isGameStarted) {
      resetGame(roomCode);
    }
  })

  socket.on("disconnect", async () => {
    console.log("Player disconnected:", socket.id);
    const roomInfo = findRoomBySocketId(socket.id);

    if (roomInfo) {
      const { roomCode, roomData } = roomInfo;
      const player = roomData.userList.find((p) => p.id === socket.id);

      if (!player.host) {
        roomData.userList = roomData.userList.filter((p) => p.id !== socket.id);
        io.to(roomCode).emit("getPlayer", roomData.userList);
        console.log(`Player ${socket.id} removed from room ${roomCode}.`);

        if (roomData.userList.length === 0) {
          gameRooms.delete(roomCode);
          io.in(roomCode).socketsLeave(roomCode);
        }
      }
    }

    connectedSockets.delete(socket.id);
  });

  socket.on("hostDisconnect", async () => {
    const roomInfo = findRoomBySocketId(socket.id);
    if (roomInfo) {
      const { roomCode } = roomInfo;
      console.log(`Host ${socket.id} explicitly disconnected. Closing room ${roomCode}.`);
      io.to(roomCode).emit("hostDisconnected");
      gameRooms.delete(roomCode); // Remove the room
      io.in(roomCode).socketsLeave(roomCode); // Disconnect all players in the room
    }
  });

});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
