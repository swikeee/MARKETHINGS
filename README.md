# MARKETHINGS — Everything Marketing in One Place

Dashboard riset kompetitor, inventori kavling komersial (termasuk pembaca gambar DWG/DXF/PDF), dan simulator BEP investor yang berjalan sendiri tanpa claude.ai.

```
index.html  ──fetch──▶  Google Apps Script (Web App)  ──▶  Google Sheet (database)
                               │
                               ├─ UrlFetchApp: baca pricelist PDF / halaman / berita
                               ├─ Claude API: ekstrak harga + insight + proposal
                               └─ Trigger mingguan: sinkron otomatis tiap Rabu pagi
```

## Isi paket

| File | Fungsi |
|---|---|
| `index.html` | Dashboard. Bisa dibuka langsung dari file, atau di-host (GitHub Pages, Google Sites, server internal). |
| `apps-script/Code.gs` | Backend: API, sinkron sumber, ekstraksi AI, riwayat harga. |
| `apps-script/appsscript.json` | Manifest Apps Script (zona waktu, izin, setelan web app). |
| `vendor/` | Pembaca DWG (libredwg-web) dan PDF (pdf.js). **Harus tetap satu folder dengan `index.html`.** |
| `assets/` | Salinan foto banner (sudah ditanam di `index.html`; folder ini hanya untuk referensi/penggantian). |
| `contoh/` | Gambar dummy untuk mencoba: `siteplan-komersial-dummy.dxf` dan `gambar-kerja-dummy.pdf`. |

Dashboard punya empat segmen: **Sales Report**, **Market Research**, **Lahan Komersial**, dan **Simulator Investor**. Sales Report membaca sheet Sales (satu baris per booking) dan Leads (jumlah leads & kunjungan per bulan per channel); selama dua sheet ini kosong, segmen itu memakai data dummy.

Tanpa backend, `index.html` jalan dalam **mode demo** dengan data contoh (13 produk Summarecon Bandung & KBP dari sumber publik, plus data dummy). Data dummy diberi label "dummy".

## Setup (sekitar 15 menit)

1. **Buat Google Sheet baru**, misalnya "Land Intel DB".
2. Buka **Extensions → Apps Script**.
   - Ganti isi `Code.gs` dengan file `apps-script/Code.gs`.
   - Di **Project Settings**, centang *Show "appsscript.json" manifest file in editor*, lalu ganti isinya dengan `apps-script/appsscript.json`.
3. **Project Settings → Script properties**, tambahkan:
   | Property | Isi |
   |---|---|
   | `WRITE_TOKEN` | kata sandi bebas, dipakai dashboard untuk menyimpan & sinkron |
   | `ANTHROPIC_API_KEY` | API key dari console.anthropic.com (untuk AI & ekstraksi harga) |
   | `READ_TOKEN` | *(opsional)* isi agar data tidak bisa dibaca tanpa token |
   | `MODEL` | *(opsional)* default `claude-sonnet-5-5`; bisa `claude-haiku-4-5-20251001` agar lebih hemat |
   | `EFFORT` | *(opsional)* effort untuk Insight AI & Ringkasan AI. Default `low`; bisa `medium`, `high`, `xhigh`, `max`, atau `off` (bawaan model). Ekstraksi harga tidak terpengaruh |
4. Di editor, pilih fungsi **`setup`** lalu **Run**. Izinkan akses saat diminta. Fungsi ini membuat sheet Competitors, Plots, Offers, Sources, PriceHistory, SyncLog, Sales, Leads, Files, dan Settings (aman dijalankan ulang; kolom baru ditambahkan di ujung kanan), mengisi daftar sumber awal Summarecon & KBP, dan memasang trigger mingguan (Rabu 07.00–08.00 WIB).
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Salin URL yang diakhiri `/exec`.
6. Buka `index.html` → **Pengaturan** → tempel URL dan token → **Tes koneksi** → **Simpan & hubungkan**.
   Tes koneksi benar-benar mencoba tiga hal di akun Google kamu dan melaporkan hasilnya satu per satu: tulis-baca-hapus satu baris di Sheet, buat-hapus satu file di Drive (folder "MARKETHINGS Arsip"), dan mengambil satu URL dari internet. Tes yang sama bisa dijalankan dari editor: fungsi **`selfTest`** → Run → lihat Execution log.
7. *(Opsional)* Di Pengaturan, klik **Kirim data contoh ke Google Sheet** untuk mengisi Sheet dengan data contoh, lalu klik **Sinkron sekarang**.

