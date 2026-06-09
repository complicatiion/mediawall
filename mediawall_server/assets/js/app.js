(() => {
  "use strict";

  const app = {
    csrf: '',
    user: '',
    library: { items: [], folders: [], stats: { total: 0, videos: 0, pictures: 0 }, label: '', mode: '', updatedAt: 0 },
    currentView: 'home',
    currentFolderPath: '',
    searchTerm: '',
    queue: [],
    queueIndex: -1,
    favorites: loadLocal('mediawall_v8_favorites', []),
    navBack: [],
    navForward: [],
    currentId: '',
    repeat: false,
    shuffle: false
  };

  const els = {
    loginScreen: document.getElementById('loginScreen'),
    loginForm: document.getElementById('loginForm'),
    loginError: document.getElementById('loginError'),
    appShell: document.getElementById('appShell'),
    searchInput: document.getElementById('searchInput'),
    searchResults: document.getElementById('searchResults'),
    content: document.getElementById('content'),
    queueList: document.getElementById('queueList'),
    queueSummary: document.getElementById('queueSummary'),
    clearQueueButton: document.getElementById('clearQueueButton'),
    queueNowThumb: document.getElementById('queueNowThumb'),
    queueNowFallback: document.getElementById('queueNowFallback'),
    queueNowTitle: document.getElementById('queueNowTitle'),
    queueNowMeta: document.getElementById('queueNowMeta'),
    playerVideo: document.getElementById('playerVideo'),
    playerStage: document.getElementById('playerStage'),
    videoStage: document.getElementById('videoStage'),
    imageStage: document.getElementById('imageStage'),
    stageTitle: document.getElementById('stageTitle'),
    stageMeta: document.getElementById('stageMeta'),
    playerDock: document.getElementById('playerDock'),
    dockTitle: document.getElementById('dockTitle'),
    dockMeta: document.getElementById('dockMeta'),
    prevButton: document.getElementById('prevButton'),
    playPauseButton: document.getElementById('playPauseButton'),
    playPauseIcon: document.getElementById('playPauseIcon'),
    nextButton: document.getElementById('nextButton'),
    progressInput: document.getElementById('progressInput'),
    currentTime: document.getElementById('currentTime'),
    durationTime: document.getElementById('durationTime'),
    randomButton: document.getElementById('randomButton'),
    rescanButton: document.getElementById('rescanButton'),
    logoutButton: document.getElementById('logoutButton'),
    settingsButton: document.getElementById('settingsButton'),
    settingsDrawer: document.getElementById('settingsDrawer'),
    settingsBackdrop: document.getElementById('settingsBackdrop'),
    closeSettingsButton: document.getElementById('closeSettingsButton'),
    settingsLibraryLabel: document.getElementById('settingsLibraryLabel'),
    settingsLibraryMode: document.getElementById('settingsLibraryMode'),
    settingsVideoCount: document.getElementById('settingsVideoCount'),
    settingsPictureCount: document.getElementById('settingsPictureCount'),
    settingsLastScan: document.getElementById('settingsLastScan')
  };

  function loadLocal(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const data = JSON.parse(raw);
      return Array.isArray(fallback) ? (Array.isArray(data) ? data : fallback) : (data ?? fallback);
    } catch {
      return fallback;
    }
  }

  function saveLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function normalizeText(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function uniqueStrings(list) {
    return Array.from(new Set((list || []).filter(Boolean)));
  }

  function formatBytes(value) {
    const num = Number(value || 0);
    if (num <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const power = Math.min(Math.floor(Math.log(num) / Math.log(1024)), units.length - 1);
    const scaled = num / Math.pow(1024, power);
    return `${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1)} ${units[power]}`;
  }

  function formatDuration(value) {
    const total = Math.max(0, Math.floor(Number(value || 0)));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function buildThumbUrl(id) {
    return `api/thumb.php?id=${encodeURIComponent(id)}`;
  }

  function buildStreamUrl(id) {
    return `api/stream.php?id=${encodeURIComponent(id)}`;
  }

  function getAllItems() {
    return Array.isArray(app.library.items) ? app.library.items.slice() : [];
  }

  function getVideoItems() {
    return getAllItems().filter(item => item.type === 'video');
  }

  function getPictureItems() {
    return getAllItems().filter(item => item.type === 'image');
  }

  function getItemById(id) {
    return getAllItems().find(item => item.id === id) || null;
  }

  function isFavorite(id) {
    return app.favorites.includes(id);
  }

  function toggleFavorite(id) {
    if (!id) return;
    if (isFavorite(id)) app.favorites = app.favorites.filter(entry => entry !== id);
    else app.favorites = uniqueStrings(app.favorites.concat([id]));
    saveLocal('mediawall_v8_favorites', app.favorites);
    renderCurrentView();
    renderQueue();
  }

  function setAuthState(authenticated, payload) {
    els.loginScreen.hidden = authenticated;
    els.appShell.hidden = !authenticated;
    if (authenticated) {
      app.csrf = payload.csrf || '';
      app.user = payload.user || '';
    }
  }

  async function apiJson(url, options = {}) {
    const config = { credentials: 'same-origin', ...options };
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({ ok: false, error: 'Invalid server response.' }));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  }

  async function checkSession() {
    try {
      const data = await apiJson('api/session.php');
      setAuthState(!!data.authenticated, data);
      if (data.authenticated) {
        await loadLibrary(false);
      }
    } catch (error) {
      showLoginError(error.message || 'Session check failed.');
    }
  }

  function showLoginError(message) {
    els.loginError.textContent = message;
    els.loginError.hidden = !message;
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    showLoginError('');
    const form = new FormData(els.loginForm);
    const payload = {
      username: String(form.get('username') || ''),
      password: String(form.get('password') || ''),
      website: String(form.get('website') || '')
    };
    try {
      const data = await apiJson('api/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setAuthState(true, data);
      els.loginForm.reset();
      await loadLibrary(false);
    } catch (error) {
      showLoginError(error.message || 'Login failed.');
    }
  }

  async function logout() {
    try { await apiJson('api/logout.php', { method: 'POST' }); } catch {}
    app.csrf = '';
    app.user = '';
    app.library = { items: [], folders: [], stats: { total: 0, videos: 0, pictures: 0 }, label: '', mode: '', updatedAt: 0 };
    app.queue = [];
    app.queueIndex = -1;
    app.currentId = '';
    stopPlayback();
    setAuthState(false, {});
  }

  async function loadLibrary(force) {
    const data = await apiJson(force ? 'api/scan.php' : 'api/library.php', {
      method: force ? 'POST' : 'GET',
      headers: force ? { 'X-CSRF-Token': app.csrf } : undefined
    });
    app.library = data.library || app.library;
    if (!Array.isArray(app.library.items)) app.library.items = [];
    if (!Array.isArray(app.library.folders)) app.library.folders = [];
    if (!app.navBack.length) app.navBack = [];
    updateSettings();
    renderCurrentView();
    renderQueue();
  }

  function updateSettings() {
    els.settingsLibraryLabel.textContent = app.library.label || '—';
    els.settingsLibraryMode.textContent = app.library.mode || '—';
    els.settingsVideoCount.textContent = String(app.library.stats?.videos || 0);
    els.settingsPictureCount.textContent = String(app.library.stats?.pictures || 0);
    els.settingsLastScan.textContent = app.library.updatedAt ? new Date(app.library.updatedAt * 1000).toLocaleString() : '—';
  }

  function navigate(view, opts = {}) {
    const snapshot = {
      view: app.currentView,
      folderPath: app.currentFolderPath,
      searchTerm: app.searchTerm
    };
    if (!opts.silent) app.navBack.push(snapshot);
    app.navForward = [];
    app.currentView = view;
    if (view !== 'folders') app.currentFolderPath = '';
    renderCurrentView();
  }

  function goBack() {
    const state = app.navBack.pop();
    if (!state) return;
    app.navForward.push({ view: app.currentView, folderPath: app.currentFolderPath, searchTerm: app.searchTerm });
    app.currentView = state.view || 'home';
    app.currentFolderPath = state.folderPath || '';
    renderCurrentView();
  }

  function goForward() {
    const state = app.navForward.pop();
    if (!state) return;
    app.navBack.push({ view: app.currentView, folderPath: app.currentFolderPath, searchTerm: app.searchTerm });
    app.currentView = state.view || 'home';
    app.currentFolderPath = state.folderPath || '';
    renderCurrentView();
  }

  function renderNavState() {
    document.querySelectorAll('.nav-button').forEach(button => {
      button.classList.toggle('is-active', button.dataset.nav === app.currentView);
    });
  }

  function cardTopActions(item) {
    return `<div class="card-top-actions">
      <button class="icon-button" type="button" data-play-item="${escapeHtml(item.id)}" title="Play">${playIcon()}</button>
      <button class="icon-button" type="button" data-toggle-favorite="${escapeHtml(item.id)}" title="Toggle favorite">${favoriteIcon(item.id)}</button>
    </div>`;
  }

  function playIcon() {
    return `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5Z"></path></svg>`;
  }

  function favoriteIcon(id) {
    const filled = isFavorite(id);
    return filled
      ? `<svg viewBox="0 0 24 24"><path d="M6 3h12a2 2 0 0 1 2 2v16l-8-4-8 4V5a2 2 0 0 1 2-2Z"></path></svg>`
      : `<svg viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 3h12a2 2 0 0 1 2 2v16l-8-4-8 4V5a2 2 0 0 1 2-2Zm0 2v12.764l6-3 6 3V5H6Z"></path></svg>`;
  }

  function imageCard(item) {
    return `<article class="media-card">
      <div class="media-thumb-wrap">
        <button class="media-thumb-hit" type="button" data-open-item="${escapeHtml(item.id)}" aria-label="Open ${escapeHtml(item.title)}">
          <img class="media-thumb" src="${buildThumbUrl(item.id)}" alt="">
        </button>
        ${cardTopActions(item)}
      </div>
      <div class="media-card-body">
        <strong class="media-title">${escapeHtml(item.title)}</strong>
        <span class="media-subtitle">${escapeHtml(item.folderPath || 'Root')} • ${escapeHtml(item.extension.toUpperCase())}</span>
      </div>
    </article>`;
  }

  function videoCard(item) {
    return `<article class="media-card">
      <div class="media-thumb-wrap">
        <button class="media-thumb-hit" type="button" data-open-item="${escapeHtml(item.id)}" aria-label="Open ${escapeHtml(item.title)}">
          <img class="media-thumb" src="${buildThumbUrl(item.id)}" alt="">
        </button>
        ${cardTopActions(item)}
      </div>
      <div class="media-card-body">
        <strong class="media-title">${escapeHtml(item.title)}</strong>
        <span class="media-subtitle">${escapeHtml(item.folderPath || 'Root')} • ${escapeHtml(item.extension.toUpperCase())}${item.duration ? ` • ${escapeHtml(formatDuration(item.duration))}` : ''}</span>
      </div>
    </article>`;
  }

  function folderCard(folder) {
    return `<button class="folder-card" type="button" data-open-folder="${escapeHtml(folder.path || '')}">
      <span class="folder-icon">
        <svg viewBox="0 0 24 24"><path d="M10 4 12 6h8a2 2 0 0 1 2 2v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h5Z"></path></svg>
      </span>
      <span class="folder-copy">
        <strong>${escapeHtml(folder.name || 'Root')}</strong>
        <em>${escapeHtml(String(folder.count || 0))} items</em>
      </span>
    </button>`;
  }

  function renderHome() {
    const items = getAllItems();
    const videos = getVideoItems().slice(0, 8);
    const pictures = getPictureItems().slice(0, 8);
    const recent = items.slice().sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0)).slice(0, 8);
    els.content.innerHTML = `
      <section class="hero">
        <div>
          <p class="eyebrow">Private media server</p>
          <h1>Browse your library from one place.</h1>
          <p>Scan fixed folders on the server, keep favorites, browse folders, and play media directly over the web.</p>
        </div>
        <div class="hero-actions">
          <button class="btn btn-accent" type="button" data-nav="wall">Open wall</button>
          <button class="btn btn-ghost" type="button" data-nav="folders">Open folders</button>
        </div>
      </section>
      <section class="stats-grid">
        <article class="stat-card"><strong>${escapeHtml(String(app.library.stats?.total || 0))}</strong><span>Total media</span></article>
        <article class="stat-card"><strong>${escapeHtml(String(app.library.stats?.videos || 0))}</strong><span>Videos</span></article>
        <article class="stat-card"><strong>${escapeHtml(String(app.library.stats?.pictures || 0))}</strong><span>Pictures</span></article>
        <article class="stat-card"><strong>${escapeHtml(String(app.favorites.length || 0))}</strong><span>Favorites</span></article>
      </section>
      <section class="content-block">
        <div class="section-head"><div><h2>Recent additions</h2><p>Fresh items from your fixed library.</p></div></div>
        <div class="media-grid">${recent.map(item => item.type === 'video' ? videoCard(item) : imageCard(item)).join('') || '<div class="empty-state">No media found yet.</div>'}</div>
      </section>
      <section class="content-block">
        <div class="section-head"><div><h2>Videos</h2><p>Your video highlights.</p></div></div>
        <div class="media-grid">${videos.map(videoCard).join('') || '<div class="empty-state">No videos found.</div>'}</div>
      </section>
      <section class="content-block">
        <div class="section-head"><div><h2>Pictures</h2><p>Your image highlights.</p></div></div>
        <div class="media-grid media-grid-pictures">${pictures.map(imageCard).join('') || '<div class="empty-state">No pictures found.</div>'}</div>
      </section>
    `;
  }

  function renderWall() {
    const items = getVideoItems();
    els.content.innerHTML = `
      <section class="content-block">
        <div class="section-head"><div><h2>Wall</h2><p>All videos from the current server library.</p></div></div>
        <div class="media-grid">${items.map(videoCard).join('') || '<div class="empty-state">No videos found.</div>'}</div>
      </section>
    `;
  }

  function getFolderDirectItems(folderPath) {
    const prefix = folderPath ? folderPath + '/' : '';
    return getAllItems().filter(item => {
      const path = item.folderPath || '';
      if (!folderPath) return !path;
      return path === folderPath;
    });
  }

  function getFolderChildren(folderPath) {
    const children = new Map();
    const prefix = folderPath ? folderPath + '/' : '';
    getAllItems().forEach(item => {
      const path = item.folderPath || '';
      if (folderPath) {
        if (!path.startsWith(prefix)) return;
        const rest = path.slice(prefix.length);
        if (!rest) return;
        const child = rest.split('/')[0];
        const childPath = folderPath ? `${folderPath}/${child}` : child;
        children.set(childPath, { path: childPath, name: child, count: (children.get(childPath)?.count || 0) + 1 });
      } else if (path) {
        const child = path.split('/')[0];
        children.set(child, { path: child, name: child, count: (children.get(child)?.count || 0) + 1 });
      }
    });
    return Array.from(children.values()).sort((a, b) => a.path.localeCompare(b.path));
  }

  function renderFolders() {
    const parts = app.currentFolderPath ? app.currentFolderPath.split('/') : [];
    const crumbs = ['<button class="folder-crumb" type="button" data-open-folder-root>Root</button>'];
    let build = '';
    parts.forEach(part => {
      build = build ? `${build}/${part}` : part;
      crumbs.push(`<span class="slash-sep">/</span><button class="folder-crumb" type="button" data-open-folder="${escapeHtml(build)}">${escapeHtml(part)}</button>`);
    });
    const folders = getFolderChildren(app.currentFolderPath);
    const items = getFolderDirectItems(app.currentFolderPath);
    els.content.innerHTML = `
      <section class="content-block">
        <div class="section-head"><div><h2>Folders</h2><p>Browse the scanned folder tree.</p></div></div>
        <div class="folder-breadcrumbs">${crumbs.join('')}</div>
        <div class="folder-grid">${folders.map(folderCard).join('') || '<div class="empty-state">No subfolders here.</div>'}</div>
      </section>
      <section class="content-block">
        <div class="section-head"><div><h2>${escapeHtml(parts[parts.length - 1] || 'Root items')}</h2><p>Direct items in this folder.</p></div></div>
        <div class="media-grid">${items.map(item => item.type === 'video' ? videoCard(item) : imageCard(item)).join('') || '<div class="empty-state">No direct items here.</div>'}</div>
      </section>
    `;
  }

  function renderFavorites() {
    const items = getAllItems().filter(item => isFavorite(item.id));
    els.content.innerHTML = `
      <section class="content-block">
        <div class="section-head"><div><h2>Favorites</h2><p>Your personal picks.</p></div></div>
        <div class="media-grid">${items.map(item => item.type === 'video' ? videoCard(item) : imageCard(item)).join('') || '<div class="empty-state">No favorites yet.</div>'}</div>
      </section>
    `;
  }

  function renderPictures() {
    const items = getPictureItems();
    els.content.innerHTML = `
      <section class="content-block">
        <div class="section-head"><div><h2>Pictures</h2><p>All pictures from the current server library.</p></div></div>
        <div class="media-grid media-grid-pictures">${items.map(imageCard).join('') || '<div class="empty-state">No pictures found.</div>'}</div>
      </section>
    `;
  }

  function renderCurrentView() {
    renderNavState();
    if (app.currentView === 'wall') return renderWall();
    if (app.currentView === 'folders') return renderFolders();
    if (app.currentView === 'favorites') return renderFavorites();
    if (app.currentView === 'pictures') return renderPictures();
    return renderHome();
  }

  function currentQueueSource(startItem) {
    if (app.currentView === 'wall') return getVideoItems().map(item => item.id);
    if (app.currentView === 'favorites') return getAllItems().filter(item => isFavorite(item.id)).map(item => item.id);
    if (app.currentView === 'folders') {
      return getFolderDirectItems(app.currentFolderPath).filter(item => item.type === startItem.type).map(item => item.id);
    }
    if (app.currentView === 'pictures') return getPictureItems().map(item => item.id);
    if (startItem.type === 'video') return getVideoItems().map(item => item.id);
    return getPictureItems().map(item => item.id);
  }

  function playItem(id, queueOverride) {
    const item = getItemById(id);
    if (!item) return;
    const queue = uniqueStrings((queueOverride && queueOverride.length ? queueOverride : currentQueueSource(item)).filter(Boolean));
    app.queue = queue.includes(id) ? queue : [id].concat(queue);
    app.queueIndex = app.queue.indexOf(id);
    app.currentId = id;
    els.playerDock.hidden = false;
    els.playerStage.hidden = false;
    els.dockTitle.textContent = item.title || 'Unknown';
    els.dockMeta.textContent = `${item.type === 'video' ? 'Video' : 'Picture'} • ${item.folderPath || 'Root'}`;
    els.stageTitle.textContent = item.title || 'Unknown';
    els.stageMeta.textContent = `${item.folderPath || 'Root'} • ${item.extension.toUpperCase()}${item.duration ? ` • ${formatDuration(item.duration)}` : ''}`;
    updateQueueNow(item);
    if (item.type === 'video') {
      els.imageStage.hidden = true;
      els.videoStage.hidden = false;
      els.videoStage.src = buildStreamUrl(item.id);
      els.playerVideo.src = buildStreamUrl(item.id);
      els.videoStage.play().catch(() => {});
      els.playerVideo.load();
    } else {
      els.videoStage.pause();
      els.videoStage.removeAttribute('src');
      els.videoStage.hidden = true;
      els.imageStage.hidden = false;
      els.imageStage.src = buildStreamUrl(item.id);
      els.playerVideo.pause();
      els.playerVideo.removeAttribute('src');
    }
    renderQueue();
    syncPlayPauseIcon();
  }

  function stopPlayback() {
    els.videoStage.pause();
    els.videoStage.removeAttribute('src');
    els.playerVideo.pause();
    els.playerVideo.removeAttribute('src');
    els.imageStage.removeAttribute('src');
    els.playerDock.hidden = true;
    els.playerStage.hidden = true;
    app.currentId = '';
    app.queue = [];
    app.queueIndex = -1;
    renderQueue();
  }

  function syncPlayPauseIcon() {
    const paused = app.currentId ? els.videoStage.paused : true;
    els.playPauseIcon.innerHTML = paused
      ? '<path d="M8 5v14l11-7L8 5Z"></path>'
      : '<path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z"></path>';
  }

  function togglePlayPause() {
    if (!app.currentId) return;
    const item = getItemById(app.currentId);
    if (!item || item.type !== 'video') return;
    if (els.videoStage.paused) els.videoStage.play().catch(() => {});
    else els.videoStage.pause();
    syncPlayPauseIcon();
  }

  function shiftQueue(direction) {
    if (!app.queue.length) return;
    if (app.shuffle) {
      const options = app.queue.filter(id => id !== app.currentId);
      const next = options[Math.floor(Math.random() * options.length)];
      if (next) return playItem(next, app.queue.slice());
      return;
    }
    let nextIndex = app.queueIndex + direction;
    if (nextIndex >= app.queue.length) {
      if (app.repeat) nextIndex = 0;
      else return;
    }
    if (nextIndex < 0) {
      if (app.repeat) nextIndex = app.queue.length - 1;
      else return;
    }
    const nextId = app.queue[nextIndex];
    if (nextId) playItem(nextId, app.queue.slice());
  }

  function renderQueue() {
    els.queueSummary.textContent = app.queue.length ? `${app.queue.length} items queued.` : 'Nothing queued.';
    els.queueList.innerHTML = app.queue.length
      ? app.queue.map((id, index) => {
          const item = getItemById(id);
          if (!item) return '';
          return `<article class="queue-item${id === app.currentId ? ' is-current' : ''}">
            <button class="queue-item-main" type="button" data-open-item="${escapeHtml(id)}">
              <img class="queue-thumb" src="${buildThumbUrl(id)}" alt="">
              <span class="queue-copy">
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.folderPath || 'Root')}</span>
              </span>
            </button>
            <button class="icon-button small" type="button" data-remove-queue="${escapeHtml(String(index))}" title="Remove">
              <svg viewBox="0 0 24 24"><path d="m18.3 5.71-1.41-1.42L12 9.17 7.11 4.29 5.7 5.71 10.58 10.6 5.7 15.49l1.41 1.41L12 12l4.89 4.9 1.41-1.41-4.88-4.89 4.88-4.89Z"></path></svg>
            </button>
          </article>`;
        }).join('')
      : '<div class="empty-state compact">Queue is empty.</div>';

    const item = getItemById(app.currentId);
    updateQueueNow(item);
  }

  function updateQueueNow(item) {
    if (!item) {
      els.queueNowThumb.hidden = true;
      els.queueNowThumb.removeAttribute('src');
      els.queueNowFallback.hidden = false;
      els.queueNowTitle.textContent = 'Nothing selected';
      els.queueNowMeta.textContent = 'Choose a video or picture.';
      return;
    }
    els.queueNowThumb.hidden = false;
    els.queueNowThumb.src = buildThumbUrl(item.id);
    els.queueNowFallback.hidden = true;
    els.queueNowTitle.textContent = item.title || 'Unknown';
    els.queueNowMeta.textContent = `${item.folderPath || 'Root'} • ${item.extension.toUpperCase()}${item.duration ? ` • ${formatDuration(item.duration)}` : ''}`;
  }

  function removeQueueIndex(index) {
    if (index < 0 || index >= app.queue.length) return;
    const removedId = app.queue[index];
    app.queue.splice(index, 1);
    if (removedId === app.currentId) {
      if (app.queue.length) {
        const next = app.queue[Math.max(0, Math.min(index, app.queue.length - 1))];
        playItem(next, app.queue.slice());
        return;
      }
      stopPlayback();
      return;
    }
    if (index < app.queueIndex) app.queueIndex -= 1;
    renderQueue();
  }

  function handleSearchInput() {
    app.searchTerm = normalizeText(els.searchInput.value);
    if (!app.searchTerm) {
      els.searchResults.hidden = true;
      els.searchResults.innerHTML = '';
      return;
    }
    const results = getAllItems().filter(item => {
      const haystack = `${item.title} ${item.folderPath} ${item.relativePath} ${item.extension}`.toLowerCase();
      return haystack.includes(app.searchTerm);
    }).slice(0, 20);

    els.searchResults.innerHTML = results.length
      ? `<div class="search-head"><strong>Search results</strong><span>${results.length} matches</span></div><div class="search-list">${results.map(item => `
          <button class="search-result" type="button" data-open-item="${escapeHtml(item.id)}">
            <img class="search-thumb" src="${buildThumbUrl(item.id)}" alt="">
            <span class="search-copy">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.folderPath || 'Root')} • ${escapeHtml(item.extension.toUpperCase())}</span>
            </span>
          </button>`).join('')}</div>`
      : '<div class="empty-state compact">No matching media.</div>';
    els.searchResults.hidden = false;
  }

  function clearSearchIfOutside(event) {
    if (!event.target.closest('.topbar-search')) {
      els.searchResults.hidden = true;
    }
  }

  function openSettings() {
    els.settingsBackdrop.hidden = false;
    els.settingsDrawer.hidden = false;
  }

  function closeSettings() {
    els.settingsBackdrop.hidden = true;
    els.settingsDrawer.hidden = true;
  }

  function randomFromCurrentView() {
    const currentItems = app.currentView === 'pictures'
      ? getPictureItems()
      : app.currentView === 'favorites'
        ? getAllItems().filter(item => isFavorite(item.id))
        : app.currentView === 'folders'
          ? getFolderDirectItems(app.currentFolderPath)
          : app.currentView === 'wall'
            ? getVideoItems()
            : getAllItems();
    if (!currentItems.length) return;
    const item = currentItems[Math.floor(Math.random() * currentItems.length)];
    playItem(item.id, currentItems.map(entry => entry.id));
  }

  function onClick(event) {
    const nav = event.target.closest('[data-nav]');
    if (nav) {
      navigate(nav.dataset.nav || 'home');
      return;
    }

    if (event.target.closest('[data-open-folder-root]')) {
      app.currentFolderPath = '';
      if (app.currentView !== 'folders') navigate('folders');
      else renderCurrentView();
      return;
    }

    const openFolder = event.target.closest('[data-open-folder]');
    if (openFolder) {
      app.currentFolderPath = openFolder.dataset.openFolder || '';
      if (app.currentView !== 'folders') navigate('folders');
      else renderCurrentView();
      return;
    }

    const openItem = event.target.closest('[data-open-item]');
    if (openItem) {
      playItem(openItem.dataset.openItem || '');
      els.searchResults.hidden = true;
      return;
    }

    const playItemButton = event.target.closest('[data-play-item]');
    if (playItemButton) {
      event.preventDefault();
      event.stopPropagation();
      playItem(playItemButton.dataset.playItem || '');
      return;
    }

    const favButton = event.target.closest('[data-toggle-favorite]');
    if (favButton) {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(favButton.dataset.toggleFavorite || '');
      return;
    }

    const removeQueue = event.target.closest('[data-remove-queue]');
    if (removeQueue) {
      removeQueueIndex(Number(removeQueue.dataset.removeQueue || -1));
      return;
    }

    if (event.target.closest('[data-action="rescan"]')) {
      triggerRescan();
      return;
    }

    clearSearchIfOutside(event);
  }

  async function triggerRescan() {
    try {
      const data = await apiJson('api/scan.php', {
        method: 'POST',
        headers: { 'X-CSRF-Token': app.csrf }
      });
      app.library = data.library || app.library;
      updateSettings();
      renderCurrentView();
      renderQueue();
    } catch (error) {
      alert(error.message || 'Rescan failed.');
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      closeSettings();
      els.searchResults.hidden = true;
    }
  }

  function bindEvents() {
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    els.loginForm.addEventListener('submit', handleLoginSubmit);
    els.searchInput.addEventListener('input', handleSearchInput);
    els.rescanButton.addEventListener('click', triggerRescan);
    els.logoutButton.addEventListener('click', logout);
    els.settingsButton.addEventListener('click', openSettings);
    els.closeSettingsButton.addEventListener('click', closeSettings);
    els.settingsBackdrop.addEventListener('click', closeSettings);
    els.randomButton.addEventListener('click', randomFromCurrentView);
    els.clearQueueButton.addEventListener('click', () => {
      app.queue = [];
      app.queueIndex = -1;
      renderQueue();
    });
    els.playPauseButton.addEventListener('click', togglePlayPause);
    els.prevButton.addEventListener('click', () => shiftQueue(-1));
    els.nextButton.addEventListener('click', () => shiftQueue(1));
    els.progressInput.addEventListener('input', () => {
      if (!app.currentId || els.videoStage.hidden) return;
      const duration = Number(els.videoStage.duration || 0);
      if (!duration) return;
      els.videoStage.currentTime = (Number(els.progressInput.value || 0) / 100) * duration;
    });

    els.videoStage.addEventListener('timeupdate', () => {
      const current = Number(els.videoStage.currentTime || 0);
      const duration = Number(els.videoStage.duration || 0);
      els.currentTime.textContent = formatDuration(current);
      els.durationTime.textContent = formatDuration(duration);
      els.progressInput.value = duration ? String((current / duration) * 100) : '0';
      syncPlayPauseIcon();
    });

    els.videoStage.addEventListener('loadedmetadata', () => {
      const duration = Number(els.videoStage.duration || 0);
      els.durationTime.textContent = formatDuration(duration);
      syncPlayPauseIcon();
    });

    els.videoStage.addEventListener('play', syncPlayPauseIcon);
    els.videoStage.addEventListener('pause', syncPlayPauseIcon);
    els.videoStage.addEventListener('ended', () => shiftQueue(1));
  }

  bindEvents();
  checkSession();
})();
