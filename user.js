/* User app: Dashboard (who has the gear), Pick (side menu + presets), Cart, Photo, Done, Profile. */
(function () {
  var E = UI.esc, I = UI.icon, V = App.views;
  var catalog = null; // cached between Pick and Cart
  var presets = null;
  var lastDone = null;
  var catIcon = {};

  function iconFor(catId) { return catIcon[catId] || 'box'; }
  function loadCatalog() {
    return API.call('catalog').then(function (d) {
      catalog = d; d.categories.forEach(function (c) { catIcon[c.id] = c.icon; }); return d;
    });
  }
  function loadPresets() { return API.call('presets').then(function (d) { presets = d; return d; }); }
  function itemById(id) { return catalog && catalog.items.filter(function (x) { return x.id === id; })[0]; }

  // =================== DASHBOARD: who has the gear ===================
  var open = {};
  V.home = function (main) {
    function draw(d) {
      var people = {}, list = [];
      d.in_use.forEach(function (x) {
        var k = x.holder_key || x.holder;
        if (!people[k]) { people[k] = { key: k, name: x.holder, mine: x.mine, lines: [], since: x.since }; list.push(people[k]); }
        people[k].lines.push(x);
        if (x.since < people[k].since) people[k].since = x.since;
      });
      list.sort(function (a, b) { return a.mine ? -1 : b.mine ? 1 : a.since < b.since ? 1 : -1; });
      main.innerHTML =
        '<div class="page-head"><div class="stack-sm"><span class="eyebrow">Live · updated ' + E(UI.when(d.updated).replace('Today ', '')) + '</span><h1>Gear in use</h1></div></div>' +
        (d.announcement ? '<div class="notice info" style="margin-bottom:14px">' + I('info') + '<div>' + E(d.announcement) + '</div></div>' : '') +
        (list.length ? '<div class="people">' + list.map(person).join('') + '</div>' :
          '<div class="card">' + UI.empty('check', 'Nobody has gear out', 'Everything is in the store right now.') + '</div>') +
        '<div style="margin-top:20px"><button class="btn primary block" data-act="go" data-to="pick">' + I('cart') + 'Pick gear</button></div>';
    }
    function person(p) {
      var n = p.lines.reduce(function (s, l) { return s + l.qty; }, 0);
      var flag = p.lines.some(function (l) { return l.overdue; }) ? UI.pill('Overdue', 'p-bad') :
        p.lines.some(function (l) { return l.status === 'RETURN_REQUESTED'; }) ? UI.pill('Returning', 'p-warn') :
          p.lines.some(function (l) { return l.status === 'PENDING'; }) ? UI.pill('Awaiting approval', 'p-info') : '';
      var isOpen = !!open[p.key];
      return '<div class="person' + (isOpen ? ' open' : '') + '">' +
        '<button class="person-h" data-act="toggle" data-id="' + E(p.key) + '" aria-expanded="' + isOpen + '">' +
        '<span class="avatar lg' + (p.mine ? ' me' : '') + '">' + E(UI.initials(p.name)) + '</span>' +
        '<span class="li-main"><span class="li-title" style="display:block">' + (p.mine ? 'You' : E(p.name)) + '</span>' +
        '<span class="li-sub" style="display:block">' + n + ' item' + (n > 1 ? 's' : '') + ' · since ' + E(UI.when(p.since)) + '</span></span>' +
        flag + '<span class="chev turn">' + I('chevd') + '</span></button>' +
        (isOpen ? '<div class="person-b">' + p.lines.map(function (l) {
          var it = itemById(l.item_id);
          return '<div class="sub-item"><div class="thumb sm">' + UI.thumb(it && it.photo, iconFor(l.category_id)) + '</div><div class="li-main">' +
            '<div class="sub-name">' + E(l.item_name) + (l.qty > 1 ? ' <span class="muted">×' + l.qty + '</span>' : '') + '</div>' +
            '<div class="sub-meta">Taken ' + E(UI.when(l.since)) + (l.expected_return ? ' · back ' + E(UI.day(l.expected_return)) : '') + '</div>' +
            (l.purpose ? '<div class="sub-meta">' + E(l.purpose) + '</div>' : '') +
            (l.handover_to ? '<div class="sub-meta" style="color:var(--info);font-weight:700">Handover to ' + E(l.handover_to) + ' pending</div>' : '') +
            '</div>' + UI.linePill(l.status, l.overdue) + '</div>';
        }).join('') + '</div>' : '') + '</div>';
    }
    var last;
    App.acts = { toggle: function (el) { var k = el.getAttribute('data-id'); open[k] = !open[k]; draw(last); } };
    App.every(30000, function () { API.call('board').then(function (d) { if (App.route === 'home' || !App.route) { last = d; draw(d); } }).catch(function () {}); });
    refreshHandoverBadge();
    return Promise.all([API.call('board'), catalog ? null : loadCatalog().catch(function () {})]).then(function (r) { last = r[0]; draw(r[0]); });
  };
  function refreshHandoverBadge() { API.call('my.handovers').then(function (h) { App.setBadge('profile', h.incoming.length); }).catch(function () {}); }

  // =================== PICK: side menu + item list ===================
  var pickCat = '', pickQ = '';
  V.pick = function (main) {
    Cart.load();
    function draw() {
      var d = catalog;
      if (!pickCat) pickCat = (presets && (presets.mine.length || presets.team.length)) ? 'presets' : (d.categories[0] || {}).id;
      var counts = {};
      d.items.forEach(function (i) { counts[i.category_id] = (counts[i.category_id] || 0) + (i.available > 0 ? 1 : 0); });
      var n = Cart.count();
      var nPre = presets ? presets.mine.length + presets.team.length : 0;
      var body;
      if (pickQ) {
        var hits = d.items.filter(function (i) { return (i.name + ' ' + i.code).toLowerCase().indexOf(pickQ) >= 0; });
        body = hits.length ? '<div class="group-h" style="margin-top:0">' + I('search') + hits.length + ' found</div><div class="rows">' + hits.map(row).join('') + '</div>' : UI.empty('search', 'Nothing found', 'No gear matches "' + pickQ + '".');
      } else if (pickCat === 'presets') {
        body = presetList();
      } else {
        var cat = d.categories.filter(function (c) { return c.id === pickCat; })[0] || d.categories[0];
        var items = d.items.filter(function (i) { return i.category_id === cat.id; });
        body = '<div class="group-h" style="margin-top:0">' + I(cat.icon) + E(cat.name) + '<span class="n">' + (counts[cat.id] || 0) + ' of ' + items.length + ' free</span></div>' +
          (items.length ? '<div class="rows">' + items.map(row).join('') + '</div>' : UI.empty('box', 'Empty', 'No gear in this category yet.'));
      }
      main.classList.toggle('has-cart', n > 0);
      main.innerHTML =
        '<div class="page-head" style="margin-bottom:10px"><div class="stack-sm"><span class="eyebrow">Step 1 of 4</span><h1>Pick your gear</h1></div></div>' +
        '<div class="pick-top"><label class="search">' + I('search') + '<input class="input" id="pq" type="search" placeholder="Search all gear" value="' + E(pickQ) + '" aria-label="Search gear"></label></div>' +
        '<div class="pick">' +
        '<nav class="rail" aria-label="Categories">' +
        '<button class="rail-b" data-act="cat" data-id="presets" aria-pressed="' + (pickCat === 'presets' && !pickQ) + '">' + I('star') + '<span>Presets</span>' + (nPre ? '<i>' + nPre + '</i>' : '') + '</button>' +
        d.categories.map(function (c) { return '<button class="rail-b" data-act="cat" data-id="' + E(c.id) + '" aria-pressed="' + (pickCat === c.id && !pickQ) + '">' + I(c.icon) + '<span>' + E(c.name) + '</span></button>'; }).join('') +
        '</nav><section class="pick-list">' + body + '</section></div>' +
        (n ? '<div class="cartbar"><button class="btn primary" data-act="go" data-to="cart"><span class="row"><span class="cart-count">' + n + '</span>View cart</span><span class="row">Checkout ' + I('right') + '</span></button></div>' : '');
      var inp = document.getElementById('pq');
      inp.addEventListener('input', UI.debounce(function () { pickQ = inp.value.trim().toLowerCase(); draw(); var x = document.getElementById('pq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 220));
      var on = main.querySelector('.rail-b[aria-pressed="true"]'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
    }
    function holderText(i) {
      var h = i.holders || [];
      if (!h.length) return '';
      var first = h[0], who = first.mine ? 'you' : first.name;
      var verb = first.status === 'RETURN_REQUESTED' ? 'Pending return by ' : first.status === 'PENDING' ? 'Awaiting approval for ' : 'In use by ';
      return verb + who + (h.length > 1 ? ' +' + (h.length - 1) : '');
    }
    function row(i) {
      var inCart = Cart.get(i.id), off = i.available <= 0 && !inCart;
      var h = i.holders || [];
      var ret = h.length && h.every(function (x) { return x.status === 'RETURN_REQUESTED'; });
      var state = i.condition === 'Under Repair' ? ['Under repair', 'warn'] : i.condition === 'Lost' ? ['Missing', 'no'] : i.available <= 0 ? [holderText(i) || 'In use', ret ? 'warn' : 'no'] :
        i.qty > 1 ? [i.available + ' of ' + i.qty + ' free', 'ok'] : i.condition === 'Damaged' ? ['Free · damaged', 'warn'] : i.condition === 'Incomplete' ? ['Free · incomplete', 'warn'] : ['Available', 'ok'];
      var takeable = h.filter(function (x) { return x.status === 'OUT' && !x.mine; });
      var mineAsk = h.some(function (x) { return x.handover_mine; });
      var ho = h.filter(function (x) { return x.handover_to; })[0];
      var extra = off && mineAsk ? '<div class="avail" style="color:var(--info)">You asked to take it over</div>' : off && ho ? '<div class="avail" style="color:var(--info)">Handover to ' + E(ho.handover_to) + ' pending</div>' : '';
      if (off) {
        var taking = Object.keys(Cart.takes()).filter(function (k) { return Cart.takes()[k].item_id === i.id; })[0];
        if (taking) { state = ['In cart · taking over from ' + Cart.takes()[taking].from_name, 'take']; extra = ''; }
        var btn = taking ? '<button class="icon-btn" data-act="untake" data-id="' + E(taking) + '" aria-label="Remove take-over">' + I('x') + '</button>' :
          takeable.length && !mineAsk && !ho ? '<button class="btn sm ghost take" data-act="take" data-id="' + E(i.id) + '">' + I('swap') + 'Take over</button>' : '';
        return '<div class="item-row off-row' + (taking ? ' in-cart' : '') + '"><div class="pic">' + UI.thumb(i.photo, iconFor(i.category_id)) + '</div>' +
          '<div class="li-main"><div class="li-title">' + E(i.name) + '</div><div class="row wrap" style="gap:6px;margin-top:3px"><span class="tape">' + E(i.code) + '</span><span class="avail ' + state[1] + '">' + E(state[0]) + '</span></div>' + extra + '</div>' + btn + '</div>';
      }
      var ctl = off ? '' : !inCart ? '<button class="add" data-act="add" data-id="' + E(i.id) + '" aria-label="Add ' + E(i.name) + '">' + I('plus') + '</button>' :
        '<div class="stepper"><button data-act="dec" data-id="' + E(i.id) + '" aria-label="One less">' + I(inCart > 1 ? 'minus' : 'x') + '</button><b>' + inCart + '</b>' +
        '<button data-act="add" data-id="' + E(i.id) + '" aria-label="One more"' + (inCart >= i.available ? ' disabled style="opacity:.4"' : '') + '>' + I('plus') + '</button></div>';
      return '<div class="item-row' + (inCart ? ' in-cart' : '') + (off ? ' off' : '') + '"><div class="pic">' + UI.thumb(i.photo, iconFor(i.category_id)) + '</div>' +
        '<div class="li-main"><div class="li-title">' + E(i.name) + '</div><div class="row wrap" style="gap:6px;margin-top:3px"><span class="tape">' + E(i.code) + '</span><span class="avail ' + state[1] + '">' + E(state[0]) + '</span></div>' +
        (h.length && i.qty > 1 ? '<div class="avail muted" style="font-weight:600">' + E(holderText(i)) + '</div>' : '') +
        (i.issue ? '<div class="item-issue">' + I('alert') + E(i.issue) + '</div>' : '') + '</div>' + ctl + '</div>';
    }
    function presetList() {
      if (!presets) return UI.loading();
      var card = function (p) {
        var bad = p.items.filter(function (x) { return !x.ok; }).length;
        return '<div class="preset"><div class="preset-h"><div class="grow" style="min-width:0"><div class="li-title">' + E(p.name) + '</div><div class="li-sub">' + (p.scope === 'team' ? 'Team preset · by ' + E(p.owner_name) : p.items.length + ' item' + (p.items.length > 1 ? 's' : '')) + '</div></div>' +
          (p.mine || (p.scope === 'team' && App.user.role === 'admin') ? '<button class="icon-btn" data-act="pre-del" data-id="' + E(p.id) + '" aria-label="Delete preset">' + I('trash') + '</button>' : '') + '</div>' +
          '<ul class="preset-items">' + p.items.map(function (x) {
            var st = x.state || (x.ok ? 'free' : 'blocked');
            var right = st === 'take' ? E(x.reason) + ' · take over' : st === 'mine' ? 'With you' : st === 'blocked' ? E(x.reason || 'Not available') : 'Free';
            return '<li class="st-' + st + '"><span>' + E(x.name) + (x.qty > 1 ? ' ×' + x.qty : '') + '</span><span>' + right + '</span></li>';
          }).join('') + '</ul>' +
          '<button class="btn sm block ' + (p.ready ? 'primary' : 'danger') + '" data-act="pre-use" data-id="' + E(p.id) + '"' + (p.ready ? '' : ' disabled') + '>' +
          (p.ready ? I('cart') + 'Use this preset' + (p.takes ? ' · ' + p.takes + ' to take over' : '') : bad + ' item' + (bad > 1 ? 's' : '') + ' not available') + '</button></div>';
      };
      return (presets.mine.length ? '<div class="group-h" style="margin-top:0">' + I('star') + 'My presets</div><div class="stack">' + presets.mine.map(card).join('') + '</div>' : '') +
        (presets.team.length ? '<div class="group-h"' + (presets.mine.length ? '' : ' style="margin-top:0"') + '>' + I('users') + 'Team presets</div><div class="stack">' + presets.team.map(card).join('') + '</div>' : '') +
        (!presets.mine.length && !presets.team.length ? '<div class="card">' + UI.empty('star', 'No presets yet', 'Pick your usual gear once, then tap "Save as preset" on the confirm page.') + '</div>' : '') +
        (!presets.mine.length && presets.team.length ? '<p class="small muted" style="margin:12px 2px 0">Tip: save your own set with "Save as preset" on the confirm page.</p>' : '');
    }
    function allPresets() { return presets ? presets.mine.concat(presets.team) : []; }
    App.acts = {
      cat: function (el) { pickCat = el.getAttribute('data-id'); pickQ = ''; draw(); window.scrollTo(0, 0); },
      add: function (el) {
        var id = el.getAttribute('data-id'), it = itemById(id);
        if (!it) return; var n = Cart.get(id);
        if (n >= it.available) return UI.toast('No more ' + it.name + ' available.', true);
        Cart.set(id, n + 1); draw();
      },
      dec: function (el) { var id = el.getAttribute('data-id'); Cart.set(id, Cart.get(id) - 1); draw(); },
      take: function (el) { takeOver(itemById(el.getAttribute('data-id')), draw); },
      untake: function (el) { Cart.untake(el.getAttribute('data-id')); draw(); },
      'pre-use': function (el) {
        var p = allPresets().filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
        if (!p || !p.ready) return;
        p.items.forEach(function (x) {
          var it = itemById(x.item_id);
          if (x.state === 'take') { if (!Cart.taking(x.item_id)) Cart.take(x.take_line, { item_id: x.item_id, item_name: x.name, from_name: x.holder, category_id: x.category_id, qty: x.take_qty || x.qty }); return; }
          if (x.state === 'mine') return;
          var want = Math.min((Cart.get(x.item_id) || 0) + x.qty, it ? it.available : x.qty); Cart.set(x.item_id, Math.max(Cart.get(x.item_id), want));
        });
        UI.toast('"' + p.name + '" added to your cart' + (p.takes ? ' · ' + p.takes + ' to take over' : ''));
        App.go('cart');
      },
      'pre-del': function (el) {
        var p = allPresets().filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
        UI.ask({ title: 'Delete "' + p.name + '"?', message: p.scope === 'team' ? 'Everyone loses this team preset.' : 'Only the preset is deleted. No gear is affected.', ok: 'Delete', danger: true }).then(function (ok) {
          if (ok) App.run(null, 'preset.delete', { id: p.id }).then(function (r) { if (r) { UI.toast('Preset deleted'); loadPresets().then(draw); } });
        });
      }
    };
    return Promise.all([loadCatalog(), loadPresets().catch(function () { presets = { mine: [], team: [] }; })]).then(draw);
  };

  // =================== CART / CHECKOUT ===================
  function steps(n) {
    var L = ['Pick', 'Confirm', 'Photo', 'Done'];
    return '<div class="steps">' + L.map(function (x, i) { return '<div class="' + (i < n ? 'on' : '') + '"></div>'; }).join('') + '</div>' +
      '<div class="steps-l">' + L.map(function (x, i) { return '<span class="' + (i < n ? 'on' : '') + '">' + x + '</span>'; }).join('') + '</div>';
  }
  var draft = { purpose: '', location: '', expected_return: '' };
  var skipSuggest = false;

  // Camera picked without a memory card or battery → suggest them (never blocks checkout).
  var BATTERY_FOR = [[/a7/i, 'Battery A7'], [/a6\d{3}/i, 'Battery A6'], [/gopro/i, 'Battery GoPro'], [/canon/i, 'Battery Canon'], [/panasonic/i, 'Battery AG-VBR59']];
  function isCamera(i) { return i.category_id === 'CAM' || catIcon[i.category_id] === 'camera'; }
  function isMemory(i) { return i.category_id === 'MEM' || catIcon[i.category_id] === 'card'; }
  function isBattery(i) { return /^battery/i.test(i.name); }
  function suggestions(lines, map) {
    var inCart = lines.map(function (l) { return map[l.item_id]; }).filter(Boolean);
    var cams = inCart.filter(isCamera);
    if (!cams.length || skipSuggest) return null;
    var needMem = !inCart.some(isMemory), needBat = !inCart.some(isBattery);
    if (!needMem && !needBat) return null;
    var free = catalog.items.filter(function (i) { return i.available > 0 && !Cart.get(i.id); });
    var out = [];
    if (needMem) out = out.concat(free.filter(isMemory));
    if (needBat) {
      var want = [];
      cams.forEach(function (c) { BATTERY_FOR.forEach(function (r) { if (r[0].test(c.name) && want.indexOf(r[1]) < 0) want.push(r[1]); }); });
      var bats = free.filter(isBattery);
      var matched = bats.filter(function (b) { return want.indexOf(b.name) >= 0; });
      out = out.concat(matched.length ? matched : bats);
    }
    return { needMem: needMem, needBat: needBat, items: out };
  }
  function suggestHtml(sg) {
    if (!sg) return '';
    var what = sg.needMem && sg.needBat ? 'a memory card or battery' : sg.needMem ? 'a memory card' : 'a battery';
    return '<div class="suggest"><div class="row" style="align-items:flex-start"><span class="suggest-ic">' + I('alert') + '</span><div class="grow"><b>Don\'t forget</b><div class="small muted">You picked a camera but no ' + what + '.</div></div>' +
      '<button class="btn sm ghost" data-act="sg-skip">No thanks</button></div>' +
      (sg.items.length ? '<div class="suggest-list">' + sg.items.map(function (i) {
        return '<div class="suggest-item"><div class="thumb sm">' + UI.thumb(i.photo, iconFor(i.category_id)) + '</div><div class="li-main"><div class="sub-name">' + E(i.name) + '</div><div class="sub-meta">' + (i.qty > 1 ? i.available + ' of ' + i.qty + ' free' : 'Available') + '</div></div>' +
          '<button class="add sm" data-act="sg-add" data-id="' + E(i.id) + '" aria-label="Add ' + E(i.name) + '">' + I('plus') + '</button></div>';
      }).join('') + '</div>' : '<div class="small muted" style="margin-top:8px">None are free right now.</div>') + '</div>';
  }
  V.cart = function (main) {
    Cart.load();
    function draw() {
      var map = {}; catalog.items.forEach(function (i) { map[i.id] = i; });
      var lines = Cart.lines().filter(function (l) { return map[l.item_id]; });
      var tk = Cart.takes();
      var takes = Object.keys(tk).map(function (lid) {
        var t = tk[lid], it = map[t.item_id];
        var h = it ? (it.holders || []).filter(function (x) { return x.line_id === lid; })[0] : null;
        var ok = !!(h && h.status === 'OUT' && !h.handover_to && !h.mine);
        return { line_id: lid, item: it, t: t, ok: ok, why: !it ? 'Item removed' : h && h.mine ? 'Already with you' : h && h.handover_to ? 'Someone else asked first' : 'No longer with ' + t.from_name };
      });
      if (!lines.length && !takes.length) {
        main.innerHTML = steps(1) + '<div class="card">' + UI.empty('cart', 'Your cart is empty', 'Add gear from the Gear tab first.') + '</div><div style="margin-top:14px"><button class="btn primary block" data-act="go" data-to="pick">Pick gear</button></div>';
        return;
      }
      var need = App.settings.REQUIRE_PURPOSE;
      var blocked = lines.filter(function (l) { return l.qty > map[l.item_id].available; }).length + takes.filter(function (x) { return !x.ok; }).length;
      main.innerHTML = steps(2) +
        '<div class="page-head"><h1>Confirm gear</h1><button class="btn sm ghost" data-act="go" data-to="pick">' + I('plus') + 'Add more</button></div>' +
        '<div class="list">' + lines.map(function (l) {
          var i = map[l.item_id], bad = l.qty > i.available;
          return '<div class="li' + (bad ? ' bad-row' : '') + '"><div class="thumb">' + UI.thumb(i.photo, iconFor(i.category_id)) + '</div><div class="li-main"><div class="li-title">' + E(i.name) + '</div><div class="li-sub"><span class="tape">' + E(i.code) + '</span>' +
            (bad ? ' <b style="color:var(--bad)">· ' + (i.available ? 'only ' + i.available + ' left' : 'not available') + '</b>' : i.condition !== 'Good' ? ' · ' + E(i.condition) : '') + '</div></div>' +
            (i.qty > 1 ? '<div class="stepper"><button data-act="dec" data-id="' + E(i.id) + '" aria-label="One less">' + I(l.qty > 1 ? 'minus' : 'x') + '</button><b>' + l.qty + '</b><button data-act="inc" data-id="' + E(i.id) + '" aria-label="One more">' + I('plus') + '</button></div>' :
              '<button class="icon-btn" data-act="rm" data-id="' + E(i.id) + '" aria-label="Remove ' + E(i.name) + '">' + I('x') + '</button>') + '</div>';
        }).join('') + takes.map(function (x) {
          var it = x.item || { name: x.t.item_name, category_id: x.t.category_id };
          return '<div class="li take-line' + (x.ok ? '' : ' bad-row') + '"><div class="thumb">' + UI.thumb(it.photo, iconFor(it.category_id)) + '</div><div class="li-main"><div class="li-title">' + E(it.name) + (x.t.qty > 1 ? ' <span class="muted">×' + x.t.qty + '</span>' : '') + '</div>' +
            '<div class="li-sub">' + (x.ok ? 'Take over from <b>' + E(x.t.from_name) + '</b>' : '<b style="color:var(--bad)">' + E(x.why) + '</b>') + '</div>' +
            (x.ok ? '<div class="li-sub">' + UI.pill('Handover pending', 'p-info') + '</div>' : '') + '</div>' +
            '<button class="icon-btn" data-act="untake" data-id="' + E(x.line_id) + '" aria-label="Remove ' + E(it.name) + '">' + I('x') + '</button></div>';
        }).join('') + '</div>' +
        (takes.length ? '<p class="small muted" style="margin:8px 2px 0">' + I('swap').replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"') + ' Take-over items move to your name once the person hands them to you and taps Hand over (or an admin approves). The task and return date below apply to them too.</p>' : '') +
        suggestHtml(suggestions(lines.concat(takes.filter(function (x) { return x.item; }).map(function (x) { return { item_id: x.item.id, qty: 1 }; })), map)) +
        (lines.length ? '<button class="btn ghost block" data-act="save-preset" style="margin-top:10px">' + I('star') + 'Save as preset</button>' : '') +
        '<form class="stack" id="cf" style="margin-top:18px" novalidate>' +
        '<label class="field"><span>Tugasan / task' + (need ? '' : ' (optional)') + '</span><textarea class="input" id="purpose" maxlength="300" placeholder="e.g. Rakaman podcast episod 12" ' + (need ? 'required' : '') + '>' + E(draft.purpose) + '</textarea></label>' +
        '<label class="field"><span>Location (optional)</span><input class="input" id="location" maxlength="200" placeholder="e.g. Studio B, Dewan Utama" value="' + E(draft.location) + '"></label>' +
        '<label class="field"><span>Return by (optional)</span><input class="input" id="ret" type="date" min="' + UI.todayStr() + '" value="' + E(draft.expected_return) + '"></label>' +
        (App.settings.REQUIRE_CHECKOUT_APPROVAL ? '<div class="notice info">' + I('info') + '<div>An admin approves this request before you take the gear.</div></div>' : '') +
        (blocked ? '<div class="notice" style="background:var(--bad-soft)">' + I('alert') + '<div>Remove the item' + (blocked > 1 ? 's' : '') + ' marked in red before you can check out.</div></div>' : '') +
        '<button class="btn primary block" type="submit" id="confirm" style="min-height:54px"' + (blocked ? ' disabled' : '') + '>' + I('check') + 'Let\'s rock n roll</button></form>';
      ['purpose', 'location', 'ret'].forEach(function (id) {
        document.getElementById(id).addEventListener('input', function (e) { draft[id === 'ret' ? 'expected_return' : id] = e.target.value; });
      });
      document.getElementById('cf').addEventListener('submit', function (e) {
        e.preventDefault();
        if (need && !draft.purpose.trim()) { UI.toast('Fill in the task (Tugasan) first.', true); document.getElementById('purpose').focus(); return; }
        var btn = document.getElementById('confirm');
        App.run(btn, 'checkout', { lines: lines, takeovers: takes.map(function (x) { return { line_id: x.line_id }; }), purpose: draft.purpose, location: draft.location, expected_return: draft.expected_return }).then(function (d) {
          if (!d) { loadCatalog().then(draw).catch(function () {}); return; }
          Cart.clear(); draft = { purpose: '', location: '', expected_return: '' }; skipSuggest = false;
          lastDone = d; catalog = null;
          App.go(d.order ? 'photo/' + d.order.id : 'done');
        });
      });
    }
    App.acts = {
      rm: function (el) { Cart.set(el.getAttribute('data-id'), 0); draw(); },
      dec: function (el) { var id = el.getAttribute('data-id'); Cart.set(id, Cart.get(id) - 1); draw(); },
      inc: function (el) { var id = el.getAttribute('data-id'), it = itemById(id); if (Cart.get(id) >= it.available) return UI.toast('No more available.', true); Cart.set(id, Cart.get(id) + 1); draw(); },
      'save-preset': function () { savePresetSheet(Cart.lines()); },
      untake: function (el) { Cart.untake(el.getAttribute('data-id')); draw(); },
      'sg-add': function (el) { var id = el.getAttribute('data-id'); Cart.set(id, Cart.get(id) + 1); UI.toast('Added ' + itemById(id).name); draw(); },
      'sg-skip': function () { skipSuggest = true; draw(); }
    };
    return (catalog ? Promise.resolve() : loadCatalog()).then(draw);
  };

  // Take over = add to cart; task and return date are filled in on Confirm gear.
  function takeOver(it, done) {
    var lines = (it.holders || []).filter(function (x) { return x.status === 'OUT' && !x.mine && !x.handover_to; });
    if (!lines.length) return;
    function add(x) {
      Cart.take(x.line_id, { item_id: it.id, item_name: it.name, from_name: x.name, category_id: it.category_id, qty: x.qty });
      UI.toast(it.name + ' added · take over from ' + x.name);
      done();
    }
    if (lines.length === 1) return add(lines[0]);
    var s = UI.sheet(UI.sheetHead('Take ' + it.name + ' from', 'More than one person has this') +
      '<div class="list">' + lines.map(function (x, k) { return '<button class="li" data-act="pick-holder" data-i="' + k + '"><span class="avatar lg">' + E(UI.initials(x.name)) + '</span><span class="li-main li-title">' + E(x.name) + (x.qty > 1 ? ' · ×' + x.qty : '') + '</span>' + I('right') + '</button>'; }).join('') + '</div>', {
      'pick-holder': function (el) { s.close(); add(lines[+el.getAttribute('data-i')]); }
    });
  }

  function savePresetSheet(lines) {
    var admin = App.user.role === 'admin';
    var s = UI.sheet(UI.sheetHead('Save as preset', lines.length + ' item' + (lines.length > 1 ? 's' : '') + ' from your cart') +
      '<form class="stack" id="spf" novalidate><label class="field"><span>Preset name</span><input class="input" id="sp-n" maxlength="60" autofocus placeholder="e.g. Podcast kit, Event 2 camera"></label>' +
      (admin ? '<div class="card pad toggle"><div><b>Team preset</b><div class="small muted">Everyone sees it in Gear → Presets.</div></div><span class="switch"><input type="checkbox" id="sp-team" aria-label="Team preset"><i></i></span></div>' : '') +
      '<p class="small muted" style="margin:0">Next time, open Gear → Presets and add the whole set in one tap.</p>' +
      '<button class="btn primary block" type="submit" id="sp-save" style="min-height:52px">' + I('star') + 'Save preset</button></form>');
    s.el.querySelector('#spf').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = s.el.querySelector('#sp-n').value.trim();
      if (!name) { UI.toast('Give the preset a name.', true); return; }
      var team = admin && s.el.querySelector('#sp-team').checked;
      App.run(s.el.querySelector('#sp-save'), 'preset.save', { name: name, scope: team ? 'team' : 'personal', items: lines }).then(function (r) {
        if (r) { s.close(); presets = null; UI.toast('Saved "' + r.preset.name + '"' + (team ? ' for everyone' : '')); }
      });
    });
  }

  // =================== PHOTO (optional) ===================
  V.photo = function (main, orderId) {
    var shots = [];
    function draw() {
      var busy = shots.some(function (s) { return s.state === 'up'; });
      main.innerHTML = steps(3) +
        '<div class="stack"><div class="stack-sm"><span class="eyebrow">' + E(orderId) + ' · optional</span><h1>Snap the gear</h1></div>' +
        '<p class="muted" style="margin:0">A quick photo of what you are taking helps if anything is missing or damaged later. Up to 4 photos.</p>' +
        (shots.length ? '<div class="photos">' + shots.map(function (s) { return '<div class="ph' + (s.state === 'up' ? ' busy' : '') + '" style="background-image:url(&quot;' + s.src + '&quot;)">' + (s.state === 'up' ? '<span class="spin" style="position:absolute;inset:0;margin:auto;z-index:1"></span>' : s.state === 'err' ? '<span class="pill p-bad" style="position:absolute;left:6px;bottom:6px">Failed</span>' : '') + '</div>'; }).join('') + '</div>' : '') +
        (shots.length < 4 ? '<div class="row"><button class="btn dark grow" data-act="snap">' + I('camera') + 'Take photo</button><button class="btn ghost grow" data-act="upload">' + I('upload') + 'Upload</button></div>' : '') +
        '<button class="btn primary block" data-act="finish" style="min-height:54px"' + (busy ? ' disabled' : '') + '>' + (shots.length ? 'Finish' : 'Skip and finish') + I('right') + '</button></div>';
    }
    function add(capture) {
      UI.pickPhoto(capture).then(function (src) {
        if (!src) return;
        var s = { src: src, state: 'up' }; shots.push(s); draw();
        API.call('order.photo', { order_id: orderId, photo: src }).then(function () { s.state = 'ok'; draw(); }, function (e) { s.state = 'err'; draw(); App.error(e); });
      });
    }
    App.acts = { snap: function () { add(true); }, upload: function () { add(false); }, finish: function () { App.go('done'); } };
    draw();
  };

  // =================== DONE ===================
  V.done = function (main) {
    var d = lastDone;
    if (!d) { App.go('profile', true); return; }
    var o = d.order, hos = d.handovers || [];
    main.innerHTML = steps(4) +
      '<div class="done"><div class="stamp' + (d.pending ? ' wait' : '') + '">' + I(d.pending ? (o ? 'clock' : 'swap') : 'check') + '</div><h1>' + E(d.title) + '</h1><p class="muted">' + E(d.message) + '</p>' +
      '<div class="ticket">' + (o ? '<div class="row between"><span class="tape">' + E(o.id) + '</span>' + UI.orderPill(o.status) + '</div>' +
      '<div class="stack-sm" style="margin-top:10px">' + o.lines.map(function (l) { return '<div class="row between small"><span>' + E(l.item_name) + '</span><span class="muted tnum">×' + l.qty + '</span></div>'; }).join('') + '</div>' : '') +
      (hos.length ? '<div class="stack-sm" style="margin-top:' + (o ? '10px' : '0') + '">' + hos.map(function (h) { return '<div class="row between small"><span>' + E(h.item_name) + ' <span class="muted">from ' + E(h.from_name) + '</span></span>' + UI.pill('Handover pending', 'p-info') + '</div>'; }).join('') + '</div>' : '') +
      ((o ? o.expected_return : hos[0] && hos[0].expected_return) ? '<div class="small muted" style="margin-top:10px">Return by <b style="color:var(--ink)">' + E(UI.day(o ? o.expected_return : hos[0].expected_return)) + '</b></div>' : '') + '</div>' +
      '<div class="row" style="width:100%"><button class="btn ghost grow" data-act="go" data-to="home">Dashboard</button><button class="btn dark grow" data-act="go" data-to="profile">My gear</button></div></div>';
  };

  // =================== PROFILE (my gear + return) ===================
  var mineTab = 'out';
  V.profile = function (main) {
    var sel = {}, hv = { incoming: [], outgoing: [] };
    function handoverBlock(h) {
      App.setBadge('profile', h.incoming.length);
      if (!h.incoming.length && !h.outgoing.length) return '';
      return '<div class="group-h">' + I('swap') + 'Handovers</div><div class="stack">' +
        h.incoming.map(function (x) {
          return '<div class="handover in"><div class="li-main"><div class="li-title">' + E(x.to_name) + ' wants your ' + E(x.item_name) + (x.qty > 1 ? ' ×' + x.qty : '') + '</div>' +
            '<div class="li-sub">Asked ' + E(UI.when(x.created_at)) + (x.purpose ? ' · ' + E(x.purpose) : '') + '</div>' + (x.note ? '<div class="li-sub">“' + E(x.note) + '”</div>' : '') + '</div>' +
            '<div class="row"><button class="btn sm danger" data-act="ho-no" data-id="' + E(x.id) + '">Decline</button><button class="btn sm ok grow" data-act="ho-yes" data-id="' + E(x.id) + '">' + I('check') + 'Hand over</button></div></div>';
        }).join('') +
        h.outgoing.map(function (x) {
          return '<div class="handover out"><div class="li-main"><div class="li-title">Waiting for ' + E(x.from_name) + ' to hand over ' + E(x.item_name) + '</div><div class="li-sub">Asked ' + E(UI.when(x.created_at)) + '</div></div>' +
            '<button class="btn sm ghost" data-act="ho-cancel" data-id="' + E(x.id) + '">Cancel request</button></div>';
        }).join('') + '</div>';
    }
    function draw(d) {
      var u = App.user;
      var holding = d.open.reduce(function (s, o) { return s + o.lines.filter(function (l) { return ['OUT', 'RETURN_REQUESTED', 'PENDING'].indexOf(l.status) >= 0; }).length; }, 0);
      main.innerHTML =
        '<div class="profile card pad"><span class="avatar xl" style="' + (u.photo ? 'background-image:url(&quot;' + E(u.photo) + '&quot;);color:transparent' : '') + '">' + E(UI.initials(u.name)) + '</span>' +
        '<div class="grow" style="min-width:0"><h2 style="overflow-wrap:anywhere">' + E(u.name) + '</h2><div class="small muted" style="overflow-wrap:anywhere">' + E(u.email) + '</div>' +
        '<div class="row wrap" style="margin-top:6px;gap:6px">' + (u.role === 'admin' ? UI.pill('Admin', 'p-info') : UI.pill('Crew', 'p-mute')) + UI.pill(holding ? holding + ' with me' : 'Nothing with me', holding ? 'p-bad' : 'p-ok') + '</div></div>' +
        '<button class="icon-btn" data-act="profile" aria-label="Account options">' + I('more') + '</button></div>' +
        handoverBlock(hv) +
        '<div class="segment" role="group" style="margin:16px 0 14px"><button data-act="tab" data-id="out" aria-pressed="' + (mineTab === 'out') + '">With me · ' + d.open.length + '</button><button data-act="tab" data-id="past" aria-pressed="' + (mineTab === 'past') + '">History</button></div>' +
        (mineTab === 'out' ? (d.open.length ? '<div class="stack">' + d.open.map(card).join('') + '</div>' : '<div class="card">' + UI.empty('check', 'You have nothing checked out', 'Gear you take shows here so you can return it.') + '</div><div style="margin-top:14px"><button class="btn primary block" data-act="go" data-to="pick">' + I('cart') + 'Pick gear</button></div>')
          : (d.past.length ? '<div class="list">' + d.past.map(function (o) {
            return '<div class="li"><div class="li-main"><div class="li-title">' + E(o.lines.map(function (l) { return l.item_name; }).join(', ')) + '</div><div class="li-sub"><span class="tape">' + E(o.id) + '</span> · ' + E(UI.when(o.created_at)) + (o.purpose ? ' · ' + E(o.purpose) : '') + '</div></div>' + UI.orderPill(o.status) + '</div>';
          }).join('') + '</div>' : '<div class="card">' + UI.empty('clock', 'No history yet', '') + '</div>'));
      App.acts = {
        'ho-yes': function (el) {
          var x = hv.incoming.filter(function (h) { return h.id === el.getAttribute('data-id'); })[0];
          UI.ask({ title: 'Hand ' + x.item_name + ' to ' + x.to_name + '?', message: 'Do this when you give it to them. It moves off your name and onto theirs.', ok: 'Yes, hand over' }).then(function (ok) {
            if (ok) App.run(null, 'handover.respond', { id: x.id, accept: true }).then(function (r) { if (r) { UI.toast('Handed over to ' + x.to_name); catalog = null; App.render(); } });
          });
        },
        'ho-no': function (el) { App.run(el, 'handover.respond', { id: el.getAttribute('data-id'), accept: false }).then(function (r) { if (r) { UI.toast('Declined'); App.render(); } }); },
        'ho-cancel': function (el) { App.run(el, 'handover.cancel', { id: el.getAttribute('data-id') }).then(function (r) { if (r) { UI.toast('Request cancelled'); App.render(); } }); },
        tab: function (el) { mineTab = el.getAttribute('data-id'); draw(d); },
        all: function (el) { var o = byId(d, el.getAttribute('data-id')); var outs = o.lines.filter(function (l) { return l.status === 'OUT'; }); var every = outs.every(function (l) { return sel[l.id]; }); outs.forEach(function (l) { sel[l.id] = !every; }); draw(d); },
        ret: function (el) { openReturn(byId(d, el.getAttribute('data-id'))); },
        cancel: function (el) {
          UI.ask({ title: 'Cancel this request?', message: 'The gear goes back to available.', ok: 'Cancel request', danger: true }).then(function (ok) {
            if (ok) App.run(el, 'my.cancel', { order_id: el.getAttribute('data-id') }).then(function (r) { if (r) { UI.toast('Request cancelled'); App.render(); } });
          });
        }
      };
      main.querySelectorAll('input[data-sel]').forEach(function (c) { c.addEventListener('change', function () { sel[c.getAttribute('data-sel')] = c.checked; refreshButtons(d); }); });
      refreshButtons(d);
    }
    function byId(d, id) { return d.open.filter(function (o) { return o.id === id; })[0]; }
    function card(o) {
      var outs = o.lines.filter(function (l) { return l.status === 'OUT'; });
      return '<div class="order"><div class="order-h"><div class="grow stack-sm"><div class="row wrap"><span class="tape">' + E(o.id) + '</span>' + UI.orderPill(o.status, o.overdue) + '</div>' +
        '<div class="small muted">' + E(UI.when(o.created_at)) + (o.purpose ? ' · ' + E(o.purpose) : '') + '</div>' +
        (o.expected_return ? '<div class="small">Return by <b style="color:' + (o.overdue ? 'var(--bad)' : 'var(--ink)') + '">' + E(UI.day(o.expected_return)) + '</b></div>' : '') + '</div></div>' +
        '<div class="order-b">' + o.lines.filter(function (l) { return l.status !== 'CANCELLED'; }).map(function (l) {
          var can = l.status === 'OUT';
          return '<div class="line">' + (can ? '<label><input type="checkbox" class="check" data-sel="' + E(l.id) + '"' + (sel[l.id] ? ' checked' : '') + '>' : '<label style="cursor:default"><span style="width:24px;flex:none"></span>') +
            '<span class="grow"><span class="li-title" style="display:block">' + E(l.item_name) + (l.qty > 1 ? ' <span class="muted">×' + l.qty + '</span>' : '') + '</span>' +
            (l.return_remark && l.status === 'OUT' ? '<span class="small" style="color:var(--warn);display:block">' + E(l.return_remark) + '</span>' : '') +
            (l.status === 'RETURN_REQUESTED' ? '<span class="small muted" style="display:block">Sent ' + E(UI.when(l.return_requested_at)) + ' · waiting for admin</span>' : '') +
            '</span></label>' + (can ? '' : UI.linePill(l.status, false, l.return_remark)) + '</div>';
        }).join('') + '</div>' +
        (outs.length ? '<div class="order-f"><button class="btn sm ghost" data-act="all" data-id="' + E(o.id) + '">Select all</button><button class="btn sm primary grow" data-act="ret" data-id="' + E(o.id) + '" data-ret="' + E(o.id) + '">Return</button></div>' : '') +
        (o.status === 'PENDING' ? '<div class="order-f"><button class="btn sm danger grow" data-act="cancel" data-id="' + E(o.id) + '">Cancel request</button></div>' : '') +
        '</div>';
    }
    function refreshButtons(d) {
      d.open.forEach(function (o) {
        var b = main.querySelector('[data-ret="' + o.id + '"]'); if (!b) return;
        var n = o.lines.filter(function (l) { return l.status === 'OUT' && sel[l.id]; }).length;
        b.disabled = !n; b.textContent = n ? 'Return ' + n + ' item' + (n > 1 ? 's' : '') : 'Tick items to return';
      });
    }
    function openReturn(o) {
      var lines = o.lines.filter(function (l) { return l.status === 'OUT' && sel[l.id]; });
      var photo = null;
      var s = UI.sheet(UI.sheetHead('Return gear', o.id) +
        '<div class="list" style="margin-bottom:14px">' + lines.map(function (l) { return '<div class="li"><div class="thumb">' + I(iconFor(l.category_id)) + '</div><div class="li-main li-title">' + E(l.item_name) + (l.qty > 1 ? ' ×' + l.qty : '') + '</div></div>'; }).join('') + '</div>' +
        '<div class="stack"><label class="field"><span>Note for admin (optional)</span><textarea class="input" id="rnote" maxlength="500" placeholder="e.g. Battery is flat, lens cap inside the bag"></textarea></label>' +
        '<div class="field"><span>Photo (optional)</span><div id="rph"></div><div class="row"><button class="btn dark grow sm" data-act="rsnap">' + I('camera') + 'Take photo</button><button class="btn ghost grow sm" data-act="rup">' + I('upload') + 'Upload</button></div></div>' +
        '<div class="notice">' + I('info') + '<div>Bring the gear back to the store. It stays on the dashboard until an admin checks it and approves.</div></div>' +
        '<button class="btn primary block" data-act="rsend" style="min-height:52px">Send return request</button></div>', {
        rsnap: function () { take(true); }, rup: function () { take(false); },
        rsend: function (el) {
          App.run(el, 'my.return', { order_id: o.id, line_ids: lines.map(function (l) { return l.id; }), note: s.el.querySelector('#rnote').value, photo: photo }).then(function (r) {
            if (!r) return; s.close(); sel = {};
            UI.sheet('<div class="done"><div class="stamp wait">' + I('clock') + '</div><h2>Return sent</h2><p class="muted">' + E(r.message) + '</p><button class="btn dark block" data-act="close-sheet">OK</button></div>', {}, { onClose: function () { App.render(); } });
          });
        }
      });
      function take(cap) { UI.pickPhoto(cap).then(function (src) { if (!src) return; photo = src; s.el.querySelector('#rph').innerHTML = '<div class="photos" style="margin-bottom:8px"><div class="ph" style="background-image:url(&quot;' + src + '&quot;)"></div></div>'; }); }
    }
    return Promise.all([API.call('my.orders'), API.call('my.handovers').catch(function () { return hv; }), catalog ? null : loadCatalog().catch(function () {})]).then(function (r) { hv = r[1]; draw(r[0]); });
  };
  V.mine = V.profile; // old links
})();