Agar semua orang langsung terhubung tanpa mengisi Pengaturan, isi `DEFAULT_API_URL` di bagian atas script `index.html`. Token tetap diisi masing-masing; tanpa token, dashboard hanya bisa membaca.

> Setiap kali `Code.gs` diubah, buat versi baru: **Deploy → Manage deployments → Edit → Version: New version**. URL tetap sama.

## Deploy ke GitHub Pages

Dashboard ini satu halaman statis, jadi cukup di-host apa adanya:

1. Push isi folder ini ke repo GitHub (`index.html` di akar repo).
2. Di repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / root → Save**.
3. Tunggu ±1 menit, buka `https://<username>.github.io/<nama-repo>/`.

Yang perlu diingat:

- GitHub Pages di akun gratis butuh repo **public**, artinya halaman dan isi `index.html` bisa dilihat siapa pun yang tahu alamatnya. Sandi tombol "Buka data sheet" hanya pagar di tampilan, bukan pengaman data. Yang benar-benar melindungi data adalah `WRITE_TOKEN` / `READ_TOKEN` di Apps Script (tidak ikut ke repo) dan pengaturan berbagi Google Sheet-nya.
- Jangan pernah menaruh token atau API key di `index.html`. `DEFAULT_API_URL` boleh diisi; token tetap diketik tiap pengguna di Pengaturan.
- File `.nojekyll` membuat GitHub menyajikan semua file apa adanya.

## Uji backend tanpa akun Google

`node tests/backend.test.js` menjalankan `apps-script/Code.gs` apa adanya di atas tiruan layanan Google (Sheet, Drive, UrlFetch, Properties), termasuk kebiasaan Sheets mengubah teks jadi angka/tanggal. 43 pemeriksaan: setup, token, simpan/edit/hapus, impor massal, file ke Drive, pengaturan bersama, sinkron sumber, riwayat harga. Ini menguji logika kode; izin dan kuota akun Google yang asli tetap perlu dicek dengan **Tes koneksi** / `selfTest` setelah deploy.

## Proyeksi omzet & laba (Simulator Investor)

Panel **Proyeksi omzet & laba** di Simulator Investor menerjemahkan isian "Omzet / bulan" menjadi proyeksi laba:

- Empat angka per bulan: omzet stabil, laba operasional (omzet − opex), laba selama angsuran/cicilan lahan, dan laba setelah lunas.
- Grafik dan tabel **Per tahun** (sejak booking / LOI sampai akhir periode) atau **Per bulan** (36 bulan pertama operasional; masa bangun dirangkum satu baris).
- Tabel **Kalau omzet per bulan berubah**: omzet −40%, −20%, isian sekarang, +20%, +50% beserta laba, BEP, dan kas akhir periode.
- Dua ambang: omzet minimal supaya tidak nombok selama cicilan, dan omzet minimal supaya balik modal dalam periode.
- Isian baru **Kenaikan omzet per tahun (%)** (bawaan 0). Omzet tetap mulai 50% saat buka dan penuh dalam 6 bulan.

Laba bersih = omzet − opex − bayar lahan (termasuk IPL untuk sewa). Investasi bangun dan fit-out serta deposit/jaminan hanya masuk ke kas kumulatif. Semua angka belum termasuk PPN dan pajak penghasilan, dan merupakan proyeksi dari asumsi yang diisi.

## Pindah browser / laptop (link sambungan)

URL Apps Script dan token tersimpan per browser. Supaya tidak perlu mengisi lagi di perangkat lain: **Pengaturan → Salin link sambungan**, lalu buka link itu di browser tujuan dan setujui konfirmasinya. Dashboard langsung tersambung, dan kodenya otomatis dibuang dari kolom alamat.

- Bentuk link: `<alamat dashboard>#sambung=<kode>`. Bagian setelah `#` tidak dikirim ke server mana pun.
- Link berisi token (hanya disandikan, bukan dienkripsi). Simpan untuk diri sendiri; kalau link bocor, ganti `WRITE_TOKEN` di Script Properties.
- Hanya URL `https://script.google.com/.../exec` yang diterima; link ke server lain diabaikan.
- Kalau dashboard dibuka dari file (bukan dari alamat web), yang tersalin adalah kodenya saja: tempel lewat **Pengaturan → Tempel link sambungan** di browser tujuan.
- Kavling, penawaran, dan password "Buka data sheet" tidak ikut link ini; pindahkan dengan **Unduh cadangan / Pulihkan dari cadangan**.

## Data bawaan Market Research

