/* ═══════════════════════════════════════════════════════════════════════════
   CineMatch — app.js   (complete clean version)
   All IDs match index.html exactly. No .active/.hidden — uses .show/.d-none.
═══════════════════════════════════════════════════════════════════════════ */

// Works from any origin: Live Server (127.0.0.1:5500), Express (localhost:5500), etc.
const API_BASE = `${window.location.protocol}//${window.location.hostname}:5000/api`;
const IMG_BASE  = 'https://image.tmdb.org/t/p';

/* ─── STATE ──────────────────────────────────────────────────────────────── */
let S = {
  user: null, token: null,
  genres: [], watchlist: [], watchedMovies: [],
  heroMovies: [], heroIdx: 0,
  searchQuery: '', searchPage: 1
};

/* ─── BOOT ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const tok  = localStorage.getItem('cm_token');
  const usr  = localStorage.getItem('cm_user');
  if (tok && usr) {
    try {
      S.token         = tok;
      S.user          = JSON.parse(usr);
      S.watchlist     = S.user.watchlist     || [];
      S.watchedMovies = S.user.watchedMovies || [];
      hideAuthModal();
      bootApp();
    } catch {
      localStorage.clear();
      loadGenrePickerList();
    }
  } else {
    loadGenrePickerList();
  }
});

function bootApp() {
  clearInterval(window._hero);
  // show username + logout
  $('nav-username').textContent = `👤 ${S.user.username}`;
  $('logout-btn').classList.remove('d-none');
  // reset to home section
  document.querySelectorAll('.section').forEach(s => s.classList.remove('show'));
  $('section-home').classList.add('show');
  fetchGenres();
  loadHome();
}

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
function $(id)          { return document.getElementById(id); }
function show(id)       { $(id).classList.remove('d-none'); }
function hide(id)       { $(id).classList.add('d-none'); }
function esc(str)       { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escA(str)      { return String(str||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }

/* ─── AUTH MODAL ─────────────────────────────────────────────────────────── */
function showAuthModal() { $('auth-modal').classList.add('show'); }
function hideAuthModal() { $('auth-modal').classList.remove('show'); }

function switchTab(tab) {
  const isLogin = (tab === 'login');
  $('login-form').classList.toggle('d-none', !isLogin);
  $('register-form').classList.toggle('d-none', isLogin);
  $('tab-login').classList.toggle('selected', isLogin);
  $('tab-register').classList.toggle('selected', !isLogin);
  $('login-error').textContent    = '';
  $('register-error').textContent = '';
}

