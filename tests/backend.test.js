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
r = post('syncNow', {}); ok('syncNow berjalan & mencatat log', r.ok && r.status === 'ok' && A.readTable('SyncLog').length === 1 && get().lastSync.summary === r.summary, r.summary);
env.setFetch((url) => url.includes('api.anthropic.com') ? {code:200, type:'application/json', body:JSON.stringify({content:[{type:'text', text:'[{"developer":"Summarecon Bandung","cluster":"Cluster Uji","lb":100,"price":2600000000}]'}]})} : {code:200, type:'text/html', body:'<p>berubah</p>'});
post('syncNow', {}); ok('perubahan harga masuk PriceHistory', get().history.some(h => h.competitorId === 'auto-summarecon-bandung-cluster-uji' && h.oldPrice === 2500000000 && h.newPrice === 2600000000 && h.changePct === 4));
ok('aksi tidak dikenal', post('apaini', {}).error === 'unknown action');
ok('import ke sheet tidak valid ditolak', /tidak valid/.test(post('import', {sheet:'Settings', rows:[{id:'x'}]}).error || ''));
// volume: 300 baris penjualan
r = post('import', {sheet:'Sales', rows:Array.from({length:300}, (_, i) => ({id:'s'+i, date:'2026-0'+(1+i%9)+'-15', cluster:'Padmagriya', price:1.1e9, status:'Akad'}))});
ok('import 300 baris Sales, tanggal tetap teks', r.count === 300 && get().sales.length === 300 && get().sales[5].date === '2026-06-15', get().sales[5].date);
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
