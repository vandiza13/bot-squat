FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install tzdata untuk zona waktu WIB (Asia/Jakarta)
RUN apk add --no-cache tzdata
ENV TZ=Asia/Jakarta

# Salin package.json & install dependencies produksi
COPY package*.json ./
RUN npm ci --omit=dev

# Salin seluruh kode aplikasi
COPY . .

# Buat direktori logs jika belum ada
RUN mkdir -p logs && chown -R node:node /app

# Gunakan non-root user untuk keamanan
USER node

ENV NODE_ENV=production

# Jalankan bot
CMD ["node", "index.js"]