/* ─── LOGIN ──────────────────────────────────────────────────────────────── */
async function handleLogin(e) {
  if (e && e.preventDefault) e.preventDefault();
  const email    = $('login-email').value.trim();
  const password = $('login-password').value.trim();
  const btn      = $('login-btn');
  $('login-error').textContent = '';

  if (!email)    { $('login-error').textContent = 'Email is required.'; return; }
  if (!password) { $('login-error').textContent = 'Password is required.'; return; }

  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const data = await api('/auth/login', 'POST', { email, password });
    saveSession(data);
    hideAuthModal();
    bootApp();
    toast(`Welcome back, ${data.username}! 🎬`, 'success');
  } catch(err) {
    const msg = err.message || 'Login failed.';
    $('login-error').textContent = msg.includes('503') || msg.includes('Database')
      ? '⚠️ Database not connected. Fix MongoDB Atlas and restart the server.'
      : msg;
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

/* ─── REGISTER ───────────────────────────────────────────────────────────── */
async function handleRegister(e) {
  if (e && e.preventDefault) e.preventDefault();
  const username = $('reg-username').value.trim();
  const email    = $('reg-email').value.trim();
  const password = $('reg-password').value.trim();
  const genres   = [...document.querySelectorAll('.genre-pick-chip.selected')]
                    .map(el => Number(el.dataset.id));
  const btn      = $('register-btn');
  $('register-error').textContent = '';

  // Client-side validation
  if (!username)             { $('register-error').textContent = 'Username is required.'; return; }
  if (username.length < 3)   { $('register-error').textContent = 'Username must be at least 3 characters.'; return; }
  if (!email)                { $('register-error').textContent = 'Email is required.'; return; }
  if (!password)             { $('register-error').textContent = 'Password is required.'; return; }
  if (password.length < 6)   { $('register-error').textContent = 'Password must be at least 6 characters.'; return; }

  btn.disabled = true; btn.textContent = 'Creating account…';
  try {
    const data = await api('/auth/register', 'POST', { username, email, password, favoriteGenres: genres });
    saveSession(data);
    hideAuthModal();
    bootApp();
    toast(`Welcome, ${data.username}! 🎉`, 'success');
  } catch(err) {
    $('register-error').textContent = err.message || 'Registration failed.';
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}

function saveSession(data) {
  S.token = data.token; S.user = data;
  S.watchlist = data.watchlist || [];
  S.watchedMovies = data.watchedMovies || [];
  localStorage.setItem('cm_token', data.token);
  localStorage.setItem('cm_user',  JSON.stringify(data));
}

function logout() {
  clearInterval(window._hero);
  S.token = null; S.user = null; S.watchlist = []; S.watchedMovies = [];
  localStorage.removeItem('cm_token');
  localStorage.removeItem('cm_user');
  $('nav-username').textContent = '';
  hide('logout-btn');
  // reset home section visible
  document.querySelectorAll('.section').forEach(s => s.classList.remove('show'));
  $('section-home').classList.add('show');
  showAuthModal();
  loadGenrePickerList();
  toast('Logged out.', 'info');
}

/* ─── GENRES ─────────────────────────────────────────────────────────────── */
async function fetchGenres() {
  try {
    const d = await api('/movies/genres');
    S.genres = d.genres || [];
    buildGenreFilter();
  } catch { /* non-fatal */ }
}

async function loadGenrePickerList() {
  try {
    const d = await api('/movies/genres');
    S.genres = d.genres || [];
  } catch {
    S.genres = [
      {id:28,name:'Action'},{id:12,name:'Adventure'},{id:16,name:'Animation'},
      {id:35,name:'Comedy'},{id:80,name:'Crime'},{id:18,name:'Drama'},
      {id:14,name:'Fantasy'},{id:27,name:'Horror'},{id:9648,name:'Mystery'},
      {id:10749,name:'Romance'},{id:878,name:'Sci-Fi'},{id:53,name:'Thriller'}
    ];
  }
  buildGenrePicker();
}

function buildGenrePicker() {
  const el = $('genre-picker'); if (!el) return;
  el.innerHTML = S.genres.map(g =>
    `<span class="genre-pick-chip" data-id="${g.id}" onclick="this.classList.toggle('selected')">${g.name}</span>`
  ).join('');
}

function buildGenreFilter() {
  const el = $('genre-filter'); if (!el) return;
  el.innerHTML = S.genres.map(g =>
    `<span class="genre-chip" data-id="${g.id}" onclick="pickGenre(${g.id},this)">${g.name}</span>`
  ).join('');
}

let _selectedGenres = [];
async function pickGenre(id, el) {
  const i = _selectedGenres.indexOf(id);
  if (i === -1) { _selectedGenres.push(id); el.classList.add('selected'); }
  else          { _selectedGenres.splice(i,1); el.classList.remove('selected'); }
  const g = $('genre-grid');
  if (!_selectedGenres.length) { g.innerHTML=''; return; }
  skeletons('genre-grid', 8);
  try {
    const d = await api(`/movies/discover/by-genre?genreIds=${_selectedGenres.join(',')}`);
    renderGrid('genre-grid', d.results);
  } catch(err) { g.innerHTML = err$(err); }
}

/* ─── SECTIONS ───────────────────────────────────────────────────────────── */
function goHome() { showSection('home'); }

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('show'));
  $(`section-${name}`).classList.add('show');
  window.scrollTo({top:0, behavior:'smooth'});
  if      (name === 'home')        loadHome();
  else if (name === 'recommended') loadRecommended();
  else if (name === 'watchlist')   renderWatchlist();
  else if (name === 'watched')     renderWatched();
}

