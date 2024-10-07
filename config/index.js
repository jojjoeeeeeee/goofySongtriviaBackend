require('dotenv').config();

exports.constant = {
  PORT: process.env.PORT || 5000,
  ORIGIN_DOMAIN: process.env.ORIGIN_DOMAIN,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI,
  SPOTIFY_AUTH_URL: "https://accounts.spotify.com/authorize",
  SPOTIFY_TOKEN_URL: "https://accounts.spotify.com/api/token",
  SPOTIFY_API_URL: "https://api.spotify.com/v1",
};