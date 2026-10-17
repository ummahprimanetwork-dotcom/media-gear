/* Talks to the Apps Script backend, or runs everything locally in demo mode. */
var Store = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage full or blocked */ } }
};

var API = (function () {
  var cfg = window.APP_CONFIG || {};
  var DEMO = !cfg.API_URL;
  var token = Store.get('mg_token') || '';
  var onAuthLost = function () {};
  var io = null;

  // ---------------- demo backend (Logic.js + a local table store) ----------------
  var DEMO_KEY = 'mg_demo_v5';
  var mem = null; // keeps demo data when storage is blocked
  function persist() { if (!io) return; var s = JSON.stringify(io.db.data); mem = s; Store.set(DEMO_KEY, s); }
  function demoIO(data) {
    return {
      db: new MemDB(data),
      env: {
        now: function () { return new Date(); }, fmt: fmtLocal, uuid: uuid4,
        savePhoto: function (dataUrl) { return dataUrl; },
        verifyGoogle: function (cred) { var p = String(cred).replace(/^demo:/, '').split('|'); return { email: p[0], name: p[1] || p[0], picture: '' }; }
      }
    };
  }
  function seedDemo() {
    io = demoIO({});
    Logic.seed(io, { admins: [{ email: 'admin@demo.app', name: 'Nur Admin' }] });
    var at = function (a, p, t) { return Logic.run(a, p, io, t); };
    var A = at('auth.google', { credential: 'demo:admin@demo.app|Nur Admin', app: 'admin' }).token;
    at('admin.user.save', { email: 'aiman@demo.app', name: 'Aiman Hakim', role: 'user', status: 'active', phone: '012-345 6789' }, A);
    at('admin.user.save', { email: 'siti@demo.app', name: 'Siti Aisyah', role: 'user', status: 'active' }, A);
    at('auth.google', { credential: 'demo:hafiz@demo.app|Hafiz Rahman' }); // waits for approval
    var cat = at('catalog', {}, A).items;
    var id = function (n) { return cat.filter(function (i) { return i.name === n; })[0].id; };
    at('admin.item.save', { id: id('Memory Card 64GB'), name: 'Memory Card 64GB', category_id: 'MEM', qty: 6, condition: 'Good' }, A);
    at('admin.item.save', { id: id('Memory Card 32GB'), name: 'Memory Card 32GB', category_id: 'MEM', qty: 4, condition: 'Good' }, A);
    at('admin.item.save', { id: id('Battery A7'), name: 'Battery A7', category_id: 'PWR', qty: 4, condition: 'Good' }, A);
    at('admin.item.log', { item_id: id('Godox VL300'), type: 'damage', detail: 'Fan noisy at full power. Sent for check.', set_condition: 'Under Repair' }, A);
    at('admin.item.log', { item_id: id('Sony A7IV'), type: 'service', detail: 'Sensor cleaning, firmware 4.01', date: UI.todayStr(-40) }, A);
    var U1 = at('auth.google', { credential: 'demo:aiman@demo.app|Aiman Hakim' }).token;
    at('checkout', { lines: [{ item_id: id('Sony A7III') }, { item_id: id('Sony 24-70mm FE 2.8') }, { item_id: id('Wireless Rode #1') }, { item_id: id('Battery A7'), qty: 2 }], purpose: 'Rakaman podcast Studio B', location: 'Studio B', expected_return: UI.todayStr(1) }, U1);
    var U2 = at('auth.google', { credential: 'demo:siti@demo.app|Siti Aisyah' }).token;
    var o2 = at('checkout', { lines: [{ item_id: id('GoPro 10') }, { item_id: id('DJI Mic') }, { item_id: id('Memory Card 64GB'), qty: 2 }], purpose: 'Liputan konvoi kemanusiaan', location: 'Dataran Merdeka', expected_return: UI.todayStr() }, U2).order;
    at('my.return', { order_id: o2.id, line_ids: o2.lines.filter(function (l) { return l.item_name !== 'Memory Card 64GB'; }).map(function (l) { return l.id; }), note: 'GoPro mount slightly loose' }, U2);
    at('checkout', { lines: [{ item_id: id('Benro Tripod') }, { item_id: id('Godox SL60W') }], purpose: 'Sesi foto produk', expected_return: UI.todayStr(3) }, A);
    at('preset.save', { name: 'Event 2-camera kit', scope: 'team', items: [{ item_id: id('Sony A6400') }, { item_id: id('Sony A6100') }, { item_id: id('Benro Tripod') }, { item_id: id('Wireless Rode #2') }, { item_id: id('Memory Card 32GB'), qty: 2 }] }, A);
    at('preset.save', { name: 'Podcast basic', scope: 'team', items: [{ item_id: id('Zoom H8 #1') }, { item_id: id('Rode Mic Pro') }, { item_id: id('Mic Stand #1') }] }, A);
    at('preset.save', { name: 'My vlog kit', items: [{ item_id: id('GoPro 9') }, { item_id: id('DJI Mic') }, { item_id: id('Battery GoPro') }] }, U1);
    var a7 = at('catalog', {}, U2).items.filter(function (i) { return i.name === 'Sony A7III'; })[0];
    at('handover.request', { line_id: a7.holders[0].line_id, purpose: 'Temubual tetamu, Studio A', expected_return: UI.todayStr(2), note: 'Saya ambil dari awak lepas Zohor' }, U2);
    // logins used to seed are not needed
    io.db.all('Sessions').length = 0;
    persist();
  }
  function demoBoot() {
    var raw = Store.get(DEMO_KEY) || mem;
    if (raw) { try { io = demoIO(JSON.parse(raw)); return; } catch (e) { /* fall through */ } }
    seedDemo();
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // One trip to the backend (or the local demo backend).
  function net(action, payload, fresh) {
    if (DEMO) {
      if (!io) demoBoot();
      return sleep(120 + Math.random() * 180).then(function () {
        try {
          var data = Logic.run(action, payload || {}, io, token);
          if (!Logic.isRead(action)) persist();
          return JSON.parse(JSON.stringify(data));
        } catch (e) { return fail(e.isApp ? e.message : 'Something went wrong: ' + e.message, e.code); }
      });
    }
    var body = { action: action, payload: payload || {}, token: token };
    if (fresh) body.fresh = true;
    return post(body).then(function (j) { if (!j.ok) return fail(j.error || 'Something went wrong.', j.code); return j.data; });
  }
  function post(body) {
    return fetch(cfg.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }, function () { return fail('No connection. Check your internet and try again.', 'NETWORK'); })
      .then(null, function (e) { if (e.code) throw e; return fail('The server did not answer properly. Try again in a moment.', 'SERVER'); });
  }

  // ---------------- read cache: pages open instantly with the last data, then update quietly ----------------
  var RC_KEY = 'mg_rc_v1', FRESH_MS = 20000, MAX_SAVE = 400000;
  var rc = {}, inflight = {}, used = {}, freshUntil = 0, gen = 0, onUpdate = function () {}, saveTimer = null;
  var NO_SAVE = { 'admin.log': 1 };
  (function loadRC() {
    try { var o = JSON.parse(Store.get(RC_KEY) || 'null'); if (o && o.tok && o.tok === tag(token)) rc = o.e || {}; } catch (e) { rc = {}; }
  })();
  function tag(t) { return t ? String(t).slice(-12) : ''; }
  function rkey(action, payload) { return action + '|' + JSON.stringify(payload || {}); }
  function saveRC() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (!token) { Store.set(RC_KEY, null); return; }
      var e = {}, size = 0;
      Object.keys(rc).sort(function (a, b) { return rc[b].t - rc[a].t; }).forEach(function (k) {
        if (NO_SAVE[k.split('|')[0]] || size + rc[k].s.length > MAX_SAVE) return;
        e[k] = rc[k]; size += rc[k].s.length;
      });
      Store.set(RC_KEY, JSON.stringify({ tok: tag(token), e: e }));
    }, 400);
  }
  function put(k, data) {
    var s = JSON.stringify(data), prev = rc[k];
    rc[k] = { s: s, t: Date.now() };
    saveRC();
    return !prev || prev.s !== s;
  }
  function staleAll() { gen++; inflight = {}; Object.keys(rc).forEach(function (k) { rc[k].stale = true; }); saveRC(); }
  function clearRC() { gen++; rc = {}; inflight = {}; Store.set(RC_KEY, null); }
  function revalidate(action, payload, k) {
    if (inflight[k]) return inflight[k];
    var g = gen;
    var p = net(action, payload, false).then(function (d) {
      if (inflight[k] === p) delete inflight[k];
      if (g === gen && put(k, d) && used[k]) onUpdate(k);
      return d;
    }, function (e) { if (inflight[k] === p) delete inflight[k]; throw e; });
    inflight[k] = p;
    return p;
  }

  function call(action, payload) {
    if (!Logic.isRead(action)) {
      return net(action, payload, false).then(function (d) {
        if (action === 'auth.google' || action === 'auth.logout') clearRC(); else staleAll();
        return d;
      });
    }
    var k = rkey(action, payload), hit = rc[k], fresh = Date.now() < freshUntil;
    used[k] = true;
    if (hit && !hit.stale && !fresh) {
      if (Date.now() - hit.t > FRESH_MS) revalidate(action, payload, k).catch(function () {});
      return Promise.resolve(JSON.parse(hit.s));
    }
    if (!fresh && inflight[k]) return inflight[k].then(function (d) { return JSON.parse(JSON.stringify(d)); });
    var g = gen;
    return net(action, payload, fresh).then(function (d) { if (g === gen) put(k, d); return d; });
  }

  /** Load several pages' data in one trip, in the background. */
  function prefetch(list) {
    var need = list.filter(function (x) {
      var k = rkey(x[0], x[1]), hit = rc[k];
      return !inflight[k] && (!hit || hit.stale || Date.now() - hit.t > FRESH_MS);
    });
    if (!need.length || !token) return Promise.resolve();
    if (DEMO) return Promise.all(need.map(function (x) { return revalidate(x[0], x[1], rkey(x[0], x[1])).catch(function () {}); }));
    var tok = token, g = gen;
    return post({ batch: need.map(function (x) { return { action: x[0], payload: x[1] || {} }; }), token: token }).then(function (j) {
      if (!j.ok || tok !== token || g !== gen) return;
      j.data.forEach(function (r, i) {
        if (!r.ok) return;
        var k = rkey(need[i][0], need[i][1]);
        if (put(k, r.data) && used[k]) onUpdate(k);
      });
    }).catch(function () {});
  }

  function fail(msg, code) {
    var e = new Error(msg); e.code = code || 'ERROR';
    if (code === 'AUTH' && token) { setToken(''); setTimeout(function () { onAuthLost(msg); }, 0); }
    throw e;
  }
  function setToken(t) { if ((t || '') !== token) clearRC(); token = t || ''; Store.set('mg_token', token || null); }

  return {
    DEMO: DEMO, call: call, prefetch: prefetch, setToken: setToken, hasToken: function () { return !!token; },
    onAuthLost: function (fn) { onAuthLost = fn; },
    /** Called when a page's data changed after it was shown from the cache. */
    onUpdate: function (fn) { onUpdate = fn; },
    /** A new page is being drawn: only its own data counts for quiet updates. */
    newPage: function () { used = {}; },
    /** Refresh button: skip the cache (phone and server) for the next few seconds. */
    freshen: function () { freshUntil = Date.now() + 6000; staleAll(); },
    resetDemo: function () { Store.set(DEMO_KEY, null); mem = null; io = null; setToken(''); clearRC(); }
  };
})();
