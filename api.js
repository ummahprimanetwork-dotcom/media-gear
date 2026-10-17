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

  function call(action, payload) {
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
    return fetch(cfg.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, payload: payload || {}, token: token }) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }, function () { return fail('No connection. Check your internet and try again.', 'NETWORK'); })
      .then(function (j) { if (!j.ok) return fail(j.error || 'Something went wrong.', j.code); return j.data; }, function (e) { if (e.code) throw e; return fail('The server did not answer properly. Try again in a moment.', 'SERVER'); });
  }
  function fail(msg, code) {
    var e = new Error(msg); e.code = code || 'ERROR';
    if (code === 'AUTH' && token) { setToken(''); setTimeout(function () { onAuthLost(msg); }, 0); }
    throw e;
  }
  function setToken(t) { token = t || ''; Store.set('mg_token', token || null); }

  return {
    DEMO: DEMO, call: call, setToken: setToken, hasToken: function () { return !!token; },
    onAuthLost: function (fn) { onAuthLost = fn; },
    resetDemo: function () { Store.set(DEMO_KEY, null); mem = null; io = null; setToken(''); }
  };
})();
