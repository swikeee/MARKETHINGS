// Simulasi layanan Google Apps Script untuk menjalankan Code.gs apa adanya di Node.
// Meniru juga kebiasaan Sheets mengubah teks menjadi angka/tanggal di sel yang tidak diformat teks.
const fs = require('fs'), vm = require('vm'), http = require('http'), crypto = require('crypto');
function makeEnv(codePath){
  const sheets = {}, props = {}, drive = {folders:{}, files:{}}, triggers = [], log = [];
  const coerce = (v, fmt) => { if (fmt === '@' || typeof v !== 'string') return v; const t = v.trim();
    if (/^[+-]?\d+([.,]\d+)?([eE][+-]?\d+)?$/.test(t)) return Number(t.replace(',', '.'));
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(t + 'T00:00:00+07:00');
    if (/^\d{4}-\d{2}$/.test(t)) return new Date(t + '-01T00:00:00+07:00');
    if (/^\d{1,2} (Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des) \d{4}$/.test(t)) return new Date(2024, 0, 1);
    if (t === 'TRUE') return true; if (t === 'FALSE') return false; return v; };
  class Sheet { constructor(name){ this.name = name; this.rows = []; this.fmt = {}; this.maxRows = 1000; }
    getLastRow(){ let n = this.rows.length; while (n && this.rows[n-1].every(v => v === '' || v == null)) n--; return n; }
    getLastColumn(){ return Math.max(0, ...this.rows.map(r => { let n = r.length; while (n && (r[n-1] === '' || r[n-1] == null)) n--; return n; })); }
    getMaxRows(){ return this.maxRows; } setFrozenRows(){ return this; }
    appendRow(row){ const n = this.getLastRow(); this.rows.length = n; this.rows.push(row.map((v, i) => coerce(v, this.fmt[i+1]))); }
    deleteRow(r){ if (r < 1 || r > this.rows.length) throw new Error('Those rows are out of bounds.'); this.rows.splice(r-1, 1); }
    getRange(r, c, nr = 1, nc = 1){ const sh = this; if (nr < 1 || nc < 1) throw new Error('The number of rows in the range must be at least 1.');
      const api = { getValues(){ const out = []; for (let i = 0; i < nr; i++){ const row = sh.rows[r-1+i] || []; out.push(Array.from({length:nc}, (_, j) => row[c-1+j] ?? '')); } return out; },
        setValues(vals){ if (vals.length !== nr || vals.some(v => v.length !== nc)) throw new Error('The number of rows/columns in the data does not match the range.');
          vals.forEach((row, i) => { const t = sh.rows[r-1+i] || (sh.rows[r-1+i] = []); row.forEach((v, j) => t[c-1+j] = coerce(v, sh.fmt[c+j])); }); for (let i = 0; i < sh.rows.length; i++) if (!sh.rows[i]) sh.rows[i] = []; return api; },
        setFontWeight(){ return api; }, setNumberFormat(f){ for (let j = 0; j < nc; j++) sh.fmt[c+j] = f; return api; } }; return api; } }
  const ss = { getId: () => 'ss-simulasi', getName: () => 'MARKETHINGS DB (simulasi)', getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet(n)) };
  const state = { modTime: 1 };   // waktu ubah file di Drive (dinaikkan uji untuk meniru edit lewat jalur lain)
  const blobOf = (bytes, type, name) => ({ getBytes: () => bytes, getContentType: () => type, getName: () => name, getDataAsString: () => Buffer.from(bytes).toString('utf8') });
  const mkFile = (blob, folder) => { const id = 'drv' + crypto.randomBytes(6).toString('hex'); const f = {id, name:blob.getName(), type:blob.getContentType(), bytes:Buffer.from(blob.getBytes()), folder:folder.id, trashed:false, desc:''};
    drive.files[id] = f; return { getId: () => id, getUrl: () => 'https://drive.google.com/file/d/' + id + '/view', getName: () => f.name, setDescription: d => { f.desc = d; }, setTrashed: t => { f.trashed = t; } }; };
  const mkFolder = f => ({ getId: () => f.id, getName: () => f.name, getUrl: () => 'https://drive.google.com/drive/folders/' + f.id, createFile: blob => mkFile(blob, f) });
  let fetchImpl = url => ({ code: 204, body: '', type: 'text/plain' });
  const g = {
    SpreadsheetApp: { getActive: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    ScriptApp: { WeekDay: {MONDAY:'MONDAY'}, getProjectTriggers: () => triggers.map(t => ({ getHandlerFunction: () => t })), deleteTrigger: t => { const i = triggers.indexOf(t.getHandlerFunction()); if (i >= 0) triggers.splice(i, 1); },
      newTrigger: fn => { const b = { timeBased: () => b, onWeekDay: () => b, atHour: () => b, forSpreadsheet: () => b, onChange: () => b, onEdit: () => b, create: () => { triggers.push(fn); } }; return b; } },
    Utilities: { getUuid: () => crypto.randomUUID(), base64Encode: b => Buffer.from(b).toString('base64'), base64Decode: s => [...Buffer.from(s, 'base64')], newBlob: (data, type, name) => blobOf(typeof data === 'string' ? [...Buffer.from(data)] : data, type, name),
      DigestAlgorithm: {MD5:'md5'}, computeDigest: (alg, bytes) => [...crypto.createHash('md5').update(Buffer.from(bytes)).digest()],
      formatDate: (d, tz, f) => { const z = new Date(d.getTime() + 7*3600e3).toISOString(); return f === 'yyyy-MM' ? z.slice(0,7) : z.slice(0,10); } },
    DriveApp: { createFolder: name => { const f = {id:'fld' + crypto.randomBytes(5).toString('hex'), name}; drive.folders[f.id] = f; return mkFolder(f); },
      getFolderById: id => { if (!drive.folders[id]) throw new Error('No item with the given ID could be found'); return mkFolder(drive.folders[id]); },
      getFileById: id => { if (id === 'ss-simulasi') return { getLastUpdated: () => new Date(state.modTime) }; const f = drive.files[id]; if (!f) throw new Error('not found'); return { setTrashed: t => { f.trashed = t; } }; } },
    ContentService: { MimeType: {JSON:'application/json'}, createTextOutput: t => ({ text: t, setMimeType(){ return this; } }) },
    UrlFetchApp: { fetch: (url, o) => { const r = fetchImpl(url, o); return { getResponseCode: () => r.code, getContentText: () => r.body, getBlob: () => blobOf([...Buffer.from(r.body)], r.type, 'x') }; } },
    Logger: { log: m => log.push(String(m)) }, console,
  };
  const ctx = vm.createContext(g);
  vm.runInContext(fs.readFileSync(codePath, 'utf8') + '\n;this.__api = {setup, doGet, doPost, selfTest, readTable, SHEETS, onEdit, onSheetChange, revision};', ctx, {filename:'Code.gs'});
  return { api: ctx.__api, sheets, props, drive, triggers, log, state, setFetch: f => { fetchImpl = f; } };
}
function serve(env, port){
  const srv = http.createServer((req, res) => { const cors = {'Access-Control-Allow-Origin':'*', 'Content-Type':'application/json'};
    const u = new URL(req.url, 'http://x'); let body = '';
    req.on('data', d => body += d); req.on('end', () => { let o;
      try { o = req.method === 'POST' ? env.api.doPost({postData:{contents:body}, parameter:Object.fromEntries(u.searchParams)}) : env.api.doGet({parameter:Object.fromEntries(u.searchParams)}); }
      catch (e) { o = {text: JSON.stringify({ok:false, error:'MOCK CRASH: ' + e.message})}; }
      res.writeHead(200, cors); res.end(o.text); }); });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)));
}
module.exports = { makeEnv, serve };
