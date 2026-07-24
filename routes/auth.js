const express   = require('express');
const router    = express.Router();
const jwt       = require('jsonwebtoken');
const User      = require('../models/User');
const { requireDB } = require('../config/db');

// All auth routes need the database
router.use(requireDB);

// ── JWT helper ────────────────────────────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ── Parse Mongoose errors into friendly messages ──────────────────────────
function parseMongoError(err) {
  // Duplicate key (unique index violation)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    return `An account with that ${field} (${value}) already exists.`;
  }
  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return messages.join(' ');
  }
  return err.message;
}

// ── Auth middleware ───────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) return res.status(401).json({ message: 'User not found' });
      return next();
    } catch {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }
  return res.status(401).json({ message: 'Not authorized, no token' });
};

// ── POST /api/auth/register ───────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { username, email, password, favoriteGenres } = req.body;

  // Basic input validation
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }
  if (username.length < 3) {
    return res.status(400).json({ message: 'Username must be at least 3 characters.' });
  }

  try {
    const userExists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (userExists) {
      const field = userExists.email === email.toLowerCase() ? 'email' : 'username';
      return res.status(400).json({ message: `An account with that ${field} already exists.` });
    }

    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
      favoriteGenres: favoriteGenres || []
    });

    console.log(`✅ New user registered: ${user.username} (${user.email})`);

    res.status(201).json({
      _id:            user._id,
      username:       user.username,
      email:          user.email,
      favoriteGenres: user.favoriteGenres,
      watchlist:      [],
      watchedMovies:  [],
      token:          generateToken(user._id)
    });
  } catch (err) {
    console.error('Register error:', err.message);
    const msg = parseMongoError(err);
    res.status(400).json({ message: msg });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'No account found with that email.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password. Please try again.' });
    }

    console.log(`✅ User logged in: ${user.username}`);

    res.json({
      _id:            user._id,
      username:       user.username,
      email:          user.email,
      favoriteGenres: user.favoriteGenres,
      watchlist:      user.watchlist,
      watchedMovies:  user.watchedMovies,
      token:          generateToken(user._id)
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error during login. Please try again.' });
  }
});

// ── GET /api/auth/profile ─────────────────────────────────────────────────
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      _id:            user._id,
      username:       user.username,
      email:          user.email,
      favoriteGenres: user.favoriteGenres,
      watchlist:      user.watchlist,
      watchedMovies:  user.watchedMovies
    });
  } catch (err) {
    console.error('Profile error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/auth/genres ──────────────────────────────────────────────────
router.put('/genres', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.favoriteGenres = req.body.genres || [];
    await user.save();
    res.json({ favoriteGenres: user.favoriteGenres });
  } catch (err) {
    console.error('Genres update error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = { router, protect };
