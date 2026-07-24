/* ═══════════════════════════════════════════════════════════════
   CineMatch — app.js
   Full-stack Movie Recommendation System
   Backend: Node.js + Express + MongoDB
   Movie Data: TMDB API (via backend proxy)
═══════════════════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:5000/api';
const IMG_BASE = 'https://image.tmdb.org/t/p';

/* ─── STATE ─────────────────────────────────────────────────────────────── */
let state = {
  user: null,
  token: null,
  genres: [],
  watchlist: [],
  watchedMovies: [],
  currentSection: 'home',
  searchPage: 1,
  searchQuery: '',
  selectedGenres: [],
  heroMovies: [],
  heroIndex: 0
};

/* ─── INIT ──────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const savedToken = localStorage.getItem('cinematch_token');
  const savedUser = localStorage.getItem('cinematch_user');
  if (savedToken && savedUser) {
    state.token = savedToken;
    state.user = JSON.parse(savedUser);
    state.watchlist = state.user.watchlist || [];
    state.watchedMovies = state.user.watchedMovies || [];
    closeAuthModal();
    initApp();
  } else {
    loadGenresForPicker();
  }
});

async function initApp() {
  document.getElementById('nav-username').textContent = `👤 ${state.user.username}`;
  await fetchGenres();
  loadHomeSection();
}

/* ─── AUTH ──────────────────────────────────────────────────────────────── */
function switchTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    const res = await apiFetch('/auth/login', 'POST', { email, password });
    saveSession(res);
    closeAuthModal();
    initApp();
    showToast('Welcome back, ' + res.username + '! 🎬', 'success');
  } catch (err) {
    errEl.textContent = err.message || 'Login failed. Check your credentials.';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('reg-username').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const selectedGenres = [...document.querySelectorAll('.genre-pick-chip.selected')].map(el => parseInt(el.dataset.id));
  const errEl = document.getElementById('register-error');
  errEl.textContent = '';
  if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }
  try {
    const res = await apiFetch('/auth/register', 'POST', { username, email, password, favoriteGenres: selectedGenres });
    saveSession(res);
    closeAuthModal();
    initApp();
    showToast('Account created! Welcome, ' + res.username + '! 🎉', 'success');
  } catch (err) {
    errEl.textContent = err.message || 'Registration failed.';
  }
}

function saveSession(data) {
  state.token = data.token;
  state.user = data;
  state.watchlist = data.watchlist || [];
  state.watchedMovies = data.watchedMovies || [];
  localStorage.setItem('cinematch_token', data.token);
  localStorage.setItem('cinematch_user', JSON.stringify(data));
}

function logout() {
  state.token = null; state.user = null;
  state.watchlist = []; state.watchedMovies = [];
  localStorage.removeItem('cinematch_token');
  localStorage.removeItem('cinematch_user');
  document.getElementById('auth-modal').classList.add('active');
  loadGenresForPicker();
  showToast('Logged out successfully.', 'info');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('active');
}

/* ─── GENRES ────────────────────────────────────────────────────────────── */
async function fetchGenres() {
  try {
    const data = await apiFetch('/movies/genres');
    state.genres = data.genres || [];
    buildGenreFilter();
  } catch { console.warn('Could not load genres'); }
}

async function loadGenresForPicker() {
  try {
    const data = await apiFetch('/movies/genres');
    state.genres = data.genres || [];
    buildGenrePicker();
  } catch { buildGenrePicker(); }
}

function buildGenrePicker() {
  const el = document.getElementById('genre-picker');
  if (!el) return;
  const list = state.genres.length ? state.genres : [
    {id:28,name:'Action'},{id:12,name:'Adventure'},{id:16,name:'Animation'},
    {id:35,name:'Comedy'},{id:80,name:'Crime'},{id:99,name:'Documentary'},
    {id:18,name:'Drama'},{id:14,name:'Fantasy'},{id:27,name:'Horror'},
    {id:9648,name:'Mystery'},{id:10749,name:'Romance'},{id:878,name:'Sci-Fi'},
    {id:53,name:'Thriller'},{id:10752,name:'War'}
  ];
  el.innerHTML = list.map(g =>
    `<span class="genre-pick-chip" data-id="${g.id}" onclick="toggleGenrePick(this)">${g.name}</span>`
  ).join('');
}

function toggleGenrePick(el) {
  el.classList.toggle('selected');
}

