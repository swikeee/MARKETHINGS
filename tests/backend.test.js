// Uji langsung fungsi backend (tanpa browser)
const { makeEnv } = require('./gas-mock'); const assert = require('assert');
const env = makeEnv(require('path').join(__dirname, '..', 'apps-script', 'Code.gs')), A = env.api;
const post = (action, payload, token = 'rahasia123') => JSON.parse(A.doPost({postData:{contents:JSON.stringify({action, token, payload})}}).text);
const get = (token) => JSON.parse(A.doGet({parameter: token ? {token} : {}}).text);
let n = 0; const ok = (name, cond, extra) => { n++; console.log((cond ? '✓' : '✗ GAGAL') + ' ' + name + (extra ? ' · ' + extra : '')); if (!cond) process.exitCode = 1; };
// sebelum setup
ok('sebelum setup(): pesan jelas', /Jalankan setup/.test(get().error || ''), get().error);
A.setup(); A.setup();   // dua kali: aman diulang
ok('setup membuat semua sheet', Object.keys(A.SHEETS).every(s => env.sheets[s] && env.sheets[s].rows[0].join() === A.SHEETS[s].join()));
ok('trigger: sinkron mingguan + penanda perubahan, masing-masing satu', env.triggers.length === 2 && env.triggers.filter(x => x === 'weeklySync').length === 1 && env.triggers.filter(x => x === 'onSheetChange').length === 1, env.triggers.join(','));
ok('sumber awal terisi', A.readTable('Sources').length === 9);
// token
ok('tanpa WRITE_TOKEN semua tulis ditolak', post('ping', {}).error === 'unauthorized');
env.props.WRITE_TOKEN = 'rahasia123';
ok('token salah ditolak', post('ping', {}, 'salah').error === 'unauthorized');
ok('ping', post('ping', {}).ok === true);
ok('baca tanpa token (READ_TOKEN kosong)', get().ok === true);
env.props.READ_TOKEN = 'baca1'; ok('READ_TOKEN: tanpa token ditolak', get().error === 'unauthorized'); ok('READ_TOKEN benar', get('baca1').ok); ok('WRITE_TOKEN juga bisa baca', get('rahasia123').ok); delete env.props.READ_TOKEN;
// kompetitor
let r = post('saveCompetitor', {developer:'Grand Sharon', cluster:'Lavanya', tier:'Milenial', lt:78, lb:58, price:1250000000, sourceDate:'24 Agu 2024', isOwn:false, promo:'DP 5%'});
ok('simpan kompetitor baru', r.ok && /^man-/.test(r.row.id) && r.row.price === 1250000000 && r.row.auto === false);
const cid = r.row.id; r = post('saveCompetitor', {id:cid, price:1300000000});
ok('edit sebagian tidak menghapus kolom lain', r.row.price === 1300000000 && r.row.cluster === 'Lavanya' && r.row.lb === 58);
ok('sourceDate tetap teks', get().competitors.find(c => c.id === cid).sourceDate === '24 Agu 2024', String(get().competitors.find(c => c.id === cid).sourceDate));
// kavling: kode mirip angka, poly array & string, harga kosong
r = post('savePlot', {code:'12', zone:'Zona X', area:500, frontage:20, status:'Available', priceM2:null, rentM2:null, poly:[[0,0],[10,0],[10,5]], drawingId:'f1#2'});
let pl = get().plots.find(p => p.id === r.row.id);
ok('kode kavling "12" tetap teks', pl.code === '12', JSON.stringify(pl.code));
ok('poly array tersimpan sebagai JSON', JSON.stringify(JSON.parse(pl.poly)) === '[[0,0],[10,0],[10,5]]', pl.poly);
ok('harga kosong tetap kosong (ikut base)', pl.priceM2 === null && pl.rentM2 === null);
r = post('import', {sheet:'Plots', rows:[{id:'E5A', code:'E5A', area:650, frontage:26, status:'Available', x:130, y:20, w:26, h:25, dummy:true}, {id:pl.id, rentM2:90000}]});
pl = get().plots; ok('import: tambah + gabung baris lama', r.count === 2 && pl.length === 2 && pl.find(p => p.code === '12').rentM2 === 90000 && pl.find(p => p.code === '12').area === 500 && pl.find(p => p.id === 'E5A').dummy === true);
// penawaran
r = post('saveOffer', {plotCode:'12', tenant:'99.CO', type:'Sewa', priceM2:90000, term:10, inst:48, date:'2026-09-12', status:'Negosiasi', contact:'081234567890', use:'Coffee shop'});
let of = get().offers.find(o => o.id === r.row.id);
ok('penawaran: tanggal tetap YYYY-MM-DD', of.date === '2026-09-12', String(of.date));
ok('penawaran: nomor HP tidak kehilangan 0', of.contact === '081234567890', String(of.contact));
ok('penawaran: plotCode teks, inst & term angka', of.plotCode === '12' && of.inst === 48 && of.term === 10 && of.tenant === '99.CO');
ok('hapus penawaran', post('delete', {sheet:'Offers', id:of.id}).ok === true && get().offers.length === 0);
ok('hapus id yang tidak ada → false, tidak error', post('delete', {sheet:'Offers', id:'zzz'}).ok === false);
ok('hapus dari sheet terlarang ditolak', /Tidak bisa menghapus/.test(post('delete', {sheet:'Sales', id:'x'}).error || ''));
// pengaturan bersama
r = post('saveSetting', {id:'kom', value:JSON.stringify({priceM2:10000000, rentM2:80000})});
ok('saveSetting + snapshot.settings', r.ok && JSON.parse(get().settings.kom).priceM2 === 10000000);
ok('saveSetting nama tidak valid ditolak', !post('saveSetting', {id:'../x', value:'1'}).ok);
// file ke Drive
const data = Buffer.from('%PDF-1.4 isi contoh ' + 'x'.repeat(5000)); r = post('saveFile', {id:'f1', name:'gambar-kerja.pdf', type:'application/pdf', size:data.length, note:'catatan', linkedTo:'12', base64:data.toString('base64')});
const dfiles = Object.values(env.drive.files);
ok('saveFile: tersimpan di Drive, isi utuh', r.ok && dfiles.length === 1 && dfiles[0].bytes.equals(data) && dfiles[0].name === 'gambar-kerja.pdf' && dfiles[0].desc === 'catatan');
ok('saveFile: folder arsip dibuat sekali & diingat', Object.values(env.drive.folders).length === 1 && env.props.ARCHIVE_FOLDER_ID === dfiles[0].folder);
ok('saveFile: baris Files berisi url, driveId tidak bocor ke dashboard', /drive\.google\.com/.test(r.row.url) && !('driveId' in r.row) && get().files[0].url === r.row.url && !('driveId' in get().files[0]));
post('saveFile', {id:'f2', name:'2.jpg', type:'image/jpeg', base64:Buffer.from('abc').toString('base64')});
ok('file kedua masuk folder yang sama', Object.values(env.drive.folders).length === 1 && Object.values(env.drive.files).length === 2);
ok('saveFile kosong ditolak', /File kosong/.test(post('saveFile', {name:'x'}).error || ''));
ok('deleteFile: baris hilang & file ke Trash', post('deleteFile', {id:'f1'}).ok === true && get().files.length === 1 && dfiles[0].trashed === true);
ok('deleteFile id tidak ada → false', post('deleteFile', {id:'nope'}).ok === false);
// selfTest
r = post('selfTest', {}); ok('selfTest: sheet, drive, fetch ok; baris uji dibersihkan', r.sheet.ok && r.drive.ok && r.fetch.ok && !A.readTable('Settings').some(x => String(x.id).startsWith('_')) && !('_tes' in get().settings), JSON.stringify([r.sheet.msg, r.drive.msg, r.fetch.msg]));
env.setFetch(() => { throw new Error('DNS error'); }); r = post('selfTest', {}); ok('selfTest melaporkan fetch gagal tanpa crash', r.ok && r.fetch.ok === false && r.sheet.ok, r.fetch.msg);
// sinkron sumber (fetch + AI ditiru)
env.props.ANTHROPIC_API_KEY = 'sk-test';
env.setFetch((url, o) => url.includes('api.anthropic.com') ? {code:200, type:'application/json', body:JSON.stringify({content:[{type:'text', text:'```json\n[{"developer":"Summarecon Bandung","project":"Gedebage","cluster":"Cluster Uji","lt":120,"lb":100,"price":2500000000,"priceBasis":"cash"}]\n```'}]})}
  : url.includes('gagal') ? {code:404, type:'text/html', body:'nf'} : {code:200, type:'text/html', body:'<html><body><h1>Pricelist</h1><p>Cluster Uji Rp 2,5 M</p></body></html>'});