Saat dashboard pertama kali tersambung ke backend dan sheet `Competitors` belum berisi input manual, dashboard otomatis mengirim data bawaannya ke Sheet: 13 produk Pororo Land (dummy), 8 produk Kota Baru Parahyangan dan 5 produk Summarecon Bandung (dari sumber publik). Ini terjadi sekali saja; penandanya `seedComps` di sheet `Settings`. Baris yang kemudian dihapus tidak muncul lagi, dan baris hasil sinkron yang lebih baru tidak ditimpa. Grand Sharon dan Citraland (dummy) tidak ikut; keduanya masih bisa dikirim lewat **Pengaturan → Kirim data contoh ke Google Sheet**.

## Lampu sambungan sumber kompetitor

Di panel **Sinkron data publik** (Market Research) tiap sumber punya lampu, diambil dari hasil baca terakhir oleh backend:

- hijau berkedip: situsnya terbaca pada pengecekan terakhir (maksimal 8 hari lalu)
- merah: gagal dibaca (`HTTP 4xx/5xx` atau `gagal: ...`)
- kuning: sudah lebih dari seminggu tidak dicek (jadwal terlewat)
- abu: belum pernah dibaca, nonaktif, atau dashboard belum tersambung backend

Lampu di judul panel berkedip bila minimal satu sumber tersambung. Sinkron otomatis berjalan tiap **Rabu 07.00–08.00 WIB**; setelah mengganti `Code.gs`, jalankan `setup` sekali lagi supaya jadwalnya ikut pindah.

## Sinkron otomatis dengan Google Sheet

Perubahan di Google Sheet tampil sendiri di dashboard, tanpa memuat ulang halaman:

| Data | Cara cek | Jeda |
|---|---|---|
| Rekap penjualan & tab EVENT (sheet publik) | dibaca langsung dari sheet | tiap 15 detik |
| Kompetitor, kavling, penawaran, file, ketentuan (backend Apps Script) | cek penanda perubahan yang ringan; data lengkap hanya diambil bila penandanya berubah | tiap 30 detik |

- Tampilan hanya digambar ulang bila isinya benar-benar berubah, dan muncul pemberitahuan singkat "Data diperbarui dari Google Sheet".
- Kalau form sedang terbuka, pembaruan ditunda sampai form ditutup supaya ketikan tidak hilang.
- Pengecekan berhenti saat tab browser tidak terlihat dan langsung jalan lagi saat tab dibuka.
- Penanda perubahan di backend naik saat: sel diedit langsung di Sheet (`onEdit`), baris ditambah/dihapus (`onSheetChange`, dipasang oleh `setup()`), dashboard menyimpan, atau file sheet berubah lewat jalur lain.
- Backend versi lama (sebelum ada penanda) tetap jalan, tetapi tiap cek mengambil data lengkap. Tempel ulang `Code.gs`, jalankan `setup()`, lalu buat versi deployment baru.
- Jeda bisa diubah per browser lewat `localStorage` kunci `li.syncMs` (milidetik, minimal 3000).

Kuota: tiap cek penanda adalah satu eksekusi Apps Script singkat. Satu dashboard yang terbuka seharian kerja memakai kira-kira 10 menit dari jatah eksekusi harian akun Google (90 menit untuk akun gratis, 6 jam untuk Workspace). Kalau banyak orang membukanya seharian di akun gratis, naikkan jedanya.

## Cara kerja sinkron

- Daftar sumber ada di sheet **Sources**. Tambah, edit, atau nonaktifkan sumber dari dashboard (tombol **Sumber**) atau langsung di Sheet.
- Setiap sinkron, Apps Script mengunduh tiap sumber dan menghitung hash isinya. **Sumber yang tidak berubah dilewati** sehingga tidak memakan biaya API.
- Isi yang berubah dikirim ke Claude API: PDF dikirim utuh, halaman web dikirim sebagai teks. Hasilnya berupa tipe unit, LT/LB, harga, promo, dan tanggal sumber.
- Produk disimpan di **Competitors** dengan `auto = TRUE`. Bila harganya berubah, perubahan dicatat di **PriceHistory** dan tampil di panel "Perubahan harga terbaru".
- Baris yang diedit manual dari dashboard menjadi `auto = FALSE` dan **tidak akan ditimpa** oleh sinkron.
- **Ambil dari URL**: tempel link baru, maka data langsung diekstrak dan URL-nya ikut disimpan sebagai sumber untuk sinkron berikutnya.

## Batasan yang perlu diketahui