/* ─── HOME ───────────────────────────────────────────────────────────────── */
async function loadHome() {
  skeletons('trending-grid', 8);
  skeletons('toprated-grid', 8);
  try {
    const [trending, toprated] = await Promise.all([
      api('/movies/trending'),
      api('/movies/top-rated')
    ]);
    S.heroMovies = (trending.results||[]).slice(0,5);
    S.heroIdx = 0;
    renderHero();
    clearInterval(window._hero);
    window._hero = setInterval(() => {
      S.heroIdx = (S.heroIdx + 1) % S.heroMovies.length;
      renderHero();
    }, 6000);
    renderGrid('trending-grid', trending.results);
    renderGrid('toprated-grid', toprated.results);
  } catch(err) {
    const m = err$(err);
    $('trending-grid').innerHTML = m;
    $('toprated-grid').innerHTML = m;
  }
}

function renderHero() {
  if (!S.heroMovies.length) return;
  const m = S.heroMovies[S.heroIdx];
  const banner = $('hero-banner');
  if (m.backdrop_path) {
    let bg = banner.querySelector('.hero-bg');
    if (!bg) { bg = document.createElement('img'); bg.className='hero-bg'; banner.prepend(bg); }
    bg.src = `${IMG_BASE}/original${m.backdrop_path}`;
    bg.alt = m.title;
  }
  const yr  = m.release_date ? m.release_date.slice(0,4) : '';
  const rat = m.vote_average ? m.vote_average.toFixed(1) : 'N/A';
  $('hero-info').innerHTML = `
    <div class="hero-title">${esc(m.title)}</div>
    <div class="hero-meta">
      <span class="meta-chip rating">⭐ ${rat}</span>
      ${yr ? `<span class="meta-chip">${yr}</span>` : ''}
    </div>
    <div class="hero-overview">${esc(m.overview||'')}</div>
    <div class="hero-btns">
      <button class="btn-primary" data-id="${m.id}" onclick="openMovie(this.dataset.id)">▶ Details</button>
      <button class="btn-secondary"
        data-id="${m.id}" data-title="${escA(m.title)}"
        data-poster="${m.poster_path||''}" data-rat="${m.vote_average||0}"
        onclick="addWatch(+this.dataset.id,this.dataset.title,this.dataset.poster,+this.dataset.rat)">
        + Watchlist
      </button>
    </div>`;
}

/* ─── RECOMMENDED ────────────────────────────────────────────────────────── */
async function loadRecommended() {
  skeletons('recommended-grid', 12);
  try {
    const d = S.token
      ? await api('/movies/recommendations/personal','GET',null,true)
      : await api('/movies/popular');
    renderGrid('recommended-grid', d.results);
  } catch(err) { $('recommended-grid').innerHTML = err$(err); }
}

/* ─── WATCHLIST ──────────────────────────────────────────────────────────── */
function renderWatchlist() {
  const g = $('watchlist-grid'), e = $('watchlist-empty');
  if (!S.watchlist.length) { g.innerHTML=''; show('watchlist-empty'); return; }
  hide('watchlist-empty');
  g.innerHTML = S.watchlist.map(m => `
    <div class="movie-card" data-id="${m.movieId}" onclick="openMovie(this.dataset.id)">
      ${m.poster ? `<img class="card-poster" src="${IMG_BASE}/w342${m.poster}" alt="${escA(m.title)}" loading="lazy">`
                 : `<div class="card-poster-ph">🎬</div>`}
      <div class="card-body">
        <div class="card-title">${esc(m.title)}</div>
        <div class="card-meta"><span class="card-rating">⭐ ${m.rating?Number(m.rating).toFixed(1):'N/A'}</span></div>
        <div class="card-actions">
          <button class="btn-icon" data-id="${m.movieId}"
            onclick="event.stopPropagation();removeWatch(+this.dataset.id)">🗑 Remove</button>
        </div>
      </div>
    </div>`).join('');
}

/* ─── WATCHED ────────────────────────────────────────────────────────────── */
function renderWatched() {
  const g = $('watched-grid');
  if (!S.watchedMovies.length) { g.innerHTML=''; show('watched-empty'); return; }
  hide('watched-empty');
  g.innerHTML = S.watchedMovies.map(m => `
    <div class="movie-card" data-id="${m.movieId}" onclick="openMovie(this.dataset.id)">
      ${m.poster ? `<img class="card-poster" src="${IMG_BASE}/w342${m.poster}" alt="${escA(m.title)}" loading="lazy">`
                 : `<div class="card-poster-ph">🎬</div>`}
      <div class="card-body">
        <div class="card-title">${esc(m.title)}</div>
        <div class="card-meta"><span class="card-rating">⭐ ${m.userRating?m.userRating+'/10':'Unrated'}</span></div>
      </div>
    </div>`).join('');
}