r = post('fetchUrl', {url:'https://contoh.test/pricelist', developer:'Summarecon Bandung'});
ok('fetchUrl: ambil halaman → ekstrak → simpan kompetitor', r.ok && r.rows === 1 && get().competitors.some(c => c.id === 'auto-summarecon-bandung-cluster-uji' && c.price === 2500000000 && c.auto === true && c.tier === 'Deluxe'), r.summary || r.error);
ok('fetchUrl: sumber baru tercatat', A.readTable('Sources').some(s => s.url === 'https://contoh.test/pricelist' && /tipe unit/.test(s.lastStatus)));
r = post('fetchUrl', {url:'https://contoh.test/gagal'}); ok('fetchUrl 404 → pesan jelas', /HTTP 404/.test(r.error || ''), r.error);
ok('sumber 404 ditandai tidak terjangkau', A.readTable('Sources').some(x => x.url === 'https://contoh.test/gagal' && x.lastStatus === 'HTTP 404' && x.lastFetched));
ok('jadwal sinkron mingguan: hari Rabu', env.weekdays.weeklySync === 'WEDNESDAY', env.weekdays.weeklySync);
r = post('syncNow', {}); ok('syncNow berjalan & mencatat log', r.ok && r.status === 'ok' && A.readTable('SyncLog').length === 1 && get().lastSync.summary === r.summary, r.summary);
env.setFetch((url) => url.includes('api.anthropic.com') ? {code:200, type:'application/json', body:JSON.stringify({content:[{type:'text', text:'[{"developer":"Summarecon Bandung","cluster":"Cluster Uji","lb":100,"price":2600000000}]'}]})} : {code:200, type:'text/html', body:'<p>berubah</p>'});
post('syncNow', {}); ok('perubahan harga masuk PriceHistory', get().history.some(h => h.competitorId === 'auto-summarecon-bandung-cluster-uji' && h.oldPrice === 2500000000 && h.newPrice === 2600000000 && h.changePct === 4));
// stok / terjual yang diisi tangan (atau angka contoh) tidak boleh hilang saat sinkron berikutnya
{ A.upsert('Competitors', {id:'auto-summarecon-bandung-cluster-uji', stock:48, sold:39, months:30, dummy:true});      // diisi langsung di Sheet (baris tetap auto)
  env.setFetch((url) => url.includes('api.anthropic.com') ? {code:200, type:'application/json', body:JSON.stringify({content:[{type:'text', text:'[{"developer":"Summarecon Bandung","cluster":"Cluster Uji","lb":100,"price":2700000000}]'}]})} : {code:200, type:'text/html', body:'<p>berubah lagi</p>'});
  post('syncNow', {}); let c = get().competitors.find(x => x.id === 'auto-summarecon-bandung-cluster-uji');
  ok('sinkron: harga diperbarui, stok/terjual/bulan dan tanda dummy dipertahankan', c.price === 2700000000 && c.stock === 48 && c.sold === 39 && c.months === 30 && c.dummy === true && c.auto === true, JSON.stringify([c.price, c.stock, c.sold, c.months, c.dummy]));
  env.setFetch((url) => url.includes('api.anthropic.com') ? {code:200, type:'application/json', body:JSON.stringify({content:[{type:'text', text:'[{"developer":"Summarecon Bandung","cluster":"Cluster Uji","lb":100,"price":2700000000,"stock":60,"sold":20,"months":10}]'}]})} : {code:200, type:'text/html', body:'<p>ada stok</p>'});
  post('syncNow', {}); c = get().competitors.find(x => x.id === 'auto-summarecon-bandung-cluster-uji');
  ok('sumber memuat stok asli → angka sumber dipakai dan tanda dummy dilepas', c.stock === 60 && c.sold === 20 && c.months === 10 && c.dummy === false, JSON.stringify([c.stock, c.sold, c.months, c.dummy])); }
