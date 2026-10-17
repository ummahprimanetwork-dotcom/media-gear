/* App core: boot, Google sign-in, shell, routing, clicks. */
var App = (function () {
  var E = UI.esc, I = UI.icon;
  var App = {
    mode: document.body.getAttribute('data-app') === 'admin' ? 'admin' : 'user',
    user: null, settings: { APP_NAME: (window.APP_CONFIG || {}).APP_NAME || 'Media Gear', ORG_NAME: (window.APP_CONFIG || {}).ORG_NAME || '' }, views: {}, acts: {}, route: '', arg: '', badge: {}, timers: []
  };
  var NAV = {
    user: [['home', 'board', 'Dashboard'], ['pick', 'cart', 'Gear'], ['profile', 'user', 'Profile']],
    admin: [['a-home', 'board', 'Overview'], ['a-approvals', 'inbox', 'Approvals'], ['a-orders', 'receipt', 'Orders'], ['a-items', 'box', 'Items'], ['a-more', 'more', 'More']]
  };
  var NAV_PARENT = { mine: 'profile', cart: 'pick', photo: 'pick', done: 'pick', 'a-order': 'a-orders', 'a-item': 'a-items', 'a-users': 'a-more', 'a-presets': 'a-more', 'a-cats': 'a-more', 'a-settings': 'a-more', 'a-log': 'a-more' };
  var root = document.getElementById('app');

  // ---------- clicks: data-act="name" ----------
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var name = el.getAttribute('data-act');
    var top = UI.topSheet();
    if (name === 'close-sheet') { if (top) top.close(); return; }
    var fn = (top && top.el.contains(el) && top.acts[name]) || App.acts[name] || GLOBAL[name];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && UI.topSheet()) UI.topSheet().close(); });

  var GLOBAL = {
    go: function (el) { App.go(el.getAttribute('data-to')); },
    back: function () { history.length > 1 && App.route !== homeRoute() ? history.back() : App.go(homeRoute()); },
    profile: openProfile,
    refresh: function (el) { el.classList.add('spinning'); App.render(); }
  };

  function homeRoute() { return App.mode === 'admin' ? 'a-home' : 'home'; }
  function entryRoute() { return (document.body.getAttribute('data-entry') || document.body.getAttribute('data-app')) === 'admin' ? 'a-home' : 'hub'; }
  var CFG = window.APP_CONFIG || {};
  var HUB = CFG.HUB_NAME || 'UmmahPrima Network';

  // ---------- routing ----------
  App.go = function (r, replace) {
    r = r || homeRoute();
    try { if (location.hash.slice(1) !== r) history[replace ? 'replaceState' : 'pushState'](null, '', '#' + r); } catch (e) { /* sandboxed */ }
    App.route = r; App.render();
  };
  window.addEventListener('popstate', function () { var r = location.hash.slice(1); if (r && r !== App.route) { UI.closeAll(); App.route = r; App.render(); } });

  App.render = function () {
    App.timers.forEach(clearInterval); App.timers = [];
    if (!App.user) return renderLogin();
    var parts = (App.route || homeRoute()).split('/');
    var name = parts[0], arg = parts.slice(1).join('/');
    if (name === 'hub') return renderHub();
    if (name.indexOf('a-') === 0 && App.views[name] && App.mode !== 'admin' && App.user.role === 'admin') setMode('admin');
    else if (name.indexOf('a-') !== 0 && App.views[name] && App.mode === 'admin') setMode('user');
    if (!App.views[name] || (App.mode === 'admin') !== (name.indexOf('a-') === 0)) { name = homeRoute(); arg = ''; }
    App.acts = {};
    var navKey = NAV_PARENT[name] || name;
    root.innerHTML =
      '<div class="shell">' +
      '<header class="top"><div class="brand"><button class="apps-btn" data-act="go" data-to="hub" aria-label="All ' + E(HUB) + ' apps">' + I('grid') + '<i class="rec' + (App.mode === 'user' ? ' live' : '') + '"></i></button><span class="brand-text"><span class="brand-name">' + E(App.settings.APP_NAME || 'Media Gear') + '</span>' + '<span class="brand-org">' + (App.mode === 'admin' ? '<span class="mode-tag">ADMIN</span>' : '') + E(App.settings.ORG_NAME || '') + '</span></span></div>' +
      '<button class="refresh-btn" data-act="refresh">' + I('refresh') + '<span>Refresh</span></button>' +
      '<button class="avatar" data-act="profile" aria-label="Account" style="' + (App.user.photo ? 'background-image:url(&quot;' + E(App.user.photo) + '&quot;);color:transparent' : '') + '">' + E(UI.initials(App.user.name)) + '</button></header>' +
      '<main class="main" id="main"></main>' +
      '<nav class="nav" aria-label="Main"><div class="nav-in">' + NAV[App.mode].map(function (n) {
        var b = App.badge[n[0]];
        return '<button data-act="go" data-to="' + n[0] + '"' + (navKey === n[0] ? ' aria-current="page"' : '') + '>' + I(n[1]) + '<span>' + n[2] + '</span>' + (b ? '<span class="dot">' + b + '</span>' : '') + '</button>';
      }).join('') + '</div></nav>' +
      '</div>';
    var main = document.getElementById('main');
    main.innerHTML = UI.loading();
    window.scrollTo(0, 0);
    Promise.resolve(App.views[name](main, arg)).catch(function (e) { showError(main, e); });
  };
  function setMode(m) { App.mode = m; document.body.setAttribute('data-app', m); }

  // ---------- hub: all team apps ----------
  function renderHub() {
    var u = App.user, apps = CFG.APPS || [{ id: 'media-gear', name: App.settings.APP_NAME || 'Media Gear', desc: 'Media equipment', icon: 'camera', status: 'live' }];
    var live = apps.filter(function (a) { return a.status === 'live'; }), soon = apps.filter(function (a) { return a.status !== 'live'; });
    var hour = new Date().getHours(), greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    root.innerHTML =
      '<div class="hub">' +
      '<header class="hub-top"><div class="hub-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></div>' +
      '<div class="hub-brand"><b>' + E(HUB) + '</b><span>' + E(CFG.HUB_TAGLINE || 'Team apps') + '</span></div>' +
      (API.DEMO ? '<button class="demo-flag" data-act="demo-menu" aria-label="Demo options">DEMO</button>' : '') +
      '<button class="avatar" data-act="profile" aria-label="Account" style="' + (u.photo ? 'background-image:url(&quot;' + E(u.photo) + '&quot;);color:transparent' : '') + '">' + E(UI.initials(u.name)) + '</button></header>' +
      '<section class="hub-hero"><div class="hub-in"><span class="eyebrow" style="color:#a8a39b">' + greet + '</span><h1>' + E(u.name.split(' ')[0]) + '</h1><p>Pick an app to start.</p></div></section>' +
      '<main class="hub-in hub-main">' +
      live.map(function (a) {
        var mg = a.id === 'media-gear';
        return '<div class="app-card live"><button class="app-open" data-act="open-app" data-id="' + E(a.id) + '">' +
          '<span class="app-ic">' + I(a.icon || 'box') + '</span><span class="li-main">' + (a.group ? '<span class="app-group">' + E(a.group) + ' —</span>' : '') + '<span class="app-name">' + E(String(a.name).split(' - ').map(function (p) { return p.replace(/ /g, '\u00a0'); }).join('\u00a0- ')) + '</span>' + (a.version ? '<span class="ver">v' + E(a.version) + ' · ' + E(CFG.VERSION_LABEL || 'Beta') + '</span>' : '') + '<span class="app-desc">' + E(a.desc || '') + '</span>' +
          (mg ? '<span class="app-stats" id="hub-stats"><span class="skel-line"></span></span>' : '') + '</span>' +
          '<span class="app-go">' + I('right') + '</span></button>' +
          (mg && u.role === 'admin' ? '<button class="app-admin" data-act="open-admin">' + I('sliders') + '<span>Admin</span><span class="app-badge" id="hub-admin-n" hidden></span></button>' : '') + '</div>';
      }).join('') +
      (soon.length ? '<div class="group-h">' + I('clock') + 'Coming soon</div><div class="soon-grid">' + soon.map(function (a) {
        return '<button class="app-card soon" data-act="soon-app" data-name="' + E(a.name) + '"><span class="app-ic">' + I(a.icon || 'box') + '</span>' +
          '<span class="app-name">' + E(a.name) + '</span><span class="app-desc">' + E(a.desc || '') + '</span>' +
          (a.note ? '<span class="app-note">' + I('star') + '<span>' + E(a.note) + '</span></span>' : '') + '<span class="pill p-mute">Coming soon</span></button>';
      }).join('') + '</div>' : '') +
      '<footer class="hub-foot"><div class="hub-mark sm" aria-hidden="true"><span></span><span></span><span></span><span></span></div>' +
      '<div><b>' + E(HUB) + '</b> · v' + E(CFG.VERSION || '0.9.0') + ' ' + E(CFG.VERSION_LABEL || 'Beta') + (CFG.VERSION_NAME ? ' “' + E(CFG.VERSION_NAME) + '”' : '') + '</div>' +
      '<div>Testing release. Found a problem? Tell the admin.</div></footer>' +
      '</main></div>';
    App.acts = {
      'open-app': function (el) { if (el.getAttribute('data-id') === 'media-gear') { setMode('user'); App.go('home'); } },
      'open-admin': function () { setMode('admin'); App.go('a-home'); },
      'soon-app': function (el) { UI.toast(el.getAttribute('data-name') + ' is coming soon.'); }
    };
    window.scrollTo(0, 0);
    Promise.all([API.call('board'), API.call('my.handovers').catch(function () { return { incoming: [] }; })]).then(function (r) {
      var box = document.getElementById('hub-stats'); if (!box) return;
      var mine = r[0].in_use.filter(function (x) { return x.mine; }).reduce(function (s, x) { return s + x.qty; }, 0);
      var people = {}; r[0].in_use.forEach(function (x) { people[x.holder_key || x.holder] = 1; });
      var bits = [mine ? '<b>' + mine + '</b> with you' : 'Nothing with you', '<b>' + Object.keys(people).length + '</b> ' + (Object.keys(people).length === 1 ? 'person has' : 'people have') + ' gear out'];
      if (r[1].incoming.length) bits.push('<b class="hot">' + r[1].incoming.length + ' handover request' + (r[1].incoming.length > 1 ? 's' : '') + '</b>');
      box.innerHTML = bits.map(function (b) { return '<span>' + b + '</span>'; }).join('');
    }).catch(function () { var box = document.getElementById('hub-stats'); if (box) box.innerHTML = ''; });
    if (u.role === 'admin') API.call('admin.overview').then(function (d) {
      var s = d.stats, n = s.pending_returns + s.pending_checkouts + s.pending_users + (s.pending_handovers || 0);
      var b = document.getElementById('hub-admin-n'); if (b && n) { b.hidden = false; b.textContent = n; }
    }).catch(function () {});
  }

  function showError(main, e) {
    if (e && e.code === 'AUTH') return;
    main.innerHTML = '<div class="empty">' + I('alert') + '<b>Could not load this page</b>' + E(e && e.message) + '<div style="margin-top:14px"><button class="btn dark" data-act="refresh">Try again</button></div></div>';
  }
  App.error = function (e) { UI.toast((e && e.message) || 'Something went wrong.', true); };
  /** Run an API call with a busy button; returns the data or undefined on error. */
  App.run = function (btn, action, payload) {
    var label;
    if (btn) { btn.disabled = true; label = btn.innerHTML; btn.innerHTML = '<span class="spin" style="width:18px;height:18px;border-width:2.5px;border-top-color:currentColor"></span>'; }
    return API.call(action, payload).then(function (d) { return d; }, function (e) { App.error(e); return undefined; })
      .then(function (d) { if (btn && document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = label; } return d; });
  };
  App.every = function (ms, fn) { App.timers.push(setInterval(function () { if (document.visibilityState === 'visible' && !UI.topSheet()) fn(); }, ms)); };
  App.setBadge = function (route, n) {
    App.badge[route] = n || 0;
    var b = document.querySelector('.nav [data-to="' + route + '"]');
    if (!b) return;
    var d = b.querySelector('.dot');
    if (n && !d) { d = document.createElement('span'); d.className = 'dot'; b.appendChild(d); }
    if (d) { if (n) d.textContent = n; else d.remove(); }
  };

  // ---------- login ----------
  var loginError = '', pendingUser = null;
  function renderLogin() {
    var s = App.settings;
    var admin = App.mode === 'admin';
    root.innerHTML =
      '<div class="login"><div class="login-in">' +
      '<div class="vf" aria-hidden="true">' +
      '<i class="vf-c tl"></i><i class="vf-c tr"></i><i class="vf-c bl"></i><i class="vf-c br"></i><i class="vf-grid"></i>' +
      '<div class="vf-hud vf-top"><span class="vf-rec"><b></b>REC</span><span class="vf-tc" id="vf-tc">00:00:00:00</span>' +
      '<span class="vf-spec">4K · 25P<span class="vf-bat"><i></i><i></i><i></i></span></span></div>' +
      '<div class="vf-mid"><div class="vf-focus"><div class="vf-title' + (admin ? '' : ' hub-title') + '">' + E(admin ? (s.APP_NAME || 'Media Gear') : HUB) + '</div>' +
      '<div class="vf-org">' + E(admin ? (s.ORG_NAME || '') : (CFG.HUB_TAGLINE || 'Team apps')) + '</div></div></div>' +
      '<div class="vf-hud vf-bot"><span class="vf-meter"><span>L<i></i></span><span>R<i></i></span></span>' +
      '<span class="vf-exp">ISO 800 · F2.8 · 1/50</span><span class="vf-mode">' + (admin ? 'ADMIN' : 'CREW') + '</span></div>' +
      '</div>' +
      '<div class="stack"><h1>' + (admin ? 'Admin<br>control room' : 'One sign-in.<br>All our<br>team apps.') + '</h1>' +
      '<p>' + (admin ? 'Approve returns, track who has what, and keep every item\'s condition on record.' : 'Media Gear is live now. Post production, graphic design and subscriptions are on the way.') + '</p></div>' +
      (loginError ? '<div class="err" role="alert">' + E(loginError) + '</div>' : '') +
      (pendingUser ? '<div class="notice info" style="color:var(--ink)">' + I('clock') + '<div><b>Hi ' + E(pendingUser.name) + ', you are on the list.</b><br>An admin needs to approve <b>' + E(pendingUser.email) + '</b> before you can use the apps. Try signing in again after they do.</div></div>' : '') +
      '<div class="stack" id="signin"></div>' +
      '</div><div class="fine">' + (API.DEMO ? 'Demo mode · data stays on this device' : 'Sign in with the Google account your admin registered') + '<br>v' + E(CFG.VERSION || '0.9.0') + ' ' + E(CFG.VERSION_LABEL || 'Beta') + (CFG.VERSION_NAME ? ' · “' + E(CFG.VERSION_NAME) + '”' : '') + '</div></div>';
    var t0 = Date.now(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var tick = setInterval(function () {
      var el = document.getElementById('vf-tc');
      if (!el) { clearInterval(tick); return; }
      var ms = Date.now() - t0, sec = Math.floor(ms / 1000);
      el.textContent = pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor(sec / 60) % 60) + ':' + pad(sec % 60) + ':' + pad(Math.floor((ms % 1000) / 40));
    }, 40);
    App.timers.push(tick);
    var box = document.getElementById('signin');
    if (API.DEMO) {
      var people = [['admin@demo.app', 'Nur Admin', 'Admin'], ['aiman@demo.app', 'Aiman Hakim', 'User'], ['siti@demo.app', 'Siti Aisyah', 'User'], ['hafiz@demo.app', 'Hafiz Rahman', 'Waiting approval']];
      if (!admin) people.push(people.shift());
      box.innerHTML = '<div class="eyebrow" style="color:#a8a39b">Demo · pretend to be</div><div class="demo-users">' + people.map(function (p) {
        return '<button class="btn" data-act="demo-login" data-email="' + p[0] + '" data-name="' + E(p[1]) + '">' + I('user') + '<span class="grow" style="text-align:left">' + E(p[1]) + '</span><span class="small muted">' + p[2] + '</span></button>';
      }).join('') + '</div>';
      App.acts = { 'demo-login': function (el) { signIn('demo:' + el.getAttribute('data-email') + '|' + el.getAttribute('data-name')); } };
    } else {
      box.innerHTML = '<div class="gbtn-wrap" id="gbtn"><div class="spin"></div></div>';
      loadGoogle(function () {
        try {
          google.accounts.id.initialize({ client_id: APP_CONFIG.GOOGLE_CLIENT_ID, callback: function (r) { signIn(r.credential); }, ux_mode: 'popup', auto_select: false });
          var w = Math.min(380, box.clientWidth || 320);
          google.accounts.id.renderButton(document.getElementById('gbtn'), { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: w });
        } catch (e) { document.getElementById('gbtn').innerHTML = '<div class="err">Google sign-in could not start. Check GOOGLE_CLIENT_ID in config.js.</div>'; }
      });
    }
  }
  function loadGoogle(cb) {
    if (window.google && google.accounts) return cb();
    var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = cb;
    s.onerror = function () { var g = document.getElementById('gbtn'); if (g) g.innerHTML = '<div class="err">Could not reach Google. Check your connection and reload.</div>'; };
    document.head.appendChild(s);
  }
  function signIn(credential) {
    loginError = ''; pendingUser = null;
    var box = document.getElementById('signin'); if (box) box.innerHTML = '<div class="spin"></div>';
    API.call('auth.google', { credential: credential, app: App.mode }).then(function (d) {
      App.settings = d.settings || App.settings;
      if (d.pending) { pendingUser = d.user; renderLogin(); return; }
      API.setToken(d.token); App.user = d.user; App.go(App.mode === 'admin' ? 'a-home' : 'hub', true);
    }, function (e) { loginError = e.message; renderLogin(); });
  }
  API.onAuthLost(function (msg) { App.user = null; UI.closeAll(); loginError = msg || ''; renderLogin(); });

  // ---------- profile sheet ----------
  function openProfile() {
    var u = App.user, isAdmin = u.role === 'admin';
    var other = App.mode === 'admin' ? 'user' : 'admin';
    var s = UI.sheet(UI.sheetHead(u.name, u.email) +
      '<div class="list">' +
      '<div class="li"><div class="thumb">' + I(isAdmin ? 'sliders' : 'user') + '</div><div class="li-main"><div class="li-title">' + (isAdmin ? 'Admin' : 'User') + ' account</div><div class="li-sub">' + E(App.settings.ORG_NAME || '') + '</div></div></div>' +
      (isAdmin ? '<button class="li" data-act="switch-app">' + '<div class="thumb">' + I('swap') + '</div><div class="li-main"><div class="li-title">Open the ' + other + ' app</div><div class="li-sub">' + (other === 'admin' ? 'Approvals, items, users, settings' : 'Dashboard, pick and return gear') + '</div></div><span class="chev">' + I('right') + '</span></button>' : '') +
      '<button class="li" data-act="to-hub"><div class="thumb">' + I('grid') + '</div><div class="li-main"><div class="li-title">All ' + E(HUB) + ' apps</div></div><span class="chev">' + I('right') + '</span></button>' +
      (API.DEMO ? '<button class="li" data-act="demo-open"><div class="thumb">' + I('info') + '</div><div class="li-main"><div class="li-title">Demo options</div><div class="li-sub">Reset demo data</div></div><span class="chev">' + I('right') + '</span></button>' : '') +
      '<button class="li" data-act="logout"><div class="thumb">' + I('logout') + '</div><div class="li-main"><div class="li-title">Sign out</div></div></button>' +
      '</div>', {
      'switch-app': function () { s.close(); App.switchApp(); },
      'to-hub': function () { s.close(); App.go('hub'); },
      'demo-open': function () { s.close(); GLOBAL['demo-menu'](); },
      logout: function () { s.close(); API.call('auth.logout').catch(function () {}).then(function () { API.setToken(''); App.user = null; loginError = ''; pendingUser = null; renderLogin(); }); }
    });
  }
  App.switchApp = function () {
    var other = App.mode === 'admin' ? 'user' : 'admin';
    setMode(other); App.go(homeRoute());
  };
  GLOBAL['demo-menu'] = function () {
    var s = UI.sheet(UI.sheetHead('Demo mode', 'Not connected to Google Sheets yet') +
      '<p class="muted" style="margin:0 0 14px">Everything you do is saved only on this device so you can try the full flow. Once the backend URL is in config.js, the app uses your real sheets.</p>' +
      '<div class="stack"><button class="btn dark block" data-act="demo-person">' + I('users') + 'Sign in as someone else</button>' +
      '<button class="btn ghost block" data-act="demo-switch">' + I('swap') + 'Switch to the ' + (App.mode === 'admin' ? 'user' : 'admin') + ' app</button>' +
      '<button class="btn ghost block" data-act="demo-reset">' + I('refresh') + 'Reset demo data</button></div>', {
      'demo-switch': function () { s.close(); if (App.user && App.user.role !== 'admin' && App.mode === 'user') { App.user = null; API.setToken(''); } setMode(App.mode === 'admin' ? 'user' : 'admin'); if (App.user) App.go(homeRoute()); else renderLogin(); },
      'demo-person': function () { s.close(); API.setToken(''); App.user = null; setMode('user'); renderLogin(); },
      'demo-reset': function () { s.close(); API.resetDemo(); App.user = null; Cart.clear(); setMode(document.body.getAttribute('data-entry') === 'admin' ? 'admin' : 'user'); renderLogin(); UI.toast('Demo data reset'); }
    });
  };

  // ---------- boot ----------
  App.boot = function () {
    document.body.setAttribute('data-entry', App.mode);
    if (API.DEMO) document.title = (App.mode === 'admin' ? 'Media Gear Admin' : HUB) + ' (demo)';
    if (!API.hasToken()) { renderLogin(); return; }
    root.innerHTML = '<div class="loading" style="min-height:80vh"><div class="spin"></div></div>';
    API.call('auth.me').then(function (d) {
      App.user = d.user; App.settings = d.settings;
      if (App.mode === 'admin' && d.user.role !== 'admin') { App.user = null; loginError = 'This account is not an admin.'; return renderLogin(); }
      var r = ''; try { r = location.hash.slice(1); } catch (e) { r = ''; }
      App.go(r || entryRoute(), true);
    }, function (e) { if (e.code !== 'AUTH') { loginError = e.message; renderLogin(); } });
  };
  return App;
})();

