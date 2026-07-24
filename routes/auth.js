const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Auth middleware
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });
};

// @route POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password, favoriteGenres } = req.body;
  try {
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({ username, email, password, favoriteGenres: favoriteGenres || [] });
    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      favoriteGenres: user.favoriteGenres,
      token: generateToken(user._id)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        favoriteGenres: user.favoriteGenres,
        watchlist: user.watchlist,
        watchedMovies: user.watchedMovies,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/auth/profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      favoriteGenres: user.favoriteGenres,
      watchlist: user.watchlist,
      watchedMovies: user.watchedMovies
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route PUT /api/auth/genres
router.put('/genres', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.favoriteGenres = req.body.genres;
    await user.save();
    res.json({ favoriteGenres: user.favoriteGenres });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = { router, protect };