// event marketing: tersimpan di tab Events (dibuat sendiri), ikut di data GET, bisa diubah & dihapus
{ delete env.sheets.Events;      // seperti Sheet lama yang belum punya tab Events: tab dibuat sendiri
  r = post('saveEvent', {id:'ev1', name:'Open House Akhir Pekan', type:'Open house', start:'2026-09-12', end:'2026-09-13', notes:'di marketing gallery'});
  ok('saveEvent: tersimpan dan ikut di data yang dibaca dashboard', r.ok && r.row.id === 'ev1' && get().events.length === 1 && get().events[0].start === '2026-09-12' && get().events[0].end === '2026-09-13' && get().events[0].name === 'Open House Akhir Pekan', r.error || JSON.stringify(get().events));
  r = post('saveEvent', {id:'ev1', name:'Open House', type:'Open house', start:'2026-09-12', end:'2026-09-01'}); ok('saveEvent id sama → memperbarui, tanggal selesai < mulai dirapikan', get().events.length === 1 && get().events[0].name === 'Open House' && get().events[0].end === '2026-09-12');
  ok('saveEvent menolak tanpa nama / tanggal tidak valid / token salah', post('saveEvent', {start:'2026-09-12'}).ok === false && post('saveEvent', {name:'x', start:'12/09/2026'}).ok === false && post('saveEvent', {name:'x', start:'2026-09-12'}, 'salah').error === 'unauthorized' && get().events.length === 1);
  r = post('saveEvent', {name:'Pameran', type:'Pameran', start:'2026-10-01'}); ok('tanpa id → id dibuat, selesai = mulai', r.ok && /^ev-/.test(r.row.id) && r.row.end === '2026-10-01' && get().events.length === 2);
  r = post('deleteEvent', {id:'ev1'}); const r2 = post('deleteEvent', {id:'tidak-ada'}); ok('deleteEvent: terhapus; id tak dikenal tidak error', r.ok && r.deleted === true && r2.ok && r2.deleted === false && get().events.length === 1); }
ok('aksi tidak dikenal', post('apaini', {}).error === 'unknown action');
ok('import ke sheet tidak valid ditolak', /tidak valid/.test(post('import', {sheet:'Settings', rows:[{id:'x'}]}).error || ''));
// volume: 300 baris penjualan
r = post('import', {sheet:'Sales', rows:Array.from({length:300}, (_, i) => ({id:'s'+i, date:'2026-0'+(1+i%9)+'-15', cluster:'Pastigriya', price:1.1e9, status:'Akad'}))});
ok('import 300 baris Sales, tanggal tetap teks', r.count === 300 && get().sales.length === 300 && get().sales[5].date === '2026-06-15', get().sales[5].date);
// AI: panggilan ke Claude API (ditiru) — format permintaan, kunci salah, kunci kosong
let seen = null;
env.setFetch((url, o) => { if (!url.includes('api.anthropic.com')) return {code:204, body:'', type:'text/plain'}; seen = {url, o, body:JSON.parse(o.payload)};
  return o.headers['x-api-key'] === 'sk-benar' ? {code:200, type:'application/json', body:JSON.stringify({content:[{type:'text', text:'## Ringkasan\n- Penjualan naik'}]})} : {code:401, type:'application/json', body:JSON.stringify({type:'error', error:{type:'authentication_error', message:'invalid x-api-key'}})}; });
env.props.ANTHROPIC_API_KEY = 'sk-benar'; r = post('ai', {prompt:'Ringkas penjualan'});
ok('aksi ai: jawaban Claude diteruskan ke dashboard', r.ok && /Penjualan naik/.test(r.text));
ok('permintaan ke Claude API berformat benar', seen.url === 'https://api.anthropic.com/v1/messages' && seen.o.method === 'post' && seen.o.headers['anthropic-version'] === '2023-06-01' && seen.o.contentType === 'application/json' && seen.body.model === 'claude-sonnet-5-5' && seen.body.max_tokens > 0 && seen.body.messages[0].role === 'user' && seen.body.messages[0].content[0].text === 'Ringkas penjualan', seen.body.model);
ok('Insight/Ringkasan AI: effort low secara bawaan', seen.body.output_config && seen.body.output_config.effort === 'low' && r.effort === 'low', JSON.stringify(seen.body.output_config));
env.props.EFFORT = 'high'; post('ai', {prompt:'x'}); ok('properti EFFORT mengganti effort', seen.body.output_config.effort === 'high');
env.props.EFFORT = 'off'; post('ai', {prompt:'x'}); ok('EFFORT=off → tanpa output_config', !('output_config' in seen.body)); delete env.props.EFFORT;
{ let calls = []; const prev = seen; env.setFetch((url, o) => { const b = JSON.parse(o.payload); calls.push(b);
    return b.output_config ? {code:400, type:'application/json', body:JSON.stringify({type:'error', error:{type:'invalid_request_error', message:'output_config.effort is not supported by this model'}})} : {code:200, type:'application/json', body:JSON.stringify({content:[{type:'text', text:'jawaban tanpa effort'}]})}; });
  const rr = post('ai', {prompt:'x'}); ok('model tanpa dukungan effort → diulang sekali tanpa effort', rr.ok && rr.text === 'jawaban tanpa effort' && calls.length === 2 && calls[0].output_config.effort === 'low' && !calls[1].output_config, rr.error);
  env.setFetch((url, o) => { if (!url.includes('api.anthropic.com')) return {code:204, body:'', type:'text/plain'}; seen = {url, o, body:JSON.parse(o.payload)};
    return o.headers['x-api-key'] === 'sk-benar' ? {code:200, type:'application/json', body:JSON.stringify({content:[{type:'text', text:'## Ringkasan\n- Penjualan naik'}]})} : {code:401, type:'application/json', body:JSON.stringify({type:'error', error:{type:'authentication_error', message:'invalid x-api-key'}})}; }); }
