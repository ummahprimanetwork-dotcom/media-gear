/* UI helpers: icons, formatting, sheets, toasts, photos. */
var UI = (function () {
  var P = {
    aperture: '<circle cx="12" cy="12" r="10"/><path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94"/>',
    camera: '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2l1.5-2h6l1.5 2h2A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="4"/>',
    lens: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    tripod: '<rect x="8" y="3" width="8" height="5" rx="1"/><path d="M12 8v4M12 12l-6 9M12 12l6 9M12 12v9"/>',
    gimbal: '<path d="M9 21h6M12 21v-6M8 15h8M16 15V9a4 4 0 0 0-4-4"/><rect x="4" y="4" width="8" height="5.5" rx="1"/>',
    battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M22 11v2M7 10v4M11 10v4"/>',
    light: '<rect x="4" y="3" width="16" height="10" rx="2"/><path d="M8 7h8M12 13v8M8 21h8"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/>',
    bag: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18"/>',
    card: '<path d="M7 2h8l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M9 6v3M12 6v3M15 7v2"/>',
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    board: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
    pick: '<path d="M4 7h16l-1.5 12.5a2 2 0 0 1-2 1.5h-9a2 2 0 0 1-2-1.5z"/><path d="M8 7a4 4 0 0 1 8 0"/>',
    mine: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 13l2 2 4-4"/>',
    user: '<circle cx="12" cy="7.5" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 4 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    wrench: '<path d="M15 4a5 5 0 0 0-4.6 6.9L3 18.3 5.7 21l7.4-7.4A5 5 0 0 0 20 9l-3 1-2-2 1-3z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    note: '<path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    out: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
    chevd: '<path d="M6 9l6 6 6-6"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4"/>',
    pen: '<path d="M12 19l7-7 3 3-7 7z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z"/><path d="M2 2l7.6 7.6"/><circle cx="11" cy="11" r="2"/>',
    subs: '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h8.1a2 2 0 0 0 2-1.5L22 7H6"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
  };
  var ICONS = ['camera', 'lens', 'tripod', 'gimbal', 'battery', 'light', 'mic', 'bag', 'card', 'box'];
  var maskN = 0;
  /** Does this picture have a see-through background? (simple icons do, photos and JPGs don't) */
  function hasAlpha(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        try {
          var cv = document.createElement('canvas'); cv.width = Math.min(64, img.width); cv.height = Math.min(64, img.height);
          var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, cv.width, cv.height);
          var d = cx.getImageData(0, 0, cv.width, cv.height).data, clear = 0;
          for (var i = 3; i < d.length; i += 4) if (d[i] < 200) clear++;
          resolve(clear > d.length / 4 * 0.08);
        } catch (e) { resolve(true); }
      };
      img.onerror = function () { resolve(true); };
      img.src = src;
    });
  }
  function icon(name, cls) {
    // A category can use its own picture (uploaded or a link): draw it inside the same 24×24 box as the built-in icons.
    var pic = /^(orig\|)?(https:\/\/|data:image\/)/.exec(String(name || ''));
    if (pic) {
      var url = esc(String(name).replace(/^orig\|/, '')), img = '<image href="' + url + '" x="1" y="1" width="22" height="22" preserveAspectRatio="xMidYMid meet"/>';
      // "orig|…" = keep the picture's own colours. Otherwise use its shape only and paint it in the app's colour,
      // so a black, white or coloured icon all look right on light and dark backgrounds.
      if (pic[1]) return '<svg viewBox="0 0 24 24" aria-hidden="true" class="ci' + (cls ? ' ' + cls : '') + '">' + img + '</svg>';
      var id = 'cim' + (++maskN);
      return '<svg viewBox="0 0 24 24" aria-hidden="true" class="ci' + (cls ? ' ' + cls : '') + '"><mask id="' + id + '" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">' + img + '</mask><rect width="24" height="24" fill="currentColor" mask="url(#' + id + ')"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + (P[name] || P.box) + '</svg>';
  }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function parse(s) { var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(s || '')); if (!m) return null; return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)); }
  function todayStr(offset) { var d = new Date(); d.setDate(d.getDate() + (offset || 0)); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function time(d) { var h = d.getHours(), m = ('0' + d.getMinutes()).slice(-2); return (h % 12 || 12) + ':' + m + (h < 12 ? ' am' : ' pm'); }
  function when(s) {
    var d = parse(s); if (!d) return '';
    if (String(s).trim().length <= 10) return day(s);
    var ds = String(s).slice(0, 10);
    if (ds === todayStr()) return 'Today ' + time(d);
    if (ds === todayStr(-1)) return 'Yesterday ' + time(d);
    return d.getDate() + ' ' + MON[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '') + ', ' + time(d);
  }
  function day(s) {
    var d = parse(s); if (!d) return '';
    var ds = String(s).slice(0, 10);
    if (ds === todayStr()) return 'Today';
    if (ds === todayStr(1)) return 'Tomorrow';
    if (ds === todayStr(-1)) return 'Yesterday';
    return DAY[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function daysAgo(s) { var d = parse(s); if (!d) return ''; var n = Math.round((parse(todayStr()) - parse(String(s).slice(0, 10))) / 864e5); return n <= 0 ? 'today' : n === 1 ? '1 day ago' : n < 60 ? n + ' days ago' : Math.round(n / 30) + ' months ago'; }

  var LINE = {
    PENDING: ['Awaiting approval', 'p-info'], OUT: ['Out', 'p-bad'], RETURN_REQUESTED: ['Return pending', 'p-warn'],
    RETURNED: ['Returned', 'p-ok'], CANCELLED: ['Cancelled', 'p-mute']
  };
  var ORDER = {
    PENDING: ['Awaiting approval', 'p-info'], ACTIVE: ['Out', 'p-bad'], RETURN_REQUESTED: ['Return pending', 'p-warn'],
    RETURNED: ['Returned', 'p-ok'], CANCELLED: ['Cancelled', 'p-mute'], REJECTED: ['Rejected', 'p-mute']
  };
  var COND = { Good: 'p-ok', Fair: 'p-info', Incomplete: 'p-warn', Damaged: 'p-bad', 'Under Repair': 'p-warn', Lost: 'p-mute' };
  function pill(text, cls) { return '<span class="pill ' + cls + '">' + esc(text) + '</span>'; }
  function linePill(s, overdue, remark) { if (overdue && s === 'OUT') return pill('Overdue', 'p-bad'); if (s === 'RETURNED' && /^Handed over/.test(remark || '')) return pill('Handed over', 'p-info'); var x = LINE[s] || [s, 'p-mute']; return pill(x[0], x[1]); }
  function orderPill(s, overdue) { if (overdue) return pill('Overdue', 'p-bad'); var x = ORDER[s] || [s, 'p-mute']; return pill(x[0], x[1]); }
  function condPill(c) { return pill(c || 'Good', COND[c] || 'p-mute'); }

  // ---------- toast ----------
  var toastT;
  function toast(msg, isErr) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var t = document.createElement('div'); t.className = 'toast' + (isErr ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(function () { t.remove(); }, isErr ? 4200 : 2600);
  }

  // ---------- bottom sheet ----------
  var stack = [];
  function sheet(html, acts, opts) {
    opts = opts || {};
    var scrim = document.createElement('div'); scrim.className = 'scrim';
    scrim.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div>';
    document.body.appendChild(scrim);
    var api = { el: scrim.querySelector('.sheet'), acts: acts || {}, close: close, onClose: opts.onClose };
    function close() { scrim.remove(); var i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1); if (api.onClose) api.onClose(); }
    scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); });
    stack.push(api);
    var f = api.el.querySelector('[autofocus]'); if (f) setTimeout(function () { f.focus(); }, 60);
    return api;
  }
  function topSheet() { return stack[stack.length - 1] || null; }
  function closeAll() { stack.slice().forEach(function (s) { s.close(); }); }
  function sheetHead(title, sub) {
    return '<div class="sheet-h"><div class="grow"><h2>' + esc(title) + '</h2>' + (sub ? '<div class="muted small">' + esc(sub) + '</div>' : '') + '</div><button class="icon-btn" data-act="close-sheet" aria-label="Close">' + icon('x') + '</button></div>';
  }
  /** Ask for confirmation, optionally with a text field. Resolves to false/null when cancelled. */
  function ask(o) {
    return new Promise(function (resolve) {
      var done = false;
      var s = sheet(sheetHead(o.title) +
        (o.message ? '<p class="muted" style="margin:0 0 14px">' + esc(o.message) + '</p>' : '') +
        (o.input ? '<label class="field" style="margin-bottom:14px"><span>' + esc(o.input) + '</span><textarea class="input" id="ask-input" autofocus placeholder="' + esc(o.placeholder || '') + '"></textarea></label>' : '') +
        '<div class="row"><button class="btn ghost grow" data-act="close-sheet">' + esc(o.back || 'Back') + '</button><button class="btn grow ' + (o.danger ? 'danger' : 'primary') + '" data-act="ask-ok">' + esc(o.ok || 'Confirm') + '</button></div>',
        { 'ask-ok': function () { done = true; var v = o.input ? s.el.querySelector('#ask-input').value.trim() : true; if (o.input && o.required && !v) { toast(o.requiredMsg || 'Please write a reason.', true); done = false; return; } s.close(); resolve(v); } },
        { onClose: function () { if (!done) resolve(o.input ? null : false); } });
    });
  }

  // ---------- photos ----------
  function compress(file, max, q, type) {
    max = max || 1280; q = q || 0.72; type = type || 'image/jpeg';
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('Choose an image file.'));
      var rd = new FileReader();
      rd.onerror = function () { reject(new Error('Could not read that photo.')); };
      rd.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('That photo format is not supported. Try a JPG.')); };
        img.onload = function () {
          var s = Math.min(1, max / Math.max(img.width, img.height));
          var cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          resolve(type === 'image/png' ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', q)); // PNG keeps see-through backgrounds
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }
  /** Open the camera (capture) or the photo picker; resolves with a compressed data URL or null. */
  function pickPhoto(capture, opt) {
    opt = opt || {};
    return new Promise(function (resolve) {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      if (capture) inp.setAttribute('capture', 'environment');
      inp.style.display = 'none'; document.body.appendChild(inp);
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0]; inp.remove();
        if (!f) return resolve(null);
        compress(f, opt.max, opt.q, opt.type).then(resolve, function (e) { toast(e.message, true); resolve(null); });
      });
      inp.click();
    });
  }
  function photoList(text) { return String(text || '').split('\n').filter(Boolean); }
  function photos(urls) {
    if (!urls.length) return '';
    return '<div class="photos">' + urls.map(function (u) { return '<a class="ph" href="' + esc(u) + '" target="_blank" rel="noopener" style="background-image:url(&quot;' + esc(u) + '&quot;)" aria-label="Open photo"></a>'; }).join('') + '</div>';
  }

  /** Item picture with automatic fallback to the category icon if the link is missing or broken. */
  function thumb(url, iconName) {
    if (!url) return icon(iconName);
    return '<img src="' + esc(url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-fb="' + esc(iconName || 'box') + '">';
  }
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (img && img.tagName === 'IMG' && img.getAttribute('data-fb')) { var span = document.createElement('span'); span.className = 'fb'; span.innerHTML = icon(img.getAttribute('data-fb')); img.replaceWith(span.firstChild); }
  }, true);

  // Chip rows (filters, categories): on a phone you swipe them sideways, so fade the edge that has more chips.
  // On a computer they wrap onto extra lines instead (see .chips in styles.css), so nothing hides.
  function chipFade(c) {
    var more = c.scrollWidth - c.clientWidth > 4;
    c.classList.toggle('fade-l', more && c.scrollLeft > 4);
    c.classList.toggle('fade-r', more && c.scrollLeft + c.clientWidth < c.scrollWidth - 4);
  }
  function chipFadeAll() { [].forEach.call(document.querySelectorAll('.chips'), chipFade); }
  document.addEventListener('scroll', function (e) { var t = e.target; if (t && t.classList && t.classList.contains('chips')) chipFade(t); }, true);
  window.addEventListener('resize', debounce(chipFadeAll, 150));
  if (typeof MutationObserver !== 'undefined') {
    var chipRaf = 0;
    new MutationObserver(function () { cancelAnimationFrame(chipRaf); chipRaf = requestAnimationFrame(chipFadeAll); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }

  function debounce(fn, ms) { var t; return function () { var a = arguments, me = this; clearTimeout(t); t = setTimeout(function () { fn.apply(me, a); }, ms); }; }
  function initials(name) { return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }
  // ---------- loading animations ----------
  var LOAD_WORDS = ['Rolling', 'Focusing', 'Checking the shelves', 'Counting batteries', 'Wiping the lenses', 'Syncing'];
  /** Page loading: a small spinning aperture with a crew word, in the middle of the page. */
  function loading() {
    return '<div class="ld" role="status"><span class="ld-ap">' + icon('aperture') + '</span><span>' + LOAD_WORDS[Math.floor(Math.random() * LOAD_WORDS.length)] + '…</span></div>';
  }
  /** Full-screen splash while the app opens (same markup is in index.html so it shows before the scripts load). */
  function boot(name) {
    return '<div class="boot" role="status" aria-label="Loading"><div class="boot-vf"><span class="boot-rec"><b></b>REC</span><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i>' +
      '<svg class="boot-ap" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS.aperture + '</svg></div>' +
      '<div class="boot-name">' + esc(name || 'UmmahPrima Network') + '</div>' +
      '<div class="boot-msg"><span>Opening the store room</span><span>Checking the gear</span><span>Charging batteries</span><span>Almost rolling</span></div>' +
      '<div class="boot-bar"><i></i></div></div>';
  }
  function empty(ic, title, text) { return '<div class="empty">' + icon(ic) + '<b>' + esc(title) + '</b>' + esc(text || '') + '</div>'; }

  return {
    icon: icon, ICONS: ICONS, esc: esc, when: when, day: day, daysAgo: daysAgo, todayStr: todayStr, pill: pill, linePill: linePill, orderPill: orderPill, condPill: condPill,
    toast: toast, sheet: sheet, sheetHead: sheetHead, topSheet: topSheet, closeAll: closeAll, ask: ask, pickPhoto: pickPhoto, photos: photos, photoList: photoList,
    debounce: debounce, hasAlpha: hasAlpha, thumb: thumb, initials: initials, loading: loading, boot: boot, empty: empty
  };
})();
