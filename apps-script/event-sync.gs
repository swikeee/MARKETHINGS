/**
 * MARKETHINGS · Event Sync
 * Pasang di Google Sheet REKAP ALL TIME (Extensions → Apps Script) supaya
 * event yang ditambahkan di dashboard otomatis tersimpan ke tab "EVENT".
 *
 * 1. Tempel kode ini, Save.
 * 2. Jalankan fungsi setupEventSheet() sekali (izinkan akses).
 * 3. (Opsional) Project Settings → Script properties → TOKEN = kata sandi;
 *    isi token yang sama di Pengaturan dashboard (kolom Token).
 * 4. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 * 5. Salin URL /exec ke Pengaturan dashboard → "URL Apps Script event".
 */
const EVENT_SHEET = 'EVENT';
const EVENT_HEAD = ['ID', 'NAMA EVENT', 'JENIS', 'MULAI', 'SELESAI', 'CATATAN', 'DIUBAH'];

function setupEventSheet() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(EVENT_SHEET);
  if (!sh) sh = ss.insertSheet(EVENT_SHEET);
  sh.getRange(1, 1, 1, EVENT_HEAD.length).setValues([EVENT_HEAD])
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#0F766E');
  sh.setFrozenRows(1);
  sh.getRange('A:G').setNumberFormat('@');            // simpan tanggal sebagai teks YYYY-MM-DD
  sh.setColumnWidths(1, 1, 120); sh.setColumnWidth(2, 240); sh.setColumnWidths(3, 3, 110); sh.setColumnWidth(6, 320); sh.setColumnWidth(7, 170);
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(['Open house', 'Pameran', 'Promo', 'Gathering', 'Launching', 'Lainnya'], true).build();
  sh.getRange('C2:C1000').setDataValidation(rule);
  return 'Tab EVENT siap';
}

function doGet() {
  return out({ ok: true, events: readEvents() });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const tok = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (tok && body.token !== tok) return out({ ok: false, error: 'unauthorized' });
    const ev = body.event || {};
    if (!ev.id) return out({ ok: false, error: 'id kosong' });
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const sh = sheet();
      const ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
      const idx = ids.indexOf(String(ev.id));
      if (body.action === 'delete') {
        if (idx >= 0) sh.deleteRow(idx + 2);
        return out({ ok: true });
      }
      const row = [ev.id, ev.name || '', ev.type || 'Lainnya', ev.start || '', ev.end || ev.start || '', ev.notes || '', new Date().toISOString()].map(String);
      if (idx >= 0) sh.getRange(idx + 2, 1, 1, row.length).setValues([row]);
      else sh.appendRow(row);
      return out({ ok: true });
    } finally { lock.releaseLock(); }
  } catch (err) { return out({ ok: false, error: String(err.message || err) }); }
}

function sheet() {
  const ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(EVENT_SHEET)) setupEventSheet();
  return ss.getSheetByName(EVENT_SHEET);
}
function readEvents() {
  const sh = sheet(); const n = sh.getLastRow() - 1; if (n < 1) return [];
  return sh.getRange(2, 1, n, EVENT_HEAD.length).getDisplayValues().map(r => ({ id: r[0], name: r[1], type: r[2], start: r[3], end: r[4], notes: r[5] }));
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
