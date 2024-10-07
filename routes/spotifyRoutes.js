const express = require("express");
const router = express.Router();
const spotifyController = require("../controllers/spotifyController");

router.get("/auth/spotify", spotifyController.authSpotify);
router.get("/callback", spotifyController.callback);
router.get("/api/spotify/user", spotifyController.getUser);
router.get("/api/spotify/playlists", spotifyController.getPlaylists);

module.exports = router;
