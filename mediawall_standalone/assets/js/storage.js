(function () {
  "use strict";

  var DB_NAME = "mediawall_cache";
  var DB_VERSION = 1;
  var DB_PROMISE = null;

  function openDb() {
    if (DB_PROMISE) return DB_PROMISE;

    DB_PROMISE = new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains("thumbs")) {
          db.createObjectStore("thumbs", { keyPath: "id" });
        }
      };

      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });

    return DB_PROMISE;
  }

  function getThumb(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("thumbs", "readonly");
        var store = tx.objectStore("thumbs");
        var request = store.get(id);
        request.onsuccess = function () { resolve(request.result || null); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  function setThumb(id, dataUrl) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("thumbs", "readwrite");
        var store = tx.objectStore("thumbs");
        var request = store.put({ id: id, dataUrl: dataUrl, updatedAt: new Date().toISOString() });
        request.onsuccess = function () { resolve(true); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  function clearThumbs() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("thumbs", "readwrite");
        var store = tx.objectStore("thumbs");
        var request = store.clear();
        request.onsuccess = function () { resolve(true); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  window.MediaWallStorage = {
    getThumb: getThumb,
    setThumb: setThumb,
    clearThumbs: clearThumbs
  };
})();
// Copyright © sksdesign 2026