function buildGenreFilter() {
  const el = document.getElementById('genre-filter');
  if (!el) return;
  el.innerHTML = state.genres.map(g =>
    `<span class="genre-chip ${state.selectedGenres.includes(g.id) ? 'selected' : ''}" 
     data-id="${g.id}" onclick="filterByGenre(${g.id}, this)">${g.name}</span>`
  ).join('');
}

async function filterByGenre(genreId, el) {
  const idx = state.selectedGenres.indexOf(genreId);
  if (idx === -1) { state.selectedGenres.push(genreId); el.classList.add('selected'); }
  else { state.selectedGenres.splice(idx, 1); el.classList.remove('selected'); }
  if (state.selectedGenres.length === 0) {
    document.getElementById('genre-grid').innerHTML = '';
    return;
  }
  showLoader();
  try {
    const data = await apiFetch(`/movies/discover/by-genre?genreIds=${state.selectedGenres.join(',')}`);
    renderMovieGrid('genre-grid', data.results);
  } catch { showToast('Failed to load genre movies', 'error'); }
  hideLoader();
}

/* ─── SECTIONS ──────────────────────────────────────────────────────────── */
function showSection(name) {
  state.currentSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById(`section-${name}`);
  if (sec) sec.classList.add('active');
  window.scrollTo(0, 0);

  if (name === 'home') loadHomeSection();
  else if (name === 'recommended') loadRecommended();
  else if (name === 'watchlist') renderWatchlistSection();
  else if (name === 'watched') renderWatchedSection();
}

/* ─── HOME SECTION ──────────────────────────────────────────────────────── */
async function loadHomeSection() {
  renderSkeletons('trending-grid', 8);
  renderSkeletons('toprated-grid', 8);
  try {
    const [trending, topRated] = await Promise.all([
      apiFetch('/movies/trending'),
      apiFetch('/movies/top-rated')
    ]);
    state.heroMovies = trending.results.slice(0, 5);
    renderHero();
    startHeroRotation();
    renderMovieGrid('trending-grid', trending.results);
    renderMovieGrid('toprated-grid', topRated.results);
  } catch (err) {
    document.getElementById('trending-grid').innerHTML = `<p class="muted">Failed to load movies. Check your API key.</p>`;
  }
}

function renderHero() {
  if (!state.heroMovies.length) return;
  const movie = state.heroMovies[state.heroIndex];
  const el = document.getElementById('hero-info');
  const banner = document.getElementById('hero-banner');
  if (movie.backdrop_path) {
    let bg = banner.querySelector('.hero-bg');
    if (!bg) { bg = document.createElement('img'); bg.className = 'hero-bg'; banner.insertBefore(bg, banner.firstChild); }
    bg.src = `${IMG_BASE}/original${movie.backdrop_path}`;
  }
  const year = movie.release_date ? movie.release_date.split('-')[0] : '';
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
  el.innerHTML = `
    <div class="hero-title">${movie.title}</div>
    <div class="hero-meta">
      <span class="meta-chip rating">⭐ ${rating}</span>
      <span class="meta-chip">${year}</span>
    </div>
    <div class="hero-overview">${movie.overview || ''}</div>
    <div class="hero-btns">
      <button class="btn-primary" onclick="openMovieModal(${movie.id})">▶ View Details</button>
      <button class="btn-secondary" onclick="addToWatchlist(${movie.id}, '${escapeQuotes(movie.title)}', '${movie.poster_path || ''}', ${movie.vote_average || 0})">+ Watchlist</button>
    </div>`;
}

function startHeroRotation() {
  clearInterval(window._heroTimer);
  window._heroTimer = setInterval(() => {
    state.heroIndex = (state.heroIndex + 1) % state.heroMovies.length;
    renderHero();
  }, 6000);
}

/* ─── RECOMMENDED ───────────────────────────────────────────────────────── */
async function loadRecommended() {
  renderSkeletons('recommended-grid', 12);
  try {
    const data = await apiFetch('/movies/recommendations/personal', 'GET', null, true);
    renderMovieGrid('recommended-grid', data.results);
  } catch {
    const data = await apiFetch('/movies/popular');
    renderMovieGrid('recommended-grid', data.results);
  }
}

