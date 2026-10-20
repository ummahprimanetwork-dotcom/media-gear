/* Admin app: Overview, Approvals, Orders, Items, Users, Categories, Settings, Activity. */
(function () {
  var E = UI.esc, I = UI.icon, V = App.views;
  var cats = [], catIcon = {}, catName = {};
  function setCats(list) { cats = list; list.forEach(function (c) { catIcon[c.id] = c.icon; catName[c.id] = c.name; }); }
  function ic(catId) { return catIcon[catId] || 'box'; }
  function itemsCache() { return API.call('admin.items').then(function (d) { setCats(d.categories); return d; }); }
  function refreshBadge() { API.call('admin.overview').then(function (d) { var n = d.stats.pending_returns + d.stats.pending_checkouts + d.stats.pending_users + (d.stats.pending_handovers || 0); App.setBadge('a-approvals', n); }).catch(function () {}); }
  function head(title, eyebrow, right) { return '<div class="page-head"><div class="stack-sm">' + (eyebrow ? '<span class="eyebrow">' + eyebrow + '</span>' : '') + '<h1>' + E(title) + '</h1></div>' + (right || '') + '</div>'; }
  function backHead(title, sub, to) {
    return '<div class="row" style="margin-bottom:14px"><button class="icon-btn" data-act="go" data-to="' + to + '" aria-label="Back">' + I('left') + '</button><div class="grow" style="min-width:0"><h2 style="overflow-wrap:anywhere">' + E(title) + '</h2>' + (sub ? '<div class="small muted">' + sub + '</div>' : '') + '</div></div>';
  }

  // =================== OVERVIEW ===================
  V['a-home'] = function (main) {
    function draw(d) {
      var s = d.stats;
      App.setBadge('a-approvals', s.pending_returns + s.pending_checkouts + s.pending_users + (s.pending_handovers || 0));
      var tile = function (n, label, to, cls) { return '<button class="stat ' + (n ? cls : '') + '" data-act="go" data-to="' + to + '"><b>' + n + '</b><span>' + label + '</span></button>'; };
      main.innerHTML = head('Overview', E(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))) +
        '<div class="stats six">' +
        tile(s.in_use, 'In use', 'a-orders', 'red') + tile(s.pending_returns, 'Returns to check', 'a-approvals', 'warn') + tile(s.overdue, 'Overdue orders', 'a-orders/overdue', 'red') +
        tile(s.pending_checkouts, 'Checkouts to approve', 'a-approvals/checkouts', 'warn') + tile(s.pending_users, 'New users', 'a-approvals/users', 'warn') + tile(s.attention, 'Needs attention', 'a-items/attention', 'warn') +
        '</div>' +
        '<div class="group-h">' + I('users') + 'Who has what<span class="n">' + d.holders.length + ' people</span></div>' +
        (d.holders.length ? '<div class="stack">' + d.holders.map(function (h) {
          return '<div class="order"><div class="order-h"><div class="avatar" style="background:var(--surface-2);color:var(--ink);border:0">' + E(UI.initials(h.name)) + '</div><div class="grow"><div class="li-title">' + E(h.name) + '</div><div class="li-sub">' + E(h.email) + ' · ' + h.lines.length + ' item' + (h.lines.length > 1 ? 's' : '') + '</div></div>' + (h.overdue ? UI.pill('Overdue', 'p-bad') : '') + '</div>' +
            '<div class="order-b">' + h.lines.map(function (l) {
              return '<button class="li" data-act="go" data-to="a-order/' + E(l.order_id) + '"><div class="li-main"><div class="li-title">' + E(l.item_name) + (l.qty > 1 ? ' <span class="muted">×' + l.qty + '</span>' : '') + '</div><div class="li-sub">' + E(UI.when(l.since)) + (l.expected_return ? ' · back ' + E(UI.day(l.expected_return)) : '') + '</div></div>' + UI.linePill(l.status, l.overdue) + '</button>';
            }).join('') + '</div></div>';
        }).join('') + '</div>' : '<div class="card">' + UI.empty('check', 'All gear is in the store', '') + '</div>') +
        (d.attention.length ? '<div class="group-h">' + I('alert') + 'Needs attention<span class="n">' + d.attention.length + '</span></div><div class="list">' + d.attention.map(function (i) {
          return '<button class="li" data-act="go" data-to="a-item/' + E(i.id) + '"><div class="thumb">' + I(ic(i.category_id)) + '</div><div class="li-main"><div class="li-title">' + E(i.name) + '</div><div class="li-sub"><span class="tape">' + E(i.code) + '</span>' + (i.issue ? ' · ' + E(i.issue) : '') + '</div></div>' + UI.condPill(i.condition) + '</button>';
        }).join('') + '</div>' : '') +
        '<div class="group-h">' + I('clock') + 'Recent activity</div><div class="list">' + (d.activity.filter(function (a) { return a.action !== 'auth.login'; }).length ? d.activity.filter(function (a) { return a.action !== 'auth.login'; }).slice(0, 8).map(actRow).join('') : '<div class="li muted">No activity yet.</div>') + '</div>' +
        '<div style="margin-top:12px"><button class="btn ghost block" data-act="go" data-to="a-log">Full activity log</button></div>';
    }
    App.every(30000, function () { API.call('admin.overview').then(function (d) { if (App.route === 'a-home') draw(d); }).catch(function () {}); });
    return Promise.all([API.call('admin.overview'), itemsCache().then(function (d) { setCodes(d.items); return d; }), API.call('admin.users').then(function (u) { setWho(u.users); }, function () {})]).then(function (r) { draw(r[0]); });
  };
  // ---------- activity in plain words ----------
  var who = {}, codeName = {}; // email → name (Users list), item code → name (Items list)
  function setCodes(items) { (items || []).forEach(function (i) { codeName[i.code] = i.name; }); }
  function setWho(users) { (users || []).forEach(function (u) { who[String(u.email).toLowerCase()] = u.name; }); }
  function nameOf(email) { var e = String(email || '').toLowerCase(); return who[e] || (e ? e.split('@')[0] : 'System'); }
  function first(n) { return String(n).split(' ')[0]; }
  function after(d) { var i = d.indexOf(': '); return i >= 0 ? d.slice(i + 2) : ''; }          // "ORD-1: A, B" → "A, B"
  function orderNo(d) { var m = /^(ORD-[\w-]+)/.exec(d); return m ? m[1] : ''; }
  var KIND = { out: 'Gear out & in', hand: 'Handovers', item: 'Items', people: 'People & settings' };
  /** Turns one Log row into { icon, tone, kind, title, text, order }. */
  function friendly(a) {
    var d = String(a.detail || ''), n = nameOf(a.email), f = first(n), r;
    switch (a.action) {
      case 'order.checkout': r = ['out', 'red', 'out', f + ' took out gear', after(d)]; break;
      case 'order.return_request': r = ['clock', 'warn', 'out', f + ' is returning gear', after(d).replace(' | note: ', ' · note: “') + (/ \| note: /.test(d) ? '”' : '')]; break;
      case 'order.return_approve':
        var parts = after(d).split('; still with ');
        r = ['check', 'ok', 'out', 'Gear returned', (parts[0] === 'nothing returned' ? 'Nothing came back' : parts[0].replace(/ \(Good\)/g, '')) + (parts[1] ? ' · still with ' + parts[1] : '') + ' · checked by ' + f]; break;
      case 'order.return_reject': r = ['x', 'bad', 'out', 'Return not accepted', after(d) + ' · by ' + f]; break;
      case 'order.user_cancel': r = ['x', 'mute', 'out', f + ' cancelled a booking', '']; break;
      case 'order.cancel': r = ['x', 'bad', 'out', 'Order cancelled by ' + f, after(d)]; break;
      case 'order.approve_out': r = ['check', 'ok', 'out', 'Checkout approved by ' + f, '']; break;
      case 'order.reject_out': r = ['x', 'bad', 'out', 'Checkout rejected by ' + f, after(d)]; break;
      case 'order.edit': r = ['edit', 'mute', 'out', 'Order changed by ' + f, after(d)]; break;
      case 'handover.request': r = ['swap', 'info', 'hand', f + ' asked to take over gear', d.replace(': ', ' · ')]; break;
      case 'handover.done': r = ['swap', 'ok', 'hand', 'Gear handed over', d.replace(/ \(ORD-[\w-]+\)$/, '').replace(': ', ' · ')]; break;
      case 'handover.decline': r = ['x', 'mute', 'hand', 'Handover declined', d.replace(': ', ' · ')]; break;
      case 'handover.cancel': r = ['x', 'mute', 'hand', 'Handover cancelled', d]; break;
      case 'item.create': r = ['plus', 'ok', 'item', 'New item added', d.replace(/^\S+ /, '')]; break;
      case 'item.edit': r = ['edit', 'mute', 'item', 'Item details changed · ' + (codeName[d.split(':')[0]] || d.split(':')[0]), after(d)]; break;
      case 'item.log':
        var m = /^(\S+) (\w+): ([\s\S]*)$/.exec(d) || [0, '', 'note', d];
        var L = { damage: ['alert', 'bad', 'Damage reported'], repair: ['wrench', 'ok', 'Repaired'], service: ['wrench', 'info', 'Serviced'], note: ['note', 'mute', 'Note added'] }[m[2]] || ['note', 'mute', 'Item note'];
        r = [L[0], L[1], 'item', L[2] + (m[1] ? ' · ' + (codeName[m[1]] || m[1]) : ''), m[3].replace(/\s*\[Condition: [^\]]*?→ ([^\]]+)\]/, ' · now $1')]; break;
      case 'item.archive': r = ['trash', 'mute', 'item', 'Item removed from the list', d]; break;
      case 'item.restore': r = ['box', 'ok', 'item', 'Item put back on the list', d]; break;
      case 'item.move': r = ['folder', 'info', 'item', d.split(': ')[0].replace('→', 'moved to'), after(d)]; break;
      case 'preset.save': r = ['star', 'info', 'item', 'Preset saved', d.replace(/^team: /, 'Team · ')]; break;
      case 'preset.delete': r = ['trash', 'mute', 'item', 'Preset deleted', d]; break;
      case 'category.create': r = ['folder', 'ok', 'item', 'New category', d.replace(/^\S+ /, '')]; break;
      case 'category.edit': r = ['folder', 'mute', 'item', 'Category renamed', d.replace(/^\S+ → /, '')]; break;
      case 'category.archive': r = ['trash', 'mute', 'item', 'Category removed', d]; break;
      case 'category.icon': r = ['image', 'info', 'item', 'Category icon changed', d.replace(/^\S+ /, '')]; break;
      case 'category.restore': r = ['folder', 'ok', 'item', 'Category restored', d]; break;
      case 'user.register': r = ['user', 'warn', 'people', n + ' signed in for the first time', /pending/.test(d) ? 'Waiting for approval' : 'Let in automatically']; break;
      case 'user.add': r = ['users', 'ok', 'people', 'Person added by ' + f, d.replace(' as ', ' · ')]; break;
      case 'user.edit': r = ['users', 'mute', 'people', 'Person updated by ' + f, d.replace(/^(\S+): (\w+), (\w+)$/, function (x, e, role, st) { return nameOf(e) + ' · ' + role + ' · ' + st; })]; break;
      case 'settings.save': r = ['sliders', 'mute', 'people', 'Settings changed by ' + f, d]; break;
      case 'auth.login': r = ['user', 'mute', 'login', f + ' opened the ' + (/admin/.test(d) ? 'admin side' : 'app'), '']; break;
      default: r = ['note', 'mute', 'people', d || a.action, ''];
    }
    return { icon: r[0], tone: r[1], kind: r[2], title: r[3], text: r[4], order: orderNo(d), when: a.date, who: n };
  }
  function actRow(a) {
    var x = friendly(a);
    return '<div class="li act"><div class="act-ic t-' + x.tone + '">' + I(x.icon) + '</div><div class="li-main"><div class="li-title">' + E(x.title) + '</div>' +
      (x.text ? '<div class="act-text">' + E(x.text) + '</div>' : '') +
      '<div class="li-sub">' + E(UI.when(x.when)) + (x.order ? ' · <span class="tape">' + E(x.order) + '</span>' : '') + '</div></div></div>';
  }

  // =================== APPROVALS ===================
  V['a-approvals'] = function (main, tab) {
    tab = tab || 'returns';
    function draw(d) {
      App.setBadge('a-approvals', d.returns.length + d.checkouts.length + d.users.length + d.handovers.length);
      var t = function (id, label, n) { return '<button data-act="tab" data-id="' + id + '" aria-pressed="' + (tab === id) + '">' + label + (n ? ' · ' + n : '') + '</button>'; };
      var body = '';
      if (tab === 'returns') body = d.returns.length ? '<div class="stack">' + d.returns.map(returnCard).join('') + '</div>' : '<div class="card">' + UI.empty('check', 'No returns to check', 'Return requests from users show up here.') + '</div>';
      if (tab === 'checkouts') body = d.checkouts.length ? '<div class="stack">' + d.checkouts.map(checkoutCard).join('') + '</div>' : '<div class="card">' + UI.empty('check', 'No checkouts waiting', App.settings.REQUIRE_CHECKOUT_APPROVAL ? '' : 'Checkout approval is off in Settings, so checkouts are instant.') + '</div>';
      if (tab === 'handovers') body = d.handovers.length ? '<div class="stack">' + d.handovers.map(function (h) {
        return '<div class="order"><div class="order-h"><div class="grow stack-sm"><b>' + E(h.item_name) + (h.qty > 1 ? ' ×' + h.qty : '') + '</b><div class="small">' + E(h.from_name) + ' → <b>' + E(h.to_name) + '</b></div>' +
          '<div class="small muted">Asked ' + E(UI.when(h.created_at)) + (h.purpose ? ' · ' + E(h.purpose) : '') + (h.expected_return ? ' · back ' + E(UI.day(h.expected_return)) : '') + '</div>' + (h.note ? '<div class="small">“' + E(h.note) + '”</div>' : '') + '</div></div>' +
          '<div class="order-f"><button class="btn sm danger" data-act="h-no" data-id="' + E(h.id) + '">Decline</button><button class="btn sm ok grow" data-act="h-ok" data-id="' + E(h.id) + '">' + I('check') + 'Approve handover</button></div></div>';
      }).join('') + '</div>' : '<div class="card">' + UI.empty('swap', 'No handovers waiting', 'When someone asks to take gear from another person, it shows here. The holder can also confirm it on their own phone.') + '</div>';
      if (tab === 'users') body = d.users.length ? '<div class="list">' + d.users.map(function (u) {
        return '<div class="li" style="flex-wrap:wrap"><div class="avatar" style="background:var(--surface-2);color:var(--ink);border:0">' + E(UI.initials(u.name)) + '</div><div class="li-main"><div class="li-title">' + E(u.name) + '</div><div class="li-sub">' + E(u.email) + ' · signed in ' + E(UI.when(u.created_at)) + '</div></div>' +
          '<div class="row" style="width:100%"><button class="btn sm danger grow" data-act="u-no" data-id="' + E(u.email) + '">Decline</button><button class="btn sm ok grow" data-act="u-ok" data-id="' + E(u.email) + '">' + I('check') + 'Approve</button></div></div>';
      }).join('') + '</div>' : '<div class="card">' + UI.empty('users', 'No one is waiting', 'People who sign in for the first time appear here.') + '</div>';
      main.innerHTML = head('Approvals') + '<div class="segment" style="margin-bottom:14px">' + t('returns', 'Returns', d.returns.length) + t('handovers', 'Handovers', d.handovers.length) + t('checkouts', 'Checkouts', d.checkouts.length) + t('users', 'Users', d.users.length) + '</div>' + body;
      App.acts = {
        tab: function (el) { tab = el.getAttribute('data-id'); draw(d); },
        'r-ok': function (el) {
          var o = find(d.returns, el.getAttribute('data-id'));
          var req = o.lines.filter(function (l) { return l.status === 'RETURN_REQUESTED'; });
          var back = req.filter(function (l) { return isBack(main, l.id); });
          var kept = req.filter(function (l) { return !isBack(main, l.id); }).map(function (l) {
            var n = main.querySelector('[data-keep-note="' + l.id + '"]'); return { line_id: l.id, note: n ? n.value.trim() : '' };
          });
          var lines = readCond(main, back, function (l) { return 'r' + l.id; });
          if (!lines) return;
          App.run(el, 'admin.return.approve', { order_id: o.id, lines: lines, not_returned: kept }).then(function (r) {
            if (!r) return;
            UI.toast(r.kept ? (r.returned ? r.returned + ' returned · ' : '') + r.kept + ' still with ' + o.name : 'Return approved. Dashboard updated.');
            reload();
          });
        },
        'r-no': function (el) {
          var id = el.getAttribute('data-id');
          UI.ask({ title: 'Reject this return?', message: 'The items go back to "Out" and the user sees your reason.', input: 'Reason', placeholder: 'e.g. Charger missing, please bring it', ok: 'Reject return', danger: true, required: true }).then(function (why) {
            if (why) App.run(null, 'admin.return.reject', { order_id: id, reason: why }).then(function (r) { if (r) { UI.toast('Return rejected'); reload(); } });
          });
        },
        'c-ok': function (el) { App.run(el, 'admin.order.approve_out', { order_id: el.getAttribute('data-id') }).then(function (r) { if (r) { UI.toast('Checkout approved'); reload(); } }); },
        'c-no': function (el) {
          var id = el.getAttribute('data-id');
          UI.ask({ title: 'Reject this checkout?', input: 'Reason (optional)', ok: 'Reject', danger: true }).then(function (why) {
            if (why !== null) App.run(null, 'admin.order.reject_out', { order_id: id, reason: why }).then(function (r) { if (r) { UI.toast('Checkout rejected'); reload(); } });
          });
        },
        'h-ok': function (el) { App.run(el, 'handover.respond', { id: el.getAttribute('data-id'), accept: true }).then(function (r) { if (r) { UI.toast('Handover approved'); reload(); } }); },
        'h-no': function (el) { App.run(el, 'handover.respond', { id: el.getAttribute('data-id'), accept: false }).then(function (r) { if (r) { UI.toast('Declined'); reload(); } }); },
        'u-ok': function (el) { App.run(el, 'admin.user.save', { email: el.getAttribute('data-id'), role: 'user', status: 'active' }).then(function (r) { if (r) { UI.toast(r.user.name + ' can now use the app'); reload(); } }); },
        'u-no': function (el) { App.run(el, 'admin.user.save', { email: el.getAttribute('data-id'), role: 'user', status: 'disabled' }).then(function (r) { if (r) { UI.toast('Declined'); reload(); } }); }
      };
      wireCond(main);
      wireReturn(main, d.returns);
    }
    function reload() { API.call('admin.approvals').then(draw, App.error); }
    return API.call('admin.approvals').then(draw);
  };
  function isBack(root, lineId) { var c = root.querySelector('[data-back="' + lineId + '"]'); return !c || c.checked; }
  /* Returned on/off per item: off = the user still has it, no condition needed. */
  function wireReturn(root, orders) {
    root.querySelectorAll('[data-back]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var box = cb.closest('.rline');
        box.querySelector('.rl-yes').hidden = !cb.checked;
        box.querySelector('.rl-no').hidden = cb.checked;
        box.classList.toggle('kept', !cb.checked);
        var card = cb.closest('.order'), o = find(orders, card.getAttribute('data-order'));
        var all = card.querySelectorAll('[data-back]'), on = card.querySelectorAll('[data-back]:checked').length, off = all.length - on;
        var btn = card.querySelector('[data-act="r-ok"] span');
        btn.textContent = !off ? 'Approve return' : !on ? 'Confirm: still with ' + o.name.split(' ')[0] : 'Confirm ' + on + ' returned · ' + off + ' kept';
      });
    });
  }
  function find(list, id) { return list.filter(function (o) { return o.id === id; })[0]; }
  var RETURN_CONDS = [['Good', 'All OK'], ['Fair', 'Worn, works fine'], ['Incomplete', 'Part missing'], ['Damaged', 'Broken / faulty'], ['Lost', 'Not returned']];
  var QUICK_NOTES = {
    Fair: ['Scratches', 'Dirty, needs cleaning', 'Battery weak'],
    Incomplete: ['Missing: ', 'Cable missing', 'Charger missing', 'Cap / cover missing'],
    Damaged: ['Not powering on', 'Cracked', 'No sound / no signal', 'Button broken'],
    Lost: ['User says left at venue', 'Will replace']
  };
  /* Condition picker + note for one returned line. key = unique id for this line in this form. */
  function condBlock(key) {
    return '<div class="cond" data-cond="' + E(key) + '">' +
      '<div class="cond-grid" role="radiogroup" aria-label="Condition">' + RETURN_CONDS.map(function (c) {
        return '<label><input type="radio" name="cd-' + E(key) + '" value="' + c[0] + '"' + (c[0] === 'Good' ? ' checked' : '') + '><span><b>' + c[0] + '</b><small>' + c[1] + '</small></span></label>';
      }).join('') + '</div>' +
      '<label class="field cond-note"><span class="cond-label">Note (optional)</span><textarea class="input" rows="2" maxlength="500" data-note="' + E(key) + '" placeholder="Anything to note? Saved to the item history."></textarea></label>' +
      '<div class="chips cond-chips" hidden></div></div>';
  }
  function wireCond(root) {
    root.querySelectorAll('.cond').forEach(function (box) {
      var ta = box.querySelector('textarea'), lab = box.querySelector('.cond-label'), chips = box.querySelector('.cond-chips');
      function sync() {
        var v = (box.querySelector('input[type=radio]:checked') || {}).value || 'Good';
        var need = v !== 'Good';
        box.classList.toggle('needs', need);
        lab.textContent = need ? 'Note (required) · what exactly?' : 'Note (optional)';
        ta.placeholder = v === 'Incomplete' ? 'e.g. 1 transmitter (TX2) missing, 1 of 2 returned' : v === 'Damaged' ? 'e.g. Screen cracked at the corner, still records' : v === 'Lost' ? 'e.g. Left at Dewan Utama, user is checking' : v === 'Fair' ? 'e.g. Light scratches on the body' : 'Anything to note? Saved to the item history.';
        var q = QUICK_NOTES[v] || [];
        chips.hidden = !q.length;
        chips.innerHTML = q.map(function (t) { return '<button type="button" class="chip sm" data-q="' + E(t) + '">' + E(t) + '</button>'; }).join('');
      }
      box.querySelectorAll('input[type=radio]').forEach(function (r) { r.addEventListener('change', sync); });
      chips.addEventListener('click', function (e) {
        var b = e.target.closest('[data-q]'); if (!b) return;
        var t = b.getAttribute('data-q');
        ta.value = ta.value.trim() ? ta.value.trim() + (/[:]$/.test(ta.value.trim()) ? ' ' : ', ') + t : t;
        ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      });
      sync();
    });
  }
  /* Read the blocks; returns null (and shows why) if a non-Good line has no note. */
  function readCond(root, lines, keyOf) {
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i], key = keyOf(l), box = root.querySelector('[data-cond="' + key + '"]');
      var cond = (box.querySelector('input[type=radio]:checked') || {}).value || 'Good';
      var ta = box.querySelector('textarea'), note = ta.value.trim();
      if (cond !== 'Good' && (!note || /:$/.test(note))) { UI.toast('Write what is wrong with ' + l.item_name + ' (' + cond + ').', true); ta.focus(); box.scrollIntoView({ block: 'center', behavior: 'smooth' }); return null; }
      out.push({ line_id: l.id, condition: cond, remark: note });
    }
    return out;
  }
  function returnCard(o) {
    var req = o.lines.filter(function (l) { return l.status === 'RETURN_REQUESTED'; });
    var photos = []; req.forEach(function (l) { if (l.return_photo && photos.indexOf(l.return_photo) < 0) photos.push(l.return_photo); });
    var note = req.map(function (l) { return l.return_note; }).filter(Boolean)[0];
    var still = o.lines.filter(function (l) { return l.status === 'OUT'; }).length;
    var first = E(o.name.split(' ')[0]);
    return '<div class="order" data-order="' + E(o.id) + '"><div class="order-h"><div class="grow stack-sm"><div class="row wrap"><b>' + E(o.name) + '</b><span class="tape">' + E(o.id) + '</span></div>' +
      '<div class="small muted">Requested ' + E(UI.when(req[0].return_requested_at)) + ' · taken ' + E(UI.when(o.created_at)) + (o.purpose ? ' · ' + E(o.purpose) : '') + '</div></div>' +
      '<button class="icon-btn" data-act="go" data-to="a-order/' + E(o.id) + '" aria-label="Open order">' + I('right') + '</button></div>' +
      (note ? '<div style="padding:10px 14px 0"><div class="notice info">' + I('note') + '<div><b>User note:</b> ' + E(note) + '</div></div></div>' : '') +
      (photos.length ? '<div style="padding:10px 14px 0">' + UI.photos(photos) + '</div>' : '') +
      (req.length > 1 ? '<div class="small muted" style="padding:10px 14px 0">Untick anything that did not actually come back. It stays with ' + first + '.</div>' : '') +
      '<div class="order-b">' + req.map(function (l) {
        return '<div style="padding:12px 14px" class="stack-sm rline"><div class="row between"><b class="grow">' + E(l.item_name) + (l.qty > 1 ? ' ×' + l.qty : '') + '</b>' +
          '<label class="rtoggle"><span>Returned</span><span class="switch"><input type="checkbox" checked data-back="' + E(l.id) + '" aria-label="' + E(l.item_name) + ' returned"><i></i></span></label></div>' +
          '<div class="rl-yes">' + condBlock('r' + l.id) + '</div>' +
          '<div class="rl-no stack-sm" hidden><div class="notice warn">' + I('user') + '<div><b>Not returned.</b> Stays with ' + E(o.name) + ' and shows as Out again.</div></div>' +
          '<input class="input" data-keep-note="' + E(l.id) + '" maxlength="300" placeholder="Note for ' + first + ' (optional), e.g. still at the venue"></div></div>';
      }).join('') + '</div>' +
      (still ? '<div class="small muted" style="padding:0 14px 10px">' + still + ' more item' + (still > 1 ? 's' : '') + ' from this order still out.</div>' : '') +
      '<div class="order-f"><button class="btn sm danger" data-act="r-no" data-id="' + E(o.id) + '">Reject all</button><button class="btn sm ok grow" data-act="r-ok" data-id="' + E(o.id) + '">' + I('check') + '<span>Approve return</span></button></div></div>';
  }
  function checkoutCard(o) {
    return '<div class="order"><div class="order-h"><div class="grow stack-sm"><div class="row wrap"><b>' + E(o.name) + '</b><span class="tape">' + E(o.id) + '</span></div><div class="small muted">' + E(UI.when(o.created_at)) + (o.purpose ? ' · ' + E(o.purpose) : '') + (o.expected_return ? ' · back ' + E(UI.day(o.expected_return)) : '') + '</div></div></div>' +
      '<div class="order-b">' + o.lines.filter(function (l) { return l.status === 'PENDING'; }).map(function (l) { return '<div class="li"><div class="li-main li-title">' + E(l.item_name) + (l.qty > 1 ? ' ×' + l.qty : '') + '</div></div>'; }).join('') + '</div>' +
      '<div class="order-f"><button class="btn sm danger" data-act="c-no" data-id="' + E(o.id) + '">Reject</button><button class="btn sm ok grow" data-act="c-ok" data-id="' + E(o.id) + '">' + I('check') + 'Approve checkout</button></div></div>';
  }

  // =================== ORDERS ===================
  var oFilter = 'open', oQ = '';
  V['a-orders'] = function (main, f) {
    if (f) oFilter = f;
    function load() { return API.call('admin.orders', { filter: oFilter === 'overdue' ? 'overdue' : oFilter, q: oQ }); }
    function draw(d) {
      var t = function (id, l) { return '<button data-act="f" data-id="' + id + '" aria-pressed="' + (oFilter === id) + '">' + l + '</button>'; };
      main.innerHTML = head('Orders', d.total + ' shown') +
        '<div class="stack" style="margin-bottom:14px"><div class="segment">' + t('open', 'Open') + t('overdue', 'Overdue') + t('closed', 'Closed') + t('all', 'All') + '</div>' +
        '<label class="search">' + I('search') + '<input class="input" id="oq" type="search" placeholder="Name, order no., item, task" value="' + E(oQ) + '" aria-label="Search orders"></label></div>' +
        (d.orders.length ? '<div class="list">' + d.orders.map(function (o) {
          var live = o.lines.filter(function (l) { return l.status !== 'CANCELLED'; });
          return '<button class="li" data-act="go" data-to="a-order/' + E(o.id) + '"><div class="li-main"><div class="row wrap" style="gap:6px"><span class="li-title">' + E(o.name) + '</span><span class="tape">' + E(o.id) + '</span></div>' +
            '<div class="li-sub">' + E(live.map(function (l) { return l.item_name + (l.qty > 1 ? ' ×' + l.qty : ''); }).join(', ') || 'No items') + '</div>' +
            '<div class="li-sub">' + E(UI.when(o.created_at)) + (o.purpose ? ' · ' + E(o.purpose) : '') + '</div></div>' + UI.orderPill(o.status, o.overdue) + '</button>';
        }).join('') + '</div>' : '<div class="card">' + UI.empty('receipt', 'No orders here', '') + '</div>');
      var inp = document.getElementById('oq');
      inp.addEventListener('input', UI.debounce(function () { oQ = inp.value.trim(); load().then(function (x) { draw(x); var n = document.getElementById('oq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, App.error); }, 300));
      App.acts = { f: function (el) { oFilter = el.getAttribute('data-id'); load().then(draw, App.error); } };
    }
    return load().then(draw);
  };

  V['a-order'] = function (main, id) {
    var sel = {};
    function draw(o) {
      var held = o.lines.filter(function (l) { return ['OUT', 'RETURN_REQUESTED'].indexOf(l.status) >= 0; });
      var closed = ['RETURNED', 'CANCELLED', 'REJECTED'].indexOf(o.status) >= 0;
      var photos = UI.photoList(o.photo_out);
      var retPhotos = []; o.lines.forEach(function (l) { if (l.return_photo && retPhotos.indexOf(l.return_photo) < 0) retPhotos.push(l.return_photo); });
      main.innerHTML = backHead(o.id, UI.orderPill(o.status, o.overdue), 'a-orders') +
        '<div class="card pad" style="margin-bottom:14px"><dl class="kv" style="margin:0">' +
        '<dt>Taken by</dt><dd><b>' + E(o.name) + '</b><br><span class="muted small">' + E(o.email) + '</span></dd>' +
        '<dt>Tugasan</dt><dd>' + (E(o.purpose) || '—') + '</dd>' +
        (o.location ? '<dt>Location</dt><dd>' + E(o.location) + '</dd>' : '') +
        '<dt>Taken</dt><dd>' + E(UI.when(o.created_at)) + '</dd>' +
        '<dt>Return by</dt><dd' + (o.overdue ? ' style="color:var(--bad);font-weight:700"' : '') + '>' + (o.expected_return ? E(UI.day(o.expected_return)) : '—') + '</dd>' +
        (o.approved_by ? '<dt>Approved</dt><dd>' + E(o.approved_by) + ' · ' + E(UI.when(o.approved_at)) + '</dd>' : '') +
        (o.admin_note ? '<dt>Admin note</dt><dd>' + E(o.admin_note) + '</dd>' : '') +
        '</dl></div>' +
        (photos.length ? '<div class="group-h">' + I('camera') + 'Checkout photos</div>' + UI.photos(photos) : '') +
        (retPhotos.length ? '<div class="group-h">' + I('camera') + 'Return photos</div>' + UI.photos(retPhotos) : '') +
        '<div class="group-h">' + I('box') + 'Items<span class="n">' + o.lines.length + '</span></div>' +
        '<div class="order"><div class="order-b">' + o.lines.map(function (l) {
          var can = ['OUT', 'RETURN_REQUESTED'].indexOf(l.status) >= 0;
          return '<div class="line"><label' + (can ? '' : ' style="cursor:default"') + '>' + (can ? '<input type="checkbox" class="check" data-sel="' + E(l.id) + '"' + (sel[l.id] ? ' checked' : '') + '>' : '<span style="width:24px;flex:none"></span>') +
            '<span class="grow"><span class="li-title" style="display:block">' + E(l.item_name) + (l.qty > 1 ? ' ×' + l.qty : '') + '</span>' +
            '<span class="small muted" style="display:block">' + (l.returned_at ? 'Returned ' + E(UI.when(l.returned_at)) + (l.return_condition ? ' · ' + E(l.return_condition) : '') : l.return_requested_at && l.status === 'RETURN_REQUESTED' ? 'Return asked ' + E(UI.when(l.return_requested_at)) : l.out_at ? 'Out since ' + E(UI.when(l.out_at)) : '') + '</span>' +
            (l.return_note ? '<span class="small" style="display:block">User: ' + E(l.return_note) + '</span>' : '') +
            (l.return_remark ? '<span class="small" style="display:block;color:var(--warn)">' + E(l.return_remark) + '</span>' : '') +
            '</span></label><button class="icon-btn" data-act="go" data-to="a-item/' + E(l.item_id) + '" aria-label="Open item">' + I('right') + '</button>' + UI.linePill(l.status, o.overdue, l.return_remark) + '</div>';
        }).join('') + '</div></div>' +
        '<div class="stack" style="margin-top:16px">' +
        (o.status === 'PENDING' ? '<div class="row"><button class="btn danger grow" data-act="reject-out">Reject</button><button class="btn ok grow" data-act="approve-out">' + I('check') + 'Approve checkout</button></div>' : '') +
        (held.length ? '<button class="btn primary block" data-act="mark-returned" id="mr">Mark selected as returned</button>' : '') +
        (!closed ? '<div class="row"><button class="btn ghost grow" data-act="edit">' + I('edit') + 'Edit order</button><button class="btn danger grow" data-act="cancel">' + I('x') + 'Cancel order</button></div>' : '') +
        '</div>';
      main.querySelectorAll('input[data-sel]').forEach(function (c) { c.addEventListener('change', function () { sel[c.getAttribute('data-sel')] = c.checked; upd(); }); });
      function upd() { var b = document.getElementById('mr'); if (!b) return; var n = held.filter(function (l) { return sel[l.id]; }).length; b.disabled = !n; b.textContent = n ? 'Mark ' + n + ' as returned' : 'Tick items to mark returned'; }
      upd();
      App.acts = {
        'approve-out': function (el) { App.run(el, 'admin.order.approve_out', { order_id: o.id }).then(function (r) { if (r) { UI.toast('Approved'); draw(r.order); } }); },
        'reject-out': function () { UI.ask({ title: 'Reject checkout?', input: 'Reason (optional)', ok: 'Reject', danger: true }).then(function (w) { if (w !== null) App.run(null, 'admin.order.reject_out', { order_id: o.id, reason: w }).then(function (r) { if (r) draw(r.order); }); }); },
        'mark-returned': function () { returnSheet(o, held.filter(function (l) { return sel[l.id]; }), function (ord) { sel = {}; draw(ord); }); },
        cancel: function () {
          UI.ask({ title: 'Cancel ' + o.id + '?', message: 'Every item still on this order goes back to available. Use this for orders made by mistake.', input: 'Reason (optional)', ok: 'Cancel order', danger: true }).then(function (w) {
            if (w !== null) App.run(null, 'admin.order.cancel', { order_id: o.id, reason: w }).then(function (r) { if (r) { UI.toast('Order cancelled'); draw(r.order); } });
          });
        },
        edit: function () { editOrder(o, draw); }
      };
    }
    return API.call('admin.order', { order_id: id }).then(function (d) { draw(d.order); });
  };

  function returnSheet(o, lines, done) {
    var s = UI.sheet(UI.sheetHead('Mark as returned', o.name + ' · ' + o.id) +
      '<div class="stack">' + lines.map(function (l) {
        return '<div class="card pad stack-sm"><b>' + E(l.item_name) + (l.qty > 1 ? ' ×' + l.qty : '') + '</b>' + condBlock('m' + l.id) + '</div>';
      }).join('') + '<button class="btn ok block" data-act="mr-save" style="min-height:52px">' + I('check') + 'Confirm return</button></div>', {
      'mr-save': function (el) {
        var payload = readCond(s.el, lines, function (l) { return 'm' + l.id; });
        if (!payload) return;
        App.run(el, 'admin.return.approve', { order_id: o.id, lines: payload }).then(function (r) { if (r) { s.close(); UI.toast('Marked returned'); done(r.order); } });
      }
    });
    wireCond(s.el);
  }

  function editOrder(o, done) {
    var rm = {}, add = {};
    var held = o.lines.filter(function (l) { return ['PENDING', 'OUT', 'RETURN_REQUESTED'].indexOf(l.status) >= 0; });
    var s = UI.sheet(UI.sheetHead('Edit order', o.id) +
      '<form class="stack" id="eo" novalidate>' +
      '<label class="field"><span>Tugasan / task</span><textarea class="input" id="eo-p" maxlength="300">' + E(o.purpose) + '</textarea></label>' +
      '<label class="field"><span>Location</span><input class="input" id="eo-l" maxlength="200" value="' + E(o.location) + '"></label>' +
      '<label class="field"><span>Return by</span><input class="input" id="eo-r" type="date" value="' + E(o.expected_return) + '"></label>' +
      '<label class="field"><span>Admin note</span><textarea class="input" id="eo-n" maxlength="300">' + E(o.admin_note) + '</textarea><small>Only admins see this.</small></label>' +
      (held.length ? '<div class="field"><span>Remove items from the order</span><div class="list">' + held.map(function (l) { return '<label class="li"><input type="checkbox" class="check" data-rm="' + E(l.id) + '"><span class="li-main">' + E(l.item_name) + '</span></label>'; }).join('') + '</div></div>' : '') +
      '<div class="field"><span>Add items</span><label class="search">' + I('search') + '<input class="input" id="eo-q" type="search" placeholder="Search available gear"></label><div id="eo-res" class="list" hidden></div><div id="eo-add" class="row wrap"></div></div>' +
      '<button class="btn primary block" type="submit" id="eo-save" style="min-height:52px">Save changes</button></form>', {
      'eo-pick': function (el) { add[el.getAttribute('data-id')] = el.getAttribute('data-name'); drawAdd(); s.el.querySelector('#eo-res').hidden = true; s.el.querySelector('#eo-q').value = ''; },
      'eo-unpick': function (el) { delete add[el.getAttribute('data-id')]; drawAdd(); }
    });
    var avail = [];
    itemsCache().then(function (d) { avail = d.items.filter(function (i) { return i.available > 0; }); });
    var q = s.el.querySelector('#eo-q'), res = s.el.querySelector('#eo-res');
    q.addEventListener('input', function () {
      var t = q.value.trim().toLowerCase();
      var hits = t ? avail.filter(function (i) { return !add[i.id] && (i.name + ' ' + i.code).toLowerCase().indexOf(t) >= 0; }).slice(0, 6) : [];
      res.hidden = !hits.length;
      res.innerHTML = hits.map(function (i) { return '<button type="button" class="li" data-act="eo-pick" data-id="' + E(i.id) + '" data-name="' + E(i.name) + '"><span class="li-main"><span class="li-title">' + E(i.name) + '</span> <span class="tape">' + E(i.code) + '</span></span>' + I('plus') + '</button>'; }).join('');
    });
    function drawAdd() { s.el.querySelector('#eo-add').innerHTML = Object.keys(add).map(function (k) { return '<button type="button" class="chip" aria-pressed="true" data-act="eo-unpick" data-id="' + E(k) + '">' + E(add[k]) + ' ' + I('x') + '</button>'; }).join(''); }
    s.el.querySelectorAll('[data-rm]').forEach(function (c) { c.addEventListener('change', function () { rm[c.getAttribute('data-rm')] = c.checked; }); });
    s.el.querySelector('#eo').addEventListener('submit', function (e) {
      e.preventDefault();
      App.run(s.el.querySelector('#eo-save'), 'admin.order.edit', {
        order_id: o.id, purpose: s.el.querySelector('#eo-p').value, location: s.el.querySelector('#eo-l').value, expected_return: s.el.querySelector('#eo-r').value, admin_note: s.el.querySelector('#eo-n').value,
        remove: Object.keys(rm).filter(function (k) { return rm[k]; }), add: Object.keys(add).map(function (k) { return { item_id: k, qty: 1 }; })
      }).then(function (r) { if (r) { s.close(); UI.toast('Order updated'); done(r.order); } });
    });
  }

  // =================== ITEMS ===================
  var iFilter = 'all', iQ = '';
  V['a-items'] = function (main, f) {
    if (f) iFilter = f;
    function draw(d) {
      var list = d.items.filter(function (i) {
        if (iQ) return (i.name + ' ' + i.code + ' ' + i.serial_no + ' ' + i.remark).toLowerCase().indexOf(iQ) >= 0;
        if (iFilter === 'archived') return i.status === 'archived';
        if (i.status === 'archived') return false;
        if (iFilter === 'attention') return ['Incomplete', 'Damaged', 'Under Repair', 'Lost'].indexOf(i.condition) >= 0;
        if (iFilter === 'inuse') return i.used > 0;
        return iFilter === 'all' || i.category_id === iFilter;
      });
      var activeCats = d.categories.filter(function (c) { return c.status !== 'archived'; });
      var chip = function (id, label, icn) { return '<button class="chip" data-act="f" data-id="' + id + '" aria-pressed="' + (iFilter === id && !iQ) + '">' + (icn ? I(icn) : '') + E(label) + '</button>'; };
      // Laptop side list (hidden on phones, which keep the sliding chips).
      var live = d.items.filter(function (i) { return i.status !== 'archived'; });
      var cnt = { all: live.length, inuse: 0, attention: 0, archived: d.items.length - live.length };
      live.forEach(function (i) {
        if (i.used > 0) cnt.inuse++;
        if (['Incomplete', 'Damaged', 'Under Repair', 'Lost'].indexOf(i.condition) >= 0) cnt.attention++;
        cnt[i.category_id] = (cnt[i.category_id] || 0) + 1;
      });
      var srow = function (id, label, icn) { return '<button type="button" data-act="f" data-id="' + E(id) + '" aria-pressed="' + (iFilter === id && !iQ) + '">' + I(icn || 'box') + '<span class="is-name">' + E(label) + '</span><span class="n">' + (cnt[id] || 0) + '</span></button>'; };
      var side = '<aside class="iside" aria-label="Filter items"><div class="is-label">Show</div>' + srow('all', 'All items', 'box') + srow('inuse', 'In use', 'out') + srow('attention', 'Needs attention', 'alert') +
        '<hr><div class="is-label">Categories</div>' + activeCats.map(function (c) { return srow(c.id, c.name, c.icon); }).join('') + '<hr>' + srow('archived', 'Removed', 'trash') + '</aside>';
      main.innerHTML = head('Items', d.items.filter(function (i) { return i.status !== 'archived'; }).length + ' on the list', '<div class="row" style="gap:8px;flex:none"><button class="btn sm ghost" data-act="go" data-to="a-presets">' + I('star') + 'Presets</button><button class="btn sm primary" data-act="new">' + I('plus') + 'Add item</button></div>') +
        '<div class="iwrap">' + side + '<div class="imain">' +
        '<div class="pick-bar"><label class="search">' + I('search') + '<input class="input" id="iq" type="search" placeholder="Search name, code, serial, remark" value="' + E(iQ) + '" aria-label="Search items"></label>' +
        '<div class="chips">' + chip('all', 'All') + chip('inuse', 'In use') + chip('attention', 'Needs attention', 'alert') + activeCats.map(function (c) { return chip(c.id, c.name, c.icon); }).join('') + chip('archived', 'Removed', 'trash') + '</div></div>' +
        (catName[iFilter] && !iQ ? '<div class="row between" style="margin:-2px 0 10px"><span class="small muted">' + list.length + ' in ' + E(catName[iFilter]) + '</span><button class="btn sm ghost" data-act="go" data-to="a-cat-move/' + E(iFilter) + '">' + I('swap') + 'Move items here</button></div>' : '') +
        (list.length ? '<div class="list">' + list.map(function (i) {
          var where = i.holders.length ? 'With ' + i.holders.join(', ') : i.status === 'archived' ? 'Removed from the pick list' : i.qty > 1 ? i.available + ' of ' + i.qty + ' free' : i.available ? 'In the store' : 'Not pickable';
          return '<button class="li" data-act="go" data-to="a-item/' + E(i.id) + '"><div class="thumb">' + UI.thumb(i.photo, ic(i.category_id)) + '</div><div class="li-main"><div class="li-title">' + E(i.name) + '</div>' +
            '<div class="li-sub"><span class="tape">' + E(i.code) + '</span> · ' + E(where) + '</div>' + (i.issue ? '<div class="li-sub" style="color:var(--bad);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + E(i.issue) + '</div>' : i.remark ? '<div class="li-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + E(i.remark) + '</div>' : '') + '</div>' +
            (i.condition !== 'Good' ? UI.condPill(i.condition) : i.used ? UI.pill('In use', 'p-bad') : '') + '</button>';
        }).join('') + '</div>' : '<div class="card">' + UI.empty('box', 'No items here', '') + '</div>') + '</div></div>';
      var inp = document.getElementById('iq');
      inp.addEventListener('input', UI.debounce(function () { iQ = inp.value.trim().toLowerCase(); draw(d); var n = document.getElementById('iq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200));
      App.acts = {
        f: function (el) { iFilter = el.getAttribute('data-id'); iQ = ''; draw(d); },
        new: function () { itemForm(null, d.categories, d.conditions, function (it) { App.go('a-item/' + it.id); }); }
      };
      var on = main.querySelector('.chip[aria-pressed="true"]'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    return itemsCache().then(draw);
  };

  function itemForm(it, categories, conditions, done) {
    var isNew = !it; it = it || { qty: 1, condition: 'Good', category_id: iFilter && catName[iFilter] ? iFilter : (categories[0] || {}).id };
    var s = UI.sheet(UI.sheetHead(isNew ? 'Add item' : 'Edit item', isNew ? 'Shows in the Gear list right away' : it.code) +
      '<form class="stack" id="itf" novalidate>' +
      '<label class="field"><span>Name</span><input class="input" id="it-name" maxlength="120" required value="' + E(it.name || '') + '" placeholder="e.g. Sony FX3" ' + (isNew ? 'autofocus' : '') + '></label>' +
      '<label class="field"><span>Category</span><select class="input" id="it-cat">' + categories.filter(function (c) { return c.status !== 'archived' || c.id === it.category_id; }).map(function (c) { return '<option value="' + E(c.id) + '"' + (c.id === it.category_id ? ' selected' : '') + '>' + E(c.name) + '</option>'; }).join('') + '</select>' + (isNew ? '' : '<small>Changing category gives the item a new code.</small>') + '</label>' +
      '<div class="row" style="align-items:start"><label class="field grow"><span>Quantity</span><input class="input" id="it-qty" type="number" min="1" step="1" inputmode="numeric" value="' + E(it.qty) + '"><small>More than 1 for pooled gear like memory cards.</small></label>' +
      '<label class="field grow"><span>Condition</span><select class="input" id="it-cond">' + conditions.map(function (c) { return '<option' + (c === it.condition ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="field"><span>Serial no. (optional)</span><input class="input" id="it-sn" maxlength="120" value="' + E(it.serial_no || '') + '"></label>' +
      '<label class="field"><span>Last service (optional)</span><input class="input" id="it-svc" type="date" value="' + E(it.last_service || '') + '"></label>' +
      '<label class="field"><span>Remark (optional)</span><textarea class="input" id="it-rm" maxlength="1000" placeholder="e.g. Comes with 2 batteries and a strap">' + E(it.remark || '') + '</textarea></label>' +
      '<label class="field"><span>Picture link (optional)</span><input class="input" id="it-img" type="url" inputmode="url" placeholder="https://… (right-click an image → Copy image address)" value="' + E(/^data:/.test(it.photo_link || '') ? '' : (it.photo_link || '')) + '"><small>Saved to the 06 · Item Photo Links sheet. To use your own photo, open the item and tap Add photo.</small></label>' +
      '<button class="btn primary block" type="submit" id="it-save" style="min-height:52px">' + (isNew ? 'Add item' : 'Save changes') + '</button></form>');
    s.el.querySelector('#itf').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (id) { return s.el.querySelector('#' + id).value; };
      if (!v('it-name').trim()) { UI.toast('Give the item a name.', true); return; }
      App.run(s.el.querySelector('#it-save'), 'admin.item.save', { id: isNew ? '' : it.id, name: v('it-name'), category_id: v('it-cat'), qty: v('it-qty'), condition: v('it-cond'), serial_no: v('it-sn'), last_service: v('it-svc'), remark: v('it-rm'), photo_link: /^data:/.test(it.photo_link || '') && !v('it-img') ? it.photo_link : v('it-img') })
        .then(function (r) { if (r) { s.close(); UI.toast(isNew ? 'Item added' : 'Saved'); done(r.item); } });
    });
  }

  var itemTab = 'log';
  V['a-item'] = function (main, id) {
    function draw(it, conditions) {
      var usedTxt = it.holders.length ? it.holders.map(function (h) { return E(h.name) + (h.qty > 1 ? ' ×' + h.qty : ''); }).join(', ') : '';
      main.innerHTML = backHead(it.name, '<span class="tape">' + E(it.code) + '</span> · ' + E(catName[it.category_id] || it.category_id), 'a-items') +
        '<div class="card pad stack" style="margin-bottom:14px"><div class="hero-item"><div class="thumb">' + UI.thumb(it.photo, ic(it.category_id)) + '</div>' +
        '<div class="stack-sm"><div class="row wrap">' + UI.condPill(it.condition) + (it.status === 'archived' ? UI.pill('Removed', 'p-mute') : it.used ? UI.pill('In use', 'p-bad') : it.available ? UI.pill('In the store', 'p-ok') : '') + '</div>' +
        '<div class="small muted">' + (it.qty > 1 ? it.available + ' of ' + it.qty + ' free · ' : '') + 'used ' + it.times_used + ' time' + (it.times_used === 1 ? '' : 's') + '</div></div></div>' +
        (usedTxt ? '<div class="notice">' + I('user') + '<div>With <b>' + usedTxt + '</b> since ' + E(UI.when(it.holders[0].out_at)) + (it.holders[0].purpose ? ' · ' + E(it.holders[0].purpose) : '') + '. <button class="btn sm ghost" style="margin-top:6px" data-act="go" data-to="a-order/' + E(it.holders[0].order_id) + '">Open order</button></div></div>' : '') +
        '<dl class="kv" style="margin:0">' +
        '<dt>Quantity</dt><dd class="tnum">' + it.qty + '</dd>' +
        '<dt>Serial no.</dt><dd>' + (E(it.serial_no) || '—') + '</dd>' +
        '<dt>Last service</dt><dd>' + (it.last_service ? E(UI.day(it.last_service)) + ' <span class="muted">(' + UI.daysAgo(it.last_service) + ')</span>' : '<span class="muted">Never recorded</span>') + '</dd>' +
        (it.issue && it.condition !== 'Good' ? '<dt>Problem</dt><dd style="color:var(--bad);font-weight:700">' + E(it.issue) + '</dd>' : '') +
        '<dt>Remark</dt><dd>' + (E(it.remark) || '—') + '</dd>' +
        '<dt>Picture</dt><dd>' + (it.photo_link ? E(it.photo_source || 'link') : '<span class="muted">None yet · shows an icon</span>') + '</dd>' +
        '<dt>Added</dt><dd>' + E(UI.when(it.created_at)) + '</dd></dl></div>' +
        '<div class="row wrap" style="margin-bottom:6px">' +
        '<button class="btn sm dark grow" data-act="log">' + I('wrench') + 'Log entry</button>' +
        '<button class="btn sm ghost grow" data-act="edit">' + I('edit') + 'Edit</button></div>' +
        '<div class="row wrap"><button class="btn sm ghost grow" data-act="photo">' + I('image') + (it.photo ? 'Change photo' : 'Add photo') + '</button>' +
        (it.status === 'archived' ? '<button class="btn sm ghost grow" data-act="restore">' + I('refresh') + 'Restore</button>' : '<button class="btn sm danger grow" data-act="archive">' + I('trash') + 'Remove</button>') + '</div>' +
        '<div class="segment" style="margin:18px 0 10px"><button data-act="tab" data-id="log" aria-pressed="' + (itemTab === 'log') + '">History · ' + it.log.length + '</button><button data-act="tab" data-id="usage" aria-pressed="' + (itemTab === 'usage') + '">Who used it · ' + it.usage.length + '</button></div>' +
        (itemTab === 'log' ? (it.log.length ? '<div class="card pad"><div class="timeline">' + it.log.map(function (l) {
          var icn = { damage: 'alert', service: 'wrench', repair: 'wrench', note: 'note', edit: 'edit' }[l.type] || 'note';
          return '<div class="tl tl-' + E(l.type) + '"><i>' + I(icn) + '</i><div style="min-width:0"><div class="row between"><b style="text-transform:capitalize">' + E(l.type) + '</b><span class="small muted">' + E(UI.when(l.date)) + '</span></div><div class="small" style="overflow-wrap:anywhere">' + E(l.detail) + '</div>' +
            '<div class="small muted">' + E(l.by || '') + (l.order_id ? ' · ' + E(l.order_id) : '') + '</div>' + (l.photo ? '<div style="margin-top:6px;max-width:120px">' + UI.photos([l.photo]) + '</div>' : '') + '</div></div>';
        }).join('') + '</div></div>' : '<div class="card">' + UI.empty('note', 'No history yet', 'Damage reports, repairs, services and edits show here.') + '</div>')
          : (it.usage.length ? '<div class="list">' + it.usage.map(function (u) {
            return '<button class="li" data-act="go" data-to="a-order/' + E(u.order_id) + '"><div class="li-main"><div class="li-title">' + E(u.name) + (u.qty > 1 ? ' <span class="muted">×' + u.qty + '</span>' : '') + '</div><div class="li-sub">' + E(UI.when(u.out_at)) + (u.returned_at ? ' → ' + E(UI.when(u.returned_at)) : '') + (u.purpose ? ' · ' + E(u.purpose) : '') + '</div>' +
              (u.return_remark ? '<div class="li-sub">' + E(u.return_remark) + '</div>' : '') + '</div>' + (u.return_condition && u.return_condition !== 'Good' ? UI.condPill(u.return_condition) : UI.linePill(u.status)) + '</button>';
          }).join('') + '</div>' : '<div class="card">' + UI.empty('users', 'Nobody has used it yet', '') + '</div>'));
      App.acts = {
        tab: function (el) { itemTab = el.getAttribute('data-id'); draw(it, conditions); },
        edit: function () { itemForm(it, cats, conditions, function () { reload(); }); },
        log: function () { logSheet(it, conditions, reload); },
        photo: function (el) { UI.pickPhoto(false).then(function (src) { if (src) App.run(el, 'admin.item.photo', { item_id: it.id, photo: src }).then(function (r) { if (r) { UI.toast('Photo saved'); reload(); } }); }); },
        archive: function () { UI.ask({ title: 'Remove ' + it.name + '?', message: 'It disappears from the Gear list. Its history is kept and you can restore it any time.', ok: 'Remove', danger: true }).then(function (ok) { if (ok) App.run(null, 'admin.item.archive', { id: it.id, archived: true }).then(function (r) { if (r) { UI.toast('Removed from the pick list'); reload(); } }); }); },
        restore: function (el) { App.run(el, 'admin.item.archive', { id: it.id, archived: false }).then(function (r) { if (r) { UI.toast('Restored'); reload(); } }); }
      };
    }
    function reload() { return API.call('admin.item', { id: id }).then(function (d) { draw(d.item, d.conditions); }, App.error); }
    return (cats.length ? Promise.resolve() : itemsCache()).then(reload);
  };

  function logSheet(it, conditions, done) {
    var type = 'damage', photo = null;
    var s = UI.sheet(UI.sheetHead('Log for ' + it.name, it.code) +
      '<form class="stack" id="lf" novalidate>' +
      '<div class="segment" id="lt">' + [['damage', 'Damage'], ['repair', 'Repaired'], ['service', 'Service'], ['note', 'Note']].map(function (t) { return '<button type="button" data-t="' + t[0] + '" aria-pressed="' + (t[0] === type) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<label class="field"><span>What happened</span><textarea class="input" id="lf-d" maxlength="1000" autofocus placeholder="e.g. Cracked LCD hinge after outdoor shoot"></textarea></label>' +
      '<label class="field"><span>Date</span><input class="input" id="lf-date" type="date" max="' + UI.todayStr() + '" value="' + UI.todayStr() + '"></label>' +
      '<label class="field"><span>Set condition to</span><select class="input" id="lf-c"><option value="">Keep as ' + E(it.condition) + ' (auto for damage / repair)</option>' + conditions.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select><small id="lf-hint"></small></label>' +
      '<div class="field"><span>Photo (optional)</span><div id="lf-ph"></div><div class="row"><button type="button" class="btn sm dark grow" data-act="lf-snap">' + I('camera') + 'Take photo</button><button type="button" class="btn sm ghost grow" data-act="lf-up">' + I('upload') + 'Upload</button></div></div>' +
      '<button class="btn primary block" type="submit" id="lf-save" style="min-height:52px">Save to history</button></form>', {
      'lf-snap': function () { take(true); }, 'lf-up': function () { take(false); }
    });
    function take(c) { UI.pickPhoto(c).then(function (src) { if (src) { photo = src; s.el.querySelector('#lf-ph').innerHTML = '<div class="photos" style="margin-bottom:8px"><div class="ph" style="background-image:url(&quot;' + src + '&quot;)"></div></div>'; } }); }
    function hint() {
      var h = { damage: 'Damage sets the condition to Damaged unless you choose another.', repair: 'Repaired sets the condition back to Good unless you choose another.', service: 'Service also updates the "last service" date.', note: 'A note changes nothing else.' }[type];
      s.el.querySelector('#lf-hint').textContent = h;
    }
    hint();
    s.el.querySelectorAll('#lt button').forEach(function (b) { b.addEventListener('click', function () { type = b.getAttribute('data-t'); s.el.querySelectorAll('#lt button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); hint(); }); });
    s.el.querySelector('#lf').addEventListener('submit', function (e) {
      e.preventDefault();
      var d = s.el.querySelector('#lf-d').value.trim();
      if (!d) { UI.toast('Write what happened.', true); return; }
      App.run(s.el.querySelector('#lf-save'), 'admin.item.log', { item_id: it.id, type: type, detail: d, date: s.el.querySelector('#lf-date').value, set_condition: s.el.querySelector('#lf-c').value, photo: photo })
        .then(function (r) { if (r) { s.close(); UI.toast('Saved to history'); done(); } });
    });
  }

  // =================== MORE ===================
  V['a-more'] = function (main) {
    var row = function (to, icn, t, sub) { return '<button class="li" data-act="go" data-to="' + to + '"><div class="thumb">' + I(icn) + '</div><div class="li-main"><div class="li-title">' + t + '</div><div class="li-sub">' + sub + '</div></div><span class="chev">' + I('right') + '</span></button>'; };
    main.innerHTML = head('More') + '<div class="list">' +
      row('a-users', 'users', 'Users', 'Approve, make admin, block') +
      row('a-cats', 'folder', 'Categories', 'The tabs in the Gear screen') +
      row('a-settings', 'sliders', 'Settings & messages', 'Checkout message, switches, announcement') +
      row('a-log', 'list', 'Activity log', 'Everything that happened') +
      '<button class="li" data-act="switch"><div class="thumb">' + I('swap') + '</div><div class="li-main"><div class="li-title">Open the user app</div><div class="li-sub">Pick gear yourself</div></div><span class="chev">' + I('right') + '</span></button>' +
      '</div><p class="small muted" style="margin-top:16px">Raw data (users, items, orders, settings) lives in the Google Sheets listed in the Master Index. Only the sheet owner can open them.</p>';
    App.acts = { switch: function () { App.switchApp(); } };
  };

  // =================== USERS ===================
  var uFilter = 'all', uQ = '';
  V['a-users'] = function (main) {
    function draw(d) {
      var list = d.users.filter(function (u) {
        if (uQ && (u.name + ' ' + u.email).toLowerCase().indexOf(uQ) < 0) return false;
        if (uFilter === 'admin') return u.role === 'admin';
        if (uFilter === 'pending' || uFilter === 'disabled') return u.status === uFilter;
        return true;
      });
      var t = function (id, l) { return '<button data-act="f" data-id="' + id + '" aria-pressed="' + (uFilter === id) + '">' + l + '</button>'; };
      var stCls = { active: 'p-ok', pending: 'p-warn', disabled: 'p-mute' };
      main.innerHTML = backHead('Users', d.users.length + ' accounts', 'a-more') +
        '<div class="stack" style="margin-bottom:14px"><button class="btn primary block" data-act="new">' + I('plus') + 'Add a Google account</button><div class="segment">' + t('all', 'All') + t('pending', 'Waiting') + t('admin', 'Admins') + t('disabled', 'Blocked') + '</div>' +
        '<label class="search">' + I('search') + '<input class="input" id="uq" type="search" placeholder="Name or email" value="' + E(uQ) + '" aria-label="Search users"></label></div>' +
        (list.length ? '<div class="list">' + list.map(function (u) {
          return '<button class="li" data-act="edit" data-id="' + E(u.email) + '"><div class="avatar" style="background:var(--surface-2);color:var(--ink);border:0">' + E(UI.initials(u.name)) + '</div><div class="li-main"><div class="li-title">' + E(u.name) + (u.email === App.user.email ? ' <span class="muted">(you)</span>' : '') + '</div><div class="li-sub">' + E(u.email) + (u.holding ? ' · holds ' + u.holding : '') + '</div></div>' +
            '<div class="stack-sm" style="justify-items:end">' + (u.role === 'admin' ? UI.pill('Admin', 'p-info') : '') + UI.pill(u.status === 'disabled' ? 'Blocked' : u.status === 'pending' ? 'Waiting' : 'Active', stCls[u.status]) + '</div></button>';
        }).join('') + '</div>' : '<div class="card">' + UI.empty('users', 'No users here', '') + '</div>');
      var inp = document.getElementById('uq');
      inp.addEventListener('input', UI.debounce(function () { uQ = inp.value.trim().toLowerCase(); draw(d); var n = document.getElementById('uq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200));
      App.acts = {
        f: function (el) { uFilter = el.getAttribute('data-id'); draw(d); },
        new: function () { userForm(null, reload); },
        edit: function (el) { userForm(d.users.filter(function (u) { return u.email === el.getAttribute('data-id'); })[0], reload); }
      };
    }
    function reload() { API.call('admin.users').then(draw, App.error); }
    return API.call('admin.users').then(draw);
  };
  function userForm(u, done) {
    var isNew = !u; u = u || { role: 'user', status: 'active' };
    var me = u.email === App.user.email;
    var s = UI.sheet(UI.sheetHead(isNew ? 'Add a Google account' : u.name, isNew ? 'They can sign in right away' : u.email) +
      '<form class="stack" id="uf" novalidate>' +
      (isNew ? '<label class="field"><span>Google email</span><input class="input" id="uf-e" type="email" autocomplete="off" autofocus placeholder="name@gmail.com"></label>' : '') +
      '<label class="field"><span>Name</span><input class="input" id="uf-n" maxlength="80" value="' + E(u.name || '') + '"></label>' +
      '<label class="field"><span>Phone (optional)</span><input class="input" id="uf-p" type="tel" maxlength="30" value="' + E(u.phone || '') + '"></label>' +
      '<div class="row"><label class="field grow"><span>Role</span><select class="input" id="uf-r"' + (me ? ' disabled' : '') + '><option value="user"' + (u.role !== 'admin' ? ' selected' : '') + '>User</option><option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>Admin</option></select></label>' +
      '<label class="field grow"><span>Status</span><select class="input" id="uf-s"' + (me ? ' disabled' : '') + '><option value="active"' + (u.status === 'active' ? ' selected' : '') + '>Active</option><option value="pending"' + (u.status === 'pending' ? ' selected' : '') + '>Waiting</option><option value="disabled"' + (u.status === 'disabled' ? ' selected' : '') + '>Blocked</option></select></label></div>' +
      (me ? '<small class="muted">You cannot change your own role or status.</small>' : '') +
      '<label class="field"><span>Admin note (optional)</span><textarea class="input" id="uf-note" maxlength="300">' + E(u.note || '') + '</textarea></label>' +
      (!isNew && u.last_login ? '<div class="small muted">Last sign-in ' + E(UI.when(u.last_login)) + (u.holding ? ' · holding ' + u.holding + ' item' + (u.holding > 1 ? 's' : '') : '') + '</div>' : '') +
      '<button class="btn primary block" type="submit" id="uf-save" style="min-height:52px">' + (isNew ? 'Add account' : 'Save') + '</button></form>');
    s.el.querySelector('#uf').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (id) { return s.el.querySelector('#' + id).value; };
      App.run(s.el.querySelector('#uf-save'), 'admin.user.save', { email: isNew ? v('uf-e') : u.email, name: v('uf-n'), phone: v('uf-p'), role: v('uf-r'), status: v('uf-s'), note: v('uf-note') })
        .then(function (r) { if (r) { s.close(); UI.toast('Saved'); done(); } });
    });
  }

  // =================== CATEGORIES ===================
  V['a-cats'] = function (main) {
    function draw(d) {
      setCats(d.categories);
      var count = {}; d.items.forEach(function (i) { if (i.status !== 'archived') count[i.category_id] = (count[i.category_id] || 0) + 1; });
      var act = d.categories.filter(function (c) { return c.status !== 'archived'; }), arch = d.categories.filter(function (c) { return c.status === 'archived'; });
      main.innerHTML = backHead('Categories', 'Order here = tab order in Gear', 'a-more') +
        '<button class="btn primary block" data-act="new" style="margin-bottom:14px">' + I('plus') + 'Add category</button>' +
        '<div class="list">' + act.map(function (c, i) {
          return '<div class="li"><div class="thumb">' + I(c.icon) + '</div><div class="li-main"><div class="li-title">' + E(c.name) + '</div><div class="li-sub"><span class="tape">' + E(c.id) + '</span> · ' + (count[c.id] || 0) + ' items</div></div>' +
            '<button class="icon-btn" data-act="mv" data-id="' + E(c.id) + '" data-dir="-1" aria-label="Move up"' + (i === 0 ? ' disabled style="opacity:.3"' : '') + '>' + I('up') + '</button>' +
            '<button class="icon-btn" data-act="mv" data-id="' + E(c.id) + '" data-dir="1" aria-label="Move down"' + (i === act.length - 1 ? ' disabled style="opacity:.3"' : '') + '>' + I('down') + '</button>' +
            '<button class="icon-btn" data-act="edit" data-id="' + E(c.id) + '" aria-label="Edit">' + I('edit') + '</button></div>';
        }).join('') + '</div>' +
        (arch.length ? '<div class="group-h">' + I('trash') + 'Removed</div><div class="list">' + arch.map(function (c) { return '<div class="li"><div class="thumb">' + I(c.icon) + '</div><div class="li-main li-title">' + E(c.name) + '</div><button class="btn sm ghost" data-act="restore" data-id="' + E(c.id) + '">Restore</button></div>'; }).join('') + '</div>' : '');
      App.acts = {
        new: function () { catForm(null, count, reload); },
        edit: function (el) { catForm(d.categories.filter(function (c) { return c.id === el.getAttribute('data-id'); })[0], count, reload); },
        mv: function (el) { App.run(null, 'admin.category.move', { id: el.getAttribute('data-id'), dir: +el.getAttribute('data-dir') }).then(function (r) { if (r) reload(); }); },
        restore: function (el) { App.run(el, 'admin.category.archive', { id: el.getAttribute('data-id'), archived: false }).then(function (r) { if (r) reload(); }); }
      };
    }
    function reload() { itemsCache().then(draw, App.error); }
    return itemsCache().then(draw);
  };
  function isPic(v) { return /^(orig\|)?(https:\/\/|data:image\/)/.test(String(v || '')); }
  function bare(v) { return String(v || '').replace(/^orig\|/, ''); }
  function catForm(c, count, done) {
    var isNew = !c; c = c || { icon: 'box' };
    var icon = c.icon, upload = null; // icon: built-in name or picture link; upload: a new picture waiting to be saved
    var tint = !/^orig\|/.test(String(c.icon || '')); // true = paint the picture in the app's colours
    var s = UI.sheet(UI.sheetHead(isNew ? 'Add category' : 'Edit category', isNew ? '' : c.id) +
      '<form class="stack" id="cf" novalidate><label class="field"><span>Name</span><input class="input" id="cf-n" maxlength="60" value="' + E(c.name || '') + '" autofocus placeholder="e.g. Streaming"></label>' +
      (isNew ? '<label class="field"><span>Short code (optional)</span><input class="input" id="cf-c" maxlength="3" placeholder="e.g. STR" style="text-transform:uppercase"><small>2–3 letters, used for item codes like STR-01.</small></label>' : '') +
      '<div class="field"><span>Icon</span><div class="chips" style="flex-wrap:wrap" id="cf-i">' + UI.ICONS.map(function (k) { return '<button type="button" class="chip" data-i="' + k + '" aria-pressed="' + (k === icon) + '" aria-label="' + k + '">' + I(k) + '</button>'; }).join('') + '</div></div>' +
      '<div class="field"><span>Or use your own icon</span><div class="own-ic"><div class="own-pair" id="cf-own"></div>' +
      '<div class="row wrap" style="gap:8px"><button type="button" class="btn sm ghost" data-act="cf-up">' + I('upload') + 'Upload picture</button><button type="button" class="btn sm ghost" data-act="cf-link">' + I('link') + 'Paste link</button></div></div>' +
      '<label class="toggle own-tint" id="cf-tintrow"' + (isPic(icon) ? '' : ' hidden') + '><span><b>Match app colours</b><small class="muted" style="display:block">On: any colour works, black or white. Off: keep the picture\'s own colours (logos, photos).</small></span>' +
      '<span class="switch"><input type="checkbox" id="cf-tint"' + (tint ? ' checked' : '') + ' aria-label="Match app colours"><i></i></span></label>' +
      '<small>Use a simple icon PNG with a see-through background (it is resized to 256 px). Black, white or any colour is fine. The two boxes show it on light and dark.</small></div>' +
      '<button class="btn primary block" type="submit" id="cf-save" style="min-height:52px">' + (isNew ? 'Add category' : 'Save') + '</button>' +
      (!isNew ? '<button class="btn ghost block" type="button" data-act="cf-move">' + I('swap') + 'Move items into ' + E(c.name) + '</button>' +
        '<button class="btn danger block" type="button" data-act="cf-del">' + I('trash') + 'Remove category</button>' : '') + '</form>', {
      'cf-move': function () { s.close(); App.go('a-cat-move/' + c.id); },
      'cf-del': function (el) {
        if (count[c.id]) { UI.toast('Move or remove its ' + count[c.id] + ' items first.', true); return; }
        App.run(el, 'admin.category.archive', { id: c.id, archived: true }).then(function (r) { if (r) { s.close(); done(); } });
      },
      'cf-up': function () {
        UI.pickPhoto(false, { max: 256, type: 'image/png' }).then(function (src) {
          if (!src) return;
          upload = src;
          UI.hasAlpha(src).then(function (see) { tint = see; s.el.querySelector('#cf-tint').checked = see; showOwn(src); }); // photos keep colours, icons get recoloured
        });
      },
      'cf-link': function () {
        UI.ask({ title: 'Icon from a link', message: 'On Google Images or a website, right-click the picture → Copy image address, then paste it here.', input: 'Image link', placeholder: 'https://…', ok: 'Use this icon', required: true, requiredMsg: 'Paste a link first.' }).then(function (v) {
          v = String(v || '').trim(); if (!v) return;
          if (!/^https:\/\/\S+$/.test(v)) { UI.toast('The link must start with https://', true); return; }
          upload = null; icon = v; tint = true; s.el.querySelector('#cf-tint').checked = true; showOwn(v);
        });
      }
    });
    function own(src) { return src ? (tint ? bare(src) : 'orig|' + bare(src)) : ''; }
    function showOwn(src) {
      var box = s.el.querySelector('#cf-own');
      box.innerHTML = src ? '<span class="own-prev on">' + I(own(src)) + '</span><span class="own-prev dark">' + I(own(src)) + '</span>' : '<span class="own-prev">' + I('image') + '</span>';
      s.el.querySelector('#cf-tintrow').hidden = !src;
      if (src) s.el.querySelectorAll('#cf-i .chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    }
    showOwn(isPic(icon) ? icon : '');
    s.el.querySelector('#cf-tint').addEventListener('change', function (e) { tint = e.target.checked; showOwn(upload || icon); });
    s.el.querySelectorAll('#cf-i .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        icon = b.getAttribute('data-i'); upload = null;
        s.el.querySelectorAll('#cf-i .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        showOwn('');
      });
    });
    s.el.querySelector('#cf').addEventListener('submit', function (e) {
      e.preventDefault();
      var n = s.el.querySelector('#cf-n').value.trim(); if (!n) { UI.toast('Give it a name.', true); return; }
      var btn = s.el.querySelector('#cf-save');
      var send = upload ? (isPic(c.icon) && !isNew ? c.icon : (isPic(icon) ? 'box' : icon)) : (isPic(icon) ? own(icon) : icon);
      App.run(btn, 'admin.category.save', { id: isNew ? '' : c.id, name: n, icon: send, code: isNew ? s.el.querySelector('#cf-c').value : '' }).then(function (r) {
        if (!r) return;
        var id = r.category.id;
        (upload ? App.run(btn, 'admin.category.icon', { id: id, photo: upload, orig: !tint }) : Promise.resolve(true)).then(function (ok) {
          s.close(); done();
          if (upload && !ok) UI.toast('Category saved, but the picture did not upload. Try again from ✏️.', true);
          if (!isNew) { UI.toast('Saved'); return; }
          UI.ask({ title: n + ' is ready', message: 'Move existing items into it now? You can tick gear from any category.', ok: 'Move items in', back: 'Not now' }).then(function (go) { if (go) App.go('a-cat-move/' + id); else UI.toast('Category added'); });
        });
      });
    });
  }

  // =================== MOVE ITEMS INTO A CATEGORY ===================
  var mvState = {};
  V['a-cat-move'] = function (main, catId) {
    return itemsCache().then(function (d) {
      var target = d.categories.filter(function (c) { return c.id === catId && c.status !== 'archived'; })[0];
      if (!target) { main.innerHTML = backHead('Category not found', '', 'a-cats'); return; }
      var others = d.categories.filter(function (c) { return c.status !== 'archived' && c.id !== catId; });
      var names = {}; d.categories.forEach(function (c) { names[c.id] = c.name; });
      var items = d.items.filter(function (i) { return i.status !== 'archived'; });
      var here = items.filter(function (i) { return i.category_id === catId; }).length;
      var st = mvState[catId] || (mvState[catId] = { picked: {}, cat: 'all', q: '' });
      function shown() {
        var q = st.q.toLowerCase();
        return items.filter(function (i) {
          if (i.category_id === catId) return false;
          if (q) return (i.name + ' ' + i.code).toLowerCase().indexOf(q) >= 0;
          if (st.cat === 'picked') return !!st.picked[i.id];
          return st.cat === 'all' || i.category_id === st.cat;
        });
      }
      function n() { return Object.keys(st.picked).length; }
      function drawList() {
        var list = shown(), allOn = list.length && list.every(function (i) { return st.picked[i.id]; });
        main.querySelector('#mv-tools').innerHTML = '<span class="small muted">' + list.length + ' shown</span>' + (list.length ? '<button type="button" class="btn sm ghost" data-act="mv-all">' + I(allOn ? 'x' : 'check') + (allOn ? 'Untick all shown' : 'Tick all shown') + '</button>' : '');
        main.querySelector('#mv-list').innerHTML = list.length ? list.map(function (i) {
          var on = !!st.picked[i.id];
          return '<label class="li pe-row' + (on ? ' on' : '') + '"><span class="pe-tick"><input type="checkbox" class="check" data-mv="' + E(i.id) + '"' + (on ? ' checked' : '') + ' aria-label="' + E(i.name) + '">' +
            '<span class="thumb sm">' + UI.thumb(i.photo, ic(i.category_id)) + '</span><span class="li-main"><span class="li-title">' + E(i.name) + '</span><span class="li-sub"><span class="tape">' + E(i.code) + '</span> · now in ' + E(names[i.category_id] || i.category_id) + '</span></span></span></label>';
        }).join('') : '<div class="li muted small">' + (st.cat === 'picked' ? 'Nothing ticked yet.' : 'No gear matches.') + '</div>';
        main.querySelectorAll('#mv-chips .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(!st.q && c.getAttribute('data-id') === st.cat)); });
      }
      function drawBar() {
        var k = n();
        main.querySelector('#mv-n').textContent = k + ' item' + (k === 1 ? '' : 's');
        main.querySelector('#mv-chips [data-id="picked"]').innerHTML = I('check') + 'Ticked · ' + k;
      }
      main.innerHTML = backHead('Move items into ' + target.name, here + ' already in ' + E(target.name) + '. Item codes stay the same.', 'a-cats') +
        '<div class="stack"><div class="pick-bar" style="margin:0"><label class="search">' + I('search') + '<input class="input" id="mv-q" type="search" placeholder="Search gear name or code" value="' + E(st.q) + '"></label>' +
        '<div class="chips" id="mv-chips"><button type="button" class="chip" data-act="mv-cat" data-id="picked">' + I('check') + 'Ticked · 0</button><button type="button" class="chip" data-act="mv-cat" data-id="all">All</button>' +
        others.map(function (c) { return '<button type="button" class="chip" data-act="mv-cat" data-id="' + E(c.id) + '">' + I(c.icon || 'box') + E(c.name) + '</button>'; }).join('') + '</div></div>' +
        '<div class="row between" id="mv-tools"></div><div class="list" id="mv-list"></div></div>' +
        '<div class="cartbar"><div class="bar2"><button class="btn ghost" data-act="mv-cancel">Cancel</button><button class="btn primary" data-act="mv-go"><span>Move to ' + E(target.name) + '</span><span class="cart-count" id="mv-n"></span></button></div></div>';
      main.classList.add('has-cart');
      drawList(); drawBar();
      var qi = main.querySelector('#mv-q');
      qi.addEventListener('input', UI.debounce(function () { st.q = qi.value.trim(); drawList(); }, 150));
      if (main._mvChange) main.removeEventListener('change', main._mvChange);
      main.addEventListener('change', main._mvChange = function (e) {
        var id = e.target.getAttribute('data-mv'); if (!id) return;
        if (e.target.checked) st.picked[id] = 1; else delete st.picked[id];
        e.target.closest('.pe-row').classList.toggle('on', e.target.checked);
        drawBar();
      });
      function leave() { delete mvState[catId]; App.go('a-items'); }
      main.querySelector('.icon-btn[data-act="go"]').setAttribute('data-act', 'mv-cancel'); // back arrow = cancel too
      App.acts = {
        'mv-cancel': function () {
          if (!n()) return leave();
          UI.ask({ title: 'Cancel moving?', message: 'Nothing is moved. Your ' + n() + ' ticked item' + (n() > 1 ? 's stay where they are.' : ' stays where it is.'), ok: 'Yes, cancel', back: 'Keep ticking' }).then(function (ok) { if (ok) leave(); });
        },
        'mv-cat': function (el) { st.cat = el.getAttribute('data-id'); st.q = ''; qi.value = ''; drawList(); },
        'mv-all': function () {
          var list = shown(), allOn = list.every(function (i) { return st.picked[i.id]; });
          list.forEach(function (i) { if (allOn) delete st.picked[i.id]; else st.picked[i.id] = 1; });
          drawList(); drawBar();
        },
        'mv-go': function (el) {
          var ids = Object.keys(st.picked);
          if (!ids.length) { UI.toast('Tick the items to move.', true); return; }
          App.run(el, 'admin.items.move', { ids: ids, category_id: catId }).then(function (r) {
            if (!r) return;
            delete mvState[catId];
            UI.toast(r.moved + ' item' + (r.moved > 1 ? 's' : '') + ' moved to ' + r.category.name);
            iFilter = catId; App.go('a-items');
          });
        }
      };
    });
  };

  // =================== SETTINGS ===================
  V['a-settings'] = function (main) {
    var LABEL = {
      APP_NAME: 'App name', ORG_NAME: 'Team / unit name', ANNOUNCEMENT: 'Dashboard announcement', DONE_TITLE: 'After checkout · heading', DONE_MESSAGE: 'After checkout · message',
      PENDING_MESSAGE: 'After checkout · message when approval is on', RETURN_MESSAGE: 'After return request · message', REQUIRE_CHECKOUT_APPROVAL: 'Admin approves every checkout',
      AUTO_APPROVE_USERS: 'Let anyone with Google sign in without approval', REQUIRE_PURPOSE: 'Tugasan is required at checkout', SESSION_DAYS: 'Days a phone stays signed in',
      EMAIL_USER_TAKE: 'Email the person when they take gear', EMAIL_USER_RETURN: 'Email the person when their return is checked',
      EMAIL_ADMIN_TAKE: 'Email admins when someone takes gear', EMAIL_ADMIN_RETURN: 'Email admins when someone returns gear', ADMIN_EMAILS: 'Admins who get emails'
    };
    var ORDER = ['DONE_TITLE', 'DONE_MESSAGE', 'PENDING_MESSAGE', 'RETURN_MESSAGE', 'ANNOUNCEMENT', 'REQUIRE_CHECKOUT_APPROVAL', 'REQUIRE_PURPOSE', 'AUTO_APPROVE_USERS',
      'EMAIL_USER_TAKE', 'EMAIL_USER_RETURN', 'EMAIL_ADMIN_TAKE', 'EMAIL_ADMIN_RETURN', 'ADMIN_EMAILS', 'APP_NAME', 'ORG_NAME', 'SESSION_DAYS'];
    var MAILK = /^(EMAIL_|ADMIN_EMAILS$)/;
    function draw(d) {
      var map = {}; d.settings.forEach(function (x) { map[x.key] = x; });
      var keys = ORDER.filter(function (k) { return map[k]; }).concat(d.settings.map(function (x) { return x.key; }).filter(function (k) { return ORDER.indexOf(k) < 0; }))
        .filter(function (k) { return d.mail || !MAILK.test(k); }); // email switches only once the backend can send email
      var field = function (k) {
        var x = map[k], lab = LABEL[k] || k;
        if (/^(REQUIRE_|AUTO_|EMAIL_)/.test(k)) return '<div class="card pad toggle"><div><b>' + E(lab) + '</b><div class="small muted">' + E(x.description) + '</div></div><span class="switch"><input type="checkbox" id="s-' + k + '" data-k="' + k + '"' + (/^(true|yes|1)$/i.test(x.value) ? ' checked' : '') + ' aria-label="' + E(lab) + '"><i></i></span></div>';
        var long = /MESSAGE|ANNOUNCEMENT/.test(k);
        return '<label class="field"><span>' + E(lab) + '</span>' + (long ? '<textarea class="input" id="s-' + k + '" data-k="' + k + '" maxlength="2000">' + E(x.value) + '</textarea>' : '<input class="input" id="s-' + k + '" data-k="' + k + '"' + (k === 'SESSION_DAYS' ? ' type="number" min="1" max="365"' : k === 'ADMIN_EMAILS' ? ' inputmode="email" placeholder="Empty = every admin"' : '') + ' value="' + E(x.value) + '">') + '<small>' + E(x.description) + '</small></label>';
      };
      main.innerHTML = backHead('Settings & messages', 'Saved to the App Settings sheet', 'a-more') +
        '<form class="stack" id="sf" novalidate>' +
        '<div class="group-h" style="margin-top:4px">' + I('note') + 'Messages</div>' +
        '<div class="ticket" id="prev" aria-live="polite"></div>' +
        keys.filter(function (k) { return /MESSAGE|TITLE|ANNOUNCEMENT/.test(k); }).map(field).join('') +
        '<div class="group-h">' + I('sliders') + 'Rules</div>' + keys.filter(function (k) { return /^(REQUIRE_|AUTO_)/.test(k); }).map(field).join('') +
        (d.mail ? '<div class="group-h">' + I('note') + 'Email notifications</div>' + keys.filter(function (k) { return MAILK.test(k); }).map(field).join('') +
        '<p class="small muted" style="margin:-4px 2px 0">Emails come from the Google account that owns the backend. A free Gmail account can send to about 100 people a day.</p>' : '') +
        '<div class="group-h">' + I('info') + 'App</div>' + keys.filter(function (k) { return !/MESSAGE|TITLE|ANNOUNCEMENT|^(REQUIRE_|AUTO_)/.test(k) && !MAILK.test(k); }).map(field).join('') +
        '<button class="btn primary block" type="submit" id="sf-save" style="min-height:52px;position:sticky;bottom:calc(var(--nav-h) + 12px + env(safe-area-inset-bottom, 0px))">Save settings</button></form>';
      function preview() {
        var fill = function (t) { return String(t).replace(/\{name\}/g, App.user.name.split(' ')[0]).replace(/\{order\}/g, 'ORD-' + UI.todayStr().replace(/-/g, '').slice(2) + '-001').replace(/\{items\}/g, 'Sony A7IV, Wireless Rode #1'); };
        document.getElementById('prev').innerHTML = '<div class="eyebrow" style="margin-bottom:8px">Preview · what users see after checkout</div><b style="font:700 20px/1.1 var(--f-display);text-transform:uppercase">' + E(fill(document.getElementById('s-DONE_TITLE').value)) + '</b><p class="muted small" style="margin:6px 0 0">' + E(fill(document.getElementById('s-DONE_MESSAGE').value)) + '</p><p class="small muted" style="margin:8px 0 0">Use {name}, {order} and {items} anywhere in a message.</p>';
      }
      preview();
      ['s-DONE_TITLE', 's-DONE_MESSAGE'].forEach(function (id) { var x = document.getElementById(id); if (x) x.addEventListener('input', preview); });
      document.getElementById('sf').addEventListener('submit', function (e) {
        e.preventDefault();
        var vals = {};
        main.querySelectorAll('[data-k]').forEach(function (el) { vals[el.getAttribute('data-k')] = el.type === 'checkbox' ? (el.checked ? 'TRUE' : 'FALSE') : el.value; });
        App.run(document.getElementById('sf-save'), 'admin.settings.save', { values: vals }).then(function (r) { if (r) { App.settings = r.settings; UI.toast('Settings saved'); var b = document.querySelector('.brand-name'); if (b) b.textContent = r.settings.APP_NAME; } });
      });
    }
    return API.call('admin.settings').then(draw);
  };

  // =================== TEAM PRESETS (from the Items page) ===================
  function whoFor(p, names) {
    if (!p.users || !p.users.length) return 'Everyone';
    var n = p.users.map(function (e) { return names[e] || e.split('@')[0]; });
    return n.length > 3 ? n.slice(0, 3).join(', ') + ' +' + (n.length - 3) : n.join(', ');
  }
  function userNames(users) { var m = {}; (users || []).forEach(function (u) { m[u.email] = u.name; }); return m; }
  V['a-presets'] = function (main) {
    function draw(r) {
      var d = r[0], names = userNames(r[1].users);
      main.innerHTML = backHead('Team presets', 'Ready-made gear sets. They show in Gear → Presets.', 'a-items') +
        '<button class="btn primary block" data-act="go" data-to="a-preset/new" style="margin-bottom:14px">' + I('plus') + 'New preset</button>' +
        (d.team.length ? '<div class="stack">' + d.team.map(function (p) {
          return '<div class="preset"><div class="preset-h"><div class="grow" style="min-width:0"><div class="li-title">' + E(p.name) + '</div><div class="li-sub">' + p.items.length + ' item' + (p.items.length > 1 ? 's' : '') + ' · for <b>' + E(whoFor(p, names)) + '</b></div></div>' +
            '<button class="icon-btn" data-act="go" data-to="a-preset/' + E(p.id) + '" aria-label="Edit">' + I('edit') + '</button><button class="icon-btn" data-act="del" data-id="' + E(p.id) + '" aria-label="Delete">' + I('trash') + '</button></div>' +
            '<ul class="preset-items">' + p.items.map(function (x) { return '<li class="st-' + E(x.state || (x.ok ? 'free' : 'blocked')) + '"><span>' + E(x.name) + (x.qty > 1 ? ' ×' + x.qty : '') + '</span><span>' + (x.state === 'free' ? 'Free' : E(x.reason || 'Not available now')) + '</span></li>'; }).join('') + '</ul></div>';
        }).join('') + '</div>' : '<div class="card">' + UI.empty('star', 'No team presets yet', 'Make sets like "Event 2-camera kit" so the crew can add everything in one tap.') + '</div>');
      App.acts = {
        del: function (el) {
          var p = d.team.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
          UI.ask({ title: 'Delete "' + p.name + '"?', message: 'The crew loses this preset. No gear is affected.', ok: 'Delete', danger: true }).then(function (ok) { if (ok) App.run(null, 'preset.delete', { id: p.id }).then(function (r) { if (r) { UI.toast('Deleted'); load().then(draw); } }); });
        }
      };
    }
    function load() { return Promise.all([API.call('presets', { all: true }), API.call('admin.users')]); }
    return load().then(draw);
  };

  /* Preset editor: tick gear from the full list, choose who it is for. */
  var peState = {};
  V['a-preset'] = function (main, id) {
    id = id || 'new';
    return Promise.all([itemsCache(), API.call('admin.users'), id === 'new' ? null : API.call('presets', { all: true })]).then(function (r) {
      var items = r[0].items.filter(function (i) { return i.status !== 'archived'; });
      var cats = r[0].categories.filter(function (c) { return c.status !== 'archived'; });
      var people = r[1].users.filter(function (u) { return u.status === 'active'; });
      var p = id === 'new' ? null : r[2].team.filter(function (x) { return x.id === id; })[0];
      if (id !== 'new' && !p) { main.innerHTML = backHead('Preset not found', '', 'a-presets'); return; }
      var st = peState[id];
      if (!st) {
        st = peState[id] = { name: p ? p.name : '', picked: {}, everyone: !(p && p.users.length), users: {}, cat: 'all', q: '' };
        if (p) { p.items.forEach(function (x) { if (!x.missing) st.picked[x.item_id] = x.qty; }); p.users.forEach(function (e) { st.users[e] = 1; }); }
      }
      var byId = {}; items.forEach(function (i) { byId[i.id] = i; });

      function shown() {
        var q = st.q.toLowerCase();
        return items.filter(function (i) {
          if (q) return (i.name + ' ' + i.code).toLowerCase().indexOf(q) >= 0;
          if (st.cat === 'picked') return !!st.picked[i.id];
          return st.cat === 'all' || i.category_id === st.cat;
        });
      }
      function count() { return Object.keys(st.picked).length; }
      function rowHtml(i) {
        var on = !!st.picked[i.id];
        var where = i.holders.length ? 'With ' + i.holders.join(', ') : i.qty > 1 ? i.available + ' of ' + i.qty + ' free' : i.available ? 'In the store' : i.condition;
        return '<div class="li pe-row' + (on ? ' on' : '') + '" data-row="' + E(i.id) + '"><label class="pe-tick"><input type="checkbox" class="check" data-pi="' + E(i.id) + '"' + (on ? ' checked' : '') + ' aria-label="' + E(i.name) + '">' +
          '<div class="thumb sm">' + UI.thumb(i.photo, ic(i.category_id)) + '</div><span class="li-main"><span class="li-title">' + E(i.name) + '</span><span class="li-sub"><span class="tape">' + E(i.code) + '</span> · ' + E(where) + '</span></span></label>' +
          (i.qty > 1 ? '<div class="stepper sm pe-qty"' + (on ? '' : ' hidden') + '><button type="button" data-act="pe-dec" data-id="' + E(i.id) + '" aria-label="Less">' + I('minus') + '</button><b>' + (st.picked[i.id] || 1) + '</b><button type="button" data-act="pe-inc" data-id="' + E(i.id) + '" aria-label="More">' + I('plus') + '</button></div>' : '') + '</div>';
      }
      function drawList() {
        var list = shown();
        var allOn = list.length && list.every(function (i) { return st.picked[i.id]; });
        main.querySelector('#pe-tools').innerHTML = '<span class="small muted">' + list.length + ' shown</span><button type="button" class="btn sm ghost" data-act="pe-all">' + I(allOn ? 'x' : 'check') + (allOn ? 'Untick all shown' : 'Tick all shown') + '</button>';
        main.querySelector('#pe-list').innerHTML = list.length ? list.map(rowHtml).join('') : '<div class="li muted small">' + (st.cat === 'picked' ? 'Nothing ticked yet.' : 'No gear matches.') + '</div>';
        main.querySelectorAll('#pe-chips .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(!st.q && c.getAttribute('data-id') === st.cat)); });
      }
      function drawBar() {
        var n = count();
        main.querySelector('#pe-n').textContent = n + ' item' + (n === 1 ? '' : 's');
        var pc = main.querySelector('#pe-chips [data-id="picked"]'); if (pc) pc.innerHTML = I('check') + 'Ticked · ' + n;
      }
      function drawWho() {
        var box = main.querySelector('#pe-people');
        box.hidden = st.everyone;
        var all = people.length && people.every(function (u) { return st.users[u.email]; });
        box.innerHTML = '<div class="row between" style="margin-bottom:8px"><span class="small muted">' + Object.keys(st.users).filter(function (e) { return people.some(function (u) { return u.email === e; }); }).length + ' of ' + people.length + ' chosen</span>' +
          '<button type="button" class="btn sm ghost" data-act="pe-users-all">' + (all ? 'Clear' : 'Choose all') + '</button></div>' +
          '<div class="chips wrap">' + people.map(function (u) {
            return '<label class="chip pe-user"><input type="checkbox" data-pu="' + E(u.email) + '"' + (st.users[u.email] ? ' checked' : '') + '><span>' + E(u.name) + '</span></label>';
          }).join('') + '</div>';
      }

      main.innerHTML = backHead(p ? 'Edit team preset' : 'New team preset', 'Tick the gear, then choose who can use it.', 'a-presets') +
        '<div class="stack">' +
        '<label class="field"><span>Preset name</span><input class="input" id="pe-name" maxlength="60" value="' + E(st.name) + '" placeholder="e.g. Event 2-camera kit"></label>' +
        '<div class="card pad stack-sm"><div class="row between"><div><b>For all users</b><div class="small muted">Off = only the people you choose see it</div></div>' +
        '<label class="switch"><input type="checkbox" id="pe-everyone"' + (st.everyone ? ' checked' : '') + ' aria-label="For all users"><i></i></label></div><div id="pe-people"' + (st.everyone ? ' hidden' : '') + '></div></div>' +
        '<div class="field"><span>Gear</span><div class="pick-bar" style="margin:0"><label class="search">' + I('search') + '<input class="input" id="pe-q" type="search" placeholder="Search gear name or code" value="' + E(st.q) + '"></label>' +
        '<div class="chips" id="pe-chips"><button type="button" class="chip" data-act="pe-cat" data-id="picked">' + I('check') + 'Ticked · ' + count() + '</button><button type="button" class="chip" data-act="pe-cat" data-id="all">All</button>' +
        cats.map(function (c) { return '<button type="button" class="chip" data-act="pe-cat" data-id="' + E(c.id) + '">' + I(c.icon || 'box') + E(c.name) + '</button>'; }).join('') + '</div></div></div>' +
        '<div class="row between" id="pe-tools"></div><div class="list" id="pe-list"></div>' +
        (p ? '<button class="btn ghost block" data-act="pe-del" style="color:var(--bad)">' + I('trash') + 'Delete this preset</button>' : '') +
        '</div><div class="cartbar"><div class="bar2"><button class="btn ghost" data-act="pe-cancel">Cancel</button><button class="btn primary" data-act="pe-save"><span>Save preset</span><span class="cart-count" id="pe-n"></span></button></div></div>';
      main.classList.add('has-cart');
      drawList(); drawBar(); drawWho();

      main.querySelector('#pe-name').addEventListener('input', function (e) { st.name = e.target.value; });
      main.querySelector('#pe-everyone').addEventListener('change', function (e) { st.everyone = e.target.checked; drawWho(); });
      var qi = main.querySelector('#pe-q');
      qi.addEventListener('input', UI.debounce(function () { st.q = qi.value.trim(); drawList(); }, 150));
      if (main._peChange) main.removeEventListener('change', main._peChange); // redraws reuse the same page element
      main.addEventListener('change', main._peChange = function (e) {
        var t = e.target, pid = t.getAttribute('data-pi'), pu = t.getAttribute('data-pu');
        if (pid) {
          if (t.checked) st.picked[pid] = st.picked[pid] || 1; else delete st.picked[pid];
          var row = t.closest('.pe-row'); row.classList.toggle('on', t.checked);
          var q = row.querySelector('.pe-qty'); if (q) { q.hidden = !t.checked; q.querySelector('b').textContent = st.picked[pid] || 1; }
          drawBar();
        }
        if (pu) { if (t.checked) st.users[pu] = 1; else delete st.users[pu]; drawWho(); }
      });
      function step(el, d) {
        var iid = el.getAttribute('data-id'), it = byId[iid];
        st.picked[iid] = Math.max(1, Math.min(it ? it.qty : 99, (st.picked[iid] || 1) + d));
        el.closest('.pe-qty').querySelector('b').textContent = st.picked[iid];
      }
      main.querySelector('.icon-btn[data-act="go"]').setAttribute('data-act', 'pe-cancel');
      App.acts = {
        'pe-cancel': function () {
          var changed = st.name.trim() !== (p ? p.name : '') || Object.keys(st.picked).length !== (p ? p.items.filter(function (x) { return !x.missing; }).length : 0) || (p ? !p.users.length : true) !== st.everyone;
          var leave = function () { delete peState[id]; App.go('a-presets'); };
          if (!changed) return leave();
          UI.ask({ title: 'Discard changes?', message: p ? 'The preset stays as it was.' : 'This preset is not saved.', ok: 'Discard', back: 'Keep editing', danger: true }).then(function (ok) { if (ok) leave(); });
        },
        'pe-cat': function (el) { st.cat = el.getAttribute('data-id'); st.q = ''; qi.value = ''; drawList(); },
        'pe-all': function () {
          var list = shown(), allOn = list.every(function (i) { return st.picked[i.id]; });
          list.forEach(function (i) { if (allOn) delete st.picked[i.id]; else st.picked[i.id] = st.picked[i.id] || 1; });
          drawList(); drawBar();
        },
        'pe-users-all': function () {
          var all = people.every(function (u) { return st.users[u.email]; });
          st.users = {}; if (!all) people.forEach(function (u) { st.users[u.email] = 1; });
          drawWho();
        },
        'pe-inc': function (el) { step(el, 1); },
        'pe-dec': function (el) { step(el, -1); },
        'pe-del': function () {
          UI.ask({ title: 'Delete "' + p.name + '"?', message: 'The crew loses this preset. No gear is affected.', ok: 'Delete', danger: true }).then(function (ok) {
            if (ok) App.run(null, 'preset.delete', { id: p.id }).then(function (res) { if (res) { delete peState[id]; UI.toast('Deleted'); App.go('a-presets'); } });
          });
        },
        'pe-save': function (el) {
          var name = st.name.trim(), ids = Object.keys(st.picked);
          var users = Object.keys(st.users).filter(function (e) { return people.some(function (u) { return u.email === e; }); });
          if (!name) { UI.toast('Give the preset a name.', true); main.querySelector('#pe-name').focus(); return; }
          if (!ids.length) { UI.toast('Tick at least one item.', true); return; }
          if (!st.everyone && !users.length) { UI.toast('Choose at least one person, or turn on "For all users".', true); return; }
          App.run(el, 'preset.save', { id: p ? p.id : '', name: name, scope: 'team', items: ids.map(function (k) { return { item_id: k, qty: st.picked[k] }; }), users: st.everyone ? [] : users }).then(function (res) {
            if (res) { delete peState[id]; UI.toast('Preset saved' + (st.everyone ? ' for everyone' : ' for ' + users.length + ' ' + (users.length > 1 ? 'people' : 'person'))); App.go('a-presets'); }
          });
        }
      };
    });
  };

  // =================== ACTIVITY LOG ===================
  var logKind = 'all';
  V['a-log'] = function (main) {
    return Promise.all([API.call('admin.log', { limit: 300 }), API.call('admin.users').then(function (u) { setWho(u.users); }, function () {}), itemsCache().then(function (d) { setCodes(d.items); }, function () {})]).then(function (r) {
      var all = r[0].log;
      function draw() {
        var list = all.filter(function (a) { var k = friendly(a).kind; return logKind === 'all' ? k !== 'login' : logKind === 'people' ? (k === 'people' || k === 'login') : k === logKind; });
        var chip = function (id, label) { return '<button class="chip" data-act="lk" data-id="' + id + '" aria-pressed="' + (logKind === id) + '">' + label + '</button>'; };
        var html = '', day = '';
        list.forEach(function (a) {
          var dd = String(a.date).slice(0, 10);
          if (dd !== day) { if (day) html += '</div>'; day = dd; html += '<div class="group-h">' + E(dayLabel(dd)) + '</div><div class="list">'; }
          html += actRow(a);
        });
        if (day) html += '</div>';
        main.innerHTML = backHead('Activity log', 'What happened, newest first', 'a-more') +
          '<div class="chips" style="margin-bottom:4px">' + chip('all', 'All') + chip('out', KIND.out) + chip('hand', KIND.hand) + chip('item', KIND.item) + chip('people', KIND.people) + '</div>' +
          (html || '<div class="card" style="margin-top:12px">' + UI.empty('list', 'Nothing here yet', '') + '</div>');
        App.acts = { lk: function (el) { logKind = el.getAttribute('data-id'); draw(); } };
      }
      draw();
    });
  };
  function dayLabel(d) {
    var t = UI.todayStr(), y = UI.todayStr(-1);
    if (d === t) return 'Today';
    if (d === y) return 'Yesterday';
    var dt = new Date(d + 'T00:00:00');
    return isNaN(dt) ? d : dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: dt.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }

  if (App.mode === 'admin') setTimeout(function () { if (App.user) refreshBadge(); }, 1500);
})();
