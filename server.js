require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { router: authRoutes } = require('./routes/auth');
const movieRoutes = require('./routes/movies');

// Print loaded env status so it's easy to debug
console.log('📋 ENV check:');
console.log('  MONGODB_URI :', process.env.MONGODB_URI ? '✅ loaded' : '❌ MISSING');
console.log('  TMDB_API_KEY:', process.env.TMDB_API_KEY ? '✅ loaded' : '❌ MISSING');
console.log('  JWT_SECRET  :', process.env.JWT_SECRET   ? '✅ loaded' : '❌ MISSING');

if (!process.env.MONGODB_URI) {
  console.error('\n❌ MONGODB_URI is not set.');
  console.error('   Make sure your .env file is in the movie-recommendation/ folder (NOT in routes/).\n');
  process.exit(1);
}

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);

// Catch-all: serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🎬 Movie Recommendation Server running on http://localhost:${PORT}`);
});