/* ─── WATCHLIST ─────────────────────────────────────────────────────────── */
function renderWatchlistSection() {
  const grid = document.getElementById('watchlist-grid');
  const empty = document.getElementById('watchlist-empty');
  if (!state.watchlist.length) {
    grid.innerHTML = ''; empty.classList.remove('hidden'); return;
  }
  empty.classList.add('hidden');
  grid.innerHTML = state.watchlist.map(m => `
    <div class="movie-card" onclick="openMovieModal(${m.movieId})">
      ${m.poster ? `<img class="card-poster" src="${IMG_BASE}/w342${m.poster}" alt="${m.title}" loading="lazy" />`
        : `<div class="card-poster-placeholder">🎬</div>`}
      <div class="card-body">
        <div class="card-title">${m.title}</div>
        <div class="card-meta">
          <span class="card-rating">⭐ ${m.rating ? m.rating.toFixed(1) : 'N/A'}</span>
        </div>
        <div class="card-actions">
          <button class="btn-icon" onclick="event.stopPropagation(); removeFromWatchlist(${m.movieId})">🗑 Remove</button>
        </div>
      </div>
    </div>`).join('');
}

/* ─── WATCHED ───────────────────────────────────────────────────────────── */
function renderWatchedSection() {
  const grid = document.getElementById('watched-grid');
  const empty = document.getElementById('watched-empty');
  if (!state.watchedMovies.length) {
    grid.innerHTML = ''; empty.classList.remove('hidden'); return;
  }
  empty.classList.add('hidden');
  grid.innerHTML = state.watchedMovies.map(m => `
    <div class="movie-card" onclick="openMovieModal(${m.movieId})">
      ${m.poster ? `<img class="card-poster" src="${IMG_BASE}/w342${m.poster}" alt="${m.title}" loading="lazy" />`
        : `<div class="card-poster-placeholder">🎬</div>`}
      <div class="card-body">
        <div class="card-title">${m.title}</div>
        <div class="card-meta">
          <span class="card-rating">⭐ ${m.userRating || 'Unrated'}/10</span>
        </div>
        <span class="muted">Your rating</span>
      </div>
    </div>`).join('');
}

/* ─── MOVIE GRID RENDERER ───────────────────────────────────────────────── */
function renderMovieGrid(containerId, movies) {
  const el = document.getElementById(containerId);
  if (!movies || !movies.length) { el.innerHTML = '<p class="muted">No movies found.</p>'; return; }
  el.innerHTML = movies.map(m => buildMovieCard(m)).join('');
}

function buildMovieCard(m) {
  const year = m.release_date ? m.release_date.split('-')[0] : '';
  const rating = m.vote_average ? m.vote_average.toFixed(1) : 'N/A';
  const inWatchlist = state.watchlist.some(w => w.movieId === m.id);
  const watched = state.watchedMovies.some(w => w.movieId === m.id);
  return `
    <div class="movie-card" onclick="openMovieModal(${m.id})">
      ${m.poster_path
        ? `<img class="card-poster" src="${IMG_BASE}/w342${m.poster_path}" alt="${escapeHTML(m.title)}" loading="lazy" />`
        : `<div class="card-poster-placeholder">🎬</div>`}
      ${watched ? `<span class="card-badge">✓ Watched</span>` : ''}
      <div class="card-body">
        <div class="card-title">${escapeHTML(m.title)}</div>
        <div class="card-meta">
          <span class="card-year">${year}</span>
          <span class="card-rating">⭐ ${rating}</span>
        </div>
        <div class="card-actions">
          <button class="btn-icon ${inWatchlist ? 'active-btn' : ''}"
            onclick="event.stopPropagation(); addToWatchlist(${m.id}, '${escapeQuotes(m.title)}', '${m.poster_path || ''}', ${m.vote_average || 0})">
            ${inWatchlist ? '✓ Listed' : '+ List'}
          </button>
        </div>
      </div>
    </div>`;
}

/* ─── SEARCH ────────────────────────────────────────────────────────────── */
let searchTimer;
function handleSearchInput(e) {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (!q) return;
  searchTimer = setTimeout(() => doSearch(q, 1), 500);
}

function triggerSearch() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;
  doSearch(q, 1);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement.id === 'search-input') triggerSearch();
});

async function doSearch(query, page) {
  state.searchQuery = query;
  state.searchPage = page;
  showSection('search');
  document.getElementById('search-query-label').textContent = `"${query}"`;
  if (page === 1) { renderSkeletons('search-grid', 10); }
  try {
    const data = await apiFetch(`/movies/search?query=${encodeURIComponent(query)}&page=${page}`);
    if (page === 1) {
      document.getElementById('search-grid').innerHTML = '';
    }
    if (!data.results.length && page === 1) {
      document.getElementById('search-empty').classList.remove('hidden');
      document.getElementById('load-more-search').classList.add('hidden');
    } else {
      document.getElementById('search-empty').classList.add('hidden');
      data.results.forEach(m => {
        const el = document.getElementById('search-grid');
        el.insertAdjacentHTML('beforeend', buildMovieCard(m));
      });
      const loadMoreBtn = document.getElementById('load-more-search');
      if (data.page < data.total_pages) loadMoreBtn.classList.remove('hidden');
      else loadMoreBtn.classList.add('hidden');
    }
  } catch { showToast('Search failed. Try again.', 'error'); }
}

