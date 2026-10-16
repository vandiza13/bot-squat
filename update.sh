#!/usr/bin/env bash

# ==========================================================
# 🔄 SQUAT-MS TELEGRAM BOT - AUTO UPDATE SCRIPT
# ==========================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔄 Menjalankan Update Squat-MS Bot...${NC}"

# 1. Pull perubahan terbaru dari Git (jika ada git repository)
if [ -d .git ]; then
    echo -e "${YELLOW}📥 Menarik update dari Git (git pull)...${NC}"
    git pull
else
    echo -e "${YELLOW}ℹ️ Bukan repository git, melewati git pull.${NC}"
fi

# 2. Update dependensi jika ada perubahan di package.json
echo -e "${YELLOW}📦 Memeriksa dependensi (npm install)...${NC}"
npm install --omit=dev

# 3. Restart bot di PM2
echo -e "${YELLOW}🔁 Memuat ulang proses bot di PM2...${NC}"
pm2 restart squat-ms-bot

echo -e "\n${GREEN}✅ UPDATE SELESAI! Bot telah berjalan kembali dengan kode terbaru.${NC}"
pm2 status