seen = null; post('extract', {text:'Cluster Uji LT 100 LB 80 Rp 2 M'}); ok('ekstraksi brosur tidak mengirim effort', seen && /Cluster Uji LT 100/.test(JSON.stringify(seen.body.messages)) && !('output_config' in seen.body));
env.props.MODEL = 'claude-haiku-4-5-20251001'; post('ai', {prompt:'x'}); ok('properti MODEL mengganti model', seen.body.model === 'claude-haiku-4-5-20251001'); delete env.props.MODEL;
r = post('selfTest', {}); ok('selfTest: kunci benar → AI ✓, effort tercantum', r.ai === true && r.aiTest && r.aiTest.ok === true && /effort low/.test(r.aiTest.msg), r.aiTest && r.aiTest.msg);
env.props.ANTHROPIC_API_KEY = 'sk-salah'; r = post('selfTest', {}); ok('selfTest: kunci salah → AI ✗ dengan pesan dari Claude', r.aiTest && r.aiTest.ok === false && /invalid x-api-key/.test(r.aiTest.msg), r.aiTest && r.aiTest.msg);
r = post('ai', {prompt:'x'}); ok('aksi ai dengan kunci salah → pesan jelas, tidak crash', r.ok === false && /Claude API: invalid x-api-key/.test(r.error), r.error);
delete env.props.ANTHROPIC_API_KEY; r = post('ai', {prompt:'x'}); ok('aksi ai tanpa kunci → pesan jelas', /ANTHROPIC_API_KEY belum diisi/.test(r.error || ''), r.error);
r = post('selfTest', {}); ok('selfTest tanpa kunci: tidak memanggil AI', r.ai === false && !r.aiTest);
ok('kunci API tidak pernah ikut terkirim ke dashboard', !JSON.stringify(get()).includes('sk-') && !JSON.stringify(post('selfTest', {})).includes('sk-'));
// status tiap sumber (dibaca dashboard untuk lampu sambungan)
env.setFetch(() => { throw new Error('DNS error'); }); r = post('fetchUrl', {url:'https://mati.test/x'});
ok('situs tak terjangkau → status "gagal", tidak crash', /DNS error/.test(r.error || '') && A.readTable('Sources').some(x => x.url === 'https://mati.test/x' && /^gagal: /.test(x.lastStatus) && x.lastFetched), r.error);
env.setFetch(() => ({code:200, type:'text/html', body:'<p>harga</p>'})); r = post('fetchUrl', {url:'https://hidup.test/x'});
ok('situs terbaca tapi AI belum aktif → ditandai terbaca, dicoba lagi nanti', /ANTHROPIC_API_KEY belum diisi/.test(r.error || '') && A.readTable('Sources').some(x => x.url === 'https://hidup.test/x' && /^terbaca, ekstraksi AI gagal/.test(x.lastStatus) && !x.lastHash), r.error);
r = post('syncNow', {}); ok('syncNow tetap jalan walau ada sumber gagal', r.ok && Array.isArray(r.failed) && r.failed.length > 0, r.summary);
// batas pemakaian AI harian (pengaman saldo API bila token dashboard diketahui orang lain)
env.props.ANTHROPIC_API_KEY = 'sk-benar'; delete env.props.AI_COUNT; env.props.AI_DAILY_LIMIT = '3';
env.setFetch((url) => url.includes('api.anthropic.com') ? {code:200, type:'application/json', body:JSON.stringify({content:[{type:'text', text:'ok'}]})} : {code:200, type:'text/html', body:'x'});
{ const rs = [1,2,3,4].map(() => post('ai', {prompt:'x'}));
  ok('AI harian: 3 panggilan pertama jalan, yang ke-4 ditolak dengan pesan jelas', rs.slice(0,3).every(x => x.ok) && rs[3].ok === false && /Batas pemakaian AI hari ini tercapai \(3/.test(rs[3].error), rs[3].error);
  ok('hitungan tersimpan per tanggal', /^\d{4}-\d\d-\d\d:3$/.test(env.props.AI_COUNT), env.props.AI_COUNT);
  env.props.AI_COUNT = '2000-01-01:99'; ok('hari berganti → hitungan mulai lagi', post('ai', {prompt:'x'}).ok === true && /:1$/.test(env.props.AI_COUNT));
  env.props.AI_DAILY_LIMIT = '0'; env.props.AI_COUNT = env.props.AI_COUNT.replace(/:\d+$/, ':9999'); ok('AI_DAILY_LIMIT=0 → tanpa batas', post('ai', {prompt:'x'}).ok === true);
  delete env.props.AI_DAILY_LIMIT; ok('bawaan 150 per hari', post('ai', {prompt:'x'}).ok === false); delete env.props.AI_COUNT; ok('di bawah batas bawaan → jalan', post('ai', {prompt:'x'}).ok === true); }
delete env.props.ANTHROPIC_API_KEY; delete env.props.AI_COUNT;
// Gemini sebagai penyedia AI (kuota gratis); Claude tetap bisa dipakai
{ let g = null; const gem = (text, code) => (url, o) => { if (url.includes('generativelanguage.googleapis.com')) { g = {url, o, body:JSON.parse(o.payload)}; return {code:code || 200, type:'application/json', body:JSON.stringify(code ? {error:{code, message:text, status:'X'}} : {candidates:[{content:{parts:[{text:'pikir dulu', thought:true}, {text}]}, finishReason:'STOP'}]})}; }
    if (url.includes('api.anthropic.com')) return {code:200, type:'application/json', body:JSON.stringify({content:[{type:'text', text:'dari claude'}]})}; return {code:200, type:'text/html', body:'<p>Cluster Uji Rp 2,5 M</p>'}; };
  env.props.GEMINI_API_KEY = 'AIza-uji'; delete env.props.AI_COUNT; env.setFetch(gem('## Ringkasan\n- dari gemini'));
  r = post('ai', {prompt:'Ringkas penjualan'});
  ok('GEMINI_API_KEY terisi → fitur AI memakai Gemini', r.ok && /dari gemini/.test(r.text) && r.provider === 'gemini' && !/pikir dulu/.test(r.text), r.text || r.error);
  ok('permintaan ke Gemini berformat benar', g.url === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent' && g.o.headers['x-goog-api-key'] === 'AIza-uji' && g.o.method === 'post' && g.body.contents[0].role === 'user' && g.body.contents[0].parts[0].text === 'Ringkas penjualan' && g.body.generationConfig.maxOutputTokens >= 2048 && g.body.generationConfig.thinkingConfig.thinkingLevel === 'low' && !g.url.includes('AIza'), g.url);
  ok('snapshot & ping: AI aktif walau kunci Claude kosong', get().ai === true && post('ping', {}).ai === true);
  env.setFetch(gem('{"developer":"Grand Uji","cluster":"Melati","tier":"Deluxe","lt":120,"lb":98,"price":2150000000,"promo":"","notes":""}'));
  r = post('extract', {text:'brosur', imageBase64:'QUJD', mediaType:'image/jpeg'});
  ok('ekstrak brosur lewat Gemini: gambar dikirim sebagai inline_data, JSON terbaca', r.ok && r.data.price === 2150000000 && g.body.contents[0].parts.some(x => x.inline_data && x.inline_data.mime_type === 'image/jpeg' && x.inline_data.data === 'QUJD') && !g.body.generationConfig.thinkingConfig, r.error);
  r = post('selfTest', {}); ok('selfTest menyebut Gemini dan modelnya', r.provider === 'gemini' && r.aiTest.ok && /Gemini menjawab · model gemini-3\.8-flash/.test(r.aiTest.msg), r.aiTest && r.aiTest.msg);
  env.props.GEMINI_MODEL = 'gemini-3.5-flash-lite'; post('ai', {prompt:'x'}); ok('GEMINI_MODEL mengganti model', /models\/gemini-3\.5-flash-lite:generateContent$/.test(g.url)); delete env.props.GEMINI_MODEL;
  env.setFetch(gem('Resource has been exhausted', 429)); r = post('ai', {prompt:'x'}); ok('kuota Gemini habis → pesan jelas', r.ok === false && /kuota gratis/.test(r.error), r.error);
  env.setFetch(gem('API key not valid. Please pass a valid API key.', 400)); r = post('ai', {prompt:'x'}); ok('kunci Gemini salah → pesan dari Google diteruskan', r.ok === false && /Gemini: API key not valid/.test(r.error), r.error);
  { let n2 = 0; env.setFetch((url, o) => { n2++; const b = JSON.parse(o.payload); return b.generationConfig.thinkingConfig ? {code:400, type:'application/json', body:JSON.stringify({error:{message:'Unknown name "thinkingLevel" at generation_config.thinking_config'}})} : {code:200, type:'application/json', body:JSON.stringify({candidates:[{content:{parts:[{text:'tanpa thinking'}]}}]})}; });
    r = post('ai', {prompt:'x'}); ok('model menolak thinkingLevel → diulang sekali tanpa itu', r.ok && r.text === 'tanpa thinking' && n2 === 2, r.error); }
  env.setFetch((url) => ({code:200, type:'application/json', body:JSON.stringify({candidates:[{content:{parts:[]}, finishReason:'MAX_TOKENS'}]})})); r = post('ai', {prompt:'x'}); ok('jawaban kosong → pesan jelas, bukan teks kosong', r.ok === false && /tidak memberi jawaban \(MAX_TOKENS\)/.test(r.error), r.error);
  { const tried = []; env.setFetch((url, o) => { const m = url.match(/models\/([^:]+):/)[1]; tried.push(m);
      return m === 'gemini-3.8-flash' || m === 'gemini-3.7-flash' ? {code:503, type:'application/json', body:JSON.stringify({error:{code:503, message:'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.', status:'UNAVAILABLE'}})}
        : {code:200, type:'application/json', body:JSON.stringify({candidates:[{content:{parts:[{text:'dari model pengganti'}]}}]})}; });
    r = post('ai', {prompt:'x'}); ok('model utama sedang penuh (503) → otomatis pindah ke model Flash berikutnya', r.ok && r.text === 'dari model pengganti' && tried.join(',') === 'gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash', tried.join(','));
    const c0 = env.props.AI_COUNT; tried.length = 0; r = post('selfTest', {}); ok('selfTest melaporkan model pengganti yang dipakai', r.aiTest.ok && /model gemini-3\.6-flash \(pengganti, gemini-3\.8-flash sedang penuh\)/.test(r.aiTest.msg), r.aiTest.msg);
    ok('pindah model tidak dihitung dobel di batas harian', Number(env.props.AI_COUNT.split(':')[1]) === Number(c0.split(':')[1]) + 1, c0 + ' → ' + env.props.AI_COUNT);
    env.setFetch(() => ({code:503, type:'application/json', body:JSON.stringify({error:{code:503, message:'high demand'}})})); tried.length = 0; r = post('ai', {prompt:'x'});
    ok('semua model penuh → pesan jelas', r.ok === false && /semua model Flash sedang penuh/.test(r.error), r.error); }
  env.props.ANTHROPIC_API_KEY = 'sk-benar'; env.props.AI_PROVIDER = 'claude'; env.setFetch(gem('dari gemini')); r = post('ai', {prompt:'x'}); ok('AI_PROVIDER=claude memaksa Claude walau kunci Gemini ada', r.ok && r.text === 'dari claude' && r.provider === 'claude', r.text);
  delete env.props.AI_PROVIDER; r = post('ai', {prompt:'x'}); ok('dua kunci terisi, tanpa AI_PROVIDER → Gemini', r.provider === 'gemini');
  ok('kunci Gemini tidak pernah ikut terkirim ke dashboard', !JSON.stringify(get()).includes('AIza') && !JSON.stringify(post('selfTest', {})).includes('AIza'));
  delete env.props.GEMINI_API_KEY; delete env.props.ANTHROPIC_API_KEY; delete env.props.AI_COUNT; }
// baca brosur utuh: semua cluster & semua tipe unit (kamar tidur, kamar mandi, lantai ikut)
{ let g = null; env.props.GEMINI_API_KEY = 'AIza-uji'; delete env.props.AI_COUNT;
  const answer = {developer:'Grand Uji', project:'Timur Kota', location:'Bandung', units:[
    {cluster:'Melati', type:'Anggrek 8x15', lt:'120', lb:98, kt:3, km:2, floors:2, price:2150000000, priceBasis:'cash keras', promo:'DP 0%', notes:'carport 2', page:5},
    {cluster:'Melati', type:'Dahlia', lt:162, lb:140, kt:'4', km:3, floors:2, price:null, priceBasis:'', promo:'', notes:'', page:6},
    {cluster:'Ruko Plaza', type:'R1', lt:75, lb:150, kt:0, km:2, floors:3, price:'3500000000', page:9},
    {cluster:'', type:''}, null]};
  env.setFetch((url, o) => { g = {url, body:JSON.parse(o.payload)}; return {code:200, type:'application/json', body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(answer)}]}}]})}; });
  r = post('extractAll', {text:'[Halaman 5]\nPrice list', images:[{page:5, mediaType:'image/jpeg', data:'QUFB'}, {page:6, mediaType:'image/jpeg', data:'QkJC'}]});
  const parts = g.body.contents[0].parts;
  ok('extractAll: semua halaman dikirim berlabel nomor halaman + teks dokumen', parts[0].text === '[Gambar · halaman 5]' && parts[1].inline_data.data === 'QUFB' && parts[2].text === '[Gambar · halaman 6]' && parts[3].inline_data.data === 'QkJC' && /SEMUA cluster dan SEMUA tipe/.test(parts[4].text) && /TEKS DOKUMEN:\n\[Halaman 5\]/.test(parts[4].text));
  ok('extractAll: minta JSON murni, tanpa memaksa berpikir pendek', g.body.generationConfig.responseMimeType === 'application/json' && !g.body.generationConfig.thinkingConfig && g.body.generationConfig.maxOutputTokens >= 20000);
  ok('extractAll: semua tipe terbaca, baris kosong dibuang', r.ok && r.units.length === 3 && r.developer === 'Grand Uji' && r.project === 'Timur Kota', r.error || JSON.stringify(r.units.map(u => u.type)));
  const u0 = r.units[0], u1 = r.units[1], u2 = r.units[2];
  ok('angka dirapikan (teks → angka), kamar tidur/mandi/lantai ikut', u0.lt === 120 && u0.lb === 98 && u0.kt === 3 && u0.km === 2 && u0.floors === 2 && u0.price === 2150000000 && u0.page === 5 && u1.kt === 4 && u2.price === 3500000000, JSON.stringify(u0));
  ok('harga yang tidak tercantum tetap kosong (null), tidak dikarang', u1.price === null && u2.kt === null);
  ok('tier dihitung: LB 98 → Deluxe, LB 140 → Premium, ruko → Shophouse', u0.tier === 'Deluxe' && u1.tier === 'Premium' && u2.tier === 'Shophouse', [u0.tier, u1.tier, u2.tier].join(','));
  ok('aturan harga & posisi unit ada di instruksi: tunai keras → tunai 2x, tipe standar, bukan KPR', /TUNAI KERAS/.test(parts[4].text) && /TUNAI 2X/.test(parts[4].text) && /unit STANDAR/.test(parts[4].text) && /Jangan pernah mengambil harga KPR/.test(parts[4].text) && !/beberapa file untuk proyek yang sama/.test(parts[4].text));
  answer.units[0].type = 'Anggrek 8x15 Standard'; answer.units[0].file = 'pricelist.pdf';
  r = post('extractAll', {text:'x', images:[{page:1, file:'brosur.pdf', data:'QUFB'}, {page:1, file:'pricelist.pdf', data:'QkJC'}]}); const p2 = g.body.contents[0].parts;
  ok('beberapa file: gambar berlabel nama file, AI diminta menggabungkan brosur + pricelist', p2[0].text === '[Gambar · file "brosur.pdf" · halaman 1]' && p2[2].text === '[Gambar · file "pricelist.pdf" · halaman 1]' && /beberapa file untuk proyek yang sama/.test(p2[4].text) && /harga dari pricelist/.test(p2[4].text));
  ok('nama file sumber ikut di hasil, akhiran "Standard" dibuang dari nama tipe', r.units[0].file === 'pricelist.pdf' && r.units[0].type === 'Anggrek 8x15', JSON.stringify([r.units[0].type, r.units[0].file]));
  // hapus banyak baris sekaligus (data lama hasil baca brosur)
  { ['dm1','dm2','dm3'].forEach(id => post('saveCompetitor', {id, developer:'PT Uji Hapus', cluster:id, tier:'Deluxe'}));
    r = post('deleteMany', {sheet:'Competitors', ids:['dm1','dm3','tidak-ada']}); const left = env.api.readTable('Competitors').filter(c => c.developer === 'PT Uji Hapus').map(c => c.id).join(',');
    ok('deleteMany: baris yang disebut terhapus, sisanya utuh, butuh token tulis', r.ok && r.deleted === 2 && left === 'dm2' && post('deleteMany', {sheet:'Competitors', ids:['dm2']}, 'salah').error === 'unauthorized', JSON.stringify(r) + ' ' + left);
    post('delete', {sheet:'Competitors', id:'dm2'}); }
  // gambar fasad: AI menandai halaman + kotak; nilai yang tidak masuk akal dibuang; foto tersimpan di kolom image
  { const ans = {developer:'Grand Uji', units:[{cluster:'Melati', type:'A', lb:98, price:2e9, imageFile:'brosur.pdf', imagePage:3, imageBox:[0.52, 0.1, 0.96, 0.48]}, {cluster:'Melati', type:'B', lb:120, imagePage:4, imageBox:[0.9, 0.5, 0.1, 0.2]},
      {cluster:'Melati', type:'C', lb:70, imagePage:2, imageBox:[0.1, 0.1, 0.12, 0.9]}, {cluster:'Melati', type:'D', lb:60, imagePage:null, imageBox:[0, 0, 1, 1]}, {cluster:'Melati', type:'E', lb:60, imagePage:2, imageBox:'kiri atas'}]};
    env.setFetch((url, o) => { g = {url, body:JSON.parse(o.payload)}; return {code:200, type:'application/json', body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(ans)}]}}]})}; });
    r = post('extractAll', {text:'x', images:[{page:3, data:'QUFB'}]}); const U = r.units, pt = g.body.contents[0].parts.at(-1).text;
    ok('instruksi AI meminta lokasi gambar fasad (halaman + kotak pecahan 0–1), bukan denah', /GAMBAR FASAD/.test(pt) && /imageBox = \[x0, y0, x1, y1\]/.test(pt) && /bukan denah/.test(pt) && /jangan menebak/.test(pt));
    ok('kotak fasad diteruskan; kotak terbalik dirapikan; kotak terlalu sempit / tanpa halaman / bukan angka dibuang', U[0].imagePage === 3 && U[0].imageFile === 'brosur.pdf' && U[0].imageBox.join() === '0.52,0.1,0.96,0.48' && U[1].imageBox.join() === '0.1,0.2,0.9,0.5' && U[2].imageBox === null && U[2].imagePage === null && U[3].imageBox === null && U[4].imageBox === null, JSON.stringify(U.map(u => [u.imagePage, u.imageBox])));
    const img = 'data:image/jpeg;base64,' + 'A'.repeat(4000);
    r = post('saveCompetitor', {id:'img1', developer:'Grand Uji', cluster:'Melati', unitType:'A', tier:'Deluxe', price:2e9, image:img}); let c = get().competitors.find(x => x.id === 'img1');
    ok('foto fasad tersimpan di kolom image dan ikut terbaca', r.ok && c.image === img);
    post('saveCompetitor', {id:'img1', price:2.1e9}); ok('mengubah data lain tidak menghapus fotonya', get().competitors.find(x => x.id === 'img1').image === img);
    post('saveCompetitor', {id:'img2', developer:'Grand Uji', cluster:'Melati', unitType:'B', tier:'Deluxe', image:'data:image/jpeg;base64,' + 'A'.repeat(60000)}); post('saveCompetitor', {id:'img3', developer:'Grand Uji', cluster:'Melati', unitType:'C', tier:'Deluxe', image:'javascript:alert(1)'});
    ok('gambar terlalu besar atau bukan data URI gambar tidak disimpan', get().competitors.find(x => x.id === 'img2').image === '' && get().competitors.find(x => x.id === 'img3').image === '');
    { const a2 = {developer:'Grand Uji', units:[{cluster:'Melati', type:'A', lb:98, planFile:'brosur.pdf', planPage:5, planBox:[0.05, 0.3, 0.95, 0.9]}, {cluster:'Melati', type:'B', lb:98, planPage:5, planBox:null}]};
      env.setFetch((url, o) => { g = {url, body:JSON.parse(o.payload)}; return {code:200, type:'application/json', body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(a2)}]}}]})}; });
      const rr = post('extractAll', {text:'x', images:[{page:5, data:'QUFB'}]}), pt2 = g.body.contents[0].parts.at(-1).text;
      ok('denah: AI diminta menandai layout lantai tiap tipe (semua lantai, bukan site plan); hasilnya diteruskan', /DENAH/.test(pt2) && /planBox/.test(pt2) && /SEMUA lantainya/.test(pt2) && /site plan/.test(pt2) && rr.units[0].planPage === 5 && rr.units[0].planBox.join() === '0.05,0.3,0.95,0.9' && rr.units[0].planFile === 'brosur.pdf' && rr.units[1].planPage === null && rr.units[1].planBox === null, JSON.stringify(rr.units.map(u => [u.planPage, u.planBox])));
      post('import', {sheet:'Competitors', rows:[{id:'img1', plan:img}]}); const c2 = get().competitors.find(x => x.id === 'img1');
      ok('denah tersimpan di kolom plan tanpa mengubah foto fasad & data lain', c2.plan === img && c2.image === img && c2.price === 2.1e9); }
    post('saveCompetitor', {id:'img1', image:''}); ok('foto bisa dihapus', get().competitors.find(x => x.id === 'img1').image === ''); ['img1','img2','img3'].forEach(id => post('delete', {sheet:'Competitors', id})); }
  // developer = nama di logo (bukan PT), segmen dari foto
  { const ans = {developer:'summarecon  bandung', developerFrom:'logo kanan atas hal 1', legalEntity:'PT. Mahkota Permata Perdana', project:'Diamond Commercial', location:'Gedebage', units:[
      {cluster:'Diamond Commercial', type:'5x17', tier:'Shophouse', tierFrom:'foto hal 2: deretan ruko 2 lantai', lt:123, lb:85, floors:2, price:2670000000, priceBasis:'tunai keras'},
      {cluster:'Diamond Commercial', type:'7x17', tier:'Ngawur', lt:167, lb:119, floors:2, price:3690000000}]};
    env.setFetch((url, o) => { g = {url, body:JSON.parse(o.payload)}; return {code:200, type:'application/json', body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(ans)}]}}]})}; });
    r = post('extractAll', {text:'x', images:[{page:1, file:'brosur.pdf', data:'QUFB'}, {page:1, file:'pricelist.pdf', data:'QkJC'}], knownDevs:['Pororo Land', 'Summarecon Bandung', 'abaikan"`${x}\nini']});
    const t = g.body.contents[0].parts[4].text;
    ok('instruksi developer: baca LOGO (kanan/kiri atas), bukan nama PT; daftar developer dashboard ikut dikirim', /seperti yang tertulis di LOGO/.test(t) && /pojok kanan atas/.test(t) && /JANGAN memakai nama badan hukum/.test(t) && /Pororo Land; Summarecon Bandung/.test(t) && !/\$\{x\}/.test(t));
    ok('instruksi segmen: ditentukan dari FOTO / render, ruko → Shophouse', /dari FOTO \/ gambar render/.test(t) && /"Shophouse": ruko/.test(t) && /Nama jalan, alamat, boulevard, distrik, atau kawasan BUKAN cluster/.test(t) && /nama produk komersial/.test(t));
    ok('instruksi gabung: nama tipe brosur ≠ pricelist dicocokkan lewat luas, L/R jadi satu tipe', /sering TIDAK sama/.test(t) && /Varian cermin kiri \/ kanan/.test(t));
    ok('developer disamakan ejaannya dengan yang sudah ada di dashboard, PT masuk ke badan hukum', r.developer === 'Summarecon Bandung' && r.legalEntity === 'PT. Mahkota Permata Perdana' && r.developerFrom === 'logo kanan atas hal 1' && r.devIsLegal === false, JSON.stringify([r.developer, r.legalEntity, r.devIsLegal]));
    ok('segmen dari AI dipakai (LB 85 tetap Shophouse, bukan Deluxe); nilai ngawur → dihitung dari LB', r.units[0].tier === 'Shophouse' && r.units[0].tierFrom.includes('ruko') && r.units[1].tier === 'Deluxe', JSON.stringify(r.units.map(u => u.tier)));
    ans.developer = 'PT. Mahkota Permata Perdana'; ans.legalEntity = ''; r = post('extractAll', {text:'x'});
    ok('AI tetap membalas nama PT → ditandai supaya dashboard mengingatkan', r.devIsLegal === true && r.legalEntity === 'PT. Mahkota Permata Perdana', JSON.stringify([r.developer, r.devIsLegal])); }
  env.setFetch(() => ({code:200, type:'application/json', body:JSON.stringify({candidates:[{content:{parts:[{text:'maaf saya tidak bisa'}]}}]})})); r = post('extractAll', {text:'x'});
  ok('jawaban AI bukan JSON → pesan jelas', r.ok === false && /tidak berupa JSON/.test(r.error), r.error);
  // kolom baru di sheet: judul menyesuaikan sendiri tanpa setup() ulang, lalu nilainya tersimpan
  const sh = env.sheets.Competitors; const before = sh.rows ? null : null;
  r = post('saveCompetitor', {developer:'Grand Uji', cluster:'Melati', unitType:'Anggrek 8x15', tier:'Deluxe', lt:120, lb:98, kt:3, km:2, floors:2, price:2150000000});
  const saved = A.readTable('Competitors').find(c => c.unitType === 'Anggrek 8x15');
  ok('produk menyimpan tipe unit, kamar tidur, kamar mandi, lantai', r.ok && saved && saved.kt === 3 && saved.km === 2 && saved.floors === 2 && saved.unitType === 'Anggrek 8x15', JSON.stringify(saved && [saved.unitType, saved.kt, saved.km, saved.floors]));
  ok('snapshot membawa kolom baru ke dashboard', get().competitors.some(c => c.unitType === 'Anggrek 8x15' && c.kt === 3));
  delete env.props.GEMINI_API_KEY; delete env.props.AI_COUNT; }