- Summarecon dan KBP **tidak punya API publik**. Data diambil dari pricelist PDF publik (portal KPR BCA), halaman web, dan berita. Website resmi keduanya tidak mencantumkan harga.
- Situs yang memblokir akses otomatis (rumah123, kontan.co.id) tidak bisa dibaca. Untuk sumber seperti itu, pakai **Ekstrak brosur** (tempel teks atau unggah foto).
- **Stok, unit terjual, dan serapan kompetitor tidak tersedia publik.** Kolom ini diisi manual dari hasil survei.
- Sumber baru tidak dicari otomatis. Tambahkan URL pricelist atau berita baru ke Sources saat menemukannya.
- Biaya Claude API ditagih ke akun API sendiri, terpisah dari langganan claude.ai. Sinkron mingguan dengan belasan sumber biasanya kecil karena sumber yang tidak berubah dilewati.
- Kuota Apps Script: satu eksekusi maksimal 6 menit; sinkron otomatis berhenti di ~5 menit dan sisa sumber dicoba minggu berikutnya.
- Data kavling dan produk internal tersimpan di Google Sheet milik akun yang men-deploy. Pastikan sesuai kebijakan IT kantor sebelum diisi data asli.

## Struktur sheet

| Sheet | Kolom utama |
|---|---|
| Competitors | id, developer, project, cluster, tier, lt, lb, price, priceBasis, stock, sold, months, promo, source, sourceUrl, sourceDate, isOwn, auto |
| Plots | id, code, zone, area, frontage, use, priceM2, rentM2, status, notes, x, y, w, h, …, poly, drawingId |
| Sources | id, developer, label, url, active, lastStatus, lastFetched, note |
| PriceHistory | at, competitorId, cluster, oldPrice, newPrice, changePct, source |
| SyncLog | at, trigger, status, summary, log |
| Sales | id, date (YYYY-MM-DD), cluster, unitType, price, channel, agent, status (Booking / Akad / Batal), akadDate, notes |
| Leads | id, month (YYYY-MM), channel, leads, visits |

## Sales Report dari Google Sheet (tanpa Apps Script)

Sales Report bisa membaca langsung Google Sheet rekap penjualan berformat **REKAP ALL TIME** (kolom CLUSTER, TIPE, TIPE STD/HOOK, Uk Kavling, UNIT, TAHUN, BULAN AJA, BULAN, TGL., DOMISILI, UMUR, TUJUAN, REV., CARA BAYAR, PEKERJAAN, SALES, SUMBER INFORMASI).

1. Di Google Sheet: **Share → General access → Anyone with the link → Viewer**.
2. Di dashboard: **Pengaturan → Link Google Sheet rekap penjualan**, tempel link sheet. Isi **Nama tab** bila rekap bukan di tab pertama (mis. `REKAP ALL TIME`).
3. Tambah baris baru di sheet → dashboard mengambil ulang otomatis tiap 5 menit, saat tab browser dibuka lagi, atau saat klik **Muat ulang**.

Catatan:
- Baris judul di atas header (mis. "REKAP PENJUALAN ALLTIME…") tidak masalah; dashboard mencari baris yang berisi kolom CLUSTER dan REV.
- `REV.` dibaca dalam **Rp miliar** (2,75 = Rp 2,75 M).
- Kolom opsional `STATUS` (isi BATAL / BOOKING) membuat KPI pembatalan muncul. Tanpa kolom ini, KPI keempat menampilkan porsi pembayaran KPR.
- Karena sheet dibuka "Anyone with the link", siapa pun yang punya link bisa melihat isinya. Untuk data asli yang sensitif, simpan di spreadsheet backend Apps Script (sheet Sales) yang tetap privat.

## Event marketing di kalender (auto-save)

Di Sales Report → panel **Heatmap & kalender event**:
- **Harian**: kalender per hari (unit terjual per tanggal). Klik tanggal → tambah event (Open house, Pameran, Promo, Gathering, Launching, Lainnya). Klik label event → ubah/hapus.
- **Bulanan**: heatmap per cluster, bulan yang punya event diberi titik berwarna.
- **Event & dampak penjualan**: tiap event dibandingkan rata-rata unit/hari pada 3, 7, atau 14 hari sebelum vs selama + sesudah event.