/* ─── MOVIE GRID ─────────────────────────────────────────────────────────── */
function renderGrid(id, movies) {
  const el = $(id); if (!el) return;
  if (!movies||!movies.length) { el.innerHTML='<p class="text-muted" style="padding:20px">No movies found.</p>'; return; }
  el.innerHTML = movies.map(m => movieCard(m)).join('');
}

function movieCard(m) {
  const yr   = m.release_date ? m.release_date.slice(0,4) : '';
  const rat  = m.vote_average ? m.vote_average.toFixed(1) : 'N/A';
  const inWL = S.watchlist.some(w => w.movieId === m.id);
  const seen = S.watchedMovies.some(w => w.movieId === m.id);
  return `
  <div class="movie-card" data-id="${m.id}" onclick="openMovie(this.dataset.id)">
    ${m.poster_path
      ? `<img class="card-poster" src="${IMG_BASE}/w342${m.poster_path}" alt="${escA(m.title)}" loading="lazy">`
      : `<div class="card-poster-ph">🎬</div>`}
    ${seen ? `<span class="card-badge">✓ Watched</span>` : ''}
    <div class="card-body">
      <div class="card-title">${esc(m.title)}</div>
      <div class="card-meta">
        <span class="card-year">${yr}</span>
        <span class="card-rating">⭐ ${rat}</span>
      </div>
      <div class="card-actions">
        <button class="btn-icon ${inWL?'in-list':''}"
          data-id="${m.id}" data-title="${escA(m.title)}"
          data-poster="${m.poster_path||''}" data-rat="${m.vote_average||0}"
          onclick="event.stopPropagation();addWatch(+this.dataset.id,this.dataset.title,this.dataset.poster,+this.dataset.rat)">
          ${inWL ? '✓ Listed' : '+ List'}
        </button>
      </div>
    </div>
  </div>`;
}

/* ─── SEARCH ─────────────────────────────────────────────────────────────── */
let _st;
function onSearchInput(e) {
  clearTimeout(_st);
  const q = e.target.value.trim();
  if (q.length < 2) return;
  _st = setTimeout(() => runSearch(q, 1), 500);
}
function onSearchKey(e) { if (e.key==='Enter') triggerSearch(); }
function triggerSearch() {
  const q = $('search-input').value.trim();
  if (q) runSearch(q, 1);
}

async function runSearch(query, page) {
  S.searchQuery = query; S.searchPage = page;
  // Switch section directly — no showSection() to avoid loadHome re-trigger
  document.querySelectorAll('.section').forEach(s => s.classList.remove('show'));
  $('section-search').classList.add('show');
  window.scrollTo({top:0, behavior:'smooth'});
  $('search-label').textContent = `"${query}"`;
  if (page===1) {
    skeletons('search-grid', 10);
    hide('search-empty'); hide('load-more-btn');
  }
  try {
    const d = await api(`/movies/search?query=${encodeURIComponent(query)}&page=${page}`);
    if (page===1) $('search-grid').innerHTML = '';
    if (!d.results||!d.results.length) {
      show('search-empty'); hide('load-more-btn');
    } else {
      hide('search-empty');
      d.results.forEach(m => $('search-grid').insertAdjacentHTML('beforeend', movieCard(m)));
      d.page < d.total_pages ? show('load-more-btn') : hide('load-more-btn');
    }
  } catch(err) { $('search-grid').innerHTML = err$(err); }
}
function loadMoreSearch() { runSearch(S.searchQuery, S.searchPage + 1); }

/* ─── MOVIE DETAIL MODAL ─────────────────────────────────────────────────── */
async function openMovie(movieId) {
  $('movie-modal').classList.add('show');
  $('movie-modal-content').innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;
  try {
    const m = await api(`/movies/${movieId}`);
    renderDetail(m);
  } catch(err) {
    $('movie-modal-content').innerHTML = `<p style="padding:40px;color:var(--muted)">${err.message}</p>`;
  }
}
function closeMovieModal() { $('movie-modal').classList.remove('show'); }
function onBackdropClick(e) { if (e.target===$('movie-modal')) closeMovieModal(); }

