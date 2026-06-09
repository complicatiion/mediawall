<?php
declare(strict_types=1);
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>MediaWall V8</title>
  <meta name="description" content="MediaWall V8 server edition">
  <link rel="icon" type="image/png" href="assets/media/favicon.png">
  <link rel="stylesheet" href="assets/css/styles.css">
</head>
<body>
  <div class="bg-glow bg-glow-a"></div>
  <div class="bg-glow bg-glow-b"></div>

  <div id="loginScreen" class="login-screen">
    <div class="login-card">
      <img class="login-logo" src="assets/media/logo.png" alt="MediaWall logo">
      <h1>MediaWall</h1>
      <p>Private media wall server</p>
      <form id="loginForm" class="login-form" autocomplete="off">
        <label>
          <span>Username</span>
          <input type="text" name="username" id="loginUser" required>
        </label>
        <label>
          <span>Password</span>
          <input type="password" name="password" id="loginPass" required>
        </label>
        <input type="text" name="website" id="loginHoney" class="visually-hidden" tabindex="-1" autocomplete="off">
        <button class="btn btn-accent" type="submit">Sign in</button>
      </form>
      <p id="loginError" class="login-error" hidden></p>
      <div class="login-foot">
        <span>MediaWall V8</span>
        <span>Server edition</span>
      </div>
    </div>
  </div>

  <div id="appShell" class="app-shell" hidden>
    <aside class="sidebar">
      <button class="brand" type="button" data-nav="home" aria-label="Open home">
        <img class="brand-logo" src="assets/media/logo.png" alt="">
        <span class="brand-copy">
          <strong>MediaWall</strong>
          <em>Server edition</em>
        </span>
      </button>

      <nav class="sidebar-nav" aria-label="Main navigation">
        <button class="nav-button is-active" type="button" data-nav="home">Home</button>
        <button class="nav-button" type="button" data-nav="wall">Wall</button>
        <button class="nav-button" type="button" data-nav="folders">Folders</button>
        <button class="nav-button" type="button" data-nav="favorites">Favorites</button>
        <button class="nav-button" type="button" data-nav="pictures">Pictures</button>
      </nav>

      <div class="sidebar-footer">
        <button id="rescanButton" class="btn btn-accent full" type="button">Rescan library</button>
        <button id="logoutButton" class="btn btn-ghost full" type="button">Sign out</button>
      </div>
    </aside>

    <main class="main-shell">
      <header class="topbar">
        <div class="topbar-search">
          <label class="search-wrap" for="searchInput">
            <input id="searchInput" class="search-input" type="search" placeholder="Search titles, folders, extensions...">
          </label>
          <div id="searchResults" class="search-results" hidden></div>
        </div>
        <div class="topbar-actions">
          <button id="randomButton" class="btn btn-ghost" type="button">Random</button>
          <button id="settingsButton" class="icon-button" type="button" title="Settings" aria-label="Settings">
            <svg viewBox="0 0 24 24"><path d="m19.14 12.94.04-.94-.04-.94 2.03-1.58a.6.6 0 0 0 .14-.77l-1.92-3.32a.6.6 0 0 0-.73-.27l-2.39.96a7.12 7.12 0 0 0-1.63-.94l-.36-2.54a.58.58 0 0 0-.58-.5h-3.84a.58.58 0 0 0-.58.5l-.36 2.54c-.58.22-1.13.54-1.63.94l-2.39-.96a.6.6 0 0 0-.73.27L2.69 8.7a.6.6 0 0 0 .14.77l2.03 1.58-.04.94.04.94-2.03 1.58a.6.6 0 0 0-.14.77l1.92 3.32a.6.6 0 0 0 .73.27l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.58.58 0 0 0 .58.5h3.84a.58.58 0 0 0 .58-.5l.36-2.54c.58-.22 1.13-.54 1.63-.94l2.39.96a.6.6 0 0 0 .73-.27l1.92-3.32a.6.6 0 0 0-.14-.77l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"></path></svg>
          </button>
        </div>
      </header>

      <section id="playerStage" class="player-stage" hidden>
        <video id="videoStage" class="stage-media" preload="metadata" playsinline hidden></video>
        <img id="imageStage" class="stage-media" alt="" hidden>
        <div class="stage-meta">
          <div>
            <strong id="stageTitle">Nothing selected</strong>
            <p id="stageMeta">Choose an item to start playback.</p>
          </div>
        </div>
      </section>

      <section id="content" class="content-shell"></section>
    </main>

    <aside class="queue-shell">
      <div class="queue-head">
        <div>
          <strong>Play Queue</strong>
          <p id="queueSummary">Nothing queued.</p>
        </div>
        <button id="clearQueueButton" class="btn btn-ghost small" type="button">Clear</button>
      </div>
      <div id="queueList" class="queue-list"></div>
      <div class="queue-now">
        <div class="queue-now-head">Now playing</div>
        <img id="queueNowThumb" class="queue-now-thumb" alt="" hidden>
        <div id="queueNowFallback" class="queue-now-fallback">MW</div>
        <strong id="queueNowTitle">Nothing selected</strong>
        <p id="queueNowMeta">Choose a video or picture.</p>
      </div>
    </aside>

    <section id="playerDock" class="player-dock" hidden>
      <div class="player-now">
        <strong id="dockTitle">Nothing selected</strong>
        <span id="dockMeta">Choose a video to start playback.</span>
      </div>
      <div class="player-controls">
        <button id="prevButton" class="icon-button" type="button" title="Previous">
          <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6V6Zm3 6 9 6V6l-9 6Z"></path></svg>
        </button>
        <button id="playPauseButton" class="icon-button play-main" type="button" title="Play or pause">
          <svg id="playPauseIcon" viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5Z"></path></svg>
        </button>
        <button id="nextButton" class="icon-button" type="button" title="Next">
          <svg viewBox="0 0 24 24"><path d="M6 18V6l9 6-9 6Zm10 0V6h2v12h-2Z"></path></svg>
        </button>
      </div>
      <div class="player-progress">
        <span id="currentTime">0:00</span>
        <input id="progressInput" type="range" min="0" max="100" step="0.1" value="0">
        <span id="durationTime">0:00</span>
      </div>
    </section>

    <video id="playerVideo" class="hidden-media" preload="metadata" playsinline></video>
  </div>

  <div id="settingsBackdrop" class="drawer-backdrop" hidden></div>
  <aside id="settingsDrawer" class="drawer" hidden>
    <div class="drawer-head">
      <div>
        <strong>Settings</strong>
        <p>Server and library information</p>
      </div>
      <button id="closeSettingsButton" class="icon-button" type="button" title="Close">
        <svg viewBox="0 0 24 24"><path d="m18.3 5.71-1.41-1.42L12 9.17 7.11 4.29 5.7 5.71 10.58 10.6 5.7 15.49l1.41 1.41L12 12l4.89 4.9 1.41-1.41-4.88-4.89 4.88-4.89Z"></path></svg>
      </button>
    </div>
    <div class="drawer-body">
      <section class="settings-card">
        <h3>Server library</h3>
        <dl class="meta-grid">
          <dt>Label</dt><dd id="settingsLibraryLabel">—</dd>
          <dt>Mode</dt><dd id="settingsLibraryMode">—</dd>
          <dt>Videos</dt><dd id="settingsVideoCount">0</dd>
          <dt>Pictures</dt><dd id="settingsPictureCount">0</dd>
          <dt>Last scan</dt><dd id="settingsLastScan">—</dd>
        </dl>
      </section>
      <section class="settings-card">
        <h3>Security</h3>
        <p>This instance uses server-side login sessions. Keep HTTPS enabled and change the default admin password before public use.</p>
      </section>
    </div>
  </aside>

  <script src="assets/js/app.js"></script>
</body>
</html>