Penyimpanan:
1. **Otomatis di browser** begitu event disimpan (tanpa setup).
2. **Ke Google Sheet (tab `EVENT`)** supaya bisa dilihat semua orang:
   - Di Google Sheet REKAP: Extensions → Apps Script → tempel `apps-script/event-sync.gs` → jalankan `setupEventSheet()` sekali.
   - Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone) → salin URL `/exec`.
   - Dashboard → Pengaturan → **URL Apps Script event** → tempel → Simpan.
   - Event yang tadinya tersimpan di browser ikut terkirim otomatis. Event juga bisa diketik langsung di tab EVENT (kolom ID, NAMA EVENT, JENIS, MULAI, SELESAI, CATATAN; tanggal format YYYY-MM-DD).

## Password tombol "Buka data sheet"

- Tombol **Buka data sheet** di Sales Report meminta password sebelum membuka Google Sheet. Password bawaan: `123`.
- Ganti lewat **Pengaturan → Ganti password sheet** (wajib gabungan huruf dan angka, minimal 6 karakter). Password baru langsung berlaku di browser itu.
- Supaya berlaku untuk semua orang yang membuka dashboard, salin baris `const SHEET_PASS_HASH = "…";` yang muncul setelah mengganti password, lalu tempel menggantikan baris yang sama di bagian atas script `index.html`.
- Link sheet di Pengaturan juga disembunyikan sampai password dimasukkan.
- Ini pengaman tingkat tampilan: link sheet tetap ada di dalam kode `index.html`, dan sheet-nya sendiri masih "Anyone with the link". Orang yang paham teknis masih bisa menemukannya. Untuk data asli yang sensitif, batasi akses sheet di Google (Share → Restricted) dan baca datanya lewat backend Apps Script.

## Membaca DWG, DXF, dan PDF gambar kerja (tanpa AI)

Di **Lahan Komersial → Gambar & dokumen lahan**, unggah (atau tarik) file `.dwg`, `.dxf`, `.pdf`, foto site plan, atau dokumen lain. Semua dibaca **di browser itu sendiri**: tidak ada file yang dikirim ke server, dan tidak ada AI/Claude yang terlibat. Maks 60 MB per file.

| File | Yang dibaca otomatis | Yang perlu dibantu manual |
|---|---|---|
| **DWG** (diuji dengan format AutoCAD 2000 dan 2018) dan **DXF** (ASCII) | Garis, polyline, busur, lingkaran, teks, blok (INSERT), layer. Polyline tertutup jadi kandidat kavling, luasnya dihitung dari geometri. Teks di dalam kavling jadi kodenya (mis. `E5A`, `C-2`, `KAV. B1`). | Kavling yang digambar dari garis lepas (bukan polyline tertutup): tandai dengan **Gambar kavling**, titik menempel ke sudut garis. |
| **PDF vektor** (hasil plot/ekspor dari CAD) | Teks, skala `1 : N`, dan garis tertutup pada halaman. Kode + luas tertulis muncul di tab **Teks**. | Sama seperti di atas. Bila skala tidak tertulis, pakai **Kalibrasi**. |
| **PDF hasil scan / foto / gambar** | Hanya tampilannya. | **Kalibrasi** (klik 2 titik yang jaraknya diketahui, isi panjangnya), lalu **Gambar kavling**. |

Alurnya: **Baca gambar** → cek satuan/skala di panel kanan → centang kavling yang benar (kode bisa diedit) → **Impor kavling ke daftar**. Kavling masuk ke tabel (luas, dimensi, bentuk), dan site plan mendapat mode **Dari gambar** yang menampilkan bentuk aslinya di atas cuplikan gambar. Kavling dengan kode yang sama diperbarui, bukan digandakan; harga dan status yang sudah diisi tidak berubah.

Yang perlu diketahui:

- **Satuan DWG/DXF** ditentukan berurutan: pilihan manual → dicocokkan dengan teks luas di gambar (mis. kavling bertuliskan `650 m2`) → satuan di file (mm/cm/m) → tebakan dari ukuran gambar. Keterangan di bawah pilihan satuan menunjukkan mana yang dipakai. **Selalu bandingkan luas hasil hitung dengan luas yang tertulis** sebelum mengimpor.
- Pembacaan DWG memakai pustaka open-source LibreDWG, bukan AutoCAD. Sebagian file (terutama dengan objek khusus/proxy, 3D, atau xref) bisa terbaca tidak lengkap. Bila hasilnya aneh atau gagal, **Save As → DXF** dari AutoCAD lalu unggah DXF-nya. DXF biner tidak didukung (pakai DXF ASCII).
- Hatch, dimensi asosiatif yang rumit, gambar tertanam (image/OLE), dan xref tidak ditampilkan. Hanya model space yang dibaca.
- PDF yang teksnya dijadikan garis saat plot (font SHX) tidak punya teks yang bisa dibaca; kodenya diisi manual.
- Hasil impor **tidak mengisi harga**. Harga jual/sewa per m² diisi di form kavling.
- Cuplikan latar site plan tersimpan di browser yang mengimpor. Di perangkat lain (lewat backend), bentuk kavling tetap tampil tetapi tanpa latar sampai gambarnya dibuka di perangkat itu.
- `index.html` mencari pembaca di folder `vendor/` lebih dulu (jalan tanpa internet, juga saat file dibuka langsung dengan klik ganda). Bila folder itu tidak ada, pembaca diambil dari CDN (jsDelivr / cdnjs) dan butuh internet.
- Backend lama: tempel ulang `Code.gs` dan jalankan `setup()` sekali lagi agar sheet `Plots` mendapat kolom `poly` dan `drawingId`, lalu buat versi deployment baru.