// sheet dari versi lama (belum punya kolom tipe/kamar): judul kolom dilengkapi sendiri saat pertama dipakai
{ const e2 = makeEnv(require('path').join(__dirname, '..', 'apps-script', 'Code.gs')); e2.api.setup(); e2.props.WRITE_TOKEN = 't';
  const sh = e2.sheets.Competitors, full = sh.rows[0].length; sh.rows[0].length = full - 6; delete sh.fmt[full - 5]; delete sh.fmt[full - 1]; delete sh.fmt[full];
  sh.rows.push(['lama-1', 'Dev Lama', '', 'Cluster Lama', 'Deluxe', 100, 80, 1500000000]);
  const res = JSON.parse(e2.api.doPost({postData:{contents:JSON.stringify({token:'t', action:'saveCompetitor', payload:{developer:'Dev Baru', cluster:'C', unitType:'36/72', kt:2, km:1, floors:1, lb:36, lt:72, price:500000000}})}}).text);
  const T = e2.api.readTable('Competitors');
  ok('sheet lama: judul kolom baru ditambahkan otomatis, tanpa setup() ulang', res.ok && sh.rows[0].length === full && sh.rows[0].slice(-6).join() === 'unitType,kt,km,floors,image,plan' && sh.fmt[full - 5] === '@' && sh.fmt[full - 1] === '@' && sh.fmt[full] === '@', sh.rows[0].slice(-5).join());
  ok('sheet lama: baris lama utuh, baris baru menyimpan tipe & kamar', T.length === 2 && T.find(c => c.id === 'lama-1').price === 1500000000 && T.find(c => c.id === 'lama-1').kt === null && T.find(c => c.unitType === '36/72').kt === 2, JSON.stringify(T.map(c => [c.id, c.unitType, c.kt]))); }
