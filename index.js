const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const axios = require("axios");
const querystring = require("querystring");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: "http://jojjoeeeeeee.trueddns.com:53387", // Replace with your client’s origin
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

const io = socketIo(server, {
  cors: {
    origin: "http://jojjoeeeeeee.trueddns.com:53387", // Replace with your client’s origin
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

// Spotify credentials
const SPOTIFY_CLIENT_ID = "136b45ab12ee44ba8c4ac1799d6af215";
const SPOTIFY_CLIENT_SECRET = "e1279dd8428146648e0c3c3e8cb80db2";
const SPOTIFY_REDIRECT_URI = "http://jojjoeeeeeee.trueddns.com:53386/callback";
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";

var userList = [];
const connectedSockets = new Map();

var sessionAccessToken = "";
var tempSelectedPlaylistId = "";
var sessionUserId = "";

var isGameStarted = false;
var randomQuestionData = [];
var onlyQuestionData = [];
var currentQuestion = 0;
var preQuestionTimer = 5;
var questionTimer = 15;
var roundPlayerCorrectCount = 0;

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
    sessionAccessToken = access_token;
    res.redirect(
      `http://jojjoeeeeeee.trueddns.com:53387/?access_token=${access_token}`
    );
  } catch (error) {
    res.status(500).send("Error during authentication");
  }
});