Lisensi pustaka di `vendor/`: **libredwg-web** (GPL-3.0, https://github.com/mlightcad/libredwg-web, berbasis GNU LibreDWG) dan **pdf.js** (Apache-2.0, Mozilla). Untuk pemakaian internal tidak ada kewajiban tambahan; bila paket ini dibagikan ke luar perusahaan, sertakan pemberitahuan lisensi tersebut dan tautan sumbernya.

## Aturan kawasan di Simulator

Rencana tapak di Simulator Investor memakai aturan kawasan komersial: **KDB 70%**, **KLB 3,2**, **GSB 10 m** (setengah ROW jalan depan, ROW 20 m), sempadan samping dan belakang **4 m**. Angkanya ada di satu tempat, `const KAWASAN = {...}` di script `index.html`; ubah di sana bila aturan atau ROW berubah. Kavling dianggap persegi panjang, jadi "tapak maks" adalah perkiraan.

## Foto banner

Bagian atas tiap segmen memakai foto latar yang ditanam langsung di `index.html` (blok `<style id="banner-images">` di akhir file), jadi tetap satu file. Salinan fotonya ada di folder `assets/`.

- Mengganti foto: ubah nilai `--bn` untuk `#salesHero`, `#compHero`, `#landHero`, atau `#simHero` menjadi `url(assets/nama-file.jpg)` (folder `assets/` harus ikut disalin) atau data URI gambar lain. Ukuran yang pas: lebar 1280–1920 px, format lanskap.
- Posisi potongan foto diatur lewat `--bn-pos` (mis. `center 40%`), dan tingkat transparansinya lewat gradasi di aturan `.hero::before`.
- Sumber foto saat ini: koleksi github.com/yavuzceliker/sample-images (foto Pixabay yang sudah dimodifikasi, Pixabay Content License, bebas dipakai tanpa atribusi). Fotonya generik, bukan foto Pororo Land.

## Penawaran tenant per kavling

Di **Lahan Komersial**, tiap kavling yang masih available bisa dicatat penawaran sewa/beli yang masuk: nama tenant, jenis (Sewa/Beli), harga ditawar per m², masa sewa, tanggal, status (Baru, Negosiasi, Diterima, Ditolak), rencana usaha, PIC, dan catatan.

- Tambah lewat **+ Penawaran** di panel kavling terpilih atau di bagian **Penawaran masuk**. Klik sebuah penawaran untuk mengubah atau menghapusnya.
- Angka biru di site plan = jumlah penawaran aktif (Baru + Negosiasi) di kavling itu.
- "vs harga list" membandingkan tawaran per m² dengan harga jual/sewa list kavling.
- Tersimpan otomatis: di browser (mode demo) atau di sheet `Offers` bila backend tersambung. Backend lama: tempel ulang `Code.gs`, jalankan `setup()` lagi, lalu buat versi deployment baru.
- Penawaran contoh bawaan fiktif dan berlabel "dummy".

## Data disimpan di mana?

| Data | Tanpa backend (buka file saja) | Setelah Apps Script tersambung |
|---|---|---|
| Penjualan (Sales Report) | Google Sheet rekap (tab REKAP ALL TIME) | sama |
| Event marketing | Browser | Tab `EVENT` di Google Sheet rekap (via `event-sync.gs`) + browser |
| Produk kompetitor | Browser | Sheet `Competitors` di spreadsheet backend |
| Kavling komersial (termasuk bentuk hasil impor gambar) dan penawaran tenant | Browser | Browser (tidak diambil dari Sheet; sheet `Plots` dan `Offers` di backend tidak dipakai) |
| Gambar lahan (DWG/DXF/PDF) + skala, kalibrasi, kavling yang digambar manual | Browser | Google Drive untuk file ≤ 8 MB + browser |
| File (brosur, pricelist, foto, dll.) | Browser | Google Drive, folder **MARKETHINGS Arsip** (daftarnya di sheet `Files`) + browser |
| Pengaturan & password | Browser | Browser |

- **Browser** = penyimpanan milik browser di perangkat itu (localStorage untuk data, IndexedDB untuk file). Tetap ada setelah halaman ditutup atau komputer dimatikan, tapi tidak muncul di perangkat/browser lain dan hilang bila data situs browser dihapus atau memakai mode incognito.
- Brosur yang dimasukkan lewat **Ekstrak brosur** (foto maupun teks) otomatis masuk ke **Arsip file** di Market Research. File lain bisa ditambah lewat **Unggah file** (maks 15 MB per file; yang ikut ke Google Drive maks 8 MB).
- **Pengaturan → Data disimpan di mana?** menampilkan lokasi dan jumlah tiap jenis data, serta tombol **Unduh cadangan (.json)** dan **Pulihkan dari cadangan** untuk memindahkan data antar perangkat.
- Karena backend sekarang menyimpan file ke Drive, `appsscript.json` punya izin Drive. Bila backend sudah pernah di-deploy, tempel ulang `Code.gs` dan `appsscript.json`, jalankan `setup()` lagi, lalu buat versi deployment baru.

## Tema tampilan

Di kanan atas ada tiga pilihan: **Terang** (tampilan asli), **Gelap**, dan **Sistem** (ikut pengaturan perangkat).
Pilihan disimpan di browser (`li.theme`) dan langsung dipakai lagi saat halaman dibuka ulang. Default: Sistem.

## Splash screen

- **Pembuka**: latar gradasi (lavender, magenta, merah, oranye) dengan tekstur grain, logo M garis putih berputar sambil zoom out, lalu tulisan "Markethings" dan slogan. Animasinya 5 detik lalu diam menunggu. Semuanya digambar dengan CSS/SVG, tanpa file gambar.
- **Keluar dengan scroll**: scroll mouse ke bawah (di HP: geser ke atas) dan tirai naik pelan mengikuti scroll sampai masuk ke Sales Report. Scroll ke atas sebelum habis akan menurunkannya lagi. Keyboard: panah bawah / PageDown / spasi.
- **Antar segmen**: tiap pindah segmen muncul layar judul segmen ±1,3 detik (nama segmen + keterangan singkat, klik untuk lewati).
- Kalau perangkat menyetel "kurangi animasi", splash tidak ditampilkan.
- Murni CSS + sedikit JS di `index.html`, tanpa file atau koneksi tambahan.

## Animasi grafik saat scroll

Semua grafik (Sales Report, Market Research, Simulator) baru digambar ketika masuk layar, jadi animasinya terlihat saat halaman di-scroll: batang tumbuh berurutan, garis naik, pie berputar. Batang HTML (funnel, target tim, sell-through) dan panel di Lahan Komersial ikut muncul saat di-scroll. Animasi main sekali per grafik tiap kali segmen dibuka atau filter diganti. Mati otomatis kalau perangkat menyetel "kurangi animasi".

## Label data di grafik

Semua grafik menampilkan angkanya langsung: di atas batang, di ujung batang mendatar, di titik garis, di dalam irisan pie/donat (persen), dan nama cluster di scatter. Arahkan kursor (atau ketuk di HP) ke label atau ke datanya, hurufnya membesar dan menebal. Label yang akan saling tumpuk atau tidak muat disembunyikan otomatis dan muncul saat datanya disorot. Dibuat sendiri di `index.html`, tanpa plugin tambahan.

## Ketentuan komersial (sewa & jual kavling)

Semua harga **belum termasuk PPN** dan semua angka bisa diubah.

| | Standar |
|---|---|
| Sewa | Rp 100.000 / m² / bulan · IPL Rp 5.500 / m² / bulan · jangka waktu minimal 10 tahun |
| Cara bayar sewa | 10% saat TTD LOI · 10% 30 hari kemudian · sisa 80% dalam 36 cicilan sejak tanggal buka/operasional |
| Jaminan sewa | Security deposit 3 bulan sewa + jaminan pembangunan Rp 20.000.000 (dikembalikan) |
| Jual | Rp 12.000.000 / m² |
| Cara bayar jual | Booking fee Rp 200.000.000 · DP 30% (dikurangi booking fee) · sisa 70% diangsur 24x |

Tiga tempat mengubahnya:

1. **Lahan Komersial → Ketentuan sewa & jual → Ubah ketentuan**: standar kawasan. Tersimpan di browser (`li.kom`), dan bila backend Apps Script tersambung ikut tersimpan di sheet `Settings` sehingga semua perangkat memakai ketentuan yang sama; "Kembali ke standar" mengembalikan angka di atas.
2. **Form kavling**: harga jual/sewa per m² khusus satu kavling. Kosong = ikut harga base.
3. **Simulator Investor**: hasil nego per calon tenant (harga, booking fee, DP, jumlah angsuran, jangka waktu, deposit, dst.) tanpa mengubah standar. Tombol "Pakai ketentuan standar" mengembalikannya.

Asumsi arus kas di Simulator: bulan 0 = TTD LOI / booking; biaya bangun dibagi rata sampai bulan buka; sewa: pembayaran 1 + deposit + jaminan di bulan 0, pembayaran 2 sebulan kemudian, cicilan dan IPL sejak buka, jaminan pembangunan kembali saat buka, security deposit kembali di akhir masa sewa; jual: booking fee bulan 0, DP bulan 1, angsuran bulan berikutnya, tanpa IPL.

**Perubahan satuan:** harga sewa (kavling dan penawaran) sekarang **per m² per bulan**, sebelumnya per tahun. Data di browser dikonversi otomatis sekali. Kalau memakai Google Sheet backend, kolom `rentM2` di sheet Plots dan `priceM2` penawaran sewa di sheet Offers perlu diisi ulang per bulan.

## Export Excel hitungan penawaran

Tombol **Export Excel** ada di empat tempat:

- tiap baris tabel **Penawaran masuk** (Lahan Komersial)
- di bawah tiap penawaran pada panel **Kavling terpilih** (samping site plan)
- di form edit penawaran
- di **Simulator Investor**, panel "Jadwal pembayaran lahan": mengekspor hitungan sesuai isian simulator (harga nego, persen bayar, jumlah cicilan, dst.)

Hasilnya satu file `.xlsx` per tenant berisi:

- kop dan judul (sewa / pembelian), nama kavling dan tenant
- A. data penawaran · B. data kavling (luas, frontage, dimensi, KDB, KLB, luas bangunan maksimal, sempadan)
- C. harga standar vs harga ditawar, selisih, total nilai
- D. cara bayar (sewa: pembayaran 1, pembayaran 2, cicilan, deposit, jaminan, IPL · beli: booking fee, DP, angsuran)
- E. jadwal pembayaran baris per baris dengan sisa kewajiban

Semua hitungan berupa **rumus Excel**: sel kuning (harga ditawar, jangka waktu, persen, booking fee, dll.) bisa diubah dan angka lain ikut berubah. Kolom opsional "Cicilan / angsuran diminta" di form penawaran dipakai untuk jumlah cicilan; kosong = standar. Cara bayar lain mengikuti Ketentuan sewa & jual saat file dibuat.

File dibuat langsung di browser tanpa pustaka atau koneksi tambahan. Teks kop ada di konstanta `KOP` di `index.html`. Kalau memakai backend Google Sheet, jalankan `setup()` lagi supaya kolom `inst` ditambahkan ke sheet Offers.

## Analisis per tipe rumah (Sales Report → Tipe)

Katalog tipe tiap cluster (nama + ukuran kavling lebar × panjang) ada di konstanta `TYPE_CATALOG` di `index.html`. Tiap baris penjualan dicocokkan ke katalog lewat kolom `TIPE` (akhiran Standard/Hook diabaikan) dan, bila ada dua tipe bernama sama, lewat kolom `Uk Kavling`.

Isi bagian ini: tipe terjual vs jumlah tipe di katalog, tipe terlaris, lebar muka terlaris, rata-rata luas kavling, grafik tipe terlaris, grafik menurut lebar muka dan luas kavling, serta tabel rincian per tipe (unit, Standard/Hook, nilai, rata-rata harga, harga per m² tanah, porsi di cluster, terakhir terjual). Saringan: cluster, rentang waktu, unit/nilai, dan "Terjual saja / Semua tipe". Tabel rincian tersembunyi dulu; buka dengan tombol **Tampilkan rincian per tipe** di bawah grafik.

Nama tipe di data yang tidak ada di katalog tetap dihitung dan ditandai "di luar katalog". Untuk menambah atau mengubah tipe, edit `TYPE_CATALOG` dengan format `"Nama LEBARxPANJANG"`; tambahkan `(Kavling)` untuk tanah saja dan `|Alias` untuk ejaan lain.
