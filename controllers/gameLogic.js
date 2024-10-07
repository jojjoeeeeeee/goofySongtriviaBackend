// gameLogic.js
const { getGameRoom } = require("../models/gameRoom");
const spotifyService = require("../services/spotifyService");
const helper = require("../utils/helper");

const handleStartGameQuestion = async (roomCode) => {
  const room = getGameRoom(roomCode);
  if (!room) return;

  room.currentQuestion = 0;

  const itemsData = await spotifyService.fetchPlaylistTracks(
    room.tempSelectedPlaylistId,
    room.sessionAccessToken
  );
  const mappedTracksData = itemsData
    .filter((item) => item.track.preview_url !== null)
    .map((item, index) => ({
      id: index,
      title: item.track.name,
      artist: item.track.artists.map((artist) => artist.name),
      audioUrl: item.track.preview_url,
      image: item.track.album.images[0].url,
    }));

  const randomQuestion = helper.getRandomQuestions(mappedTracksData, 10);
  room.randomQuestionData = randomQuestion;
  room.onlyQuestionData = randomQuestion.map((item) => ({
    id: item.id,
    question: item.question,
    choices: item.choices,
    audioUrl: item.audioUrl,
  }));
};

const handleGetQuestion = (roomCode, io) => {
  const room = getGameRoom(roomCode);

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
          handleGetQuestion(roomCode, io);
          clearInterval(timer);
        }
      }, 1000);

      return () => clearInterval(timer);
    } catch (error) {
      console.error("Error retrieving question:", error);
    }
  } else {
    console.log(`No more questions available. roomCode: ${roomCode}`);
    const [topThree, remaining] = helper.splitTopThree(room.userList)
    io.to(roomCode).emit("onGameEnd", {topPlayers: topThree, players: remaining});
  }
};

const resetGame = (roomCode, io) => {
  const room = getGameRoom(roomCode);
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

module.exports = { handleStartGameQuestion, handleGetQuestion, resetGame };
