/**
 * MEDIA GEAR — shared business logic
 * ------------------------------------------------------------
 * This exact file runs in two places:
 *   1. Google Apps Script backend (saved there as Logic.gs)
 *   2. The phone app's demo mode (app/logic.js)
 * It never touches Sheets or Drive directly. It talks to an `io`
 * object: io.db (tables) and io.env (time, ids, photos, Google check).
 */
var Logic = (function () {
  'use strict';

  // ---------- table schema (column order = sheet column order) ----------
  var SCHEMA = {
    Users: ['email', 'name', 'photo', 'role', 'status', 'phone', 'note', 'created_at', 'last_login'],
    Sessions: ['token', 'email', 'created_at', 'expires_at', 'app'],
    Categories: ['id', 'name', 'icon', 'sort', 'status'],
    Items: ['id', 'code', 'name', 'category_id', 'qty', 'condition', 'status', 'serial_no', 'last_service', 'remark', 'photo', 'created_at', 'updated_at', 'issue'],
    ItemLog: ['id', 'item_id', 'date', 'type', 'detail', 'by', 'photo', 'order_id'],
    Orders: ['id', 'email', 'name', 'purpose', 'location', 'expected_return', 'status', 'created_at', 'photo_out', 'approved_by', 'approved_at', 'admin_note', 'updated_at'],
    OrderLines: ['id', 'order_id', 'item_id', 'item_name', 'category_id', 'qty', 'status', 'out_at', 'return_requested_at', 'return_note', 'return_photo', 'returned_at', 'return_condition', 'return_remark', 'approved_by'],
    Settings: ['key', 'value', 'description'],
    Log: ['date', 'email', 'action', 'detail'],
    Presets: ['id', 'name', 'scope', 'owner_email', 'owner_name', 'items', 'status', 'created_at', 'updated_at', 'users'],
    PhotoLinks: ['item_id', 'code', 'name', 'image_url', 'search', 'source', 'updated_at'],
    Handovers: ['id', 'item_id', 'item_name', 'qty', 'from_line_id', 'from_order_id', 'from_email', 'from_name', 'to_email', 'to_name', 'purpose', 'expected_return', 'note', 'status', 'created_at', 'decided_at', 'decided_by', 'new_order_id', 'to_order_id']
  };
  var KEY = { Users: 'email', Sessions: 'token', Categories: 'id', Items: 'id', ItemLog: 'id', Orders: 'id', OrderLines: 'id', Settings: 'key', Log: 'date', Presets: 'id', PhotoLinks: 'item_id', Handovers: 'id' };

  var CONDITIONS = ['Good', 'Fair', 'Incomplete', 'Damaged', 'Under Repair', 'Lost'];
  var ATTENTION = ['Incomplete', 'Damaged', 'Under Repair', 'Lost'];
  var UNAVAILABLE_CONDITIONS = ['Under Repair', 'Lost'];
  var HELD = ['PENDING', 'OUT', 'RETURN_REQUESTED']; // line statuses that keep an item busy
  var LOG_TYPES = ['note', 'damage', 'service', 'repair'];

  var DEFAULT_SETTINGS = [
    ['APP_NAME', 'Media Gear', 'App name shown on the login screen and header.'],
    ['ORG_NAME', 'UmmahPrima Network', 'Organisation name shown under the app name at the top of every screen.'],
    ['ANNOUNCEMENT', '', 'Optional notice shown at the top of everyone\'s dashboard. Leave empty to hide.'],
    ['DONE_TITLE', 'All set, {name}!', 'Heading on the screen after checkout. {name} and {order} are replaced automatically.'],
    ['DONE_MESSAGE', 'Order {order} is recorded. Handle the gear with care and return it by the date you set.', 'Message shown after checkout. {name}, {order} and {items} are replaced automatically.'],
    ['PENDING_MESSAGE', 'Request {order} is sent. Wait for an admin to approve it before taking the gear.', 'Message after checkout when checkout approval is ON.'],
    ['RETURN_MESSAGE', 'Return request sent. The items stay on the dashboard until an admin checks and approves the return.', 'Message after a user requests a return.'],
    ['REQUIRE_CHECKOUT_APPROVAL', 'FALSE', 'TRUE = admin must approve before items are taken out. FALSE = checkout is instant.'],
    ['AUTO_APPROVE_USERS', 'FALSE', 'TRUE = anyone who signs in with Google can use the app. FALSE = new users wait for admin approval.'],
    ['REQUIRE_PURPOSE', 'TRUE', 'TRUE = users must fill in the task (Tugasan) at checkout.'],
    ['SESSION_DAYS', '30', 'How many days a phone stays signed in.']
  ];

  // Seed list — from "Borang Keluar-Masuk Barang" (Cetakan Versi ke-3, 21 July 2023)
  var SEED = [
    ['CAM', 'Camera', 'camera', ['Sony A7IV', 'Sony A7III', 'Sony A6400', 'Sony A6100', 'Panasonic Camcorder', 'Panasonic HC-V385', 'Canon EOS 650D', 'GoPro 10', 'GoPro 9', 'Insta360', 'DJI Drone']],
    ['LNS', 'Lenses', 'lens', ['Sony 24mm FE 1.4', 'Sony 85mm FE 1.4', 'Samyang 85mm FE 1.4', 'Sony 18mm FE 2.8', 'Sony 16-35mm FE 2.8', 'Sony 24-70mm FE 2.8', 'Sony 18-105mm FE 2.8', 'Sony 70-200mm FE 2.8', 'Sony 15-50mm FE 3.5', 'Tamron 28-75mm FE 2.8', 'Canon 18-200mm', 'Canon 18-135mm', 'Canon 50mm']],
    ['TRP', 'Tripod & Support', 'tripod', ['Benro Tripod', 'C-Stand', 'Slider 80cm', 'Joby Spider Pod', 'Orange Gorilla Pod', 'Manfrotto Monopod', 'Velbon Quick Release Plate', 'E-Image Quick Release Plate']],
    ['ACC', 'Accessories', 'gimbal', ['Gimbal Ronin RS2', 'Gimbal Zhiyun Weebill S', 'Gimbal Zhiyun Mini', 'Capture Card', 'Cable HDMI-HDMI', 'Cable HDMI-Mini HDMI', 'Cable HDMI-Micro HDMI', 'Greenscreen', 'Puluz Photo Light Box', 'Andoer Teleprompter', 'ND Filter 77mm JJC', 'ND Filter 67mm JJC', 'ND Filter 82mm JJC']],
    ['PWR', 'Charger & Battery', 'battery', ['Battery A7', 'Battery A6', 'Battery GoPro', 'Battery Canon', 'Battery NP-F970', 'Battery AG-VBR59', 'Battery AA', 'Charger A7', 'Charger A6', 'Charger GoPro', 'Charger Canon', 'Charger NP-F970', 'Charger Panasonic AG-VBR59']],
    ['LGT', 'Lighting', 'light', ['Godox VL300', 'Godox SL60W', 'Godox LED500W', 'Godox TT685 Flash', 'Nanlite Forza 300B', 'Nanlite Forza 60B', 'Nanlite PavoTube', 'Aputure Amaran F7', 'Cross Mini Lighting', 'Head Godox P120G', 'Reflector Godox', 'Reflector Caler', 'Light Stand']],
    ['AUD', 'Audio', 'mic', ['Rode Mic Pro', 'Rode Mic Go #1', 'Rode Mic Go #2', 'Wireless Rode #1', 'Wireless Rode #2', 'Boya Mic #1', 'Boya Mic #2', 'Zoom H1 #1', 'Zoom H1 #2', 'Zoom H8 #1', 'Zoom H8 #2', 'Sennheiser Set #1', 'Sennheiser Set #2', 'Comica Set Old #1', 'Comica Set Old #2', 'Comica Set New #1', 'Comica Set New #2', 'Mic Stand #1', 'Mic Stand #2', 'DJI Mic']],
    ['BAG', 'Bag & Case', 'bag', ['Pelican Hardcase', 'Smriti Hardcase', 'Big Blue Bag', 'Small Blue Bag']],
    ['MEM', 'Memory Card', 'card', ['Memory Card 64GB', 'Memory Card 32GB', 'Memory Card 16GB']]
  ];

  // Search words used to find a reference photo for each item (specific | fallback).
  var PHOTO_SEARCH = {
    'Sony A7IV': 'Sony Alpha 7 IV | mirrorless camera', 'Sony A7III': 'Sony Alpha 7 III | mirrorless camera', 'Sony A6400': 'Sony Alpha 6400 | mirrorless camera',
    'Sony A6100': 'Sony Alpha 6100 | mirrorless camera', 'Panasonic Camcorder': 'Panasonic camcorder | camcorder', 'Panasonic HC-V385': 'Panasonic HC-V camcorder | camcorder',
    'Canon EOS 650D': 'Canon EOS 650D | DSLR camera', 'GoPro 10': 'GoPro HERO10 | GoPro camera', 'GoPro 9': 'GoPro HERO9 | GoPro camera', 'Insta360': 'Insta360 | 360 degree camera',
    'DJI Drone': 'DJI Mavic | quadcopter drone',
    'Sony 24mm FE 1.4': 'Sony FE 24mm F1.4 GM | camera lens', 'Sony 85mm FE 1.4': 'Sony FE 85mm F1.4 GM | camera lens', 'Samyang 85mm FE 1.4': 'Samyang 85mm F1.4 | camera lens',
    'Sony 18mm FE 2.8': 'Sony E lens | camera lens', 'Sony 16-35mm FE 2.8': 'Sony FE 16-35mm F2.8 GM | zoom lens', 'Sony 24-70mm FE 2.8': 'Sony FE 24-70mm F2.8 GM | zoom lens',
    'Sony 18-105mm FE 2.8': 'Sony E PZ 18-105mm | zoom lens', 'Sony 70-200mm FE 2.8': 'Sony FE 70-200mm F2.8 GM | telephoto lens', 'Sony 15-50mm FE 3.5': 'Sony E 16-50mm | zoom lens',
    'Tamron 28-75mm FE 2.8': 'Tamron 28-75mm F2.8 | zoom lens', 'Canon 18-200mm': 'Canon EF-S 18-200mm | zoom lens', 'Canon 18-135mm': 'Canon EF-S 18-135mm | zoom lens', 'Canon 50mm': 'Canon EF 50mm f/1.8 | camera lens',
    'Benro Tripod': 'Benro tripod | camera tripod', 'C-Stand': 'C-stand | light stand', 'Slider 80cm': 'camera slider | camera dolly', 'Joby Spider Pod': 'Joby GorillaPod | flexible tripod',
    'Orange Gorilla Pod': 'GorillaPod | flexible tripod', 'Manfrotto Monopod': 'Manfrotto monopod | monopod', 'Velbon Quick Release Plate': 'tripod quick release plate | tripod head',
    'E-Image Quick Release Plate': 'tripod quick release plate | tripod head',
    'Gimbal Ronin RS2': 'DJI RS 2 gimbal | camera gimbal', 'Gimbal Zhiyun Weebill S': 'Zhiyun Weebill | camera gimbal', 'Gimbal Zhiyun Mini': 'Zhiyun Smooth gimbal | smartphone gimbal',
    'Capture Card': 'HDMI capture card | video capture card', 'Cable HDMI-HDMI': 'HDMI cable', 'Cable HDMI-Mini HDMI': 'Mini HDMI cable | HDMI cable', 'Cable HDMI-Micro HDMI': 'Micro HDMI cable | HDMI cable',
    'Greenscreen': 'green screen chroma key | chroma key', 'Puluz Photo Light Box': 'photo light box | light tent photography', 'Andoer Teleprompter': 'teleprompter',
    'ND Filter 77mm JJC': 'ND filter | neutral density filter', 'ND Filter 67mm JJC': 'ND filter | neutral density filter', 'ND Filter 82mm JJC': 'ND filter | neutral density filter',
    'Battery A7': 'Sony NP-FZ100 | camera battery', 'Battery A6': 'Sony NP-FW50 | camera battery', 'Battery GoPro': 'GoPro battery | lithium-ion battery', 'Battery Canon': 'Canon LP-E8 | camera battery',
    'Battery NP-F970': 'Sony NP-F970 | camera battery', 'Battery AG-VBR59': 'Panasonic VBR59 battery | camcorder battery', 'Battery AA': 'AA battery',
    'Charger A7': 'Sony battery charger | battery charger', 'Charger A6': 'Sony battery charger | battery charger', 'Charger GoPro': 'GoPro charger | battery charger',
    'Charger Canon': 'Canon battery charger | battery charger', 'Charger NP-F970': 'NP-F battery charger | battery charger', 'Charger Panasonic AG-VBR59': 'Panasonic battery charger | battery charger',
    'Godox VL300': 'Godox VL300 | LED video light', 'Godox SL60W': 'Godox SL60W | LED video light', 'Godox LED500W': 'Godox LED500 | LED panel light', 'Godox TT685 Flash': 'Godox TT685 | camera flash',
    'Nanlite Forza 300B': 'Nanlite Forza 300 | LED video light', 'Nanlite Forza 60B': 'Nanlite Forza 60 | LED video light', 'Nanlite PavoTube': 'Nanlite PavoTube | LED tube light',
    'Aputure Amaran F7': 'Aputure Amaran | LED video light', 'Cross Mini Lighting': 'mini LED light | LED light', 'Head Godox P120G': 'Godox parabolic softbox | softbox',
    'Reflector Godox': 'photography reflector | reflector photography', 'Reflector Caler': 'photography reflector | reflector photography', 'Light Stand': 'light stand',
    'Rode Mic Pro': 'Rode VideoMic Pro | shotgun microphone', 'Rode Mic Go': 'Rode VideoMic GO | shotgun microphone', 'Wireless Rode': 'Rode Wireless GO | wireless microphone',
    'Boya Mic': 'Boya microphone | lavalier microphone', 'Zoom H1': 'Zoom H1 recorder | audio recorder', 'Zoom H8': 'Zoom H8 recorder | audio recorder',
    'Sennheiser Set': 'Sennheiser wireless microphone | wireless microphone', 'Comica Set Old': 'Comica microphone | wireless microphone', 'Comica Set New': 'Comica microphone | wireless microphone',
    'Mic Stand': 'microphone stand', 'DJI Mic': 'DJI Mic | wireless microphone',
    'Pelican Hardcase': 'Pelican case | hard case', 'Smriti Hardcase': 'camera hard case | equipment case', 'Big Blue Bag': 'camera bag', 'Small Blue Bag': 'camera bag',
    'Memory Card 64GB': 'SD card | memory card', 'Memory Card 32GB': 'SD card | memory card', 'Memory Card 16GB': 'SD card | memory card'
  };
  function photoSearchFor(name) { var base = String(name || '').replace(/\s*#\d+$/, '').trim(); return PHOTO_SEARCH[base] || base; }

  // ---------- small helpers ----------
  function S(v) { return v === null || v === undefined ? '' : String(v); }
  function N(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
  function bool(v) { v = S(v).trim().toUpperCase(); return v === 'TRUE' || v === 'YES' || v === '1' || v === 'Y'; }
  function lower(v) { return S(v).trim().toLowerCase(); }
  function fail(msg, code) { var e = new Error(msg); e.code = code || 'BAD_REQUEST'; e.isApp = true; throw e; }
  function pick(o, keys) { var r = {}; keys.forEach(function (k) { r[k] = o[k]; }); return r; }
  function by(field) { return function (a, b) { return S(a[field]) < S(b[field]) ? -1 : S(a[field]) > S(b[field]) ? 1 : 0; }; }
  function desc(field) { var f = by(field); return function (a, b) { return -f(a, b); }; }
  function fill(tpl, vars) { return S(tpl).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; }); }
  function clip(v, n) { v = S(v).trim(); return v.length > n ? v.slice(0, n) : v; }

  function Ctx(io, token) {
    this.io = io; this.db = io.db; this.env = io.env; this.token = token;
    this.nowDate = io.env.now();
    this.now = io.env.fmt(this.nowDate);
    this.today = this.now.slice(0, 10);
    this.user = null;
    this.reads = {}; this.changed = {}; // which tables this action looked at / changed (lets the phone refresh only what is affected)
  }
  Ctx.prototype.all = function (t) { this.reads[t] = 1; return this.db.all(t); };
  Ctx.prototype.ins = function (t, o) { this.changed[t] = 1; var row = {}; SCHEMA[t].forEach(function (c) { row[c] = o[c] === undefined ? '' : o[c]; }); return this.db.insert(t, row); };
  Ctx.prototype.upd = function (t, row, patch) { this.changed[t] = 1; return this.db.update(t, row, patch); };
  Ctx.prototype.log = function (action, detail) {
    this.ins('Log', { date: this.now, email: this.user ? this.user.email : '', action: action, detail: clip(detail, 500) });
  };
  Ctx.prototype.id = function (prefix) { return prefix + '-' + this.env.uuid().replace(/-/g, '').slice(0, 10).toUpperCase(); };

  // ---------- settings ----------
  function settingsMap(c) {
    var m = {};
    DEFAULT_SETTINGS.forEach(function (d) { m[d[0]] = d[1]; });
    c.all('Settings').forEach(function (r) { if (r.key) m[S(r.key)] = S(r.value); });
    return m;
  }
  function publicSettings(c) {
    var s = settingsMap(c);
    return {
      APP_NAME: s.APP_NAME, ORG_NAME: s.ORG_NAME, ANNOUNCEMENT: s.ANNOUNCEMENT,
      REQUIRE_CHECKOUT_APPROVAL: bool(s.REQUIRE_CHECKOUT_APPROVAL), REQUIRE_PURPOSE: bool(s.REQUIRE_PURPOSE)
    };
  }

  // ---------- users & sessions ----------
  function findUser(c, email) { email = lower(email); return c.all('Users').filter(function (u) { return lower(u.email) === email; })[0] || null; }
  function pubUser(u) { return { email: lower(u.email), name: S(u.name), photo: S(u.photo), role: S(u.role) || 'user', status: S(u.status) || 'pending', phone: S(u.phone) }; }
  function requireSession(c, needAdmin) {
    if (!c.token) fail('Please sign in.', 'AUTH');
    var s = c.all('Sessions').filter(function (x) { return S(x.token) === S(c.token); })[0];
    if (!s || S(s.expires_at) < c.now) fail('Your sign-in has expired. Please sign in again.', 'AUTH');
    var u = findUser(c, s.email);
    if (!u) fail('Account not found.', 'AUTH');
    if (S(u.status) === 'disabled') fail('Your account has been disabled. Contact an admin.', 'AUTH');
    if (S(u.status) !== 'active') fail('Your account is waiting for admin approval.', 'AUTH');
    if (needAdmin && S(u.role) !== 'admin') fail('Admins only.', 'FORBIDDEN');
    c.user = pubUser(u);
    return c.user;
  }

  // ---------- inventory helpers ----------
  function activeCats(c) { return c.all('Categories').filter(function (x) { return S(x.status) !== 'archived'; }).sort(function (a, b) { return N(a.sort) - N(b.sort); }); }
  function itemMap(c) { var m = {}; c.all('Items').forEach(function (i) { m[S(i.id)] = i; }); return m; }
  function orderMap(c) { var m = {}; c.all('Orders').forEach(function (o) { m[S(o.id)] = o; }); return m; }
  function heldLines(c) { return c.all('OrderLines').filter(function (l) { return HELD.indexOf(S(l.status)) >= 0; }); }
  function usedQty(c) { var m = {}; heldLines(c).forEach(function (l) { m[S(l.item_id)] = (m[S(l.item_id)] || 0) + N(l.qty || 1); }); return m; }
  function availableOf(item, used) {
    if (S(item.status) === 'archived') return 0;
    if (UNAVAILABLE_CONDITIONS.indexOf(S(item.condition)) >= 0) return 0;
    return Math.max(0, N(item.qty || 1) - (used[S(item.id)] || 0));
  }
  function photoMap(c) { var m = {}; c.all('PhotoLinks').forEach(function (r) { if (S(r.image_url).trim()) m[S(r.item_id)] = S(r.image_url).trim(); }); return m; }
  function photoRow(c, itemId) { return c.all('PhotoLinks').filter(function (r) { return S(r.item_id) === S(itemId); })[0] || null; }
  function pubItem(i, used, ph) {
    return {
      id: S(i.id), code: S(i.code), name: S(i.name), category_id: S(i.category_id), qty: N(i.qty || 1),
      condition: S(i.condition) || 'Good', status: S(i.status) || 'active', photo: (ph && ph[S(i.id)]) || S(i.photo),
      issue: (S(i.condition) || 'Good') === 'Good' ? '' : S(i.issue),
      used: used[S(i.id)] || 0, available: availableOf(i, used)
    };
  }
  function catOrder(c) {
    var rank = {};
    c.all('Categories').forEach(function (x) { rank[S(x.id)] = N(x.sort); });
    return function (a, b) {
      var ra = rank[S(a.category_id)] || 999, rb = rank[S(b.category_id)] || 999;
      if (ra !== rb) return ra - rb;
      return S(a.code) < S(b.code) ? -1 : S(a.code) > S(b.code) ? 1 : 0;
    };
  }
  function linesOf(c, orderId) { return c.all('OrderLines').filter(function (l) { return S(l.order_id) === S(orderId); }); }
  function computeStatus(lines, prev) {
    var st = lines.map(function (l) { return S(l.status); });
    if (!st.length) return 'CANCELLED';
    if (st.indexOf('PENDING') >= 0) return 'PENDING';
    if (st.indexOf('RETURN_REQUESTED') >= 0) return 'RETURN_REQUESTED';
    if (st.indexOf('OUT') >= 0) return 'ACTIVE';
    if (st.every(function (s) { return s === 'CANCELLED'; })) return prev === 'REJECTED' ? 'REJECTED' : 'CANCELLED';
    return 'RETURNED';
  }
  function refreshOrder(c, o) { var s = computeStatus(linesOf(c, o.id), S(o.status)); c.upd('Orders', o, { status: s, updated_at: c.now }); return s; }
  function pubLine(l) {
    return pick(l, ['id', 'order_id', 'item_id', 'item_name', 'category_id', 'qty', 'status', 'out_at', 'return_requested_at', 'return_note', 'return_photo', 'returned_at', 'return_condition', 'return_remark', 'approved_by']);
  }
  function pubOrder(c, o, withEmail) {
    var r = pick(o, ['id', 'name', 'purpose', 'location', 'expected_return', 'status', 'created_at', 'photo_out', 'approved_by', 'approved_at', 'admin_note', 'updated_at']);
    if (withEmail) r.email = S(o.email);
    r.lines = linesOf(c, o.id).map(pubLine);
    r.overdue = !!(S(o.expected_return) && S(o.expected_return) < c.today && r.lines.some(function (l) { return S(l.status) === 'OUT'; }));
    return r;
  }
  function newOrderId(c) {
    var d = c.today.replace(/-/g, '').slice(2); // yymmdd
    var n = c.all('Orders').filter(function (o) { return S(o.id).indexOf('ORD-' + d + '-') === 0; }).length + 1;
    var id;
    do { id = 'ORD-' + d + '-' + ('00' + n).slice(-3); n++; } while (c.all('Orders').some(function (o) { return S(o.id) === id; }));
    return id;
  }
  function normaliseLines(c, raw) {
    if (!raw || !raw.length) fail('Your cart is empty.');
    var merged = {};
    raw.forEach(function (l) { var id = S(l.item_id); if (!id) return; merged[id] = (merged[id] || 0) + Math.max(1, Math.floor(N(l.qty) || 1)); });
    var items = itemMap(c), used = usedQty(c), out = [];
    Object.keys(merged).forEach(function (id) {
      var it = items[id];
      if (!it || S(it.status) === 'archived') fail('An item in your cart no longer exists. Please refresh.');
      var av = availableOf(it, used);
      if (merged[id] > av) fail(S(it.name) + (av ? ' only has ' + av + ' available.' : ' is no longer available. Someone just took it.'), 'CONFLICT');
      out.push({ item: it, qty: merged[id] });
    });
    return out;
  }
  function addLines(c, order, list, status) {
    list.forEach(function (x) {
      c.ins('OrderLines', {
        id: c.id('L'), order_id: order.id, item_id: x.item.id, item_name: x.item.name, category_id: x.item.category_id,
        qty: x.qty, status: status, out_at: status === 'OUT' ? c.now : ''
      });
    });
  }
  function photoUrl(c, data, kind, name) {
    if (!data) return '';
    if (S(data).length > 6 * 1024 * 1024) fail('Photo is too large. Try again.');
    return c.env.savePhoto(S(data), kind, name);
  }
  function appendPhoto(existing, url) { return S(existing) ? S(existing) + '\n' + url : url; }
  function itemLog(c, itemId, type, detail, extra) {
    extra = extra || {};
    c.ins('ItemLog', { id: c.id('IL'), item_id: itemId, date: extra.date || c.now, type: type, detail: clip(detail, 1000), by: c.user ? c.user.name : '', photo: extra.photo || '', order_id: extra.order_id || '' });
  }

  // ---------- handovers (take over gear from the person holding it) ----------
  function openHandovers(c) { return c.all('Handovers').filter(function (h) { return S(h.status) === 'PENDING'; }); }
  function handoverByLine(c) { var m = {}; openHandovers(c).forEach(function (h) { m[S(h.from_line_id)] = h; }); return m; }
  function cancelHandoversFor(c, lineIds, why) {
    openHandovers(c).forEach(function (h) { if (lineIds.indexOf(S(h.from_line_id)) >= 0) c.upd('Handovers', h, { status: 'CANCELLED', decided_at: c.now, decided_by: why || 'system' }); });
  }
  function pubHandover(h) { return pick(h, ['id', 'item_id', 'item_name', 'qty', 'from_line_id', 'from_order_id', 'from_name', 'to_name', 'purpose', 'expected_return', 'note', 'status', 'created_at', 'decided_at', 'decided_by', 'new_order_id', 'to_order_id']); }
  function holdersMap(c) {
    var orders = orderMap(c), ho = handoverByLine(c), m = {};
    heldLines(c).forEach(function (l) {
      var o = orders[S(l.order_id)] || {};
      (m[S(l.item_id)] = m[S(l.item_id)] || []).push({
        line_id: S(l.id), name: S(o.name), qty: N(l.qty || 1), status: S(l.status), mine: lower(o.email) === c.user.email,
        handover_to: ho[S(l.id)] ? S(ho[S(l.id)].to_name) : '', handover_mine: !!(ho[S(l.id)] && lower(ho[S(l.id)].to_email) === c.user.email)
      });
    });
    return m;
  }

  // =====================================================================
  //  ACTIONS
  // =====================================================================
  var A = {};

  // ---------- auth ----------
  A['auth.google'] = function (c, p) {
    var g = c.env.verifyGoogle(S(p.credential));
    if (!g || !g.email) fail('Google sign-in failed. Please try again.', 'AUTH');
    var set = settingsMap(c);
    var u = findUser(c, g.email);
    if (!u) {
      u = c.ins('Users', { email: lower(g.email), name: g.name || g.email, photo: g.picture || '', role: 'user', status: bool(set.AUTO_APPROVE_USERS) ? 'active' : 'pending', created_at: c.now, last_login: c.now });
      c.user = pubUser(u); c.log('user.register', 'New sign-in, status ' + u.status);
    } else {
      var patch = { last_login: c.now };
      if (!S(u.name)) patch.name = g.name || '';
      if (g.picture) patch.photo = g.picture;
      c.upd('Users', u, patch);
    }
    if (S(u.status) === 'disabled') fail('Your account has been disabled. Contact an admin.', 'DISABLED');
    if (S(u.status) !== 'active') return { pending: true, user: pubUser(u), settings: publicSettings(c) };
    if (p.app === 'admin' && S(u.role) !== 'admin') fail('This Google account is not an admin. Use the user app instead.', 'NOT_ADMIN');
    var days = Math.max(1, N(set.SESSION_DAYS) || 30);
    var exp = c.env.fmt(new Date(c.nowDate.getTime() + days * 86400000));
    var token = (c.env.uuid() + c.env.uuid()).replace(/-/g, '');
    c.ins('Sessions', { token: token, email: lower(u.email), created_at: c.now, expires_at: exp, app: p.app === 'admin' ? 'admin' : 'user' });
    c.user = pubUser(u); c.log('auth.login', p.app === 'admin' ? 'admin app' : 'user app');
    return { token: token, user: c.user, settings: publicSettings(c) };
  };
  A['auth.me'] = function (c) { return { user: c.user, settings: publicSettings(c) }; };
  A['auth.logout'] = function (c) {
    var s = c.all('Sessions').filter(function (x) { return S(x.token) === S(c.token); })[0];
    if (s) c.upd('Sessions', s, { expires_at: c.now });
    return { ok: true };
  };

  // ---------- everyone ----------
  A['board'] = function (c) {
    var items = itemMap(c), orders = orderMap(c), cats = {};
    c.all('Categories').forEach(function (x) { cats[S(x.id)] = S(x.name); });
    var used = usedQty(c), ho = handoverByLine(c);
    var inUse = heldLines(c).map(function (l) {
      var o = orders[S(l.order_id)] || {}, it = items[S(l.item_id)] || {};
      return {
        line_id: S(l.id), order_id: S(l.order_id), item_id: S(l.item_id), item_name: S(it.name || l.item_name), code: S(it.code),
        category_id: S(l.category_id || it.category_id), category: cats[S(l.category_id || it.category_id)] || '',
        qty: N(l.qty || 1), status: S(l.status), holder: S(o.name), holder_key: lower(o.email), mine: c.user && lower(o.email) === c.user.email,
        since: S(l.out_at || o.created_at), purpose: S(o.purpose), expected_return: S(o.expected_return),
        overdue: !!(S(o.expected_return) && S(o.expected_return) < c.today && S(l.status) === 'OUT'),
        handover_to: ho[S(l.id)] ? S(ho[S(l.id)].to_name) : ''
      };
    }).sort(desc('since'));
    var total = 0, avail = 0;
    c.all('Items').forEach(function (i) { if (S(i.status) === 'archived') return; total += N(i.qty || 1); avail += availableOf(i, used); });
    var inUseQty = inUse.reduce(function (s, x) { return s + x.qty; }, 0);
    return { in_use: inUse, stats: { total: total, in_use: inUseQty, available: avail }, announcement: settingsMap(c).ANNOUNCEMENT, updated: c.now };
  };

  A['catalog'] = function (c) {
    var used = usedQty(c), ph = photoMap(c);
    var cats = activeCats(c).map(function (x) { return pick(x, ['id', 'name', 'icon', 'sort']); });
    var catIds = cats.map(function (x) { return S(x.id); });
    var items = c.all('Items').filter(function (i) { return S(i.status) !== 'archived' && catIds.indexOf(S(i.category_id)) >= 0; })
      .map(function (i) { return pubItem(i, used, ph); }).sort(catOrder(c));
    var hm = holdersMap(c);
    items.forEach(function (i) { i.holders = hm[i.id] || []; });
    return { categories: cats, items: items };
  };

  A['checkout'] = function (c, p) {
    var set = settingsMap(c);
    var purpose = clip(p.purpose, 300), location = clip(p.location, 200), ret = clip(p.expected_return, 10);
    if (bool(set.REQUIRE_PURPOSE) && !purpose) fail('Please fill in the task (Tugasan).');
    if (ret && !/^\d{4}-\d{2}-\d{2}$/.test(ret)) fail('Return date is not valid.');
    if (ret && ret < c.today) fail('Return date cannot be in the past.');
    var takes = (p.takeovers || []).map(function (t) { return checkTakeover(c, t.line_id); });
    if (!takes.length && !(p.lines || []).length) fail('Your cart is empty.');
    var list = (p.lines || []).length ? normaliseLines(c, p.lines) : [];
    var needApproval = bool(set.REQUIRE_CHECKOUT_APPROVAL);
    var o = null, names = '';
    if (list.length) {
      o = c.ins('Orders', { id: newOrderId(c), email: c.user.email, name: c.user.name, purpose: purpose, location: location, expected_return: ret, status: needApproval ? 'PENDING' : 'ACTIVE', created_at: c.now, updated_at: c.now });
      addLines(c, o, list, needApproval ? 'PENDING' : 'OUT');
      names = list.map(function (x) { return x.item.name + (x.qty > 1 ? ' ×' + x.qty : ''); }).join(', ');
      c.log('order.checkout', o.id + ': ' + names);
    }
    var hos = takes.map(function (t) { return pubHandover(createHandover(c, t, purpose, ret, clip(p.takeover_note, 300), o ? o.id : '')); });
    var waitText = hos.length ? 'Waiting for ' + hos.map(function (h) { return h.from_name + ' to hand over ' + h.item_name; }).join(', ') + '. They tap Hand over on their phone when you meet, or an admin approves.' : '';
    var vars = { name: c.user.name.split(' ')[0], order: o ? o.id : '', items: names };
    if (!o) return { order: null, handovers: hos, pending: true, title: 'Take-over sent', message: waitText };
    return {
      order: pubOrder(c, o, false), handovers: hos, pending: needApproval,
      title: needApproval ? 'Request sent' : fill(set.DONE_TITLE, vars),
      message: fill(needApproval ? set.PENDING_MESSAGE : set.DONE_MESSAGE, vars) + (waitText ? ' ' + waitText : '')
    };
  };

  function myOrder(c, id) {
    var o = orderMap(c)[S(id)];
    if (!o || lower(o.email) !== c.user.email) fail('Order not found.', 'NOT_FOUND');
    return o;
  }
  A['order.photo'] = function (c, p) {
    var o = myOrder(c, p.order_id);
    if (S(o.photo_out).split('\n').filter(String).length >= 4) fail('You can add up to 4 photos per order.');
    var url = photoUrl(c, p.photo, 'checkout', o.id);
    c.upd('Orders', o, { photo_out: appendPhoto(o.photo_out, url), updated_at: c.now });
    return { url: url };
  };
  A['my.orders'] = function (c) {
    var mine = c.all('Orders').filter(function (o) { return lower(o.email) === c.user.email; }).sort(desc('created_at'));
    var open = mine.filter(function (o) { return ['PENDING', 'ACTIVE', 'RETURN_REQUESTED'].indexOf(S(o.status)) >= 0; });
    var past = mine.filter(function (o) { return open.indexOf(o) < 0; }).slice(0, 15);
    return { open: open.map(function (o) { return pubOrder(c, o); }), past: past.map(function (o) { return pubOrder(c, o); }) };
  };
  A['my.cancel'] = function (c, p) {
    var o = myOrder(c, p.order_id);
    var lines = linesOf(c, o.id);
    if (!lines.length || lines.some(function (l) { return S(l.status) !== 'PENDING'; })) fail('Only requests still waiting for approval can be cancelled.');
    lines.forEach(function (l) { c.upd('OrderLines', l, { status: 'CANCELLED' }); });
    c.upd('Orders', o, { status: 'CANCELLED', admin_note: appendNote(o.admin_note, 'Cancelled by user'), updated_at: c.now });
    c.log('order.user_cancel', o.id);
    return { ok: true };
  };
  A['my.return'] = function (c, p) {
    var o = myOrder(c, p.order_id);
    var ids = (p.line_ids || []).map(S);
    var lines = linesOf(c, o.id).filter(function (l) { return ids.indexOf(S(l.id)) >= 0; });
    if (!lines.length) fail('Choose at least one item to return.');
    if (lines.some(function (l) { return S(l.status) !== 'OUT'; })) fail('Some of those items are not out right now. Refresh and try again.');
    var url = p.photo ? photoUrl(c, p.photo, 'return', o.id) : '';
    var note = clip(p.note, 500);
    lines.forEach(function (l) { c.upd('OrderLines', l, { status: 'RETURN_REQUESTED', return_requested_at: c.now, return_note: note, return_photo: url, return_remark: '' }); });
    cancelHandoversFor(c, lines.map(function (l) { return S(l.id); }), 'returned to store');
    refreshOrder(c, o);
    c.log('order.return_request', o.id + ': ' + lines.map(function (l) { return l.item_name; }).join(', ') + (note ? ' | note: ' + note : ''));
    return { message: settingsMap(c).RETURN_MESSAGE };
  };
  function appendNote(a, b) { return S(a) ? S(a) + ' | ' + b : b; }

  function checkTakeover(c, lineId) {
    var line = c.all('OrderLines').filter(function (l) { return S(l.id) === S(lineId); })[0];
    var o = line ? orderMap(c)[S(line.order_id)] : null;
    if (!line || !o || S(line.status) !== 'OUT') fail((line ? S(line.item_name) : 'An item') + ' is no longer with the person you wanted to take it from. Remove it from your cart.', 'CONFLICT');
    if (lower(o.email) === c.user.email) fail(S(line.item_name) + ' is already with you.');
    var ex = handoverByLine(c)[S(line.id)];
    if (ex) fail(lower(ex.to_email) === c.user.email ? 'You already asked to take over ' + S(line.item_name) + '.' : S(ex.to_name) + ' already asked to take over ' + S(line.item_name) + '.', 'CONFLICT');
    return { line: line, order: o };
  }
  function createHandover(c, t, purpose, ret, note, toOrderId) {
    var line = t.line, o = t.order;
    var h = c.ins('Handovers', {
      id: c.id('HO'), item_id: S(line.item_id), item_name: S(line.item_name), qty: N(line.qty || 1), from_line_id: S(line.id), from_order_id: S(o.id),
      from_email: lower(o.email), from_name: S(o.name), to_email: c.user.email, to_name: c.user.name, purpose: purpose, expected_return: ret, note: note,
      status: 'PENDING', created_at: c.now, to_order_id: toOrderId || ''
    });
    c.log('handover.request', S(line.item_name) + ': ' + o.name + ' → ' + c.user.name);
    return h;
  }
  A['handover.request'] = function (c, p) {
    var set = settingsMap(c);
    var purpose = clip(p.purpose, 300), ret = clip(p.expected_return, 10);
    if (bool(set.REQUIRE_PURPOSE) && !purpose) fail('Please fill in the task (Tugasan).');
    if (ret && (!/^\d{4}-\d{2}-\d{2}$/.test(ret) || ret < c.today)) fail('Return date is not valid.');
    var t = checkTakeover(c, p.line_id);
    var h = createHandover(c, t, purpose, ret, clip(p.note, 300), '');
    return { handover: pubHandover(h), message: S(t.order.name) + ' needs to confirm on their phone when they hand it to you. An admin can also approve it.' };
  };
  A['handover.respond'] = function (c, p) {
    var h = openHandovers(c).filter(function (x) { return S(x.id) === S(p.id); })[0];
    if (!h) fail('This handover request is no longer open.', 'NOT_FOUND');
    var isHolder = lower(h.from_email) === c.user.email, isAdmin = c.user.role === 'admin';
    if (!isHolder && !isAdmin) fail('Only ' + h.from_name + ' or an admin can answer this.', 'FORBIDDEN');
    if (!p.accept) {
      c.upd('Handovers', h, { status: 'DECLINED', decided_at: c.now, decided_by: c.user.name });
      c.log('handover.decline', S(h.item_name) + ': ' + h.from_name + ' → ' + h.to_name);
      return { ok: true };
    }
    var line = c.all('OrderLines').filter(function (l) { return S(l.id) === S(h.from_line_id); })[0];
    if (!line || S(line.status) !== 'OUT') { c.upd('Handovers', h, { status: 'CANCELLED', decided_at: c.now, decided_by: 'system' }); fail('That item is no longer out with ' + h.from_name + '.'); }
    var target = findUser(c, h.to_email);
    if (!target || S(target.status) !== 'active') fail(h.to_name + ' cannot use the app right now.');
    c.upd('OrderLines', line, { status: 'RETURNED', returned_at: c.now, return_remark: 'Handed over to ' + h.to_name, approved_by: c.user.name });
    refreshOrder(c, orderMap(c)[S(line.order_id)]);
    var join = S(h.to_order_id) ? orderMap(c)[S(h.to_order_id)] : null;
    if (join && (lower(join.email) !== lower(h.to_email) || ['PENDING', 'ACTIVE', 'RETURN_REQUESTED'].indexOf(S(join.status)) < 0)) join = null;
    var no = join || c.ins('Orders', { id: newOrderId(c), email: lower(h.to_email), name: S(h.to_name), purpose: S(h.purpose), expected_return: S(h.expected_return), status: 'ACTIVE', created_at: c.now, updated_at: c.now, admin_note: 'Handover from ' + h.from_name + ' (' + h.from_order_id + ')', approved_by: c.user.name, approved_at: c.now });
    if (join) c.upd('Orders', join, { admin_note: appendNote(join.admin_note, h.item_name + ' handed over from ' + h.from_name) });
    c.ins('OrderLines', { id: c.id('L'), order_id: no.id, item_id: line.item_id, item_name: line.item_name, category_id: line.category_id, qty: line.qty, status: 'OUT', out_at: c.now });
    refreshOrder(c, no);
    c.upd('Handovers', h, { status: 'DONE', decided_at: c.now, decided_by: c.user.name, new_order_id: no.id });
    itemLog(c, line.item_id, 'note', 'Handed over from ' + h.from_name + ' to ' + h.to_name + (isHolder ? '' : ' (approved by admin ' + c.user.name + ')'), { order_id: no.id });
    c.log('handover.done', S(h.item_name) + ': ' + h.from_name + ' → ' + h.to_name + ' (' + no.id + ')');
    return { ok: true, new_order_id: no.id };
  };
  A['handover.cancel'] = function (c, p) {
    var h = openHandovers(c).filter(function (x) { return S(x.id) === S(p.id); })[0];
    if (!h) fail('This request is no longer open.', 'NOT_FOUND');
    if (lower(h.to_email) !== c.user.email) fail('Only the person who asked can cancel it.', 'FORBIDDEN');
    c.upd('Handovers', h, { status: 'CANCELLED', decided_at: c.now, decided_by: c.user.name });
    c.log('handover.cancel', S(h.item_name));
    return { ok: true };
  };
  A['my.handovers'] = function (c) {
    var open = openHandovers(c);
    return {
      incoming: open.filter(function (h) { return lower(h.from_email) === c.user.email; }).map(pubHandover),
      outgoing: open.filter(function (h) { return lower(h.to_email) === c.user.email; }).map(pubHandover)
    };
  };

  // ---------- admin ----------
  A['admin.overview'] = function (c) {
    var items = itemMap(c), orders = orderMap(c), used = usedQty(c);
    var held = heldLines(c);
    var holders = {};
    held.forEach(function (l) {
      var o = orders[S(l.order_id)] || {};
      var k = lower(o.email);
      if (!holders[k]) holders[k] = { email: k, name: S(o.name), lines: [], overdue: 0 };
      var od = !!(S(o.expected_return) && S(o.expected_return) < c.today && S(l.status) === 'OUT');
      if (od) holders[k].overdue++;
      holders[k].lines.push({ line_id: S(l.id), order_id: S(l.order_id), item_id: S(l.item_id), item_name: S((items[S(l.item_id)] || {}).name || l.item_name), qty: N(l.qty || 1), status: S(l.status), since: S(l.out_at || o.created_at), expected_return: S(o.expected_return), purpose: S(o.purpose), overdue: od });
    });
    var total = 0, avail = 0, attention = [];
    c.all('Items').forEach(function (i) {
      if (S(i.status) === 'archived') return;
      total += N(i.qty || 1); avail += availableOf(i, used);
      if (ATTENTION.indexOf(S(i.condition)) >= 0) attention.push(pubItem(i, used));
    });
    var overdueOrders = {};
    held.forEach(function (l) { var o = orders[S(l.order_id)] || {}; if (S(o.expected_return) && S(o.expected_return) < c.today && S(l.status) === 'OUT') overdueOrders[S(o.id)] = 1; });
    return {
      stats: {
        total: total, available: avail,
        in_use: held.reduce(function (s, l) { return s + N(l.qty || 1); }, 0),
        pending_returns: c.all('Orders').filter(function (o) { return S(o.status) === 'RETURN_REQUESTED' || linesOf(c, o.id).some(function (l) { return S(l.status) === 'RETURN_REQUESTED'; }); }).length,
        pending_checkouts: c.all('Orders').filter(function (o) { return S(o.status) === 'PENDING'; }).length,
        pending_users: c.all('Users').filter(function (u) { return S(u.status) === 'pending'; }).length,
        pending_handovers: openHandovers(c).length,
        attention: attention.length, overdue: Object.keys(overdueOrders).length
      },
      holders: Object.keys(holders).map(function (k) { return holders[k]; }).sort(function (a, b) { return b.lines.length - a.lines.length; }),
      attention: attention,
      activity: c.all('Log').slice(-12).reverse()
    };
  };

  A['admin.approvals'] = function (c) {
    var orders = c.all('Orders');
    var returns = orders.filter(function (o) { return linesOf(c, o.id).some(function (l) { return S(l.status) === 'RETURN_REQUESTED'; }); })
      .map(function (o) { return pubOrder(c, o, true); })
      .sort(function (a, b) { var f = function (x) { return x.lines.filter(function (l) { return l.status === 'RETURN_REQUESTED'; }).map(function (l) { return l.return_requested_at; }).sort()[0] || ''; }; return f(a) < f(b) ? -1 : 1; });
    var checkouts = orders.filter(function (o) { return S(o.status) === 'PENDING'; }).map(function (o) { return pubOrder(c, o, true); }).sort(by('created_at'));
    var users = c.all('Users').filter(function (u) { return S(u.status) === 'pending'; }).map(function (u) { var r = pubUser(u); r.created_at = S(u.created_at); return r; });
    return { returns: returns, checkouts: checkouts, users: users, handovers: openHandovers(c).map(pubHandover).sort(by('created_at')) };
  };

  function adminOrder(c, id) { var o = orderMap(c)[S(id)]; if (!o) fail('Order not found.', 'NOT_FOUND'); return o; }

  A['admin.orders'] = function (c, p) {
    var f = S(p.filter || 'open'), q = lower(p.q);
    var list = c.all('Orders').filter(function (o) {
      var s = S(o.status);
      if (f === 'open' && ['PENDING', 'ACTIVE', 'RETURN_REQUESTED'].indexOf(s) < 0) return false;
      if (f === 'closed' && ['RETURNED', 'CANCELLED', 'REJECTED'].indexOf(s) < 0) return false;
      return true;
    }).map(function (o) { return pubOrder(c, o, true); });
    if (f === 'overdue') list = list.filter(function (o) { return o.overdue; });
    if (q) list = list.filter(function (o) {
      return (o.id + ' ' + o.name + ' ' + o.email + ' ' + o.purpose + ' ' + o.lines.map(function (l) { return l.item_name; }).join(' ')).toLowerCase().indexOf(q) >= 0;
    });
    list.sort(desc('created_at'));
    return { orders: list.slice(0, 200), total: list.length };
  };
  A['admin.order'] = function (c, p) { return { order: pubOrder(c, adminOrder(c, p.order_id), true) }; };

  A['admin.order.approve_out'] = function (c, p) {
    var o = adminOrder(c, p.order_id);
    var lines = linesOf(c, o.id).filter(function (l) { return S(l.status) === 'PENDING'; });
    if (!lines.length) fail('Nothing waiting for approval on this order.');
    lines.forEach(function (l) { c.upd('OrderLines', l, { status: 'OUT', out_at: c.now }); });
    c.upd('Orders', o, { approved_by: c.user.name, approved_at: c.now });
    refreshOrder(c, o);
    c.log('order.approve_out', o.id);
    return { order: pubOrder(c, o, true) };
  };
  A['admin.order.reject_out'] = function (c, p) {
    var o = adminOrder(c, p.order_id);
    var lines = linesOf(c, o.id).filter(function (l) { return S(l.status) === 'PENDING'; });
    if (!lines.length) fail('Nothing waiting for approval on this order.');
    lines.forEach(function (l) { c.upd('OrderLines', l, { status: 'CANCELLED' }); });
    c.upd('Orders', o, { admin_note: appendNote(o.admin_note, 'Rejected: ' + (clip(p.reason, 200) || 'no reason given')) });
    var st = refreshOrder(c, o);
    if (st === 'CANCELLED') c.upd('Orders', o, { status: 'REJECTED' });
    c.log('order.reject_out', o.id + (p.reason ? ': ' + p.reason : ''));
    return { order: pubOrder(c, o, true) };
  };

  // Approve a return (or mark items returned directly). lines: [{line_id, condition, remark}]
  A['admin.return.approve'] = function (c, p) {
    var o = adminOrder(c, p.order_id);
    var items = itemMap(c);
    var want = {}, keep = {};
    (p.lines || []).forEach(function (x) { want[S(x.line_id)] = x; });
    // Items the user asked to return but did not actually bring back: they stay with the user.
    (p.not_returned || []).forEach(function (x) { var id = S(x.line_id || x); if (!want[id]) keep[id] = x; });
    var lines = linesOf(c, o.id).filter(function (l) { return want[S(l.id)] && ['OUT', 'RETURN_REQUESTED'].indexOf(S(l.status)) >= 0; });
    var kept = linesOf(c, o.id).filter(function (l) { return keep[S(l.id)] && S(l.status) === 'RETURN_REQUESTED'; });
    if (!lines.length && !kept.length) fail('Choose at least one item that is still out.');
    lines.forEach(function (l) {
      var x = want[S(l.id)];
      var cd = CONDITIONS.indexOf(S(x.condition)) >= 0 ? S(x.condition) : 'Good';
      if (cd !== 'Good' && !S(x.remark).trim()) fail('Write a note for ' + S(l.item_name) + ' (' + cd + '), e.g. what is missing or broken.');
    });
    kept.forEach(function (l) {
      var note = clip(keep[S(l.id)].note, 300);
      c.upd('OrderLines', l, { status: 'OUT', return_requested_at: '', return_remark: 'Not returned yet (checked by ' + c.user.name + ')' + (note ? ': ' + note : '') });
    });
    cancelHandoversFor(c, lines.map(function (l) { return S(l.id); }), 'returned to store');
    lines.forEach(function (l) {
      var x = want[S(l.id)];
      var cond = CONDITIONS.indexOf(S(x.condition)) >= 0 ? S(x.condition) : 'Good';
      var remark = clip(x.remark, 500);
      c.upd('OrderLines', l, { status: 'RETURNED', returned_at: c.now, return_condition: cond, return_remark: remark, approved_by: c.user.name });
      var it = items[S(l.item_id)];
      if (it && cond !== 'Good') {
        var before = S(it.condition) || 'Good';
        c.upd('Items', it, { condition: cond, issue: remark, updated_at: c.now });
        itemLog(c, it.id, cond === 'Fair' ? 'note' : 'damage', 'Returned ' + (cond === 'Incomplete' ? 'incomplete' : 'as ' + cond) + (before !== cond ? ' (was ' + before + ')' : '') + ' by ' + o.name + ': ' + remark, { order_id: o.id, photo: S(l.return_photo) });
      } else if (it && remark) {
        itemLog(c, it.id, 'note', 'Return remark from ' + o.name + ': ' + remark, { order_id: o.id });
      }
    });
    refreshOrder(c, o);
    c.log('order.return_approve', o.id + ': ' + (lines.length ? lines.map(function (l) { return l.item_name + ' (' + (want[S(l.id)].condition || 'Good') + ')'; }).join(', ') : 'nothing returned') +
      (kept.length ? '; still with ' + o.name + ': ' + kept.map(function (l) { return l.item_name; }).join(', ') : ''));
    return { order: pubOrder(c, o, true), returned: lines.length, kept: kept.length };
  };
  A['admin.return.reject'] = function (c, p) {
    var o = adminOrder(c, p.order_id);
    var ids = (p.line_ids || []).map(S);
    var lines = linesOf(c, o.id).filter(function (l) { return S(l.status) === 'RETURN_REQUESTED' && (!ids.length || ids.indexOf(S(l.id)) >= 0); });
    if (!lines.length) fail('No return request to reject.');
    var reason = clip(p.reason, 300) || 'Return not accepted yet';
    lines.forEach(function (l) { c.upd('OrderLines', l, { status: 'OUT', return_remark: 'Return rejected: ' + reason }); });
    refreshOrder(c, o);
    c.log('order.return_reject', o.id + ': ' + reason);
    return { order: pubOrder(c, o, true) };
  };
  A['admin.order.cancel'] = function (c, p) {
    var o = adminOrder(c, p.order_id);
    var lines = linesOf(c, o.id).filter(function (l) { return HELD.indexOf(S(l.status)) >= 0; });
    if (!lines.length) fail('This order is already closed.');
    cancelHandoversFor(c, lines.map(function (l) { return S(l.id); }), 'order cancelled');
    lines.forEach(function (l) { c.upd('OrderLines', l, { status: 'CANCELLED' }); });
    c.upd('Orders', o, { admin_note: appendNote(o.admin_note, 'Cancelled by ' + c.user.name + (p.reason ? ': ' + clip(p.reason, 200) : '')) });
    refreshOrder(c, o);
    c.log('order.cancel', o.id + (p.reason ? ': ' + p.reason : ''));
    return { order: pubOrder(c, o, true) };
  };
  A['admin.order.edit'] = function (c, p) {
    var o = adminOrder(c, p.order_id);
    if (['RETURNED', 'CANCELLED', 'REJECTED'].indexOf(S(o.status)) >= 0) fail('Closed orders cannot be edited.');
    var patch = { updated_at: c.now }, changes = [];
    ['purpose', 'location', 'expected_return', 'admin_note'].forEach(function (k) {
      if (p[k] !== undefined && S(p[k]) !== S(o[k])) { patch[k] = clip(p[k], 300); changes.push(k); }
    });
    if (patch.expected_return && !/^\d{4}-\d{2}-\d{2}$/.test(patch.expected_return)) fail('Return date is not valid.');
    c.upd('Orders', o, patch);
    var rm = (p.remove || []).map(S);
    cancelHandoversFor(c, rm, 'removed from order');
    linesOf(c, o.id).forEach(function (l) { if (rm.indexOf(S(l.id)) >= 0 && HELD.indexOf(S(l.status)) >= 0) { c.upd('OrderLines', l, { status: 'CANCELLED' }); changes.push('removed ' + l.item_name); } });
    if (p.add && p.add.length) {
      var list = normaliseLines(c, p.add);
      var st = linesOf(c, o.id).some(function (l) { return S(l.status) === 'PENDING'; }) ? 'PENDING' : 'OUT';
      addLines(c, o, list, st);
      list.forEach(function (x) { changes.push('added ' + x.item.name); });
    }
    refreshOrder(c, o);
    c.log('order.edit', o.id + ': ' + (changes.join(', ') || 'no change'));
    return { order: pubOrder(c, o, true) };
  };

  // ---------- admin: items ----------
  A['admin.items'] = function (c) {
    var used = usedQty(c), orders = orderMap(c);
    var holders = {};
    heldLines(c).forEach(function (l) { var o = orders[S(l.order_id)] || {}; (holders[S(l.item_id)] = holders[S(l.item_id)] || []).push(S(o.name)); });
    var cats = c.all('Categories').slice().sort(function (a, b) { return N(a.sort) - N(b.sort); }).map(function (x) { return pick(x, ['id', 'name', 'icon', 'sort', 'status']); });
    var ph = photoMap(c);
    var items = c.all('Items').map(function (i) {
      var r = pubItem(i, used, ph); r.remark = S(i.remark); r.last_service = S(i.last_service); r.serial_no = S(i.serial_no); r.holders = holders[S(i.id)] || []; return r;
    }).sort(catOrder(c));
    return { categories: cats, items: items, conditions: CONDITIONS };
  };
  A['admin.item'] = function (c, p) {
    var it = itemMap(c)[S(p.id)];
    if (!it) fail('Item not found.', 'NOT_FOUND');
    var used = usedQty(c), orders = orderMap(c);
    var r = pubItem(it, used, photoMap(c));
    var prow = photoRow(c, it.id);
    r.photo_link = prow ? S(prow.image_url) : ''; r.photo_source = prow ? S(prow.source) : '';
    ['serial_no', 'last_service', 'remark', 'created_at', 'updated_at', 'issue'].forEach(function (k) { r[k] = S(it[k]); });
    r.log = c.all('ItemLog').filter(function (l) { return S(l.item_id) === S(it.id); }).map(function (l) { return pick(l, ['id', 'date', 'type', 'detail', 'by', 'photo', 'order_id']); }).sort(desc('date'));
    var lines = c.all('OrderLines').filter(function (l) { return S(l.item_id) === S(it.id) && S(l.status) !== 'CANCELLED'; });
    r.usage = lines.map(function (l) {
      var o = orders[S(l.order_id)] || {};
      return { order_id: S(l.order_id), name: S(o.name), email: S(o.email), purpose: S(o.purpose), qty: N(l.qty || 1), status: S(l.status), out_at: S(l.out_at || o.created_at), returned_at: S(l.returned_at), return_condition: S(l.return_condition), return_remark: S(l.return_remark) };
    }).sort(desc('out_at')).slice(0, 60);
    r.holders = r.usage.filter(function (u) { return HELD.indexOf(u.status) >= 0; });
    r.times_used = lines.length;
    return { item: r, conditions: CONDITIONS };
  };
  function nextCode(c, catId) {
    var cat = c.all('Categories').filter(function (x) { return S(x.id) === S(catId); })[0];
    var prefix = S(cat ? cat.id : 'ITM').toUpperCase();
    var max = 0;
    c.all('Items').forEach(function (i) { var m = new RegExp('^' + prefix + '-(\\d+)$').exec(S(i.code)); if (m) max = Math.max(max, N(m[1])); });
    return prefix + '-' + ('0' + (max + 1)).slice(-2);
  }
  A['admin.item.save'] = function (c, p) {
    var name = clip(p.name, 120);
    if (!name) fail('Item name is required.');
    var cat = c.all('Categories').filter(function (x) { return S(x.id) === S(p.category_id); })[0];
    if (!cat) fail('Choose a category.');
    var qty = Math.max(1, Math.floor(N(p.qty) || 1));
    var cond = p.condition !== undefined ? S(p.condition) : 'Good';
    if (CONDITIONS.indexOf(cond) < 0) fail('Unknown condition.');
    if (p.last_service && !/^\d{4}-\d{2}-\d{2}$/.test(S(p.last_service))) fail('Last service date is not valid.');
    var fields = { name: name, category_id: S(cat.id), qty: qty, condition: cond, serial_no: clip(p.serial_no, 120), last_service: S(p.last_service || ''), remark: clip(p.remark, 1000) };
    if (p.issue !== undefined) fields.issue = cond === 'Good' ? '' : clip(p.issue, 500);
    else if (cond === 'Good') fields.issue = '';
    if (!p.id) {
      var it = c.ins('Items', Object.assign({ id: c.id('IT'), code: nextCode(c, cat.id), status: 'active', created_at: c.now, updated_at: c.now }, fields));
      setPhotoLink(c, it, p.photo_link !== undefined ? p.photo_link : '', 'link from admin app');
      itemLog(c, it.id, 'note', 'Item added to inventory');
      c.log('item.create', it.code + ' ' + it.name);
      return { item: pubItem(it, usedQty(c)) };
    }
    var cur = itemMap(c)[S(p.id)];
    if (!cur) fail('Item not found.', 'NOT_FOUND');
    var used = usedQty(c)[S(cur.id)] || 0;
    if (qty < used) fail('Quantity cannot be lower than the ' + used + ' currently in use.');
    var labels = { name: 'Name', category_id: 'Category', qty: 'Quantity', condition: 'Condition', serial_no: 'Serial no.', last_service: 'Last service', remark: 'Remark', issue: 'Problem' };
    var changes = [];
    Object.keys(fields).forEach(function (k) { if (S(fields[k]) !== S(cur[k])) changes.push(labels[k] + ': ' + (S(cur[k]) || '—') + ' → ' + (S(fields[k]) || '—')); });
    if (p.photo_link !== undefined) {
      var pr = photoRow(c, cur.id);
      if (S(p.photo_link).trim() !== (pr ? S(pr.image_url) : '')) { setPhotoLink(c, cur, p.photo_link, 'link from admin app'); changes.push('Photo link updated'); }
    }
    if (!changes.length) return { item: pubItem(cur, usedQty(c)) };
    if (S(fields.category_id) !== S(cur.category_id)) fields.code = nextCode(c, fields.category_id);
    fields.updated_at = c.now;
    c.upd('Items', cur, fields);
    var prow = photoRow(c, cur.id);
    if (prow && (S(prow.name) !== S(cur.name) || S(prow.code) !== S(cur.code))) c.upd('PhotoLinks', prow, { name: cur.name, code: cur.code });
    itemLog(c, cur.id, 'edit', changes.join('; '));
    c.log('item.edit', cur.code + ': ' + changes.join('; '));
    return { item: pubItem(cur, usedQty(c)) };
  };
  A['admin.item.archive'] = function (c, p) {
    var it = itemMap(c)[S(p.id)];
    if (!it) fail('Item not found.', 'NOT_FOUND');
    var archive = p.archived !== false;
    if (archive && (usedQty(c)[S(it.id)] || 0) > 0) fail('This item is in use. Wait for it to be returned before removing it.');
    c.upd('Items', it, { status: archive ? 'archived' : 'active', updated_at: c.now });
    itemLog(c, it.id, 'edit', archive ? 'Removed from the pick list' : 'Restored to the pick list');
    c.log(archive ? 'item.archive' : 'item.restore', it.code + ' ' + it.name);
    return { ok: true };
  };
  A['admin.item.log'] = function (c, p) {
    var it = itemMap(c)[S(p.item_id)];
    if (!it) fail('Item not found.', 'NOT_FOUND');
    var type = LOG_TYPES.indexOf(S(p.type)) >= 0 ? S(p.type) : 'note';
    var detail = clip(p.detail, 1000);
    if (!detail) fail('Write what happened.');
    var date = S(p.date) && /^\d{4}-\d{2}-\d{2}$/.test(S(p.date)) ? S(p.date) : c.today;
    var url = p.photo ? photoUrl(c, p.photo, 'items', it.code) : '';
    var patch = { updated_at: c.now };
    var setCond = S(p.set_condition);
    if (!setCond && type === 'damage') setCond = 'Damaged';
    if (!setCond && type === 'repair') setCond = 'Good';
    if (setCond && CONDITIONS.indexOf(setCond) >= 0 && setCond !== S(it.condition)) { patch.condition = setCond; detail += ' [Condition: ' + (S(it.condition) || 'Good') + ' → ' + setCond + ']'; }
    var newCond = patch.condition || S(it.condition) || 'Good';
    if (newCond === 'Good') patch.issue = '';
    else if (type === 'damage' || (patch.condition && type !== 'note')) patch.issue = clip(p.detail, 500);
    if (type === 'service' && date > S(it.last_service)) patch.last_service = date;
    c.upd('Items', it, patch);
    itemLog(c, it.id, type, detail, { date: date === c.today ? c.now : date, photo: url });
    c.log('item.log', it.code + ' ' + type + ': ' + detail);
    return { ok: true };
  };
  A['admin.item.photo'] = function (c, p) {
    var it = itemMap(c)[S(p.item_id)];
    if (!it) fail('Item not found.', 'NOT_FOUND');
    var url = photoUrl(c, p.photo, 'items', it.code);
    setPhotoLink(c, it, url, 'uploaded from admin app', true);
    c.upd('Items', it, { updated_at: c.now });
    itemLog(c, it.id, 'edit', 'New photo uploaded');
    return { url: url };
  };
  function setPhotoLink(c, it, url, source, trusted) {
    url = clip(url, 1000);
    if (url && !trusted && !/^(https?:\/\/|data:image\/)/i.test(url)) fail('The photo link must start with https://');
    var row = photoRow(c, it.id);
    var patch = { code: S(it.code), name: S(it.name), image_url: url, source: url ? source : '', updated_at: c.now };
    if (row) c.upd('PhotoLinks', row, patch);
    else c.ins('PhotoLinks', Object.assign({ item_id: S(it.id), search: photoSearchFor(it.name) }, patch));
  }

  // ---------- presets (saved carts) ----------
  function presetView(c, p, items, used, hm) {
    hm = hm || holdersMap(c);
    var list = [];
    try { list = JSON.parse(S(p.items) || '[]'); } catch (e) { list = []; }
    var rows = list.map(function (x) {
      var it = items[S(x.item_id)], q = Math.max(1, Math.floor(N(x.qty) || 1));
      if (!it || S(it.status) === 'archived') return { item_id: S(x.item_id), name: S(x.name) || 'Removed item', code: '', category_id: '', qty: q, available: 0, ok: false, state: 'blocked', reason: 'Removed', missing: true };
      var av = availableOf(it, used), cond = S(it.condition) || 'Good';
      var r = { item_id: S(it.id), name: S(it.name), code: S(it.code), category_id: S(it.category_id), qty: q, available: av, condition: cond, state: 'free', reason: '', holder: '' };
      var hs = hm[S(it.id)] || [];
      if (av >= q) { r.state = 'free'; }
      else if (UNAVAILABLE_CONDITIONS.indexOf(cond) >= 0) { r.state = 'blocked'; r.reason = cond === 'Lost' ? 'Missing' : 'Under repair'; }
      else if (hs.some(function (h) { return h.mine; }) && av === 0) { r.state = 'mine'; r.reason = 'Already with you'; }
      else {
        var take = av === 0 ? hs.filter(function (h) { return h.status === 'OUT' && !h.mine && !h.handover_to && h.qty >= q; })[0] : null;
        if (take) { r.state = 'take'; r.holder = take.name; r.take_line = take.line_id; r.take_qty = take.qty; r.reason = 'In use by ' + take.name; }
        else {
          var h0 = hs[0];
          r.state = 'blocked';
          r.reason = av > 0 ? 'Only ' + av + ' free' : !h0 ? 'Not available' : h0.handover_to ? (h0.handover_mine ? 'You asked ' + h0.name : h0.handover_to + ' is taking it from ' + h0.name) :
            h0.status === 'RETURN_REQUESTED' ? 'Pending return by ' + h0.name : h0.status === 'PENDING' ? 'Awaiting approval for ' + h0.name : 'In use by ' + h0.name;
          r.holder = h0 ? h0.name : '';
        }
      }
      r.ok = r.state !== 'blocked';
      return r;
    });
    return {
      id: S(p.id), name: S(p.name), scope: S(p.scope) || 'personal', owner_name: S(p.owner_name), mine: lower(p.owner_email) === c.user.email, users: presetUsers(p),
      items: rows, ready: rows.length > 0 && rows.every(function (r) { return r.ok; }), blocked: rows.filter(function (r) { return !r.ok; }).length,
      takes: rows.filter(function (r) { return r.state === 'take'; }).length, updated_at: S(p.updated_at)
    };
  }
  /** Team preset audience: empty list = everyone. */
  function presetUsers(p) { return S(p.users).split(/[,;\s]+/).map(lower).filter(function (e) { return e.indexOf('@') > 0; }); }
  function presetFor(c, p) { var u = presetUsers(p); return !u.length || u.indexOf(c.user.email) >= 0; }
  function findPreset(c, id) { var p = c.all('Presets').filter(function (x) { return S(x.id) === S(id) && S(x.status) !== 'archived'; })[0]; if (!p) fail('Preset not found.', 'NOT_FOUND'); return p; }
  function canEditPreset(c, p) {
    if (S(p.scope) === 'team') return c.user.role === 'admin';
    return lower(p.owner_email) === c.user.email;
  }
  A['presets'] = function (c, p) {
    var items = itemMap(c), used = usedQty(c), hm = holdersMap(c);
    var all = !!(p && p.all) && c.user.role === 'admin'; // admin preset manager sees every team preset
    var live = c.all('Presets').filter(function (x) { return S(x.status) !== 'archived'; }).sort(by('name'));
    return {
      mine: live.filter(function (x) { return S(x.scope) !== 'team' && lower(x.owner_email) === c.user.email; }).map(function (x) { return presetView(c, x, items, used, hm); }),
      team: live.filter(function (x) { return S(x.scope) === 'team' && (all || presetFor(c, x)); }).map(function (x) { return presetView(c, x, items, used, hm); })
    };
  };
  A['preset.save'] = function (c, p) {
    var name = clip(p.name, 60);
    if (!name) fail('Give the preset a name.');
    var scope = p.scope === 'team' ? 'team' : 'personal';
    if (scope === 'team' && c.user.role !== 'admin') fail('Only admins can make presets for everyone.', 'FORBIDDEN');
    var items = itemMap(c), merged = {}, order = [];
    (p.items || []).forEach(function (x) {
      var id = S(x.item_id), it = items[id];
      if (!it || S(it.status) === 'archived') return;
      if (!merged[id]) { merged[id] = 0; order.push(id); }
      merged[id] += Math.max(1, Math.floor(N(x.qty) || 1));
    });
    if (!order.length) fail('Add at least one item to the preset.');
    var json = JSON.stringify(order.map(function (id) { return { item_id: id, qty: merged[id], name: S(items[id].name) }; }));
    // Team presets can be for everyone (empty) or for chosen people only.
    var users = '';
    if (scope === 'team' && p.users && p.users.length) {
      var known = {}; c.all('Users').forEach(function (u) { known[lower(u.email)] = 1; });
      users = p.users.map(lower).filter(function (e, i, a) { return known[e] && a.indexOf(e) === i; }).join(', ');
      if (!users) fail('Choose at least one person, or pick "All users".');
    }
    var row;
    if (p.id) {
      row = findPreset(c, p.id);
      if (!canEditPreset(c, row)) fail('You cannot change this preset.', 'FORBIDDEN');
      var patch = { name: name, items: json, updated_at: c.now };
      if (S(row.scope) === 'team') patch.users = users;
      c.upd('Presets', row, patch);
    } else {
      var mine = c.all('Presets').filter(function (x) { return S(x.status) !== 'archived' && S(x.scope) !== 'team' && lower(x.owner_email) === c.user.email; });
      if (scope === 'personal' && mine.length >= 30) fail('You already have 30 presets. Delete one first.');
      if (c.all('Presets').some(function (x) { return S(x.status) !== 'archived' && S(x.scope) === scope && lower(x.name) === lower(name) && (scope === 'team' || lower(x.owner_email) === c.user.email); })) fail('You already have a preset called "' + name + '".');
      row = c.ins('Presets', { id: c.id('PR'), name: name, scope: scope, owner_email: c.user.email, owner_name: c.user.name, items: json, status: 'active', created_at: c.now, updated_at: c.now, users: users });
    }
    c.log('preset.save', (scope === 'team' ? 'team: ' : '') + name + ' (' + order.length + ' items' + (users ? ', for ' + users : '') + ')');
    return { preset: presetView(c, row, items, usedQty(c)) };
  };
  A['preset.delete'] = function (c, p) {
    var row = findPreset(c, p.id);
    if (!canEditPreset(c, row)) fail('You cannot delete this preset.', 'FORBIDDEN');
    c.upd('Presets', row, { status: 'archived', updated_at: c.now });
    c.log('preset.delete', S(row.name));
    return { ok: true };
  };

  // ---------- admin: categories ----------
  A['admin.category.save'] = function (c, p) {
    var name = clip(p.name, 60);
    if (!name) fail('Category name is required.');
    if (!p.id) {
      var id = clip(p.code || name, 3).toUpperCase().replace(/[^A-Z]/g, '');
      if (id.length < 2) id = 'CT';
      var base = id, n = 2;
      while (c.all('Categories').some(function (x) { return S(x.id) === id; })) { id = base.slice(0, 2) + n; n++; }
      var maxSort = c.all('Categories').reduce(function (m, x) { return Math.max(m, N(x.sort)); }, 0);
      var cat = c.ins('Categories', { id: id, name: name, icon: S(p.icon || 'box'), sort: maxSort + 1, status: 'active' });
      c.log('category.create', id + ' ' + name);
      return { category: cat };
    }
    var cur = c.all('Categories').filter(function (x) { return S(x.id) === S(p.id); })[0];
    if (!cur) fail('Category not found.', 'NOT_FOUND');
    var patch = { name: name };
    if (p.icon) patch.icon = S(p.icon);
    if (p.sort !== undefined) patch.sort = N(p.sort);
    c.upd('Categories', cur, patch);
    c.log('category.edit', cur.id + ' → ' + name);
    return { category: cur };
  };
  A['admin.category.move'] = function (c, p) {
    var cats = c.all('Categories').slice().sort(function (a, b) { return N(a.sort) - N(b.sort); });
    var i = cats.map(function (x) { return S(x.id); }).indexOf(S(p.id));
    var j = i + (N(p.dir) < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= cats.length) return { ok: true };
    var tmp = cats[i]; cats[i] = cats[j]; cats[j] = tmp;
    cats.forEach(function (x, k) { if (N(x.sort) !== k + 1) c.upd('Categories', x, { sort: k + 1 }); });
    return { ok: true };
  };
  A['admin.category.archive'] = function (c, p) {
    var cur = c.all('Categories').filter(function (x) { return S(x.id) === S(p.id); })[0];
    if (!cur) fail('Category not found.', 'NOT_FOUND');
    var archive = p.archived !== false;
    if (archive && c.all('Items').some(function (i) { return S(i.category_id) === S(cur.id) && S(i.status) !== 'archived'; })) fail('Move or remove the items in this category first.');
    c.upd('Categories', cur, { status: archive ? 'archived' : 'active' });
    c.log(archive ? 'category.archive' : 'category.restore', cur.id);
    return { ok: true };
  };

  // ---------- admin: users ----------
  A['admin.users'] = function (c) {
    var orders = orderMap(c), count = {};
    heldLines(c).forEach(function (l) { var e = lower((orders[S(l.order_id)] || {}).email); count[e] = (count[e] || 0) + 1; });
    return {
      users: c.all('Users').map(function (u) { var r = pubUser(u); r.note = S(u.note); r.created_at = S(u.created_at); r.last_login = S(u.last_login); r.holding = count[lower(u.email)] || 0; return r; })
        .sort(function (a, b) { var rank = { pending: 0, active: 1, disabled: 2 }; return (rank[a.status] - rank[b.status]) || (a.name < b.name ? -1 : 1); })
    };
  };
  A['admin.user.save'] = function (c, p) {
    var email = lower(p.email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Enter a valid Google email.');
    var role = p.role === 'admin' ? 'admin' : 'user';
    var status = ['active', 'pending', 'disabled'].indexOf(S(p.status)) >= 0 ? S(p.status) : 'active';
    var u = findUser(c, email);
    if (u && lower(u.email) === c.user.email && (role !== 'admin' || status !== 'active')) fail('You cannot remove your own admin access.');
    var fields = { role: role, status: status, phone: clip(p.phone, 30), note: clip(p.note, 300) };
    if (p.name !== undefined && clip(p.name, 80)) fields.name = clip(p.name, 80);
    if (!u) {
      u = c.ins('Users', Object.assign({ email: email, name: fields.name || email.split('@')[0], created_at: c.now }, fields));
      c.log('user.add', email + ' as ' + role);
    } else {
      c.upd('Users', u, fields);
      c.log('user.edit', email + ': ' + role + ', ' + status);
    }
    if (status !== 'active') c.all('Sessions').forEach(function (s) { if (lower(s.email) === email && S(s.expires_at) > c.now) c.upd('Sessions', s, { expires_at: c.now }); });
    return { user: pubUser(u) };
  };

  // ---------- admin: settings & log ----------
  A['admin.settings'] = function (c) {
    var m = settingsMap(c), desc = {};
    DEFAULT_SETTINGS.forEach(function (d) { desc[d[0]] = d[2]; });
    c.all('Settings').forEach(function (r) { if (r.description) desc[S(r.key)] = S(r.description); });
    return { settings: Object.keys(m).map(function (k) { return { key: k, value: m[k], description: desc[k] || '' }; }) };
  };
  A['admin.settings.save'] = function (c, p) {
    var vals = p.values || {}, rows = c.all('Settings'), changed = [];
    Object.keys(vals).forEach(function (k) {
      var v = clip(vals[k], 2000);
      if (/^(REQUIRE_|AUTO_)/.test(k)) v = bool(v) ? 'TRUE' : 'FALSE';
      var row = rows.filter(function (r) { return S(r.key) === k; })[0];
      if (row) { if (S(row.value) !== v) { c.upd('Settings', row, { value: v }); changed.push(k); } }
      else { var d = DEFAULT_SETTINGS.filter(function (x) { return x[0] === k; })[0]; if (d) { c.ins('Settings', { key: k, value: v, description: d[2] }); changed.push(k); } }
    });
    if (changed.length) c.log('settings.save', changed.join(', '));
    return { settings: publicSettings(c) };
  };
  A['admin.log'] = function (c, p) {
    var n = Math.min(300, N(p.limit) || 100);
    return { log: c.all('Log').slice(-n).reverse() };
  };

  // ---------- routing ----------
  var PUBLIC = ['auth.google'];
  var READS = ['auth.me', 'board', 'catalog', 'presets', 'my.handovers', 'my.orders', 'admin.overview', 'admin.approvals', 'admin.orders', 'admin.order', 'admin.items', 'admin.item', 'admin.users', 'admin.settings', 'admin.log'];

  /** meta (optional): filled with { reads: [tables], changed: [tables] } even when the action fails. */
  function run(action, payload, io, token, meta) {
    var fn = A[action];
    if (!fn) fail('Unknown action: ' + action, 'NOT_FOUND');
    var c = new Ctx(io, token);
    try {
      if (PUBLIC.indexOf(action) < 0) requireSession(c, action.indexOf('admin.') === 0);
      return fn(c, payload || {});
    } finally {
      if (meta) { meta.reads = Object.keys(c.reads); meta.changed = Object.keys(c.changed); }
    }
  }

  /** Fill empty tables with the starting data. Safe to run more than once. */
  function seed(io, opts) {
    opts = opts || {};
    var c = new Ctx(io, null);
    if (!c.all('Settings').length) DEFAULT_SETTINGS.forEach(function (d) { c.ins('Settings', { key: d[0], value: d[1], description: d[2] }); });
    if (!c.all('Categories').length) SEED.forEach(function (cat, i) { c.ins('Categories', { id: cat[0], name: cat[1], icon: cat[2], sort: i + 1, status: 'active' }); });
    if (!c.all('Items').length) SEED.forEach(function (cat) {
      cat[3].forEach(function (name, j) {
        c.ins('Items', { id: c.id('IT'), code: cat[0] + '-' + ('0' + (j + 1)).slice(-2), name: name, category_id: cat[0], qty: 1, condition: 'Good', status: 'active', created_at: c.now, updated_at: c.now });
      });
    });
    var links = {};
    c.all('PhotoLinks').forEach(function (r) { links[S(r.item_id)] = 1; });
    c.all('Items').forEach(function (i) {
      if (!links[S(i.id)]) c.ins('PhotoLinks', { item_id: S(i.id), code: S(i.code), name: S(i.name), image_url: S(i.photo), search: photoSearchFor(i.name), source: S(i.photo) ? 'item photo' : '', updated_at: c.now });
    });
    (opts.admins || []).forEach(function (a) {
      var email = lower(a.email || a);
      if (!email || email.indexOf('@') < 0) return;
      var u = findUser(c, email);
      if (!u) c.ins('Users', { email: email, name: a.name || email.split('@')[0], role: 'admin', status: 'active', created_at: c.now, note: 'Owner admin (setup)' });
      else c.upd('Users', u, { role: 'admin', status: 'active' });
    });
  }

  var api = {
    SCHEMA: SCHEMA, KEY: KEY, photoSearchFor: photoSearchFor, CONDITIONS: CONDITIONS, DEFAULT_SETTINGS: DEFAULT_SETTINGS, SEED: SEED,
    run: run, seed: seed, isRead: function (a) { return READS.indexOf(a) >= 0; }, actions: Object.keys(A)
  };
  return api;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