function renderDetail(m) {
  const yr  = m.release_date ? m.release_date.slice(0,4) : '';
  const rat = m.vote_average ? m.vote_average.toFixed(1) : 'N/A';
  const rt  = m.runtime ? `${Math.floor(m.runtime/60)}h ${m.runtime%60}m` : '';
  const genres  = (m.genres||[]).map(g=>`<span class="meta-chip genre">${esc(g.name)}</span>`).join('');
  const inWL    = S.watchlist.some(w=>w.movieId===m.id);
  const seen    = S.watchedMovies.find(w=>w.movieId===m.id);
  const curStar = seen ? seen.userRating : 0;
  const trailer = (m.videos?.results||[]).find(v=>v.type==='Trailer'&&v.site==='YouTube');
  const cast    = (m.credits?.cast||[]).slice(0,8);
  const similar = (m.similar?.results||m.recommendations?.results||[]).slice(0,8);

  const svgPh = `<svg width="70" height="70" viewBox="0 0 70 70"><rect width="70" height="70" rx="35" fill="#2a2a3d"/><circle cx="35" cy="27" r="11" fill="#5c5c7a"/><ellipse cx="35" cy="58" rx="18" ry="12" fill="#5c5c7a"/></svg>`;

  const castHTML = cast.length ? `
    <div class="detail-sec-title">🎭 Cast</div>
    <div class="cast-grid">${cast.map(c=>`
      <div class="cast-card">
        ${c.profile_path
          ? `<img class="cast-photo" src="${IMG_BASE}/w92${c.profile_path}" alt="${escA(c.name)}" loading="lazy">`
          : `<div class="cast-photo-ph">${svgPh}</div>`}
        <div class="cast-name">${esc(c.name)}</div>
        <div class="cast-char text-muted">${esc(c.character||'')}</div>
      </div>`).join('')}
    </div>` : '';

  const stars = Array.from({length:10},(_,i)=>`
    <span class="star ${i<curStar?'on':''}"
      data-mid="${m.id}" data-title="${escA(m.title)}"
      data-poster="${m.poster_path||''}" data-v="${i+1}"
      onclick="rateStar(+this.dataset.mid,this.dataset.title,this.dataset.poster,+this.dataset.v,this)">★</span>`
  ).join('');

  const simHTML = similar.length ? `
    <div class="detail-sec-title">🎬 Similar Movies</div>
    <div class="similar-grid">${similar.map(s=>`
      <div class="similar-card" data-id="${s.id}" onclick="openMovie(this.dataset.id)">
        ${s.poster_path
          ? `<img src="${IMG_BASE}/w185${s.poster_path}" alt="${escA(s.title)}" loading="lazy">`
          : `<div style="aspect-ratio:2/3;background:var(--surface2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:32px">🎬</div>`}
        <div class="similar-title">${esc(s.title)}</div>
      </div>`).join('')}
    </div>` : '';

  $('movie-modal-content').innerHTML = `
    ${m.backdrop_path ? `<img class="detail-backdrop" src="${IMG_BASE}/w1280${m.backdrop_path}" alt="backdrop">` : ''}
    <div class="detail-body">
      <div class="detail-header">
        <div class="detail-poster">
          ${m.poster_path
            ? `<img src="${IMG_BASE}/w342${m.poster_path}" alt="${escA(m.title)}">`
            : `<div class="card-poster-ph" style="height:180px">🎬</div>`}
        </div>
        <div class="detail-info">
          <div class="detail-title">${esc(m.title)}</div>
          ${m.tagline ? `<div class="detail-tagline">"${esc(m.tagline)}"</div>` : ''}
          <div class="detail-meta">
            <span class="meta-chip rating">⭐ ${rat}</span>
            ${yr  ? `<span class="meta-chip">📅 ${yr}</span>` : ''}
            ${rt  ? `<span class="meta-chip">⏱ ${rt}</span>` : ''}
            ${m.vote_count ? `<span class="meta-chip">${m.vote_count.toLocaleString()} votes</span>` : ''}
            ${genres}
          </div>
          <div class="detail-actions">
            <button class="${inWL?'btn-primary in-list':'btn-primary'}" id="wl-${m.id}"
              data-id="${m.id}" data-title="${escA(m.title)}"
              data-poster="${m.poster_path||''}" data-rat="${m.vote_average||0}"
              onclick="addWatch(+this.dataset.id,this.dataset.title,this.dataset.poster,+this.dataset.rat)">
              ${inWL ? '✓ In Watchlist' : '+ Watchlist'}
            </button>
            ${trailer
              ? `<a href="https://www.youtube.com/watch?v=${trailer.key}" target="_blank" rel="noopener" class="btn-secondary">▶ Trailer</a>`
              : ''}
          </div>
        </div>
      </div>
      <div class="detail-overview">${esc(m.overview||'No overview available.')}</div>
      <div class="user-rating-wrap">
        <div class="detail-sec-title">⭐ Your Rating</div>
        <div class="star-rating">${stars}</div>
      </div>
      ${castHTML}
      ${simHTML}
    </div>`;
}

