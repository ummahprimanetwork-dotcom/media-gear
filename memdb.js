/* In-memory table store used by demo mode (browser) and tests (node). */
var MemDB = (function () {
  function MemDB(data, onChange) { this.data = data || {}; this.onChange = onChange || function () {}; }
  MemDB.prototype.all = function (t) { return this.data[t] || (this.data[t] = []); };
  MemDB.prototype.insert = function (t, row) { this.all(t).push(row); this.onChange(); return row; };
  MemDB.prototype.update = function (t, row, patch) { Object.assign(row, patch); this.onChange(); return row; };
  return MemDB;
})();

function fmtLocal(d) {
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}
function uuid4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (ch) { var r = Math.random() * 16 | 0; return (ch === 'x' ? r : (r & 3 | 8)).toString(16); });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { MemDB: MemDB, fmtLocal: fmtLocal, uuid4: uuid4 };
