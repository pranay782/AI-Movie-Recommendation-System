const path = require('path');
const fs   = require('fs');

/* ── Load environment ──────────────────────────────────────────────────── */
// On Render (and other cloud hosts) env vars are injected directly —
// no .env file exists. Only load dotenv locally when the file is present.
const rootEnv = path.join(__dirname, '.env');
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
  console.log('📂 Loaded env from .env file');
} else {
  console.log('☁️  No .env file — using environment variables from host (Render/etc.)');
}

// Fix TMDB key if short+bearer token were pasted together
if (process.env.TMDB_API_KEY && process.env.TMDB_API_KEY.includes('.eyJ')) {
  const parts = process.env.TMDB_API_KEY.split('.');
  // Bearer JWT is 3 dot-separated parts starting with eyJ
  const bearerStart = parts.findIndex(p => p.startsWith('eyJ'));
  if (bearerStart !== -1) {
    process.env.TMDB_API_KEY = parts.slice(bearerStart).join('.');
  }
}

console.log('📋 ENV:');
console.log('  MONGODB_URI :', process.env.MONGODB_URI  ? '✅' : '❌ MISSING');
console.log('  TMDB_API_KEY:', process.env.TMDB_API_KEY ? '✅' : '❌ MISSING');
console.log('  JWT_SECRET  :', process.env.JWT_SECRET   ? '✅' : '❌ MISSING');

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI missing — set it in Render → Environment tab.');
  process.exit(1);
}

const express = require('express');
const cors    = require('cors');
const connectDB = require('./config/db');
const { router: authRoutes }  = require('./routes/auth');
const movieRoutes = require('./routes/movies');

connectDB();

const app = express();

/* ── CORS — allow all origins ────────────────────────────────────────────── */
const corsOptions = {
  origin: true,           // reflect any origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));   // handle preflight for every route

/* ── Body parsers ────────────────────────────────────────────────────────── */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Request logger ──────────────────────────────────────────────────────── */
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`➡️  ${req.method} ${req.path} — body:`, JSON.stringify(req.body).slice(0, 120));
  }
  next();
});

/* ── API routes ──────────────────────────────────────────────────────────── */
app.use('/api/auth',   authRoutes);
app.use('/api/movies', movieRoutes);

/* ── Unknown /api/* → JSON 404 (not HTML) ────────────────────────────────── */
app.use('/api', (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

/* ── Static frontend (after API routes) ─────────────────────────────────── */
app.use(express.static(path.join(__dirname, 'public')));

/* ── SPA fallback ────────────────────────────────────────────────────────── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 Server listening on 0.0.0.0:${PORT}`);
});