/* ─── WATCHLIST ACTIONS ──────────────────────────────────────────────────── */
async function addWatch(movieId, title, poster, rating) {
  if (!S.token) { toast('Please log in first.', 'error'); return; }
  if (S.watchlist.some(w=>w.movieId===movieId)) { toast(`"${title}" already in watchlist.`,'info'); return; }
  try {
    const r = await api('/movies/watchlist/add','POST',{movieId,title,poster,rating},true);
    S.watchlist = r.watchlist; syncStorage();
    toast(`Added "${title}" to watchlist! 📋`,'success');
    const btn = $(`wl-${movieId}`);
    if (btn) { btn.textContent='✓ In Watchlist'; btn.classList.add('in-list'); }
  } catch(err) { toast(err.message,'error'); }
}

async function removeWatch(movieId) {
  if (!S.token) return;
  try {
    const r = await api(`/movies/watchlist/${movieId}`,'DELETE',null,true);
    S.watchlist = r.watchlist; syncStorage();
    toast('Removed from watchlist.','info');
    renderWatchlist();
  } catch(err) { toast(err.message,'error'); }
}

/* ─── RATING ─────────────────────────────────────────────────────────────── */
async function rateStar(movieId, title, poster, val, el) {
  if (!S.token) { toast('Please log in to rate.','error'); return; }
  el.closest('.star-rating').querySelectorAll('.star')
    .forEach((s,i) => s.classList.toggle('on', i < val));
  try {
    const r = await api('/movies/watched/add','POST',{movieId,title,poster,userRating:val},true);
    S.watchedMovies = r.watchedMovies; syncStorage();
    toast(`Rated "${title}" ${val}/10 ⭐`,'success');
  } catch(err) { toast(err.message,'error'); }
}

/* ─── API ────────────────────────────────────────────────────────────────── */
async function api(endpoint, method='GET', body=null, auth=false) {
  const opts = { method, headers: {'Content-Type':'application/json'} };
  if (auth && S.token) opts.headers['Authorization'] = `Bearer ${S.token}`;
  if (body) opts.body = JSON.stringify(body);
  let res;
  try { res = await fetch(`${API_BASE}${endpoint}`, opts); }
  catch { throw new Error('Cannot reach server — is it running?'); }
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
  return data;
}

/* ─── SKELETONS ──────────────────────────────────────────────────────────── */
function skeletons(id, n) {
  const el = $(id); if (!el) return;
  el.innerHTML = Array(n).fill(`<div class="skeleton skeleton-card"></div>`).join('');
}

/* ─── TOAST ──────────────────────────────────────────────────────────────── */
let _tt;
function toast(msg, type='info') {
  const el = $('toast');
  el.className = `toast ${type}`;
  el.textContent = msg;
  el.classList.remove('d-none');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.add('d-none'), 3500);
}

/* ─── SYNC ───────────────────────────────────────────────────────────────── */
function syncStorage() {
  if (S.user) {
    S.user.watchlist = S.watchlist;
    S.user.watchedMovies = S.watchedMovies;
    localStorage.setItem('cm_user', JSON.stringify(S.user));
  }
}

/* ─── ERROR HTML ─────────────────────────────────────────────────────────── */
function err$(err) {
  return `<p class="text-muted" style="padding:20px;grid-column:1/-1">⚠️ ${esc(err.message)}</p>`;
}