app.get("/api/spotify/user", async (req, res) => {
  const { access_token } = req.query;
  try {
    const response = await axios.get(`${SPOTIFY_API_URL}/me`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    console.log("fetch user:", response.data.id);
    if (sessionUserId === "") {
      console.log("set user id", response.data.id);
      sessionUserId = response.data.id;
    }
    res.json(response.data);
  } catch (error) {
    console.log("fetch user error:", error);
    res.status(500).send("Error fetching user");
  }
});

app.get("/api/spotify/playlists", async (req, res) => {
  const { access_token } = req.query;
  try {
    console.log(
      "fetch playlist:",
      `${SPOTIFY_API_URL}/users/${sessionUserId}/playlists`
    );
    const response = await axios.get(
      `${SPOTIFY_API_URL}/users/${sessionUserId}/playlists`,
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

app.get("/api/spotify/playlist/tracks", async (req, res) => {
  const { access_token, playlist_id } = req.query;
  try {
    const response = await axios.get(
      `${SPOTIFY_API_URL}/playlists/${playlist_id}/tracks`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).send("Error fetching playlist tracks");
  }
});

const fetchPlaylistTracks = async (playlist_id) => {
  const response = await axios.get(
    `${SPOTIFY_API_URL}/playlists/${playlist_id}/tracks`,
    {
      headers: {
        Authorization: `Bearer ${sessionAccessToken}`,
      },
    }
  );
  return response.data.items;
};

const handleStartGameQuestion = async () => {
  currentQuestion = 0;
  const itemsData = await fetchPlaylistTracks(tempSelectedPlaylistId);
  const mappedTracksData = itemsData
    .filter((item) => item.track.preview_url !== null) // Filter out items where preview_url is null
    .map((item, index) => {
      return {
        id: index,
        title: item.track.name,
        artist: item.track.artists.map((artist) => artist.name),
        audioUrl: item.track.preview_url,
        image: item.track.album.images[0].url,
      };
    });
  const randomQuestion = getRandomQuestions(mappedTracksData, 10); //change question amount here
  randomQuestionData = randomQuestion;
  const onlyQuestion = randomQuestion.map((item) => {
    return {
      id: item.id,
      question: item.question,
      choices: item.choices,
      audioUrl: item.audioUrl,
    };
  });
  onlyQuestionData = onlyQuestion;
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

const handleGetQuestion = () => {
  if (currentQuestion < onlyQuestionData.length) {
    try {
      console.log("-----------------");
      console.log("getQuestion", onlyQuestionData[currentQuestion]);
      console.log("answer", randomQuestionData[currentQuestion].correctAnswer);
      io.emit("onGetQuestion", { trivia: onlyQuestionData[currentQuestion] });
      io.emit("getPlayer", userList);
      currentQuestion += 1;
      roundPlayerCorrectCount = userList.length;

      let timer;
      clearInterval(timer);
      var seconds = questionTimer + preQuestionTimer + 1;
      timer = setInterval(() => {
        console.log("countdown: ", seconds);
        seconds -= 1;

        if (seconds === 0) {
          console.log("auto get new question");
          handleGetQuestion();
          clearInterval(timer);
        }
      }, 1000);

      return () => clearInterval(timer);
    } catch (error) {
      console.error("Error retrieving question:", error);
    }
  } else {
    console.log("No more questions available.");
    const [topThree, remaining] = splitTopThree(userList)
    io.emit("onGameEnd", {topPlayers: topThree, players: remaining});
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

const resetGame = () => {
  io.emit("onResetGame", {songList: randomQuestionData});

  isGameStarted = false;
  randomQuestionData = [];
  onlyQuestionData = [];
  currentQuestion = 0;
  const updatedUserList = userList.map((user) => ({
    ...user,
    score: 0,
  }));
  
  userList = updatedUserList;

  setTimeout(() => {
    io.emit("getPlayer", userList);
  }, 800);
};

io.on("connection", (socket) => {
  console.log("New player connected:", socket.id);
  connectedSockets.set(socket.id, socket);

  socket.on("searchSession", async () => {
    if (!isGameStarted) {
      console.log(`id ${socket.id} search session`);
      io.emit("getSession", {
        userList: userList,
        accessToken: sessionAccessToken,
      });
    } else {
      io.emit("gameInProgress");
    }
  });

  socket.on("joinGame", async (data) => {
    const { username, avatarDataUri } = data;
    const matchingPlayers = userList.filter(
      (player) => player.id === socket.id
    );
    if (matchingPlayers.length >= 0) {
      const matchUsernameIndex = userList.findIndex(
        (player) => player.username === username
      );
      if (matchUsernameIndex !== -1) {
        if (
          userList[matchUsernameIndex].host &&
          !connectedSockets.has(userList[matchUsernameIndex].id)
        ) {
          userList[matchUsernameIndex].id = socket.id;
        }
      } else {
        userList.push({
          id: socket.id,
          avatarDataUri: avatarDataUri,
          username: username,
          host: userList.length === 0 ? true : false,
          score: 0,
        });
      }
      io.emit("getPlayer", userList);
      if (tempSelectedPlaylistId !== "") {
        io.emit("onSelectedPlaylist", tempSelectedPlaylistId);
      }
      console.log(`id ${socket.id} join room`);
    }
  });

  socket.on("selectPlaylist", async (data) => {
    const { playlistId } = data;
    const matchingPlayers = userList.filter(
      (player) => player.id === socket.id
    );
    if (matchingPlayers.length >= 0) {
      const matchUsernameIndex = userList.findIndex(
        (player) => matchingPlayers[0] && matchingPlayers[0].username && player.username === matchingPlayers[0].username
      );
      if (matchUsernameIndex !== -1) {
        if (userList[matchUsernameIndex].host) {
          tempSelectedPlaylistId = playlistId;
          io.emit("onSelectedPlaylist", tempSelectedPlaylistId);
          console.log(
            `id ${socket.id} set playlist id`,
            tempSelectedPlaylistId
          );
        }
      }
    }
  });

  socket.on("startGame", async () => {
    if (!isGameStarted) {
      isGameStarted = true;
      console.log("startGame");
      await handleStartGameQuestion();
      setTimeout(() => {
        console.log("getQuestion on start");
        handleGetQuestion();
      }, 11000);
      io.emit("onStartGameCountDown");
    }
  });

  socket.on("getQuestion", () => {
    handleGetQuestion();
  });

  socket.on("submitAnswer", (data) => {
    const { answer, timeRemain } = data;
    const matchingPlayers = userList.filter(
      (player) => player.id === socket.id
    );
    if (matchingPlayers.length >= 0) {
      const matchUsernameIndex = userList.findIndex(
        (player) => matchingPlayers[0] && matchingPlayers[0].username && player.username === matchingPlayers[0].username
      );
      if (matchUsernameIndex !== -1) {
        if (randomQuestionData[currentQuestion - 1].correctAnswer === answer) {
          var roundScore = Math.ceil(
            100 +
              ((timeRemain / questionTimer) *
                50 *
                currentQuestion *
                roundPlayerCorrectCount) /
                userList.length
          );
          userList[matchUsernameIndex].score += roundScore;
          userList.sort((a, b) => b.score - a.score);
          roundPlayerCorrectCount -= 1;
          io.to(socket.id).emit("onSubmitAnswer", {
            id: currentQuestion,
            roundScore,
            isCorrect: true,
          });
        } else {
          io.to(socket.id).emit("onSubmitAnswer", {
            id: currentQuestion,
            roundScore: 0,
            isCorrect: false,
          });
        }
      }
    }
  });

  socket.on("onGameEndGetSongList", () => {
    //getSong list and move reset game to reset socket
    if (isGameStarted) {
      resetGame();
    }
  })

  socket.on("disconnect", async () => {
    console.log("Player disconnected:", socket.id);
    const matchingPlayers = userList.filter(
      (player) => player.id === socket.id
    );
    if (matchingPlayers.length > 0) {
      if (!matchingPlayers[0].host) {
        userList = userList.filter((player) => player.id !== socket.id);
        io.emit("getPlayer", userList);
      }
    }
    connectedSockets.delete(socket.id);
  });

  socket.on("hostDisconnect", async () => {
    userList = []
    sessionUserId = ""
    io.emit("getPlayer", userList);
    connectedSockets.clear()
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
