const axios = require("axios");
const config = require("../config");

exports.fetchUser = async (accessToken) => {
  const response = await axios.get(`${config.constant.SPOTIFY_API_URL}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
};

exports.fetchPlaylists = async (userId, accessToken) => {
  const response = await axios.get(`${config.constant.SPOTIFY_API_URL}/users/${userId}/playlists`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
};

exports.fetchPlaylistTracks = async (playlistId, accessToken) => {
  const response = await axios.get(`${config.constant.SPOTIFY_API_URL}/playlists/${playlistId}/tracks`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data.items;
};