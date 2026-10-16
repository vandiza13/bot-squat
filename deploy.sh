#!/usr/bin/env bash

# ==========================================================
# 🚀 SQUAT-MS TELEGRAM BOT - AUTO SETUP & DEPLOY SCRIPT (PM2)
# ==========================================================
# Script ini akan secara otomatis:
# 1. Memeriksa & Menginstall Node.js 20 LTS & PM2 jika belum ada
# 2. Menginstall dependensi proyek (npm install)
# 3. Menyiapkan folder logs & memeriksa file .env
# 4. Menjalankan bot dengan PM2 & mengaktifkan auto-restart saat reboot
# ==========================================================

set -e

# Warna Terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}   🤖 SQUAT-MS TELEGRAM BOT - PM2 DEPLOYMENT SETUP   ${NC}"
echo -e "${CYAN}====================================================${NC}"

# 1. Periksa apakah script dijalankan di Linux
if [ "$(uname)" != "Linux" ]; then
    echo -e "${YELLOW}⚠️ Peringatan: Script ini didesain untuk server Linux (Ubuntu/Debian).${NC}"
fi

# 2. Periksa / Install Curl & Git
echo -e "\n${BLUE}🔍 [1/6] Memeriksa paket pendukung (curl, git)...${NC}"
if ! command -v curl &> /dev/null || ! command -v git &> /dev/null; then
    echo -e "${YELLOW}📦 Menginstall curl & git...${NC}"
    sudo apt update -y && sudo apt install -y curl git
else
    echo -e "${GREEN}✅ Curl & Git sudah terinstall.${NC}"
fi

# 3. Periksa / Install Node.js (Minimal v18 atau v20 LTS direkomendasikan)
echo -e "\n${BLUE}🔍 [2/6] Memeriksa instalasi Node.js...${NC}"
NODE_INSTALLED=false
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        NODE_INSTALLED=true
        echo -e "${GREEN}✅ Node.js sudah terinstall: $(node -v)${NC}"
    else
        echo -e "${YELLOW}⚠️ Versi Node.js terlalu lama ($(node -v)). Diperlukan minimal Node.js v20 LTS.${NC}"
    fi
fi

if [ "$NODE_INSTALLED" = false ]; then
    echo -e "${YELLOW}📥 Menginstall Node.js 20 LTS dari NodeSource...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    echo -e "${GREEN}✅ Node.js 20 LTS berhasil diinstall: $(node -v)${NC}"
fi

# 4. Periksa / Install PM2 Process Manager
echo -e "\n${BLUE}🔍 [3/6] Memeriksa PM2 Process Manager...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Menginstall PM2 secara global...${NC}"
    sudo npm install -g pm2
    echo -e "${GREEN}✅ PM2 berhasil diinstall.${NC}"
else
    echo -e "${GREEN}✅ PM2 sudah terinstall: $(pm2 -v)${NC}"
fi

# 5. Menyiapkan Folder & File .env
echo -e "\n${BLUE}🔍 [4/6] Menyiapkan environment & direktori logs...${NC}"
mkdir -p logs

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo -e "${YELLOW}⚠️ File .env belum ditemukan. Membuat dari .env.example...${NC}"
        cp .env.example .env
        echo -e "${RED}❗ PENTING: Harap periksa dan lengkapi file .env (nano .env) dengan BOT_TOKEN & DATABASE_URL asli Anda!${NC}"
    else
        echo -e "${RED}❌ File .env maupun .env.example tidak ditemukan! Silakan buat file .env terlebih dahulu.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ File .env ditemukan.${NC}"
fi

# 6. Install NPM Dependencies
echo -e "\n${BLUE}📦 [5/6] Menginstall dependensi proyek (npm install)...${NC}"
npm install --omit=dev

# 7. Menjalankan Bot dengan PM2
echo -e "\n${BLUE}🚀 [6/6] Memulai Bot dengan PM2...${NC}"

# Hentikan bot lama jika sudah terdaftar di PM2 untuk menghindari duplikasi
pm2 delete squat-ms-bot &> /dev/null || true

# Jalankan menggunakan ecosystem.config.js
pm2 start ecosystem.config.js

# Simpan state PM2 dan aktifkan startup otomatis saat server reboot
pm2 save
echo -e "${YELLOW}⚙️ Mengatur PM2 startup auto-boot...${NC}"
STARTUP_CMD=$(pm2 startup systemd -u "$USER" --hp "$HOME" | grep "sudo env" || true)
if [ -n "$STARTUP_CMD" ]; then
    eval "$STARTUP_CMD"
fi

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}   🎉 DEPLOYMENT SELESAI! BOT AKTIF & BERJALAN 24/7   ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Status proses PM2 saat ini:"
pm2 status

echo -e "\n${CYAN}📌 Perintah Penting untuk Pengelolaan:${NC}"
echo -e " • Melihat log bot realtime : ${YELLOW}pm2 logs squat-ms-bot${NC}"
echo -e " • Restart bot              : ${YELLOW}pm2 restart squat-ms-bot${NC}"
echo -e " • Stop bot                 : ${YELLOW}pm2 stop squat-ms-bot${NC}"
echo -e " • Status bot               : ${YELLOW}pm2 status${NC}"
echo -e " • Update kode bot nanti    : ${YELLOW}./update.sh${NC}\n"