// penanda perubahan untuk sinkron otomatis
const rev = () => JSON.parse(A.doGet({parameter:{rev:'1'}}).text);
let r0 = rev(); ok('cek revisi ringan: hanya mengembalikan penanda, bukan data', r0.ok && typeof r0.rev === 'string' && !('competitors' in r0), r0.rev);
ok('tanpa perubahan penanda tetap', rev().rev === r0.rev);
const wait = ms => { const t = Date.now(); while (Date.now() - t < ms); };
wait(3); A.onEdit({}); let r1 = rev(); ok('edit sel di Sheet (onEdit) mengubah penanda', r1.rev !== r0.rev);
wait(3); A.onSheetChange({}); let r2 = rev(); ok('tambah/hapus baris (onChange) mengubah penanda', r2.rev !== r1.rev);
env.state.modTime += 5000; let r3 = rev(); ok('perubahan lewat jalur lain (waktu ubah file Drive) mengubah penanda', r3.rev !== r2.rev);
wait(3); post('saveOffer', {plotCode:'E5A', tenant:'Uji Rev', type:'Sewa', priceM2:90000}); let r4 = rev(); ok('simpan dari dashboard mengubah penanda', r4.rev !== r3.rev);
ok('snapshot membawa penanda yang sama', get().rev === rev().rev);
wait(3); post('ping', {}); ok('aksi baca (ping) tidak mengubah penanda', rev().rev === r4.rev);
env.props.READ_TOKEN = 'baca1'; ok('cek revisi ikut aturan READ_TOKEN', JSON.parse(A.doGet({parameter:{rev:'1'}}).text).error === 'unauthorized' && JSON.parse(A.doGet({parameter:{rev:'1', token:'baca1'}}).text).ok); delete env.props.READ_TOKEN;
console.log(process.exitCode ? '\nADA YANG GAGAL' : `\nSemua ${n} uji backend lulus`);