/* Cart lives on the phone until checkout. */
var Cart = (function () {
  var items = {}, takes = {};
  function key() { return 'mg_cart_' + (App.user ? App.user.email : ''); }
  function load() {
    try { items = JSON.parse(Store.get(key()) || '{}') || {}; } catch (e) { items = {}; }
    try { takes = JSON.parse(Store.get(key() + '_take') || '{}') || {}; } catch (e) { takes = {}; }
  }
  function save() { Store.set(key(), JSON.stringify(items)); Store.set(key() + '_take', JSON.stringify(takes)); }
  return {
    load: load,
    /* take-over entries: { line_id: { item_id, item_name, from_name, category_id } } */
    take: function (lineId, info) { takes[lineId] = info; save(); },
    untake: function (lineId) { delete takes[lineId]; save(); },
    takes: function () { return takes; },
    taking: function (itemId) { return Object.keys(takes).some(function (k) { return takes[k].item_id === itemId; }); },
    get: function (id) { return items[id] || 0; },
    set: function (id, n) { if (n > 0) items[id] = n; else delete items[id]; save(); },
    all: function () { return items; },
    count: function () { return Object.keys(items).reduce(function (s, k) { return s + items[k]; }, 0) + Object.keys(takes).length; },
    lines: function () { return Object.keys(items).map(function (k) { return { item_id: k, qty: items[k] }; }); },
    clear: function () { items = {}; takes = {}; save(); }
  };
})();
