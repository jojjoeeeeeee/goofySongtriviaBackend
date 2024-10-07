class GameRoom {
    constructor(accessToken) {
      this.userList = [];
      this.sessionAccessToken = accessToken;
      this.tempSelectedPlaylistId = "";
      this.sessionUserId = "";
      this.isGameStarted = false;
      this.randomQuestionData = [];
      this.onlyQuestionData = [];
      this.currentQuestion = 0;
      this.preQuestionTimer = 5;
      this.questionTimer = 15;
      this.roundPlayerCorrectCount = 0;
    }
  }
  
  // Singleton to manage all game rooms
  const gameRooms = new Map(); // Use a Map to store game rooms
  
  const createGameRoom = (roomCode, accessToken) => {
    if (!gameRooms.has(roomCode)) {
      gameRooms.set(roomCode, new GameRoom(accessToken));
    } else {
      console.error(`Game room ${roomCode} already exists.`);
    }
  };
  
  const hasGameRoom = (roomCode) => {
    return gameRooms.has(roomCode);
  };
  
  const getGameRoom = (roomCode) => {
    return gameRooms.get(roomCode);
  };
  
  const deleteGameRoom = (roomCode) => {
    if (gameRooms.has(roomCode)) {
      gameRooms.delete(roomCode);
    } else {
      console.error(`Game room ${roomCode} does not exist.`);
    }
  };
  
  const findRoomBySocketId = (socketId) => {
    for (const [roomCode, roomData] of gameRooms.entries()) {
      if (roomData.userList.some((player) => player.id === socketId)) {
        return { roomCode, roomData };
      }
    }
    return null;
  };
  
  module.exports = { createGameRoom, hasGameRoom, getGameRoom, deleteGameRoom, findRoomBySocketId };
  