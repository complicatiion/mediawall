(function () {
  "use strict";

  var CONFIG = window.MEDIAWALL_CONFIG || {};
  var STORAGE = window.MediaWallStorage || {};

  var APP = {
    state: createInitialState(),
    searchTerm: "",
    currentView: "home",
    activeFolder: "",
    activeCategory: "",
    detailsItemId: null,
    filesById: new Map(),
    posterFilesById: new Map(),
    objectUrls: new Map(),
    thumbQueue: [],
    thumbQueued: new Set(),
    thumbInFlight: 0,
    viewCountStamp: "",
    player: {
      itemId: null,
      playlistIds: [],
      mode: "collapsed",
      shuffle: false,
      repeat: "off",
      isMuted: false,
      volume: 0.85
    }
  };

  var els = {};

  var PLAY_ICON = '<path d="M8 5v14l11-7L8 5Z"/>';
  var PAUSE_ICON = '<path d="M8 5h3v14H8V5Zm5 0h3v14h-3V5Z"/>';
  var MUTED_ICON = '<path d="M14 3.23v17.54a1 1 0 0 1-1.64.77L7.8 18H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3.8l4.56-3.54A1 1 0 0 1 14 3.23Zm6.71 2.65 1.41 1.41L18.41 11l3.71 3.71-1.41 1.41L17 12.41l-3.71 3.71-1.41-1.41L15.59 11l-3.71-3.71 1.41-1.41L17 9.59l3.71-3.71Z"/>';
  var VOLUME_ICON = '<path d="M14 3.23v17.54a1 1 0 0 1-1.64.77L7.8 18H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3.8l4.56-3.54A1 1 0 0 1 14 3.23Zm4.95 8.77a4.98 4.98 0 0 0-1.46-3.54l1.42-1.42a7 7 0 0 1 0 9.92l-1.42-1.42A4.98 4.98 0 0 0 18.95 12Zm-3.54 0a1.46 1.46 0 0 0-.43-1.04l1.42-1.42a3.5 3.5 0 0 1 0 4.92l-1.42-1.42c.28-.27.43-.65.43-1.04Z"/>';

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("beforeunload", handleBeforeUnload);

  function init() {
    bindElements();
    loadState();
    ensureStateShape();
    applySettingsToUi();
    wireEvents();
    navigate(validView(APP.state.settings.startPage || "home"));
    renderAll();
    syncVolumeUi();
    syncPlayPauseButton();
    updateRepeatUi();
    updateStatus("Ready. Open settings to import a local media folder.");
  }

  function createInitialState() {
    return {
      settings: clone(CONFIG.defaultSettings || {}),
      library: {
        videos: [],
        images: [],
        updatedAt: null
      },
      favorites: [],
      viewCounts: {},
      playbackStates: {},
      mediaMeta: {}
    };
  }

  function ensureStateShape() {
    var fresh = createInitialState();
    APP.state = deepMerge(fresh, APP.state || {});
    APP.state.favorites = Array.isArray(APP.state.favorites) ? APP.state.favorites : [];
    APP.state.viewCounts = APP.state.viewCounts && typeof APP.state.viewCounts === "object" ? APP.state.viewCounts : {};
    APP.state.playbackStates = APP.state.playbackStates && typeof APP.state.playbackStates === "object" ? APP.state.playbackStates : {};
    APP.state.mediaMeta = APP.state.mediaMeta && typeof APP.state.mediaMeta === "object" ? APP.state.mediaMeta : {};
    APP.state.library.videos = Array.isArray(APP.state.library.videos) ? APP.state.library.videos : [];
    APP.state.library.images = Array.isArray(APP.state.library.images) ? APP.state.library.images : [];
    APP.state.settings.categoriesText = normalizeCategoriesText(APP.state.settings.categoriesText || "");
  }

  function bindElements() {
    els.navLinks = slice(document.querySelectorAll(".nav-link"));
    els.views = slice(document.querySelectorAll(".view"));
    els.globalSearch = document.getElementById("globalSearch");
    els.randomButton = document.getElementById("randomButton");
    els.settingsButton = document.getElementById("settingsButton");
    els.heroSettingsButton = document.getElementById("heroSettingsButton");

    els.statsGrid = document.getElementById("statsGrid");
    els.homeRecentGrid = document.getElementById("homeRecentGrid");
    els.homePopularGrid = document.getElementById("homePopularGrid");
    els.homeFavoritesGrid = document.getElementById("homeFavoritesGrid");
    els.homePicturesGrid = document.getElementById("homePicturesGrid");
    els.homeCategoriesGrid = document.getElementById("homeCategoriesGrid");

    els.videoSort = document.getElementById("videoSort");
    els.videoImportButton = document.getElementById("videoImportButton");
    els.videoWallMeta = document.getElementById("videoWallMeta");
    els.videoWallGrid = document.getElementById("videoWallGrid");

    els.categoriesMeta = document.getElementById("categoriesMeta");
    els.categoriesGrid = document.getElementById("categoriesGrid");
    els.categoryResultsLabel = document.getElementById("categoryResultsLabel");
    els.categoryResultsMeta = document.getElementById("categoryResultsMeta");
    els.categoryResultsGrid = document.getElementById("categoryResultsGrid");
    els.importCategoriesQuickButton = document.getElementById("importCategoriesQuickButton");
    els.exportCategoriesQuickButton = document.getElementById("exportCategoriesQuickButton");

    els.folderUpButton = document.getElementById("folderUpButton");
    els.resetFolderFilterButton = document.getElementById("resetFolderFilterButton");
    els.folderBreadcrumbs = document.getElementById("folderBreadcrumbs");
    els.folderMeta = document.getElementById("folderMeta");
    els.folderGrid = document.getElementById("folderGrid");
    els.folderItemsLabel = document.getElementById("folderItemsLabel");
    els.folderItemsMeta = document.getElementById("folderItemsMeta");
    els.folderItemsGrid = document.getElementById("folderItemsGrid");

    els.favoriteSort = document.getElementById("favoriteSort");
    els.favoritesMeta = document.getElementById("favoritesMeta");
    els.favoritesGrid = document.getElementById("favoritesGrid");

    els.imageSort = document.getElementById("imageSort");
    els.imageImportButton = document.getElementById("imageImportButton");
    els.pictureWallMeta = document.getElementById("pictureWallMeta");
    els.pictureWallGrid = document.getElementById("pictureWallGrid");

    els.settingsBackdrop = document.getElementById("settingsBackdrop");
    els.settingsDrawer = document.getElementById("settingsDrawer");
    els.closeSettingsButton = document.getElementById("closeSettingsButton");
    els.discardSettingsButton = document.getElementById("discardSettingsButton");
    els.saveSettingsButton = document.getElementById("saveSettingsButton");
    els.accentColorInput = document.getElementById("accentColorInput");
    els.startPageInput = document.getElementById("startPageInput");
    els.gridDensityButtons = slice(document.querySelectorAll(".density-button"));
    els.videoFolderLabelInput = document.getElementById("videoFolderLabelInput");
    els.imageFolderLabelInput = document.getElementById("imageFolderLabelInput");
    els.categoriesTextInput = document.getElementById("categoriesTextInput");
    els.rememberPlaybackInput = document.getElementById("rememberPlaybackInput");
    els.preferTheaterInput = document.getElementById("preferTheaterInput");
    els.autoplayNextInput = document.getElementById("autoplayNextInput");
    els.closeDetailsOnPlayInput = document.getElementById("closeDetailsOnPlayInput");
    els.pickVideoFolderButton = document.getElementById("pickVideoFolderButton");
    els.pickImageFolderButton = document.getElementById("pickImageFolderButton");
    els.relinkVideoFolderButton = document.getElementById("relinkVideoFolderButton");
    els.relinkImageFolderButton = document.getElementById("relinkImageFolderButton");
    els.importCategoriesButton = document.getElementById("importCategoriesButton");
    els.exportCategoriesButton = document.getElementById("exportCategoriesButton");
    els.clearCategoriesButton = document.getElementById("clearCategoriesButton");
    els.exportStateButton = document.getElementById("exportStateButton");
    els.importStateInput = document.getElementById("importStateInput");
    els.clearThumbCacheButton = document.getElementById("clearThumbCacheButton");
    els.clearSessionLinksButton = document.getElementById("clearSessionLinksButton");
    els.clearLibraryButton = document.getElementById("clearLibraryButton");
    els.clearDeleteLibraryButton = document.getElementById("clearDeleteLibraryButton");
    els.scanStatus = document.getElementById("scanStatus");

    els.detailsBackdrop = document.getElementById("detailsBackdrop");
    els.detailsDrawer = document.getElementById("detailsDrawer");
    els.closeDetailsButton = document.getElementById("closeDetailsButton");
    els.closeDetailsFooterButton = document.getElementById("closeDetailsFooterButton");
    els.detailsTitle = document.getElementById("detailsTitle");
    els.detailsPreviewImage = document.getElementById("detailsPreviewImage");
    els.detailsPreviewFallback = document.getElementById("detailsPreviewFallback");
    els.detailsTagsInput = document.getElementById("detailsTagsInput");
    els.detailsCategoriesInput = document.getElementById("detailsCategoriesInput");
    els.detailsDescriptionInput = document.getElementById("detailsDescriptionInput");
    els.detailsList = document.getElementById("detailsList");
    els.detailsPlayButton = document.getElementById("detailsPlayButton");
    els.detailsFavoriteButton = document.getElementById("detailsFavoriteButton");
    els.saveDetailsButton = document.getElementById("saveDetailsButton");

    els.playerStage = document.getElementById("playerStage");
    els.playerStageShell = document.getElementById("playerStageShell");
    els.playerTitle = document.getElementById("playerTitle");
    els.playerMeta = document.getElementById("playerMeta");
    els.stageInfoButton = document.getElementById("stageInfoButton");
    els.fullscreenPlayerButton = document.getElementById("fullscreenPlayerButton");
    els.mediaPlayer = document.getElementById("mediaPlayer");
    els.imageViewer = document.getElementById("imageViewer");

    els.bottomPlayer = document.getElementById("bottomPlayer");
    els.dockTitle = document.getElementById("dockTitle");
    els.dockMeta = document.getElementById("dockMeta");
    els.playerMiniThumb = document.getElementById("playerMiniThumb");
    els.shuffleButton = document.getElementById("shuffleButton");
    els.previousButton = document.getElementById("previousButton");
    els.rewindButton = document.getElementById("rewindButton");
    els.playPauseButton = document.getElementById("playPauseButton");
    els.playPauseIcon = document.getElementById("playPauseIcon");
    els.forwardButton = document.getElementById("forwardButton");
    els.nextButton = document.getElementById("nextButton");
    els.repeatButton = document.getElementById("repeatButton");
    els.favoritePlayerButton = document.getElementById("favoritePlayerButton");
    els.randomPlayerButton = document.getElementById("randomPlayerButton");
    els.currentTimeLabel = document.getElementById("currentTimeLabel");
    els.progressSlider = document.getElementById("progressSlider");
    els.durationLabel = document.getElementById("durationLabel");
    els.muteButton = document.getElementById("muteButton");
    els.muteButtonIcon = document.getElementById("muteButtonIcon");
    els.volumeSlider = document.getElementById("volumeSlider");
    els.collapsePlayerButton = document.getElementById("collapsePlayerButton");
    els.expandPlayerButton = document.getElementById("expandPlayerButton");
    els.theaterPlayerButton = document.getElementById("theaterPlayerButton");
    els.pipPlayerButton = document.getElementById("pipPlayerButton");
    els.closePlayerButton = document.getElementById("closePlayerButton");

    els.videoFolderInput = document.getElementById("videoFolderInput");
    els.imageFolderInput = document.getElementById("imageFolderInput");
    els.categoriesFileInput = document.getElementById("categoriesFileInput");
    els.emptyStateTemplate = document.getElementById("emptyStateTemplate");
    els.cardTemplate = document.getElementById("cardTemplate");
    els.folderCardTemplate = document.getElementById("folderCardTemplate");
    els.categoryCardTemplate = document.getElementById("categoryCardTemplate");
  }

  function wireEvents() {
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeydown);

    els.globalSearch.addEventListener("input", function () {
      APP.searchTerm = normalizeText(els.globalSearch.value);
      renderAll();
    });

    els.globalSearch.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        if (APP.currentView === "home") {
          navigate("wall");
        } else {
          renderAll();
        }
      }
    });

    els.randomButton.addEventListener("click", function () { openRandomVideo(false); });
    els.randomPlayerButton.addEventListener("click", function () { openRandomVideo(true); });

    els.settingsButton.addEventListener("click", openSettings);
    els.heroSettingsButton.addEventListener("click", openSettings);

    els.videoSort.addEventListener("change", function () {
      APP.state.settings.sortVideos = els.videoSort.value;
      persistState();
      renderWall();
    });

    els.imageSort.addEventListener("change", function () {
      APP.state.settings.sortImages = els.imageSort.value;
      persistState();
      renderPictures();
    });

    els.favoriteSort.addEventListener("change", function () {
      APP.state.settings.sortFavorites = els.favoriteSort.value;
      persistState();
      renderFavorites();
    });

    els.videoImportButton.addEventListener("click", function () { els.videoFolderInput.click(); });
    els.imageImportButton.addEventListener("click", function () { els.imageFolderInput.click(); });
    els.importCategoriesQuickButton.addEventListener("click", function () { els.categoriesFileInput.click(); });
    els.exportCategoriesQuickButton.addEventListener("click", exportCategoriesText);

    els.folderUpButton.addEventListener("click", navigateFolderUp);
    els.resetFolderFilterButton.addEventListener("click", function () {
      APP.activeFolder = "";
      renderFolders();
    });

    els.settingsBackdrop.addEventListener("click", closeSettings);
    els.closeSettingsButton.addEventListener("click", closeSettings);
    els.discardSettingsButton.addEventListener("click", closeSettings);
    els.saveSettingsButton.addEventListener("click", function () {
      commitSettingsForm();
      closeSettings();
      renderAll();
      updateStatus("Settings saved.");
    });

    els.gridDensityButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        els.gridDensityButtons.forEach(function (item) { item.classList.remove("is-active"); });
        button.classList.add("is-active");
      });
    });

    els.pickVideoFolderButton.addEventListener("click", function () { els.videoFolderInput.click(); });
    els.pickImageFolderButton.addEventListener("click", function () { els.imageFolderInput.click(); });
    els.relinkVideoFolderButton.addEventListener("click", function () { els.videoFolderInput.click(); });
    els.relinkImageFolderButton.addEventListener("click", function () { els.imageFolderInput.click(); });

    els.videoFolderInput.addEventListener("change", function (event) {
      importFolderFiles("video", event.target.files);
      event.target.value = "";
    });

    els.imageFolderInput.addEventListener("change", function (event) {
      importFolderFiles("image", event.target.files);
      event.target.value = "";
    });

    els.categoriesFileInput.addEventListener("change", importCategoriesTextFile);
    els.importCategoriesButton.addEventListener("click", function () { els.categoriesFileInput.click(); });
    els.exportCategoriesButton.addEventListener("click", exportCategoriesText);
    els.clearCategoriesButton.addEventListener("click", clearCategoriesText);

    els.exportStateButton.addEventListener("click", exportStateJson);
    els.importStateInput.addEventListener("change", importStateJson);
    els.clearThumbCacheButton.addEventListener("click", clearThumbnailCache);
    els.clearSessionLinksButton.addEventListener("click", function () { clearSessionLinks(); });
    els.clearLibraryButton.addEventListener("click", clearEntireLibrary);
    els.clearDeleteLibraryButton.addEventListener("click", clearAndDeleteLibrary);

    els.detailsBackdrop.addEventListener("click", closeDetails);
    els.closeDetailsButton.addEventListener("click", closeDetails);
    els.closeDetailsFooterButton.addEventListener("click", closeDetails);
    els.detailsFavoriteButton.addEventListener("click", function () {
      if (APP.detailsItemId) toggleFavorite(APP.detailsItemId);
    });
    els.detailsPlayButton.addEventListener("click", function () {
      if (!APP.detailsItemId) return;
      var item = findItemById(APP.detailsItemId);
      if (!item) return;
      openMedia(item, getPlaylistForItem(item));
    });
    els.saveDetailsButton.addEventListener("click", saveDetails);

    els.mediaPlayer.addEventListener("play", function () {
      syncPlayPauseButton();
      incrementViewCountIfNeeded();
    });
    els.mediaPlayer.addEventListener("pause", syncPlayPauseButton);
    els.mediaPlayer.addEventListener("timeupdate", syncPlayerProgress);
    els.mediaPlayer.addEventListener("loadedmetadata", syncPlayerDuration);
    els.mediaPlayer.addEventListener("volumechange", syncVolumeUi);
    els.mediaPlayer.addEventListener("ended", handlePlaybackEnded);
    els.mediaPlayer.addEventListener("error", function () {
      updateStatus("The browser could not play this file format.", true);
    });

    els.progressSlider.addEventListener("input", function () {
      if (!isVideoActive()) return;
      var duration = els.mediaPlayer.duration || 0;
      if (!duration) return;
      els.mediaPlayer.currentTime = (Number(els.progressSlider.value) / 100) * duration;
    });

    els.playPauseButton.addEventListener("click", togglePlayPause);
    els.previousButton.addEventListener("click", function () { stepPlaylist(-1); });
    els.nextButton.addEventListener("click", function () { stepPlaylist(1); });
    els.rewindButton.addEventListener("click", function () { seekBy(-10); });
    els.forwardButton.addEventListener("click", function () { seekBy(10); });
    els.shuffleButton.addEventListener("click", toggleShuffle);
    els.repeatButton.addEventListener("click", cycleRepeat);
    els.favoritePlayerButton.addEventListener("click", function () {
      if (APP.player.itemId) toggleFavorite(APP.player.itemId);
    });
    els.muteButton.addEventListener("click", toggleMute);
    els.volumeSlider.addEventListener("input", setPlayerVolumeFromUi);
    els.collapsePlayerButton.addEventListener("click", function () { setPlayerMode("collapsed"); });
    els.expandPlayerButton.addEventListener("click", function () { setPlayerMode("expanded"); });
    els.theaterPlayerButton.addEventListener("click", function () {
      setPlayerMode(APP.player.mode === "theater" ? "expanded" : "theater");
    });
    els.pipPlayerButton.addEventListener("click", togglePictureInPicture);
    els.closePlayerButton.addEventListener("click", closePlayer);
    els.stageInfoButton.addEventListener("click", function () {
      if (APP.player.itemId) openDetails(APP.player.itemId);
    });
    els.fullscreenPlayerButton.addEventListener("click", toggleFullscreenPlayer);
  }

  function handleBeforeUnload() {
    rememberCurrentPlaybackPosition(true);
    revokeAllObjectUrls();
  }

  function loadState() {
    var raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) {
      persistState();
      return;
    }

    try {
      APP.state = JSON.parse(raw);
    } catch (error) {
      APP.state = createInitialState();
    }
  }

  function persistState() {
    APP.state.library.updatedAt = new Date().toISOString();
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(APP.state));
  }

  function applySettingsToUi() {
    var settings = APP.state.settings;
    applyAccentColor(settings.accentColor);
    document.documentElement.style.setProperty("--grid-columns", String(settings.gridSize || 6));

    els.accentColorInput.value = settings.accentColor || "#6f5cff";
    els.startPageInput.value = validView(settings.startPage || "home");
    els.videoSort.value = settings.sortVideos || "date_desc";
    els.imageSort.value = settings.sortImages || "date_desc";
    els.favoriteSort.value = settings.sortFavorites || "date_desc";
    els.videoFolderLabelInput.value = settings.videoFolderLabel || "";
    els.imageFolderLabelInput.value = settings.imageFolderLabel || "";
    els.categoriesTextInput.value = settings.categoriesText || "";
    els.rememberPlaybackInput.checked = Boolean(settings.rememberPlaybackState);
    els.preferTheaterInput.checked = Boolean(settings.preferTheaterMode);
    if (els.autoplayNextInput) els.autoplayNextInput.checked = settings.autoplayNext !== false;
    if (els.closeDetailsOnPlayInput) els.closeDetailsOnPlayInput.checked = settings.closeDetailsOnPlay !== false;

    els.gridDensityButtons.forEach(function (button) {
      button.classList.toggle("is-active", Number(button.getAttribute("data-grid")) === Number(settings.gridSize || 6));
    });

    var playerVolume = clamp(APP.player.volume, 0, 1);
    els.mediaPlayer.volume = playerVolume;
    els.volumeSlider.value = String(Math.round(playerVolume * 100));
  }

  function commitSettingsForm() {
    APP.state.settings.accentColor = els.accentColorInput.value || "#6f5cff";
    APP.state.settings.startPage = validView(els.startPageInput.value || "home");
    APP.state.settings.videoFolderLabel = els.videoFolderLabelInput.value.trim();
    APP.state.settings.imageFolderLabel = els.imageFolderLabelInput.value.trim();
    APP.state.settings.categoriesText = normalizeCategoriesText(els.categoriesTextInput.value);
    APP.state.settings.rememberPlaybackState = els.rememberPlaybackInput.checked;
    APP.state.settings.preferTheaterMode = els.preferTheaterInput.checked;
    APP.state.settings.autoplayNext = els.autoplayNextInput ? els.autoplayNextInput.checked : true;
    APP.state.settings.closeDetailsOnPlay = els.closeDetailsOnPlayInput ? els.closeDetailsOnPlayInput.checked : true;

    var activeGridButton = els.gridDensityButtons.find(function (button) {
      return button.classList.contains("is-active");
    });
    APP.state.settings.gridSize = Number(activeGridButton ? activeGridButton.getAttribute("data-grid") : 6);

    applySettingsToUi();
    persistState();
  }

  function applyAccentColor(hex) {
    var color = hex || "#6f5cff";
    document.documentElement.style.setProperty("--accent", color);
    document.documentElement.style.setProperty("--accent-rgb", hexToRgbString(color));
  }

  function validView(name) {
    var allowed = ["home", "wall", "categories", "folders", "favorites", "pictures"];
    return allowed.indexOf(name) !== -1 ? name : "home";
  }

  function navigate(viewName) {
    APP.currentView = validView(viewName);
    els.views.forEach(function (view) {
      view.classList.toggle("is-active", view.getAttribute("data-view") === APP.currentView);
    });
    els.navLinks.forEach(function (link) {
      link.classList.toggle("is-active", link.getAttribute("data-nav") === APP.currentView);
    });
    renderAll();
  }

  function handleDocumentClick(event) {
    var navButton = event.target.closest("[data-nav]");
    if (navButton) {
      event.preventDefault();
      navigate(navButton.getAttribute("data-nav"));
      return;
    }

    var folderButton = event.target.closest("[data-folder-path]");
    if (folderButton) {
      event.preventDefault();
      APP.activeFolder = folderButton.getAttribute("data-folder-path") || "";
      navigate("folders");
      renderFolders();
      return;
    }

    var categoryButton = event.target.closest("[data-category]");
    if (categoryButton) {
      event.preventDefault();
      APP.activeCategory = categoryButton.getAttribute("data-category") || "";
      navigate("categories");
      renderCategories();
      return;
    }

    var actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      var actionCard = actionButton.closest(".media-card");
      var actionId = actionCard ? actionCard.getAttribute("data-id") : "";
      if (!actionId) return;

      if (actionButton.getAttribute("data-action") === "favorite") {
        toggleFavorite(actionId);
        return;
      }

      if (actionButton.getAttribute("data-action") === "play") {
        var playItem = findItemById(actionId);
        if (playItem) openMedia(playItem, getPlaylistForItem(playItem));
        return;
      }

      if (actionButton.getAttribute("data-action") === "details") {
        openDetails(actionId);
        return;
      }
    }

    var card = event.target.closest(".media-card");
    if (!card) return;

    var id = card.getAttribute("data-id");
    if (!id) return;
    openDetails(id);
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      if (isDetailsOpen()) {
        closeDetails();
        return;
      }
      if (isSettingsOpen()) {
        closeSettings();
        return;
      }
      if (APP.player.itemId && APP.player.mode !== "collapsed") {
        setPlayerMode("collapsed");
        return;
      }
    }

    if (event.target && /input|textarea|select/i.test(event.target.tagName)) {
      return;
    }

    if (event.code === "Space" && APP.player.itemId) {
      event.preventDefault();
      togglePlayPause();
    }
  }

  function renderAll() {
    renderHome();
    renderWall();
    renderCategories();
    renderFolders();
    renderFavorites();
    renderPictures();
    refreshPlayerUi();
  }

  function renderHome() {
    var videos = getAvailableOrIndexed("video");
    var images = getAvailableOrIndexed("image");
    var favorites = getFavoriteItems();
    var stats = [
      { label: "Videos", value: String(APP.state.library.videos.length) },
      { label: "Pictures", value: String(APP.state.library.images.length) },
      { label: "Favorites", value: String(APP.state.favorites.length) },
      { label: "Linked this session", value: String(APP.filesById.size) }
    ];

    els.statsGrid.innerHTML = stats.map(function (stat) {
      return '<article class="stats-card"><span class="stats-value">' + escapeHtml(stat.value) + '</span><span class="stats-label">' + escapeHtml(stat.label) + "</span></article>";
    }).join("");

    renderMediaGrid(els.homeRecentGrid, sortItems(videos.slice(), "date_desc").slice(0, 8), "Import a local video folder to populate recent media.");
    renderMediaGrid(els.homePopularGrid, sortItems(videos.slice(), "views_desc").slice(0, 8), "Videos with the highest local view count will appear here.");
    renderMediaGrid(els.homeFavoritesGrid, favorites.slice(0, 8), "Your starred media will appear here.");
    renderMediaGrid(els.homePicturesGrid, sortItems(images.slice(), APP.state.settings.sortImages || "date_desc").slice(0, 8), "Import a local picture folder to populate this section.");
    renderCategoryCardGrid(els.homeCategoriesGrid, getDefinedCategories().slice(0, 8), "Import or define categories to show them here.");
  }

  function renderWall() {
    var items = filterItems(APP.state.library.videos);
    items = sortItems(items, APP.state.settings.sortVideos || "date_desc");
    els.videoWallMeta.innerHTML = buildWallMeta(items.length, "video", items);
    renderMediaGrid(els.videoWallGrid, items, "Import a local video folder to build the wall.");
  }

  function renderCategories() {
    var categories = getDefinedCategories();
    var filteredCategories = categories.filter(function (category) {
      if (!APP.searchTerm) return true;
      return normalizeText(category).indexOf(APP.searchTerm) !== -1;
    });

    renderCategoryCardGrid(els.categoriesGrid, filteredCategories, "Import or define categories in settings to build this view.");
    els.categoriesMeta.innerHTML = buildCategorySummary(categories.length, filteredCategories.length);

    if (APP.activeCategory && categories.indexOf(APP.activeCategory) === -1) {
      APP.activeCategory = "";
    }

    if (!APP.activeCategory) {
      els.categoryResultsLabel.textContent = "Choose a category to search the current library.";
      els.categoryResultsMeta.innerHTML = "";
      renderMediaGrid(els.categoryResultsGrid, [], "Select a category card to show matching videos and pictures.");
      return;
    }

    var items = getCategoryMatches(APP.activeCategory);
    items = filterItems(items);
    items = sortItems(items, "date_desc");

    els.categoryResultsLabel.textContent = 'Results for "' + APP.activeCategory + '"';
    els.categoryResultsMeta.innerHTML = '<div class="meta-chip">' + escapeHtml(String(items.length)) + ' matches</div>';
    renderMediaGrid(els.categoryResultsGrid, items, "No imported media matched this category.");
  }

  function renderFolders() {
    var folders = buildFolderEntries(APP.state.library.videos);
    if (APP.activeFolder && !folders.some(function (entry) { return entry.path === APP.activeFolder; })) {
      APP.activeFolder = "";
    }

    renderFolderBreadcrumbs();
    var childFolders = getChildFolders(folders, APP.activeFolder, APP.searchTerm);
    var folderItems = getFolderItems(APP.activeFolder);

    els.folderMeta.innerHTML = buildFolderMeta(folders, childFolders, folderItems);
    renderFolderCardGrid(childFolders);
    renderFolderItems(folderItems);
  }

  function renderFavorites() {
    var items = filterItems(getFavoriteItems());
    items = sortItems(items, APP.state.settings.sortFavorites || "date_desc");
    els.favoritesMeta.innerHTML = buildWallMeta(items.length, "favorite", items);
    renderMediaGrid(els.favoritesGrid, items, "Star videos or pictures to build your favorites collection.");
  }

  function renderPictures() {
    var items = filterItems(APP.state.library.images);
    items = sortItems(items, APP.state.settings.sortImages || "date_desc");
    els.pictureWallMeta.innerHTML = buildWallMeta(items.length, "picture", items);
    renderMediaGrid(els.pictureWallGrid, items, "Import a local image folder to populate the picture wall.");
  }

  function renderMediaGrid(container, items, emptyMessage) {
    container.innerHTML = "";

    if (!items.length) {
      container.appendChild(createEmptyState("Nothing here yet", emptyMessage));
      return;
    }

    var fragment = document.createDocumentFragment();
    items.forEach(function (item) {
      var node = els.cardTemplate.content.firstElementChild.cloneNode(true);
      node.setAttribute("data-id", item.id);

      var thumb = node.querySelector(".media-thumb");
      var thumbFallback = node.querySelector(".media-thumb-fallback");
      var typeBadge = node.querySelector(".type-badge");
      var unavailableBadge = node.querySelector(".unavailable-badge");
      var favoriteButton = node.querySelector(".favorite-toggle");
      var title = node.querySelector(".media-title");
      var subtitle = node.querySelector(".media-subtitle");
      var shortTitle = truncateTitle(item.title, CONFIG.titlePreviewLength || 10);
      var subtitleText = buildCardSubtitle(item);

      title.textContent = shortTitle;
      title.title = item.title || "";
      subtitle.textContent = subtitleText;
      subtitle.title = subtitleText;
      typeBadge.textContent = item.type === "video" ? "Video" : "Image";
      favoriteButton.classList.toggle("is-active", isFavorite(item.id));
      unavailableBadge.hidden = isItemLinked(item);

      applyCardPreview(item, thumb, thumbFallback);
      fragment.appendChild(node);
    });

    container.appendChild(fragment);
  }

  function renderFolderCardGrid(childFolders) {
    els.folderGrid.innerHTML = "";

    if (!childFolders.length) {
      els.folderGrid.appendChild(createEmptyState("No folders here", APP.activeFolder ? "This folder has no more child folders." : "Import a local video folder with subfolders to build the folder browser."));
      return;
    }

    var fragment = document.createDocumentFragment();
    childFolders.forEach(function (entry) {
      var node = els.folderCardTemplate.content.firstElementChild.cloneNode(true);
      node.setAttribute("data-folder-path", entry.path);
      node.querySelector(".folder-card-title").textContent = entry.name;
      node.querySelector(".folder-card-meta").textContent = String(entry.childCount) + " subfolders • " + String(entry.totalVideoCount) + " videos";
      fragment.appendChild(node);
    });
    els.folderGrid.appendChild(fragment);
  }

  function getFolderItems(folderPath) {
    if (!folderPath) return [];
    var items = APP.state.library.videos.filter(function (item) {
      return normalizePath(item.folderPath || "") === normalizePath(folderPath);
    });
    items = filterItems(items);
    return sortItems(items, APP.state.settings.sortVideos || "date_desc");
  }

  function renderFolderItems(items) {
    if (!APP.activeFolder) {
      els.folderItemsLabel.textContent = "Open a folder to show the videos stored directly in it.";
      els.folderItemsMeta.innerHTML = "";
      renderMediaGrid(els.folderItemsGrid, [], "Choose a folder card above to show the direct video contents of that folder.");
      return;
    }

    els.folderItemsLabel.textContent = 'Videos in "' + APP.activeFolder.split('/').slice(-1)[0] + '"';
    els.folderItemsMeta.innerHTML = '<div class="meta-chip">' + escapeHtml(String(items.length)) + ' direct videos</div>';
    if (APP.searchTerm) {
      els.folderItemsMeta.innerHTML += '<div class="meta-chip">Search: ' + escapeHtml(APP.searchTerm) + '</div>';
    }
    renderMediaGrid(els.folderItemsGrid, items, "No direct videos matched this folder view.");
  }

  function renderCategoryCardGrid(container, categories, emptyMessage) {
    container.innerHTML = "";
    if (!categories.length) {
      container.appendChild(createEmptyState("No categories yet", emptyMessage));
      return;
    }

    var fragment = document.createDocumentFragment();
    categories.forEach(function (category) {
      var node = els.categoryCardTemplate.content.firstElementChild.cloneNode(true);
      node.setAttribute("data-category", category);
      node.classList.toggle("is-active", APP.activeCategory === category);
      node.querySelector(".category-card-title").textContent = category;
      node.querySelector(".category-card-count").textContent = String(getCategoryMatches(category).length);
      fragment.appendChild(node);
    });
    container.appendChild(fragment);
  }

  function renderFolderBreadcrumbs() {
    els.folderBreadcrumbs.innerHTML = "";
    var fragment = document.createDocumentFragment();

    var rootButton = document.createElement("button");
    rootButton.type = "button";
    rootButton.className = "breadcrumb-chip" + (APP.activeFolder ? "" : " is-active");
    rootButton.setAttribute("data-folder-path", "");
    rootButton.textContent = "Root";
    fragment.appendChild(rootButton);

    if (APP.activeFolder) {
      var parts = APP.activeFolder.split("/");
      var current = "";
      parts.forEach(function (part, index) {
        current = current ? current + "/" + part : part;

        var arrow = document.createElement("span");
        arrow.className = "breadcrumb-separator";
        arrow.textContent = "›";
        fragment.appendChild(arrow);

        var button = document.createElement("button");
        button.type = "button";
        button.className = "breadcrumb-chip" + (index === parts.length - 1 ? " is-active" : "");
        button.setAttribute("data-folder-path", current);
        button.textContent = part;
        fragment.appendChild(button);
      });
    }

    els.folderBreadcrumbs.appendChild(fragment);
  }

  function buildFolderEntries(items) {
    var map = {};
    items.forEach(function (item) {
      var folderPath = normalizePath(item.folderPath || "");
      if (!folderPath) return;

      var parts = folderPath.split("/");
      var current = "";
      parts.forEach(function (part, index) {
        var parent = current;
        current = current ? current + "/" + part : part;
        if (!map[current]) {
          map[current] = {
            path: current,
            name: part,
            parent: parent,
            depth: index,
            totalVideoCount: 0,
            directVideoCount: 0,
            children: {}
          };
        }
        map[current].totalVideoCount += 1;
        if (index === parts.length - 1) {
          map[current].directVideoCount += 1;
        }
        if (parent && map[parent]) {
          map[parent].children[current] = true;
        }
      });
    });

    return Object.keys(map).sort().map(function (key) {
      var entry = map[key];
      entry.childCount = Object.keys(entry.children).length;
      return entry;
    });
  }

  function getChildFolders(entries, parentPath, searchTerm) {
    return entries.filter(function (entry) {
      var matchesParent = (entry.parent || "") === (parentPath || "");
      if (!matchesParent) return false;
      if (!searchTerm) return true;
      return normalizeText(entry.name).indexOf(searchTerm) !== -1 || normalizeText(entry.path).indexOf(searchTerm) !== -1;
    }).sort(function (a, b) {
      return compareText(a.name, b.name);
    });
  }

  function navigateFolderUp() {
    if (!APP.activeFolder) return;
    var parts = APP.activeFolder.split("/");
    parts.pop();
    APP.activeFolder = parts.join("/");
    renderFolders();
  }

  function buildCategorySummary(totalCount, filteredCount) {
    var chips = [];
    chips.push('<div class="meta-chip">' + escapeHtml(String(totalCount)) + ' total categories</div>');
    if (APP.searchTerm) {
      chips.push('<div class="meta-chip">' + escapeHtml(String(filteredCount)) + ' visible</div>');
      chips.push('<div class="meta-chip">Search: ' + escapeHtml(APP.searchTerm) + '</div>');
    }
    if (APP.activeCategory) {
      chips.push('<div class="meta-chip">Active: ' + escapeHtml(APP.activeCategory) + '</div>');
    }
    return chips.join("");
  }

  function createEmptyState(title, message) {
    var node = els.emptyStateTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector("h3").textContent = title;
    node.querySelector("p").textContent = message;
    return node;
  }

  function buildCardSubtitle(item) {
    var parts = [];
    if (item.folderPath) parts.push(item.folderPath);
    parts.push(formatBytes(item.size || 0));
    parts.push(formatDate(item.modifiedAt));
    return parts.join(" • ");
  }

  function buildWallMeta(count, kind, items) {
    var linkedCount = (items || []).filter(function (item) { return isItemLinked(item); }).length;
    var noun = kind === "picture" ? "pictures" : kind === "favorite" ? "favorites" : "videos";
    var chips = [];
    chips.push('<div class="meta-chip">' + escapeHtml(String(count)) + " " + escapeHtml(noun) + "</div>");
    chips.push('<div class="meta-chip">' + escapeHtml(String(linkedCount)) + ' linked this session</div>');
    if (APP.searchTerm) {
      chips.push('<div class="meta-chip">Search: ' + escapeHtml(APP.searchTerm) + '</div>');
    }
    return chips.join("");
  }

  function buildFolderMeta(folders, childFolders, folderItems) {
    var chips = [];
    chips.push('<div class="meta-chip">' + escapeHtml(String(folders.length)) + ' indexed folders</div>');
    chips.push('<div class="meta-chip">' + escapeHtml(String(childFolders.length)) + ' child folders here</div>');
    if (APP.activeFolder) {
      chips.push('<div class="meta-chip">' + escapeHtml(String((folderItems || []).length)) + ' direct videos here</div>');
      chips.push('<div class="meta-chip">Current: ' + escapeHtml(APP.activeFolder) + '</div>');
    } else {
      chips.push('<div class="meta-chip">Current: root</div>');
    }
    if (APP.searchTerm) {
      chips.push('<div class="meta-chip">Search: ' + escapeHtml(APP.searchTerm) + '</div>');
    }
    return chips.join("");
  }

  function filterItems(items) {
    return items.filter(function (item) {
      return matchesSearch(item);
    });
  }

  function matchesSearch(item) {
    if (!APP.searchTerm) return true;
    var meta = APP.state.mediaMeta[item.id] || {};
    var haystack = [
      item.title,
      item.name,
      item.relativePath,
      item.folderPath,
      (meta.tags || []).join(" "),
      (meta.categories || []).join(" "),
      meta.description || ""
    ].join(" ").toLowerCase();

    return haystack.indexOf(APP.searchTerm) !== -1;
  }

  function sortItems(items, sortMode) {
    var mode = sortMode || "date_desc";

    items.sort(function (a, b) {
      if (mode === "name_asc") return compareText(a.title, b.title);
      if (mode === "name_desc") return compareText(b.title, a.title);
      if (mode === "date_asc") return compareNumber(asTime(a.modifiedAt), asTime(b.modifiedAt));
      if (mode === "date_desc") return compareNumber(asTime(b.modifiedAt), asTime(a.modifiedAt));
      if (mode === "size_asc") return compareNumber(a.size || 0, b.size || 0);
      if (mode === "size_desc") return compareNumber(b.size || 0, a.size || 0);
      if (mode === "views_desc") return compareNumber(getViewCount(b.id), getViewCount(a.id));
      return compareNumber(asTime(b.modifiedAt), asTime(a.modifiedAt));
    });

    return items;
  }

  function getFavoriteItems() {
    return getAllItems().filter(function (item) {
      return isFavorite(item.id);
    });
  }

  function getAllItems() {
    return APP.state.library.videos.concat(APP.state.library.images);
  }

  function getAvailableOrIndexed(kind) {
    return kind === "video" ? APP.state.library.videos.slice() : APP.state.library.images.slice();
  }

  function isFavorite(id) {
    return APP.state.favorites.indexOf(id) !== -1;
  }

  function toggleFavorite(id) {
    var index = APP.state.favorites.indexOf(id);
    if (index === -1) {
      APP.state.favorites.push(id);
    } else {
      APP.state.favorites.splice(index, 1);
    }
    persistState();
    renderAll();
    if (APP.detailsItemId === id) updateDetailsFavoriteButton(id);
  }

  function getDefinedCategories() {
    return normalizeCategoriesText(APP.state.settings.categoriesText || "").split("\n").filter(Boolean);
  }

  function normalizeCategoriesText(value) {
    var seen = {};
    return String(value || "")
      .replace(/\r/g, "")
      .split("\n")
      .map(function (line) { return line.trim(); })
      .filter(function (line) {
        var key = normalizeText(line);
        if (!key || seen[key]) return false;
        seen[key] = true;
        return true;
      })
      .join("\n");
  }

  function getCategoryMatches(category) {
    var term = normalizeText(category);
    if (!term) return [];
    return getAllItems().filter(function (item) {
      var meta = APP.state.mediaMeta[item.id] || {};
      var filenameMatch = [item.title, item.name, item.relativePath, item.folderPath].join(" ").toLowerCase().indexOf(term) !== -1;
      var metaCategoryMatch = (meta.categories || []).some(function (entry) {
        return normalizeText(entry) === term || normalizeText(entry).indexOf(term) !== -1;
      });
      var metaTagMatch = (meta.tags || []).some(function (entry) {
        return normalizeText(entry) === term || normalizeText(entry).indexOf(term) !== -1;
      });
      var descriptionMatch = normalizeText(meta.description || "").indexOf(term) !== -1;
      return filenameMatch || metaCategoryMatch || metaTagMatch || descriptionMatch;
    });
  }

  function importFolderFiles(kind, fileList) {
    var files = slice(fileList || []);
    if (!files.length) {
      updateStatus("No files were selected.", true);
      return;
    }

    var mediaExtensions = kind === "video" ? CONFIG.videoExtensions : CONFIG.imageExtensions;
    var imageExtensions = CONFIG.imageExtensions || [];
    var mediaFiles = files.filter(function (file) {
      var ext = getExtension(file.name);
      return mediaExtensions.indexOf(ext) !== -1;
    });

    if (!mediaFiles.length) {
      updateStatus("No supported " + kind + " files were found in the selected folder.", true);
      return;
    }

    var folderRoot = determineFolderRoot(mediaFiles[0]);
    if (kind === "video" && !APP.state.settings.videoFolderLabel) {
      APP.state.settings.videoFolderLabel = folderRoot;
    }
    if (kind === "image" && !APP.state.settings.imageFolderLabel) {
      APP.state.settings.imageFolderLabel = folderRoot;
    }

    mediaFiles.sort(function (a, b) {
      return compareText(a.webkitRelativePath || a.name, b.webkitRelativePath || b.name);
    });

    clearSessionLinks(kind);

    var imageIndex = {};
    files.forEach(function (file) {
      var ext = getExtension(file.name);
      if (imageExtensions.indexOf(ext) === -1) return;
      var relativePath = normalizePath(file.webkitRelativePath || file.name);
      var relativeWithoutRoot = stripRootFolder(relativePath);
      var key = removeExtension(relativeWithoutRoot).toLowerCase();
      imageIndex[key] = file;
    });

    var items = mediaFiles.map(function (file) {
      var relativePath = normalizePath(file.webkitRelativePath || file.name);
      var relativeWithoutRoot = stripRootFolder(relativePath);
      var folderPath = relativeWithoutRoot.indexOf("/") !== -1 ? relativeWithoutRoot.split("/").slice(0, -1).join("/") : "";
      var title = file.name.replace(/\.[^.]+$/, "");
      var item = {
        id: buildItemId(kind, relativeWithoutRoot, file.size, file.lastModified),
        type: kind,
        title: title,
        name: file.name,
        ext: getExtension(file.name),
        relativePath: relativeWithoutRoot,
        folderPath: folderPath,
        rootFolder: folderRoot,
        size: file.size,
        modifiedAt: new Date(file.lastModified).toISOString(),
        importedAt: new Date().toISOString(),
        posterRelativePath: ""
      };

      APP.filesById.set(item.id, file);
      var posterFile = kind === "video" ? findPosterFile(imageIndex, relativeWithoutRoot, folderPath) : null;
      if (posterFile) {
        var posterRelative = stripRootFolder(normalizePath(posterFile.webkitRelativePath || posterFile.name));
        item.posterRelativePath = posterRelative;
        APP.posterFilesById.set(item.id, posterFile);
      }
      return item;
    });

    if (kind === "video") {
      APP.state.library.videos = items;
      APP.activeFolder = "";
      els.videoFolderLabelInput.value = APP.state.settings.videoFolderLabel || folderRoot;
    } else {
      APP.state.library.images = items;
      els.imageFolderLabelInput.value = APP.state.settings.imageFolderLabel || folderRoot;
    }

    APP.state.library.updatedAt = new Date().toISOString();
    persistState();
    renderAll();

    if (kind === "video") {
      navigate("wall");
    } else {
      navigate("pictures");
    }

    generateVisibleThumbs(items.slice(0, CONFIG.maxInitialThumbs || 24));
    updateStatus("Imported " + String(items.length) + " " + kind + " files from the local folder.");
  }

  function determineFolderRoot(file) {
    var relative = normalizePath(file.webkitRelativePath || file.name);
    return relative.split("/")[0] || "";
  }

  function stripRootFolder(relativePath) {
    var parts = relativePath.split("/");
    if (parts.length <= 1) return relativePath;
    return parts.slice(1).join("/");
  }

  function clearSessionLinks(kind) {
    if (kind) {
      var source = kind === "video" ? APP.state.library.videos : APP.state.library.images;
      source.forEach(function (item) {
        revokeObjectUrl(item.id);
        APP.filesById.delete(item.id);
        APP.posterFilesById.delete(item.id);
      });
      if (APP.player.itemId) {
        var current = findItemById(APP.player.itemId);
        if (current && current.type === kind) {
          closePlayer();
        }
      }
      renderAll();
      updateStatus("Cleared current session links for " + kind + " files.");
      return;
    }

    getAllItems().forEach(function (item) {
      revokeObjectUrl(item.id);
      APP.filesById.delete(item.id);
      APP.posterFilesById.delete(item.id);
    });
    closePlayer();
    renderAll();
    updateStatus("Cleared all session file links. The JSON database remains available.");
  }

  function clearEntireLibrary() {
    if (!window.confirm("Clear the entire MediaWall library, favorites, metadata, and playback state?")) {
      return;
    }

    var settings = clone(APP.state.settings);
    APP.state = createInitialState();
    APP.state.settings = deepMerge(clone(CONFIG.defaultSettings || {}), settings);
    APP.state.settings.videoFolderLabel = "";
    APP.state.settings.imageFolderLabel = "";
    APP.filesById.clear();
    APP.posterFilesById.clear();
    revokeAllObjectUrls();
    APP.activeFolder = "";
    APP.activeCategory = "";
    closePlayer();
    persistState();
    applySettingsToUi();
    navigate("home");
    renderAll();
    updateStatus("The library was cleared.");
  }

  function clearAndDeleteLibrary() {
    if (!window.confirm("Clear the library, metadata, cache references, and reset the local categories list?")) {
      return;
    }

    APP.state = createInitialState();
    APP.filesById.clear();
    APP.posterFilesById.clear();
    revokeAllObjectUrls();
    APP.activeFolder = "";
    APP.activeCategory = "";
    closePlayer();

    STORAGE.clearThumbs().catch(function () { return null; });
    persistState();
    applySettingsToUi();
    navigate("home");
    renderAll();
    downloadText("categories.txt", "");
    updateStatus("The library was cleared and the local categories list was reset. An empty categories.txt file was downloaded.");
  }

  function exportStateJson() {
    var payload = {
      settings: APP.state.settings,
      library: APP.state.library,
      favorites: APP.state.favorites,
      viewCounts: APP.state.viewCounts,
      playbackStates: APP.state.playbackStates,
      mediaMeta: APP.state.mediaMeta
    };

    downloadJson("mediawall-db.json", payload);
    updateStatus("Exported the local JSON database.");
  }

  function importStateJson(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      try {
        var imported = JSON.parse(String(reader.result || "{}"));
        var fresh = createInitialState();
        APP.state = deepMerge(fresh, imported || {});
        ensureStateShape();
        persistState();
        applySettingsToUi();
        APP.activeFolder = "";
        APP.activeCategory = "";
        renderAll();
        closePlayer();
        updateStatus("Imported the JSON database. Re-import your local media folders to relink the actual files.");
      } catch (error) {
        updateStatus("The selected JSON database could not be imported.", true);
      }
    };
    reader.readAsText(file);
  }

  function importCategoriesTextFile(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      APP.state.settings.categoriesText = normalizeCategoriesText(String(reader.result || ""));
      applySettingsToUi();
      persistState();
      renderHome();
      renderCategories();
      updateStatus("Imported categories.txt.");
    };
    reader.onerror = function () {
      updateStatus("The selected categories file could not be imported.", true);
    };
    reader.readAsText(file);
  }

  function exportCategoriesText() {
    commitSettingsForm();
    downloadText("categories.txt", APP.state.settings.categoriesText || "");
    updateStatus("Exported categories.txt.");
  }

  function clearCategoriesText() {
    if (!window.confirm("Clear the current categories list?")) return;
    APP.state.settings.categoriesText = "";
    APP.activeCategory = "";
    applySettingsToUi();
    persistState();
    renderHome();
    renderCategories();
    updateStatus("Categories were cleared.");
  }

  function clearThumbnailCache() {
    STORAGE.clearThumbs().then(function () {
      updateStatus("Thumbnail cache cleared.");
      renderAll();
    }).catch(function () {
      updateStatus("Thumbnail cache could not be cleared.", true);
    });
  }

  function openSettings() {
    applySettingsToUi();
    els.settingsBackdrop.hidden = false;
    els.settingsDrawer.classList.add("is-open");
    els.settingsDrawer.setAttribute("aria-hidden", "false");
  }

  function closeSettings() {
    els.settingsBackdrop.hidden = true;
    els.settingsDrawer.classList.remove("is-open");
    els.settingsDrawer.setAttribute("aria-hidden", "true");
  }

  function isSettingsOpen() {
    return els.settingsDrawer.classList.contains("is-open");
  }

  function openDetails(id) {
    var item = findItemById(id);
    if (!item) return;

    APP.detailsItemId = id;
    var meta = APP.state.mediaMeta[id] || {};

    els.detailsTitle.textContent = item.title;
    els.detailsTagsInput.value = (meta.tags || []).join(", ");
    els.detailsCategoriesInput.value = (meta.categories || []).join(", ");
    els.detailsDescriptionInput.value = meta.description || "";
    updateDetailsFavoriteButton(id);
    renderDetailsList(item);
    renderDetailsPreview(item);

    els.detailsBackdrop.hidden = false;
    els.detailsDrawer.classList.add("is-open");
    els.detailsDrawer.setAttribute("aria-hidden", "false");
  }

  function closeDetails() {
    APP.detailsItemId = null;
    els.detailsBackdrop.hidden = true;
    els.detailsDrawer.classList.remove("is-open");
    els.detailsDrawer.setAttribute("aria-hidden", "true");
  }

  function isDetailsOpen() {
    return els.detailsDrawer.classList.contains("is-open");
  }

  function renderDetailsList(item) {
    var playback = APP.state.playbackStates[item.id] || {};
    var details = [
      ["Type", item.type],
      ["File name", item.name || "-"],
      ["Relative path", item.relativePath || "-"],
      ["Folder", item.folderPath || item.rootFolder || "-"],
      ["Size", formatBytes(item.size || 0)],
      ["Modified", formatDate(item.modifiedAt)],
      ["Availability", isItemLinked(item) ? "Linked in current session" : "Metadata only, relink required"],
      ["View count", String(getViewCount(item.id))],
      ["Playback", playback.time ? formatTime(playback.time) + " / " + formatTime(playback.duration || 0) : "No saved state"]
    ];

    els.detailsList.innerHTML = details.map(function (entry) {
      return "<div><dt>" + escapeHtml(entry[0]) + "</dt><dd>" + escapeHtml(entry[1]) + "</dd></div>";
    }).join("");
  }

  function renderDetailsPreview(item) {
    els.detailsPreviewImage.hidden = true;
    els.detailsPreviewFallback.hidden = false;
    els.detailsPreviewFallback.textContent = isItemLinked(item) ? "Generating preview..." : "Preview requires a linked local file";

    if (item.type === "image" && isItemLinked(item)) {
      ensureObjectUrl(item.id).then(function (url) {
        if (!url || APP.detailsItemId !== item.id) return;
        els.detailsPreviewImage.src = url;
        els.detailsPreviewImage.hidden = false;
        els.detailsPreviewFallback.hidden = true;
      });
      return;
    }

    STORAGE.getThumb(item.id).then(function (thumb) {
      if (!thumb || APP.detailsItemId !== item.id) return;
      els.detailsPreviewImage.src = thumb.dataUrl;
      els.detailsPreviewImage.hidden = false;
      els.detailsPreviewFallback.hidden = true;
    }).catch(function () { return null; });

    if (isItemLinked(item)) {
      queueThumbnail(item);
    }
  }

  function updateDetailsFavoriteButton(id) {
    els.detailsFavoriteButton.textContent = isFavorite(id) ? "Remove favorite" : "Add favorite";
  }

  function saveDetails() {
    if (!APP.detailsItemId) return;

    APP.state.mediaMeta[APP.detailsItemId] = {
      tags: splitCsv(els.detailsTagsInput.value),
      categories: splitCsv(els.detailsCategoriesInput.value),
      description: els.detailsDescriptionInput.value.trim()
    };

    persistState();
    renderAll();
    updateStatus("Details saved.");
  }

  function openMedia(item, playlistIds) {
    if (!item) return;

    if (!isItemLinked(item)) {
      updateStatus("This item is currently metadata only. Re-import the local folder to open the actual file.", true);
      openDetails(item.id);
      return;
    }

    if (APP.state.settings.closeDetailsOnPlay !== false && isDetailsOpen()) {
      closeDetails();
    }

    APP.player.itemId = item.id;
    APP.player.playlistIds = slice(playlistIds || []).filter(Boolean);
    APP.viewCountStamp = "";

    els.bottomPlayer.hidden = false;
    document.body.classList.add("has-player");

    var openMode = APP.state.settings.preferTheaterMode && item.type === "video" ? "theater" : "expanded";
    setPlayerMode(openMode);

    updatePlayerMeta(item);
    highlightPlayerFavorite();

    if (item.type === "video") {
      openVideoItem(item);
    } else {
      openImageItem(item);
    }
  }

  function openVideoItem(item) {
    els.imageViewer.hidden = true;
    els.imageViewer.removeAttribute("src");
    els.mediaPlayer.hidden = false;
    ensureObjectUrl(item.id).then(function (url) {
      if (!url || APP.player.itemId !== item.id) return;
      els.mediaPlayer.src = url;
      els.mediaPlayer.currentTime = 0;
      restorePlaybackState(item.id);
      els.mediaPlayer.play().catch(function () {
        updateStatus("Autoplay was blocked by the browser. Press play to start.");
      });
      syncPlayerDuration();
      queueThumbnail(item);
    });
  }

  function openImageItem(item) {
    els.mediaPlayer.pause();
    els.mediaPlayer.removeAttribute("src");
    els.mediaPlayer.load();
    els.mediaPlayer.hidden = true;
    ensureObjectUrl(item.id).then(function (url) {
      if (!url || APP.player.itemId !== item.id) return;
      els.imageViewer.src = url;
      els.imageViewer.hidden = false;
      els.currentTimeLabel.textContent = "Image";
      els.durationLabel.textContent = "Still";
      els.progressSlider.value = "0";
      incrementViewCount(item.id);
      refreshPlayerUi();
      queueThumbnail(item);
    });
  }

  function updatePlayerMeta(item) {
    els.playerTitle.textContent = item.title;
    els.playerMeta.textContent = buildCardSubtitle(item);
    els.dockTitle.textContent = item.title;
    els.dockMeta.textContent = buildCardSubtitle(item);
    els.playerMiniThumb.textContent = item.type === "video" ? "VID" : "IMG";
    renderPlayerMiniThumb(item);
  }

  function renderPlayerMiniThumb(item) {
    STORAGE.getThumb(item.id).then(function (thumb) {
      if (!thumb || APP.player.itemId !== item.id) return;
      els.playerMiniThumb.style.backgroundImage = 'url("' + thumb.dataUrl + '")';
      els.playerMiniThumb.textContent = "";
    }).catch(function () {
      els.playerMiniThumb.style.backgroundImage = "";
      els.playerMiniThumb.textContent = item.type === "video" ? "VID" : "IMG";
    });
  }

  function highlightPlayerFavorite() {
    els.favoritePlayerButton.classList.toggle("is-active", APP.player.itemId ? isFavorite(APP.player.itemId) : false);
  }

  function closePlayer() {
    rememberCurrentPlaybackPosition(true);
    els.mediaPlayer.pause();
    els.mediaPlayer.removeAttribute("src");
    els.mediaPlayer.load();
    els.imageViewer.removeAttribute("src");
    els.imageViewer.hidden = true;
    els.mediaPlayer.hidden = false;
    APP.player.itemId = null;
    APP.player.playlistIds = [];
    els.bottomPlayer.hidden = true;
    els.playerStage.hidden = true;
    document.body.classList.remove("has-player", "has-player-stage", "player-theater");
    els.playerMiniThumb.style.backgroundImage = "";
    els.playerMiniThumb.textContent = "MW";
    els.dockTitle.textContent = "Nothing playing";
    els.dockMeta.textContent = "Import a folder to start.";
    els.playerTitle.textContent = "Nothing playing";
    els.playerMeta.textContent = "Import a local media folder to begin.";
    syncPlayPauseButton();
    highlightPlayerFavorite();
  }

  function setPlayerMode(mode) {
    if (!APP.player.itemId) return;
    APP.player.mode = mode;

    if (mode === "collapsed") {
      els.playerStage.hidden = true;
      document.body.classList.remove("has-player-stage", "player-theater");
      return;
    }

    els.playerStage.hidden = false;
    document.body.classList.add("has-player-stage");
    if (mode === "theater") {
      document.body.classList.add("player-theater");
    } else {
      document.body.classList.remove("player-theater");
    }
  }

  function refreshPlayerUi() {
    highlightPlayerFavorite();
    syncPlayPauseButton();
  }

  function togglePlayPause() {
    if (!APP.player.itemId) return;
    var item = findItemById(APP.player.itemId);
    if (!item || item.type !== "video") return;

    if (els.mediaPlayer.paused) {
      els.mediaPlayer.play().catch(function () {
        updateStatus("Playback could not start.", true);
      });
    } else {
      els.mediaPlayer.pause();
    }
  }

  function syncPlayPauseButton() {
    var isPlaying = APP.player.itemId && isVideoActive() && !els.mediaPlayer.paused;
    els.playPauseIcon.innerHTML = isPlaying ? PAUSE_ICON : PLAY_ICON;
  }

  function syncPlayerProgress() {
    if (!isVideoActive()) return;
    var current = els.mediaPlayer.currentTime || 0;
    var duration = els.mediaPlayer.duration || 0;

    els.currentTimeLabel.textContent = formatTime(current);
    els.durationLabel.textContent = formatTime(duration);
    els.progressSlider.value = duration ? String(Math.round((current / duration) * 100)) : "0";

    rememberCurrentPlaybackPosition(false);
  }

  function syncPlayerDuration() {
    if (!isVideoActive()) return;
    els.durationLabel.textContent = formatTime(els.mediaPlayer.duration || 0);
  }

  function rememberCurrentPlaybackPosition(forcePersist) {
    if (!APP.state.settings.rememberPlaybackState) return;
    if (!APP.player.itemId || !isVideoActive()) return;
    if (!Number.isFinite(els.mediaPlayer.currentTime)) return;

    APP.state.playbackStates[APP.player.itemId] = {
      time: Math.max(0, Number(els.mediaPlayer.currentTime || 0)),
      duration: Math.max(0, Number(els.mediaPlayer.duration || 0)),
      updatedAt: new Date().toISOString(),
      completed: Boolean(els.mediaPlayer.ended)
    };

    if (forcePersist) persistState();
  }

  function restorePlaybackState(id) {
    if (!APP.state.settings.rememberPlaybackState) return;
    var saved = APP.state.playbackStates[id];
    if (!saved || !saved.time) return;

    var apply = function () {
      var duration = els.mediaPlayer.duration || 0;
      if (!duration || saved.time >= duration - 5) return;
      els.mediaPlayer.currentTime = saved.time;
      els.mediaPlayer.removeEventListener("loadedmetadata", apply);
    };

    els.mediaPlayer.addEventListener("loadedmetadata", apply);
  }

  function handlePlaybackEnded() {
    rememberCurrentPlaybackPosition(true);

    if (APP.player.repeat === "one") {
      els.mediaPlayer.currentTime = 0;
      els.mediaPlayer.play().catch(function () { return null; });
      return;
    }

    var shouldAdvance = APP.player.repeat === "all" || APP.player.shuffle || (APP.state.settings.autoplayNext !== false && APP.player.playlistIds.length > 1);
    if (shouldAdvance) {
      stepPlaylist(1);
    }
  }

  function stepPlaylist(direction) {
    if (!APP.player.itemId) return;
    var currentItem = findItemById(APP.player.itemId);
    var playlist = APP.player.playlistIds && APP.player.playlistIds.length ? APP.player.playlistIds : getPlaylistForItem(currentItem);
    if (!playlist.length) return;

    if (APP.player.shuffle) {
      var randomId = playlist[Math.floor(Math.random() * playlist.length)];
      if (randomId && randomId !== APP.player.itemId) {
        openMedia(findItemById(randomId), playlist);
      }
      return;
    }

    var currentIndex = playlist.indexOf(APP.player.itemId);
    if (currentIndex === -1) currentIndex = 0;
    var nextIndex = currentIndex + direction;

    if (nextIndex < 0) {
      nextIndex = APP.player.repeat === "all" ? playlist.length - 1 : 0;
    }
    if (nextIndex >= playlist.length) {
      nextIndex = APP.player.repeat === "all" ? 0 : playlist.length - 1;
    }

    if (playlist[nextIndex] && playlist[nextIndex] !== APP.player.itemId) {
      var item = findItemById(playlist[nextIndex]);
      if (item) openMedia(item, playlist);
    }
  }

  function seekBy(seconds) {
    if (!isVideoActive()) return;
    els.mediaPlayer.currentTime = Math.max(0, Math.min((els.mediaPlayer.duration || 0), (els.mediaPlayer.currentTime || 0) + seconds));
  }

  function toggleShuffle() {
    APP.player.shuffle = !APP.player.shuffle;
    els.shuffleButton.classList.toggle("is-active", APP.player.shuffle);
  }

  function cycleRepeat() {
    if (APP.player.repeat === "off") APP.player.repeat = "all";
    else if (APP.player.repeat === "all") APP.player.repeat = "one";
    else APP.player.repeat = "off";
    updateRepeatUi();
  }

  function updateRepeatUi() {
    var label = APP.player.repeat === "all" ? "ALL" : APP.player.repeat === "one" ? "ONE" : "OFF";
    els.repeatButton.querySelector(".repeat-label").textContent = label;
    els.repeatButton.classList.toggle("is-active", APP.player.repeat !== "off");
    els.repeatButton.title = "Repeat " + label.toLowerCase();
  }

  function toggleMute() {
    APP.player.isMuted = !APP.player.isMuted;
    els.mediaPlayer.muted = APP.player.isMuted;
    syncVolumeUi();
  }

  function setPlayerVolumeFromUi() {
    APP.player.volume = clamp(Number(els.volumeSlider.value) / 100, 0, 1);
    els.mediaPlayer.volume = APP.player.volume;
    APP.player.isMuted = APP.player.volume === 0;
    els.mediaPlayer.muted = APP.player.isMuted;
    syncVolumeUi();
  }

  function syncVolumeUi() {
    els.muteButtonIcon.innerHTML = APP.player.isMuted || els.mediaPlayer.muted || Number(els.volumeSlider.value) === 0 ? MUTED_ICON : VOLUME_ICON;
    els.muteButton.classList.toggle("is-active", APP.player.isMuted || els.mediaPlayer.muted);
    if (!els.mediaPlayer.muted) {
      var currentVolume = clamp(els.mediaPlayer.volume || APP.player.volume || 0.85, 0, 1);
      APP.player.volume = currentVolume;
      els.volumeSlider.value = String(Math.round(currentVolume * 100));
    }
  }

  function togglePictureInPicture() {
    if (!isVideoActive() || typeof document.pictureInPictureEnabled === "undefined") {
      updateStatus("Picture in picture is not available in this browser or for the current medium.", true);
      return;
    }

    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(function () { return null; });
      return;
    }

    els.mediaPlayer.requestPictureInPicture().catch(function () {
      updateStatus("Picture in picture could not be started.", true);
    });
  }

  function toggleFullscreenPlayer() {
    if (!APP.player.itemId) return;
    var target = isVideoActive() ? els.mediaPlayer : els.imageViewer;
    if (!target.requestFullscreen) return;
    target.requestFullscreen().catch(function () { return null; });
  }

  function openRandomVideo(forceOpenWall) {
    var pool = APP.state.library.videos.filter(function (item) {
      return isItemLinked(item);
    });

    if (!pool.length) {
      updateStatus("Import a local video folder before using the random button.", true);
      openSettings();
      return;
    }

    var item = pool[Math.floor(Math.random() * pool.length)];
    if (!item) return;
    openMedia(item, pool.map(function (entry) { return entry.id; }));
    if (forceOpenWall) {
      navigate("wall");
    }
  }

  function getPlaylistForItem(item) {
    if (!item) return [];

    if (APP.currentView === "folders" && item.type === "video" && APP.activeFolder) {
      return getFolderItems(APP.activeFolder).map(function (entry) { return entry.id; });
    }

    if (APP.currentView === "categories" && APP.activeCategory) {
      return sortItems(filterItems(getCategoryMatches(APP.activeCategory).filter(function (entry) { return entry.type === item.type; })), item.type === "video" ? (APP.state.settings.sortVideos || "date_desc") : (APP.state.settings.sortImages || "date_desc")).map(function (entry) { return entry.id; });
    }

    if (APP.currentView === "favorites") {
      return sortItems(filterItems(getFavoriteItems().filter(function (entry) { return entry.type === item.type; })), item.type === "video" ? (APP.state.settings.sortFavorites || "date_desc") : (APP.state.settings.sortFavorites || "date_desc")).map(function (entry) { return entry.id; });
    }

    if (item.type === "video") {
      return sortItems(filterItems(APP.state.library.videos.slice()), APP.state.settings.sortVideos || "date_desc").map(function (entry) { return entry.id; });
    }
    return sortItems(filterItems(APP.state.library.images.slice()), APP.state.settings.sortImages || "date_desc").map(function (entry) { return entry.id; });
  }

  function incrementViewCountIfNeeded() {
    if (!APP.player.itemId) return;
    if (APP.viewCountStamp === APP.player.itemId) return;
    APP.viewCountStamp = APP.player.itemId;
    incrementViewCount(APP.player.itemId);
  }

  function incrementViewCount(id) {
    APP.state.viewCounts[id] = (APP.state.viewCounts[id] || 0) + 1;
    persistState();
    if (APP.detailsItemId === id) {
      var current = findItemById(id);
      if (current) renderDetailsList(current);
    }
    renderHome();
    renderWall();
    renderFavorites();
    renderFolders();
    renderCategories();
  }

  function getViewCount(id) {
    return APP.state.viewCounts[id] || 0;
  }

  function findItemById(id) {
    return getAllItems().find(function (item) { return item.id === id; }) || null;
  }

  function isItemLinked(item) {
    return APP.filesById.has(item.id);
  }

  function isVideoActive() {
    var item = APP.player.itemId ? findItemById(APP.player.itemId) : null;
    return Boolean(item && item.type === "video");
  }

  function ensureObjectUrl(id) {
    if (APP.objectUrls.has(id)) {
      return Promise.resolve(APP.objectUrls.get(id));
    }

    var file = APP.filesById.get(id);
    if (!file) return Promise.resolve(null);

    var url = URL.createObjectURL(file);
    APP.objectUrls.set(id, url);
    return Promise.resolve(url);
  }

  function revokeObjectUrl(id) {
    var url = APP.objectUrls.get(id);
    if (!url) return;
    URL.revokeObjectURL(url);
    APP.objectUrls.delete(id);
  }

  function revokeAllObjectUrls() {
    APP.objectUrls.forEach(function (url) {
      URL.revokeObjectURL(url);
    });
    APP.objectUrls.clear();
  }

  function applyCardPreview(item, thumbEl, fallbackEl) {
    thumbEl.hidden = true;
    fallbackEl.hidden = false;
    fallbackEl.textContent = item.type === "video" ? "VID" : "IMG";

    STORAGE.getThumb(item.id).then(function (thumb) {
      if (!thumb) {
        if (isItemLinked(item)) queueThumbnail(item);
        return;
      }
      thumbEl.src = thumb.dataUrl;
      thumbEl.hidden = false;
      fallbackEl.hidden = true;
    }).catch(function () {
      if (isItemLinked(item)) queueThumbnail(item);
    });
  }

  function generateVisibleThumbs(items) {
    slice(items || []).slice(0, CONFIG.thumbnailBatchSize || 16).forEach(queueThumbnail);
  }

  function queueThumbnail(item) {
    if (!item || !isItemLinked(item)) return;
    if (APP.thumbQueued.has(item.id)) return;
    APP.thumbQueued.add(item.id);
    APP.thumbQueue.push(item);
    processThumbnailQueue();
  }

  function generateThumbnail(item) {
    var posterFile = APP.posterFilesById.get(item.id);
    if (posterFile) {
      return fileToDataUrl(posterFile).then(function (dataUrl) {
        return resizeImageDataUrl(dataUrl, 480, 270);
      });
    }

    var file = APP.filesById.get(item.id);
    if (!file) return Promise.resolve(null);

    if (item.type === "image") {
      return fileToDataUrl(file).then(function (dataUrl) {
        return resizeImageDataUrl(dataUrl, 480, 270);
      });
    }

    return ensureObjectUrl(item.id).then(function (url) {
      if (!url) return null;
      return captureVideoFrame(url);
    });
  }

  function captureVideoFrame(url) {
    return new Promise(function (resolve) {
      var video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.src = url;

      var done = false;
      var timer = null;
      var finish = function (value) {
        if (done) return;
        done = true;
        if (timer) window.clearTimeout(timer);
        video.pause();
        video.removeAttribute("src");
        resolve(value || null);
      };

      function drawFrame() {
        if (!video.videoWidth || !video.videoHeight) {
          finish(null);
          return;
        }
        var canvas = document.createElement("canvas");
        var ratio = Math.min(480 / video.videoWidth, 270 / video.videoHeight);
        var width = Math.max(1, Math.round(video.videoWidth * ratio));
        var height = Math.max(1, Math.round(video.videoHeight * ratio));
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, width, height);
        finish(canvas.toDataURL("image/jpeg", 0.82));
      }

      video.addEventListener("loadeddata", function () {
        try {
          if (video.duration && video.duration > 2) {
            video.currentTime = Math.min(1.5, video.duration / 3);
          } else {
            drawFrame();
          }
        } catch (error) {
          drawFrame();
        }
      }, { once: true });

      video.addEventListener("seeked", drawFrame, { once: true });
      video.addEventListener("error", function () { finish(null); }, { once: true });
      timer = window.setTimeout(function () { finish(null); }, 3500);
    });
  }

  function processThumbnailQueue() {
    var limit = CONFIG.thumbnailConcurrency || 2;
    while (APP.thumbInFlight < limit && APP.thumbQueue.length) {
      var item = APP.thumbQueue.shift();
      if (!item) continue;
      APP.thumbInFlight += 1;
      (function (currentItem) {
        generateThumbnail(currentItem).then(function (dataUrl) {
          if (!dataUrl) return null;
          return STORAGE.setThumb(currentItem.id, dataUrl).then(function () {
            applyThumbToLiveElements(currentItem.id, dataUrl);
            if (APP.player.itemId === currentItem.id) renderPlayerMiniThumb(currentItem);
          });
        }).catch(function () {
          return null;
        }).finally(function () {
          APP.thumbQueued.delete(currentItem.id);
          APP.thumbInFlight = Math.max(0, APP.thumbInFlight - 1);
          window.setTimeout(processThumbnailQueue, 10);
        });
      })(item);
    }
  }

  function applyThumbToLiveElements(id, dataUrl) {
    var cards = slice(document.querySelectorAll('[data-id="' + id + '"]'));
    cards.forEach(function (card) {
      var thumb = card.querySelector(".media-thumb");
      var fallback = card.querySelector(".media-thumb-fallback");
      if (thumb) {
        thumb.src = dataUrl;
        thumb.hidden = false;
      }
      if (fallback) fallback.hidden = true;
    });

    if (APP.detailsItemId === id) {
      els.detailsPreviewImage.src = dataUrl;
      els.detailsPreviewImage.hidden = false;
      els.detailsPreviewFallback.hidden = true;
    }
  }

  function truncateTitle(value, maxLength) {
    var text = String(value || "");
    var limit = Number(maxLength || 10);
    if (text.length <= limit) return text;
    return text.slice(0, limit) + "...";
  }

  function removeExtension(value) {
    return String(value || "").replace(/\.[^.]+$/, "");
  }

  function findPosterFile(imageIndex, relativeWithoutRoot, folderPath) {
    var stem = removeExtension(relativeWithoutRoot).toLowerCase();
    if (imageIndex[stem]) return imageIndex[stem];
    var folder = String(folderPath || "").toLowerCase();
    if (folder) {
      if (imageIndex[folder + "/poster"]) return imageIndex[folder + "/poster"];
      if (imageIndex[folder + "/folder"]) return imageIndex[folder + "/folder"];
      var fileName = stem.split("/").pop();
      if (imageIndex[folder + "/" + fileName]) return imageIndex[folder + "/" + fileName];
    }
    return null;
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(file);
    });
  }

  function resizeImageDataUrl(dataUrl, maxWidth, maxHeight) {
    return new Promise(function (resolve) {
      var image = new Image();
      image.onload = function () {
        var ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        var width = Math.max(1, Math.round(image.width * ratio));
        var height = Math.max(1, Math.round(image.height * ratio));
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      image.onerror = function () { resolve(null); };
      image.src = dataUrl;
    });
  }

  function downloadJson(filename, payload) {
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
  }

  function downloadText(filename, content) {
    var blob = new Blob([String(content || "")], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
  }

  function triggerDownload(url, filename) {
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  function updateStatus(message, isError) {
    els.scanStatus.textContent = message;
    els.scanStatus.classList.toggle("is-error", Boolean(isError));
  }

  function formatDate(iso) {
    if (!iso) return "-";
    var value = new Date(iso);
    if (Number.isNaN(value.getTime())) return "-";
    return value.toLocaleString();
  }

  function formatBytes(bytes) {
    var value = Number(bytes || 0);
    if (value < 1024) return value + " B";
    var units = ["KB", "MB", "GB", "TB"];
    var unitIndex = -1;
    do {
      value /= 1024;
      unitIndex += 1;
    } while (value >= 1024 && unitIndex < units.length - 1);
    return value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2) + " " + units[unitIndex];
  }

  function formatTime(seconds) {
    var total = Math.max(0, Math.floor(Number(seconds || 0)));
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var secs = total % 60;
    return hours ? hours + ":" + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0") : minutes + ":" + String(secs).padStart(2, "0");
  }

  function buildItemId(kind, relativePath, size, modifiedAt) {
    return kind + "_" + hashString([kind, normalizePath(relativePath).toLowerCase(), String(size || 0), String(modifiedAt || 0)].join("|"));
  }

  function hashString(input) {
    var hash = 2166136261;
    for (var index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
  }

  function normalizePath(value) {
    return String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
  }

  function getExtension(filename) {
    var match = String(filename || "").toLowerCase().match(/\.([^.]+)$/);
    return match ? match[1] : "";
  }

  function splitCsv(value) {
    return String(value || "")
      .split(",")
      .map(function (part) { return part.trim(); })
      .filter(Boolean);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    Object.keys(source).forEach(function (key) {
      if (Array.isArray(source[key])) {
        target[key] = source[key].slice();
      } else if (source[key] && typeof source[key] === "object") {
        if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) {
          target[key] = {};
        }
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
    return target;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hexToRgbString(hex) {
    var clean = String(hex || "").replace("#", "");
    if (clean.length === 3) {
      clean = clean.split("").map(function (char) { return char + char; }).join("");
    }
    if (clean.length !== 6) return "111,92,255";
    var num = parseInt(clean, 16);
    return [num >> 16 & 255, num >> 8 & 255, num & 255].join(",");
  }

  function compareText(a, b) {
    return String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base", numeric: true });
  }

  function compareNumber(a, b) {
    return (a || 0) - (b || 0);
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function asTime(value) {
    var time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function slice(list) {
    return Array.prototype.slice.call(list || []);
  }
})();
// Copyright © sksdesign 2026