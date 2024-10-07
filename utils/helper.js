exports.generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

exports.splitTopThree = (sortedArray) => {
  if (sortedArray.length === 0) {
    return [[], []];
  }
  const topThree = sortedArray.slice(0, 3);
  const remaining = sortedArray.slice(3);
  return [topThree, remaining];
};

exports.getRandomQuestions = (data, numQuestions) => {
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