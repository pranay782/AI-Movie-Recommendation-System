const express       = require('express');
const router        = express.Router();
const axios         = require('axios');
const User          = require('../models/User');
const { protect }   = require('./auth');
const { requireDB } = require('../config/db');

const TMDB_BASE = 'https://api.themoviedb.org/3';

// ── TMDB fetch helper ─────────────────────────────────────────────────────
// Supports both short api_key (v3) and long Bearer token (v4)
const tmdb = async (endpoint, params = {}) => {
  const key      = process.env.TMDB_API_KEY || '';
  const isBearer = key.startsWith('eyJ');
  try {
    const response = await axios.get(`${TMDB_BASE}${endpoint}`, {
      headers: isBearer ? { Authorization: `Bearer ${key}` } : {},
      params:  {
        language: 'en-US',
        ...(isBearer ? {} : { api_key: key }),
        ...params
      },
      timeout: 10000
    });
    return response.data;
  } catch (err) {
    // Map axios/TMDB errors to clean messages
    if (err.response) {
      const status = err.response.status;
      if (status === 401) throw new Error('Invalid TMDB API key. Check your .env.example file.');
      if (status === 404) throw new Error('Movie not found on TMDB.');
      throw new Error(`TMDB error ${status}: ${err.response.data?.status_message || err.message}`);
    }
    if (err.code === 'ECONNABORTED') throw new Error('TMDB request timed out.');
    throw new Error(`Network error reaching TMDB: ${err.message}`);
  }
};

// ── GET /api/movies/trending ──────────────────────────────────────────────
router.get('/trending', async (req, res) => {
  try {
    res.json(await tmdb('/trending/movie/week'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/movies/popular ───────────────────────────────────────────────
router.get('/popular', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    res.json(await tmdb('/movie/popular', { page }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/movies/top-rated ─────────────────────────────────────────────
router.get('/top-rated', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    res.json(await tmdb('/movie/top_rated', { page }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/movies/genres ────────────────────────────────────────────────
router.get('/genres', async (req, res) => {
  try {
    res.json(await tmdb('/genre/movie/list'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/movies/search ────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  const { query, page = 1 } = req.query;
  if (!query || !query.trim()) {
    return res.status(400).json({ message: 'Search query is required.' });
  }
  try {
    res.json(await tmdb('/search/movie', { query: query.trim(), page }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/movies/discover/by-genre ────────────────────────────────────
router.get('/discover/by-genre', async (req, res) => {
  const { genreIds, page = 1 } = req.query;
  if (!genreIds) {
    return res.status(400).json({ message: 'genreIds query param is required.' });
  }
  try {
    res.json(await tmdb('/discover/movie', {
      with_genres:      genreIds,
      sort_by:          'popularity.desc',
      'vote_count.gte': 100,
      page
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/movies/recommendations/personal ──────────────────────────────
router.get('/recommendations/personal', requireDB, protect, async (req, res) => {
  try {
    const user   = await User.findById(req.user._id);
    const genres = user.favoriteGenres;
    if (!genres || genres.length === 0) {
      return res.json(await tmdb('/movie/popular'));
    }
    res.json(await tmdb('/discover/movie', {
      with_genres:      genres.join(','),
      sort_by:          'popularity.desc',
      'vote_count.gte': 50,
      page: 1
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/movies/watchlist/add ────────────────────────────────────────
router.post('/watchlist/add', requireDB, protect, async (req, res) => {
  try {
    // Coerce to Number so the duplicate check is type-safe
    const movieId = Number(req.body.movieId);
    const { title, poster, rating } = req.body;
    if (!movieId) return res.status(400).json({ message: 'movieId is required.' });

    const user = await User.findById(req.user._id);
    if (user.watchlist.some(m => m.movieId === movieId)) {
      return res.status(400).json({ message: 'Movie already in watchlist.' });
    }
    user.watchlist.push({ movieId, title, poster, rating: Number(rating) || 0 });
    await user.save();
    res.json({ message: 'Added to watchlist', watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/movies/watchlist/:movieId ─────────────────────────────────
router.delete('/watchlist/:movieId', requireDB, protect, async (req, res) => {
  try {
    const movieId = Number(req.params.movieId);
    const user    = await User.findById(req.user._id);
    user.watchlist = user.watchlist.filter(m => m.movieId !== movieId);
    await user.save();
    res.json({ message: 'Removed from watchlist', watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/movies/watched/add ──────────────────────────────────────────
router.post('/watched/add', requireDB, protect, async (req, res) => {
  try {
    const movieId    = Number(req.body.movieId);
    const userRating = Number(req.body.userRating);
    const { title, poster } = req.body;
    if (!movieId) return res.status(400).json({ message: 'movieId is required.' });

    const user      = await User.findById(req.user._id);
    const existsIdx = user.watchedMovies.findIndex(m => m.movieId === movieId);
    if (existsIdx !== -1) {
      user.watchedMovies[existsIdx].userRating = userRating;
    } else {
      user.watchedMovies.push({ movieId, title, poster, userRating });
    }
    await user.save();
    res.json({ message: 'Marked as watched', watchedMovies: user.watchedMovies });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/movies/:id  (MUST be last — wildcard) ────────────────────────
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) {
    return res.status(400).json({ message: 'Invalid movie ID.' });
  }
  try {
    res.json(await tmdb(`/movie/${id}`, {
      append_to_response: 'videos,credits,similar,recommendations'
    }));
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 500).json({ message: err.message });
  }
});

module.exports = router;
