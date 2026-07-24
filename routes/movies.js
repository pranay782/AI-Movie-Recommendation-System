const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const { protect } = require('./auth');

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Helper: fetch from TMDB — supports both short api_key and long Bearer token
const tmdb = async (endpoint, params = {}) => {
  const key = process.env.TMDB_API_KEY || '';
  const url = `${TMDB_BASE}${endpoint}`;
  const isBearer = key.startsWith('eyJ');
  const response = await axios.get(url, {
    headers: isBearer ? { Authorization: `Bearer ${key}` } : {},
    params: {
      language: 'en-US',
      ...(isBearer ? {} : { api_key: key }),
      ...params
    }
  });
  return response.data;
};

// @route GET /api/movies/trending
router.get('/trending', async (req, res) => {
  try {
    const data = await tmdb('/trending/movie/week');
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch trending movies', error: err.message });
  }
});

// @route GET /api/movies/popular
router.get('/popular', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await tmdb('/movie/popular', { page });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch popular movies', error: err.message });
  }
});

// @route GET /api/movies/top-rated
router.get('/top-rated', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await tmdb('/movie/top_rated', { page });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch top-rated movies', error: err.message });
  }
});

// @route GET /api/movies/genres
router.get('/genres', async (req, res) => {
  try {
    const data = await tmdb('/genre/movie/list');
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch genres', error: err.message });
  }
});

// @route GET /api/movies/search
router.get('/search', async (req, res) => {
  try {
    const { query, page = 1 } = req.query;
    if (!query) return res.status(400).json({ message: 'Search query is required' });
    const data = await tmdb('/search/movie', { query, page });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Search failed', error: err.message });
  }
});

// @route GET /api/movies/discover/by-genre
router.get('/discover/by-genre', async (req, res) => {
  try {
    const { genreIds, page = 1 } = req.query;
    const data = await tmdb('/discover/movie', {
      with_genres: genreIds,
      sort_by: 'vote_average.desc',
      'vote_count.gte': 100,
      page
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch movies by genre', error: err.message });
  }
});

// @route POST /api/movies/watchlist/add
router.post('/watchlist/add', protect, async (req, res) => {
  try {
    const { movieId, title, poster, rating } = req.body;
    const user = await User.findById(req.user._id);
    const exists = user.watchlist.find(m => m.movieId === movieId);
    if (exists) return res.status(400).json({ message: 'Movie already in watchlist' });
    user.watchlist.push({ movieId, title, poster, rating });
    await user.save();
    res.json({ message: 'Added to watchlist', watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route DELETE /api/movies/watchlist/:movieId
router.delete('/watchlist/:movieId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.watchlist = user.watchlist.filter(m => m.movieId !== parseInt(req.params.movieId));
    await user.save();
    res.json({ message: 'Removed from watchlist', watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route POST /api/movies/watched/add
router.post('/watched/add', protect, async (req, res) => {
  try {
    const { movieId, title, poster, userRating } = req.body;
    const user = await User.findById(req.user._id);
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

// @route GET /api/movies/recommendations/personal
router.get('/recommendations/personal', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const genres = user.favoriteGenres;
    if (!genres || genres.length === 0) {
      const data = await tmdb('/movie/popular');
      return res.json(data);
    }
    const data = await tmdb('/discover/movie', {
      with_genres: genres.join(','),
      sort_by: 'vote_average.desc',
      'vote_count.gte': 50,
      page: 1
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/movies/:id  — MUST be last to avoid swallowing named routes
router.get('/:id', async (req, res) => {
  try {
    const data = await tmdb(`/movie/${req.params.id}`, { append_to_response: 'videos,credits,similar,recommendations' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch movie details', error: err.message });
  }
});

module.exports = router;
