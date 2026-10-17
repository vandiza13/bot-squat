# 🚀 PANDUAN DEPLOYMENT SQUAT-MS TELEGRAM BOT KE SERVER

Panduan ini berisi langkah-langkah lengkap untuk menjalankan **SquatMS Data Telegram Bot** di server produksi (VPS Linux, Docker, atau Cloud PaaS) agar dapat beroperasi **24/7 non-stop**.

---

## 📋 DAFTAR ISI
1. [Prasyarat Server](#1-prasyarat-server)
2. [Metode 1: VPS Linux dengan PM2 (Paling Direkomendasikan)](#2-metode-1-vps-linux-dengan-pm2-rekomendasi)
3. [Metode 2: Deploy dengan Docker & Docker Compose](#3-metode-2-deploy-dengan-docker--docker-compose)
4. [Metode 3: Deploy di Cloud PaaS (Railway / Render)](#4-metode-3-deploy-di-cloud-paas-railway--render)
5. [Otomasi Sinkronisasi Harian (Cron Job)](#5-otomasi-sinkronisasi-harian-cron-job)
6. [Troubleshooting & Pemeliharaan](#6-troubleshooting--pemeliharaan)

---

## 1. Prasyarat Server
* **Sistem Operasi**: Linux Ubuntu 20.04/22.04 LTS atau Debian 11/12 (jika menggunakan VPS).
* **Spesifikasi Minimal**:
  * CPU: 1 Core
  * RAM: 512 MB - 1 GB (Bot sangat ringan, konsumsi RAM hanya ~40-60 MB).
  * Disk: 5 GB SSD.
* **Koneksi Internet**: Akses keluar ke Telegram API (`api.telegram.org`) & Supabase Cloud (`aws-1-ap-south-1.pooler.supabase.com`).

---

## 2. Metode 1: VPS Linux dengan PM2 (Rekomendasi)

PM2 adalah process manager standar industri untuk Node.js yang memastikan bot **otomatis menyala kembali saat server reboot atau crash**.

### ⚡ CARA CEPAT: 1-Click Auto Setup (Otomatis)
Setelah Anda mengupload folder bot ke server atau clone via git:
```bash
cd squat-ms-bot

# Pastikan file .env sudah diisi kredensial Anda
cp .env.example .env
nano .env

# Berikan izin eksekusi dan jalankan script otomatis
chmod +x deploy.sh update.sh
./deploy.sh
```
*Script `deploy.sh` akan secara otomatis memeriksa dan menginstall Node.js 20, PM2, dependencies npm, menjalankan bot, dan mengaktifkan auto-restart saat reboot.*

---

### Atau Jalankan Langkah Manual (Opsional):
Jika Anda lebih suka menjalankan langkah per langkah secara manual:
```bash
# 1. Update package
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# 3. Verifikasi instalasi
node -v   # Minimal v20.x.x
npm -v

# 4. Install PM2 secara global
sudo npm install -g pm2
```

### Langkah 2: Upload / Clone Kode ke Server
```bash
# Masuk ke folder home
cd ~

# Clone repository atau upload folder squat-ms-bot ke server
git clone <URL_REPOSITORY_ANDA> squat-ms-bot
cd squat-ms-bot
```

### Langkah 3: Konfigurasi File Environment (.env)
Salin contoh file `.env` dan masukkan kredensial:
```bash
cp .env.example .env
nano .env
```
Isi variabel dengan data asli:
```ini
BOT_TOKEN=your_telegram_bot_token_here
DATABASE_URL=postgresql://postgres.your_project_ref:YOUR_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
ADMIN_IDS=12345678
GAS_WEBAPP_URL=https://script.google.com/macros/s/your_deployment_id/exec
SPREADSHEET_ID=your_spreadsheet_id_here
WITEL_SPREADSHEET_ID=your_witel_spreadsheet_id_here
```
*(Tekan `CTRL + O`, `Enter` lalu `CTRL + X` untuk menyimpan di nano).*

### Langkah 4: Install Dependencies
```bash
npm install --omit=dev
```

### Langkah 5: Jalankan Bot dengan PM2
```bash
# Jalankan bot menggunakan konfigurasi ecosystem yang sudah disediakan
npm run pm2:start

# Periksa status bot
pm2 status

# Aktifkan auto-start saat VPS di-restart
pm2 startup
# (Jalankan perintah sudo yang muncul di layar terminal Anda)

# Simpan daftar proses PM2 saat ini
pm2 save
```

### Perintah Berguna PM2:
* **Melihat Log Realtime**: `npm run pm2:logs` atau `pm2 logs squat-ms-bot`
* **Restart Bot**: `npm run pm2:restart`
* **Hentikan Bot**: `npm run pm2:stop`

---

## 3. Metode 2: Deploy dengan Docker & Docker Compose

Jika server Anda telah terpasang Docker:

```bash
# 1. Pastikan file .env sudah dikonfigurasi dengan benar
cp .env.example .env
nano .env

# 2. Build dan jalankan container di background
npm run docker:up
# atau: docker compose up -d --build

# 3. Cek log bot
npm run docker:logs
# atau: docker compose logs -f

# 4. Menghentikan bot
npm run docker:down
```

Container sudah dilengkapi dengan pengaturan `restart: unless-stopped` sehingga akan otomatis menyala kembali jika server reboot.

---

## 4. Metode 3: Deploy di Cloud PaaS (Railway / Render)

Jika Anda tidak ingin mengelola server VPS sendiri, Anda dapat menggunakan platform cloud:

### Deploy di Railway (Sangat Cepat & Mudah):
1. Buka [railway.app](https://railway.app/) dan hubungkan akun GitHub Anda.
2. Buat **New Project** ➔ **Deploy from GitHub repo** ➔ Pilih repository `squat-ms-bot`.
3. Masuk ke tab **Variables**, lalu tambahkan semua environment variable dari `.env`:
   * `BOT_TOKEN`
   * `DATABASE_URL`
   * `ADMIN_IDS`
   * `GAS_WEBAPP_URL`
   * `SPREADSHEET_ID`
   * `WITEL_SPREADSHEET_ID`
4. Masuk ke tab **Settings** ➔ **Deploy** ➔ Start Command: `node index.js`.
5. Railway akan otomatis build dan menjalankan bot 24/7.

---

## 5. Otomasi Sinkronisasi Harian (Cron Job)

Jika Anda ingin data dari Google Sheets otomatis diperbarui ke database Supabase setiap hari (misalnya pukul **02:00 WIB dini hari**), pasang cron job di server VPS:

```bash
# Buka crontab editor
crontab -e
```
Tambahkan baris berikut di paling bawah:
```cron
# Sinkronisasi Witel Bekasi setiap hari pukul 02:00 WIB
0 2 * * * cd /home/ubuntu/squat-ms-bot && /usr/bin/npm run sync:witel >> /home/ubuntu/squat-ms-bot/logs/cron-sync.log 2>&1

# Atau sinkronisasi seluruh Sheet setiap hari Minggu pukul 03:00 WIB
0 3 * * 0 cd /home/ubuntu/squat-ms-bot && /usr/bin/npm run sync:all >> /home/ubuntu/squat-ms-bot/logs/cron-sync.log 2>&1
```

---

## 6. Troubleshooting & Pemeliharaan

### Q: Bot tidak merespon saat dijalankan di server
1. Cek log aplikasi:
   ```bash
   pm2 logs squat-ms-bot --lines 50
   ```
2. Pastikan tidak ada instance bot lain yang sedang berjalan di komputer lokal Anda (karena Telegram hanya mengizinkan 1 bot instance Long Polling secara bersamaan).
3. Pastikan `DATABASE_URL` menggunakan port pooler IPv4 Supabase (`6543`), bukan direct IPv6 (`5432`).

### Q: Bagaimana cara update bot jika ada perubahan kode baru?
Cukup jalankan:
```bash
cd ~/squat-ms-bot
git pull
npm install --omit=dev
npm run pm2:restart
```
Bot akan langsung ter-update tanpa downtime!
