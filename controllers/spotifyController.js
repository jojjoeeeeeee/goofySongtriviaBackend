const spotifyService = require("../services/spotifyService");
const config = require("../config");
const querystring = require("querystring");
const axios = require("axios");
const { getGameRoom } = require('../models/gameRoom');

exports.authSpotify = (req, res) => {
  const authUrl = `${config.constant.SPOTIFY_AUTH_URL}?client_id=${config.constant.SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${config.constant.SPOTIFY_REDIRECT_URI}&scope=playlist-read-private%20user-read-private%20streaming`;
  res.redirect(authUrl);
};

exports.callback = async (req, res) => {
  const { code } = req.query;
  try {
    const tokenResponse = await axios.post(
      config.constant.SPOTIFY_TOKEN_URL,
      querystring.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.constant.SPOTIFY_REDIRECT_URI,
        client_id: config.constant.SPOTIFY_CLIENT_ID,
        client_secret: config.constant.SPOTIFY_CLIENT_SECRET,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    )

    const { access_token } = tokenResponse.data;
    res.redirect(`${config.constant.ORIGIN_DOMAIN}/?access_token=${access_token}`);
  } catch (error) {
    res.status(500).send("Error during authentication");
  }
};

exports.getUser = async (req, res) => {
  const { room_code, access_token } = req.query;
  const room = getGameRoom(room_code);
  try {
    const userData = await spotifyService.fetchUser(access_token);
    if (room.sessionUserId === "") {
      room.sessionUserId = userData.id;
    }
    res.json(userData);
  } catch (error) {
    res.status(500).send("Error fetching user");
  }
};

exports.getPlaylists = async (req, res) => {
  const { room_code, access_token } = req.query;
  const room = getGameRoom(room_code);
  try {
    const playlistsData = await spotifyService.fetchPlaylists(room.sessionUserId, access_token);
    res.json(playlistsData);
  } catch (error) {
    res.status(500).send("Error fetching playlists");
  }
};