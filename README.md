# 🤖 SquatMS Data Bot (Node.js Edition)

Migrasi dari Google Apps Script ke **Node.js** menggunakan **GrammY** (Telegram Bot Framework) dan **PostgreSQL (Supabase)**.

---

## 🌟 Fitur Utama
- **Kecepatan Tinggi & Performa SQL**: Data disimpan dalam tabel PostgreSQL berindeks (`fsi`, `umt`, `mtel`, `tsel`, `olo`, `logs`).
- **100% Format Paritas**: Format pesan HTML, template detail site, emoji, dan footer persis sama dengan versi Google Apps Script asli.
- **Kirim Lokasi Telegram Otomatis**: Jika data memiliki koordinat Latitude & Longitude, bot otomatis mengirim pin lokasi interaktif ke chat Telegram.
- **Pencarian Fleksibel**:
  - `/fsi [ID/Nama Site]` - Pencarian database FSI
  - `/umt [ID/Nama Site]` - Pencarian database UMT (+ link KMZ)
  - `/mtel [ID/Nama Site]` - Pencarian database MTEL
  - `/tsel [ID/Nama Site]` - Pencarian identitas site TSEL (27 atribut lengkap)
  - `/olo [ID/Nama/Cust Name]` - Pencarian data OLO (SID, ISP, Customer)
  - `/odc [Nama ODC]` - Pengecekan isi ODC lintas TSEL & OLO
  - **Pencarian Global Otomatis**: Ketik langsung ID / Nama Site tanpa slash command, bot akan mencari di semua database secara berurutan.
- **Pencatatan Log Aktivitas**: Semua pesan dan command tercatat ke tabel `logs` di PostgreSQL secara non-blocking (asinkron).
- **Sinkronisasi Dinamis (`/sync`)**: Mendukung sinkronisasi/upsert data BTS Witel Bekasi ke TSEL dengan pemetaan kolom dinamis (kebal pergeseran urutan kolom).
- **Import Utility**: Tersedia script untuk mengimpor CSV lokal dan sinkronisasi langsung dari Google Sheets.

---

## 📁 Struktur Direktori
```text
squat-ms-bot/
├── .env                  # Token bot dan kredensial database
├── .env.example          # Template konfigurasi environment
├── package.json          # Dependensi & script project
├── schema.sql            # Skema DDL tabel PostgreSQL (FSI, UMT, MTEL, TSEL, OLO, LOGS)
├── index.js              # Entry point utama bot
├── src/
│   ├── config.js         # Loader environment variables
│   ├── db.js             # PostgreSQL connection pool & helper
│   ├── bot.js            # Inisialisasi GrammY & routing perintah
│   ├── formatters/
│   │   └── messageFormatter.js # Template pesan HTML & helper koordinat
│   └── services/
│       ├── searchService.js    # Logika query pencarian DB
│       ├── logService.js       # Pencatatan log pesan pengguna
│       ├── syncService.js      # Sinkronisasi Witel -> TSEL & GSheets -> DB
│       └── sheetsService.js    # Client Google Sheets API v4
└── scripts/
    ├── initDb.js         # Script pembuatan tabel dari schema.sql
    ├── syncSheets.js     # CLI sync Google Sheets
    └── importCsv.js      # CLI import file CSV ke database
```

---

## 🚀 Panduan Instalasi & Penggunaan

### 1. Konfigurasi Environment (`.env`)
Buka file `.env` dan lengkapi konfigurasi berikut:
```env
BOT_TOKEN=123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

> **Catatan Supabase**: 
> Pastikan password dan host connection string di Supabase sudah benar (dapat diambil dari dashboard Supabase: *Project Settings* -> *Database* -> *Connection string URI*).

---

### 2. Inisialisasi Tabel Database
Jalankan perintah ini sekali untuk membuat semua tabel dan indeks secara otomatis:
```bash
npm run init-db
```

---

### 3. Memasukkan / Mengimpor Data Awal

Anda memiliki 2 cara mudah untuk mengisi database:

#### Cara A: Menggunakan Script Import CSV (Direkomendasikan & Cepat)
Download tab sheet Anda dari Google Sheets sebagai `.csv`, lalu jalankan:
```bash
node scripts/importCsv.js --table=fsi --file=./data/fsi.csv
node scripts/importCsv.js --table=umt --file=./data/umt.csv
node scripts/importCsv.js --table=mtel --file=./data/mtel.csv
node scripts/importCsv.js --table=tsel --file=./data/tsel.csv
node scripts/importCsv.js --table=olo --file=./data/olo.csv
```

#### Cara B: Sinkronisasi Otomatis dari Google Sheets via API
1. Siapkan Service Account di Google Cloud Console dan unduh file key JSON sebagai `service-account.json` di folder proyek.
2. Berikan akses Viewer/Editor pada spreadsheet ke email service account tersebut.
3. Jalankan perintah:
```bash
npm run sync:all
```

---

### 4. Menjalankan Bot

Mode Produksi:
```bash
npm start
```

Mode Development (Auto-reload saat file diedit):
```bash
npm run dev
```

---

## 🛠️ Menjalankan di Background / Server (VPS)
Untuk menjalankan bot secara terus-menerus di server / VPS, Anda dapat menggunakan **PM2**:
```bash
npm install -g pm2
pm2 start index.js --name "squat-ms-bot"
pm2 save
pm2 startup
```

Untuk memantau log:
```bash
pm2 logs squat-ms-bot
```
