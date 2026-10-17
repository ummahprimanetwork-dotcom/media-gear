/* Offline shell: the app opens even with a weak signal. Data always comes live from the backend. */
var VERSION = 'upn-0.9.0'; // bump with each release so phones fetch the new files
var SHELL = ['./', 'index.html', 'admin.html', 'styles.css', 'config.js', 'logic.js', 'memdb.js', 'ui.js', 'api.js', 'app.js', 'user.js', 'admin.js',
  'manifest.webmanifest', 'manifest-admin.webmanifest', 'icons/icon-192.png', 'icons/admin-192.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
// Network first (so updates arrive), cache as fallback. Only same-origin GETs.
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(function (res) {
    var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(r, copy); }); return res;
  }).catch(function () { return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || caches.match('index.html'); }); }));
});
