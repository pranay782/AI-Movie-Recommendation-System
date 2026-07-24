# 🎬 CineMatch — Movie Recommendation System

A full-stack movie recommendation web app built with **Node.js + Express + MongoDB** (backend) and **HTML + CSS + Vanilla JS** (frontend), powered by the **TMDB API**.

---

## 📁 Project Structure

```
movie-recommendation/
├── server.js                  # Express server entry point
├── package.json
├── .env.example               # Copy to .env and fill in your keys
├── config/
│   └── db.js                  # MongoDB connection
├── models/
│   └── User.js                # Mongoose user schema
├── routes/
│   ├── auth.js                # Auth routes + JWT middleware
│   └── movies.js              # Movie routes (TMDB proxy + user actions)
└── public/                    # Frontend (served as static files)
    ├── index.html
    ├── style.css
    └── app.js
```

---

## 🚀 Quick Start

### 1. Get a FREE TMDB API Key
- Go to [https://www.themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
- Register and create an API key (it's free)
- Copy the **API Read Access Token (v4 auth)** — it starts with `eyJ...`

### 2. Install MongoDB
- **Local**: Install [MongoDB Community Edition](https://www.mongodb.com/try/download/community)
- **Cloud (Recommended)**: Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas)

### 3. Set Up Environment Variables
```bash
cp .env.example .env
```

Edit `.env`:
```env
MONGODB_URI=mongodb://localhost:27017/movierecommendation
# OR for Atlas: mongodb+srv://user:pass@cluster.mongodb.net/movierecommendation

TMDB_API_KEY=eyJhbGc...  ← Your TMDB API Bearer Token
JWT_SECRET=any_long_random_string_here
PORT=5000
```

### 4. Install Dependencies
```bash
cd movie-recommendation
npm install
```

### 5. Start the Server
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

### 6. Open the App
Visit **http://localhost:5000** in your browser.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Auth** | Register / Login with JWT (stored in localStorage) |
| 🔥 **Trending** | Weekly trending movies from TMDB |
| ⭐ **Top Rated** | All-time best movies |
| 🎯 **For You** | Personalized recommendations based on your genres |
| 🔍 **Search** | Real-time movie search with pagination |
| 🎭 **Genre Filter** | Browse movies by category |
| 📋 **Watchlist** | Add / remove movies (stored in MongoDB) |
| ✅ **Watched** | Mark movies as watched with star ratings (1–10) |
| 🎬 **Movie Detail** | Full details: cast, trailer, overview, similar movies |
| 🖼️ **Hero Banner** | Auto-rotating featured movie banner |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB + Mongoose ODM |
| **Auth** | JWT (JSON Web Tokens) + bcryptjs |
| **Movie Data** | TMDB API v3 |
| **HTTP Client** | Axios (server-side) + Fetch API (client-side) |

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/profile` | Get profile (auth required) |
| PUT | `/api/auth/genres` | Update favorite genres |

### Movies
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/movies/trending` | Trending this week |
| GET | `/api/movies/popular` | Popular movies |
| GET | `/api/movies/top-rated` | Top rated movies |
| GET | `/api/movies/genres` | All genres list |
| GET | `/api/movies/search?query=...` | Search movies |
| GET | `/api/movies/:id` | Movie details + cast + similar |
| GET | `/api/movies/discover/by-genre?genreIds=...` | Filter by genre |
| GET | `/api/movies/recommendations/personal` | Personalized (auth) |
| POST | `/api/movies/watchlist/add` | Add to watchlist (auth) |
| DELETE | `/api/movies/watchlist/:movieId` | Remove from watchlist (auth) |
| POST | `/api/movies/watched/add` | Mark watched + rate (auth) |