function loadMoreSearch() {
  doSearch(state.searchQuery, state.searchPage + 1);
}

/* ─── MOVIE DETAIL MODAL ────────────────────────────────────────────────── */
async function openMovieModal(movieId) {
  document.getElementById('movie-modal').classList.add('active');
  document.getElementById('movie-modal-content').innerHTML = `
    <div style="padding: 80px; text-align:center;"><div class="spinner" style="margin:auto;"></div></div>`;
  try {
    const m = await apiFetch(`/movies/${movieId}`);
    renderMovieDetail(m);
  } catch {
    document.getElementById('movie-modal-content').innerHTML = '<p style="padding:40px; color:var(--muted);">Failed to load movie details.</p>';
  }
}

function renderMovieDetail(m) {
  const year = m.release_date ? m.release_date.split('-')[0] : '';
  const rating = m.vote_average ? m.vote_average.toFixed(1) : 'N/A';
  const runtime = m.runtime ? `${Math.floor(m.runtime / 60)}h ${m.runtime % 60}m` : '';
  const genres = (m.genres || []).map(g => `<span class="meta-chip genre">${g.name}</span>`).join('');
  const inWatchlist = state.watchlist.some(w => w.movieId === m.id);
  const watchedEntry = state.watchedMovies.find(w => w.movieId === m.id);
  const currentRating = watchedEntry ? watchedEntry.userRating : 0;

  const trailer = (m.videos?.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
  const cast = (m.credits?.cast || []).slice(0, 8);
  const similar = (m.similar?.results || m.recommendations?.results || []).slice(0, 8);

  const castHTML = cast.length ? `
    <div class="detail-section-title">🎭 Cast</div>
    <div class="cast-grid">
      ${cast.map(c => `
        <div class="cast-card">
          <img class="cast-photo" src="${c.profile_path ? IMG_BASE + '/w92' + c.profile_path : 'https://via.placeholder.com/70x70?text=?'}" alt="${escapeHTML(c.name)}" loading="lazy" />
          <div class="cast-name">${escapeHTML(c.name)}</div>
          <div class="cast-char muted">${escapeHTML(c.character || '')}</div>
        </div>`).join('')}
    </div>` : '';

  const starsHTML = Array.from({ length: 10 }, (_, i) => `
    <span class="star ${i < currentRating ? 'active' : ''}" data-val="${i + 1}"
      onclick="rateMovie(${m.id}, '${escapeQuotes(m.title)}', '${m.poster_path || ''}', ${i + 1}, this)">★</span>
  `).join('');

  const similarHTML = similar.length ? `
    <div class="detail-section-title">🎬 Similar Movies</div>
    <div class="similar-grid">
      ${similar.map(s => `
        <div class="similar-card" onclick="openMovieModal(${s.id})">
          ${s.poster_path ? `<img src="${IMG_BASE}/w185${s.poster_path}" alt="${escapeHTML(s.title)}" loading="lazy" />`
            : `<div style="aspect-ratio:2/3;background:var(--surface2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:32px;">🎬</div>`}
          <div class="similar-title">${escapeHTML(s.title)}</div>
        </div>`).join('')}
    </div>` : '';

  document.getElementById('movie-modal-content').innerHTML = `
    ${m.backdrop_path ? `<img class="detail-backdrop" src="${IMG_BASE}/w1280${m.backdrop_path}" alt="backdrop" />` : ''}
    <div class="detail-body">
      <div class="detail-header">
        <div class="detail-poster">
          ${m.poster_path ? `<img src="${IMG_BASE}/w342${m.poster_path}" alt="${escapeHTML(m.title)}" />`
            : `<div class="card-poster-placeholder" style="height:180px;">🎬</div>`}
        </div>
        <div class="detail-info">
          <div class="detail-title">${escapeHTML(m.title)}</div>
          ${m.tagline ? `<div class="detail-tagline">"${escapeHTML(m.tagline)}"</div>` : ''}
          <div class="detail-meta">
            <span class="meta-chip rating">⭐ ${rating}</span>
            ${year ? `<span class="meta-chip">📅 ${year}</span>` : ''}
            ${runtime ? `<span class="meta-chip">⏱ ${runtime}</span>` : ''}
            ${m.vote_count ? `<span class="meta-chip">${m.vote_count.toLocaleString()} votes</span>` : ''}
            ${genres}
          </div>
          <div class="detail-actions">
            <button class="btn-primary" onclick="addToWatchlist(${m.id}, '${escapeQuotes(m.title)}', '${m.poster_path || ''}', ${m.vote_average || 0})" id="wl-btn-${m.id}">
              ${inWatchlist ? '✓ In Watchlist' : '+ Watchlist'}
            </button>
            ${trailer ? `<a href="https://www.youtube.com/watch?v=${trailer.key}" target="_blank" class="btn-secondary">▶ Watch Trailer</a>` : ''}
          </div>
        </div>
      </div>
      <div class="detail-overview">${escapeHTML(m.overview || 'No overview available.')}</div>
      
      <div class="user-rating-wrap">
        <div class="detail-section-title">⭐ Your Rating</div>
        <div class="star-rating" id="stars-${m.id}">${starsHTML}</div>
      </div>
      
      ${castHTML}
      ${similarHTML}
    </div>`;
}

function closeMovieModal(e) {
  if (e && e.target !== document.getElementById('movie-modal')) return;
  if (!e) document.getElementById('movie-modal').classList.remove('active');
  else document.getElementById('movie-modal').classList.remove('active');
}

/* ─── WATCHLIST ACTIONS ─────────────────────────────────────────────────── */
async function addToWatchlist(movieId, title, poster, rating) {
  if (!state.token) { showToast('Please log in to use watchlist.', 'error'); return; }
  if (state.watchlist.some(w => w.movieId === movieId)) {
    showToast(`"${title}" is already in your watchlist.`, 'info'); return;
  }
  try {
    const res = await apiFetch('/movies/watchlist/add', 'POST', { movieId, title, poster, rating }, true);
    state.watchlist = res.watchlist;
    syncUserStorage();
    showToast(`"${title}" added to watchlist! 📋`, 'success');
    // Update button in modal if open
    const btn = document.getElementById(`wl-btn-${movieId}`);
    if (btn) { btn.textContent = '✓ In Watchlist'; }
  } catch (err) {
    showToast(err.message || 'Failed to add to watchlist.', 'error');
  }
}

async function removeFromWatchlist(movieId) {
  if (!state.token) return;
  try {
    const res = await apiFetch(`/movies/watchlist/${movieId}`, 'DELETE', null, true);
    state.watchlist = res.watchlist;
    syncUserStorage();
    showToast('Removed from watchlist.', 'info');
    renderWatchlistSection();
  } catch (err) {
    showToast('Failed to remove from watchlist.', 'error');
  }
}

/* ─── RATING ────────────────────────────────────────────────────────────── */
async function rateMovie(movieId, title, poster, rating, starEl) {
  if (!state.token) { showToast('Please log in to rate movies.', 'error'); return; }
  // Highlight stars
  const container = starEl.closest('.star-rating');
  container.querySelectorAll('.star').forEach((s, i) => {
    s.classList.toggle('active', i < rating);
  });
  try {
    const res = await apiFetch('/movies/watched/add', 'POST', { movieId, title, poster, userRating: rating }, true);
    state.watchedMovies = res.watchedMovies;
    syncUserStorage();
    showToast(`Rated "${title}" ${rating}/10 ⭐`, 'success');
  } catch (err) {
    showToast('Failed to save rating.', 'error');
  }
}

/* ─── API FETCH HELPER ──────────────────────────────────────────────────── */
async function apiFetch(endpoint, method = 'GET', body = null, auth = false) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (auth && state.token) opts.headers['Authorization'] = `Bearer ${state.token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

/* ─── SKELETON LOADERS ──────────────────────────────────────────────────── */
function renderSkeletons(containerId, count) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array(count).fill(`<div class="skeleton skeleton-card"></div>`).join('');
}

/* ─── TOAST ─────────────────────────────────────────────────────────────── */
let toastTimer;
function showToast(message, type = 'info') {
  const el = document.getElementById('toast');
  el.className = `toast ${type}`;
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

/* ─── LOADER ────────────────────────────────────────────────────────────── */
function showLoader() { document.getElementById('page-loader').classList.remove('hidden'); }
function hideLoader() { document.getElementById('page-loader').classList.add('hidden'); }

/* ─── HELPERS ───────────────────────────────────────────────────────────── */
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeQuotes(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function syncUserStorage() {
  if (state.user) {
    state.user.watchlist = state.watchlist;
    state.user.watchedMovies = state.watchedMovies;
    localStorage.setItem('cinematch_user', JSON.stringify(state.user));
  }
}
