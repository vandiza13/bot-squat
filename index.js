const { createBot } = require('./src/bot');
const { testConnection, pool } = require('./src/db');
const config = require('./src/config');

async function start() {
  console.log('==============================================');
  console.log('🤖  SQUAT-MS TELEGRAM BOT (Node.js Edition)  ');
  console.log('==============================================');

  // 1. Verifikasi Database PostgreSQL / Supabase
  console.log('🔍 Memeriksa koneksi database...');
  const dbStatus = await testConnection();
  if (dbStatus.ok) {
    console.log('✅ PostgreSQL terkoneksi dengan sukses pada:', dbStatus.now);
  } else {
    console.warn('⚠️  Peringatan Koneksi Database:');
    console.warn('   ', dbStatus.error);
    console.warn('   💡 Pastikan DATABASE_URL di .env sudah disetel dengan benar.');
    console.warn('   👉 Jalankan `npm run init-db` setelah mengatur DATABASE_URL.');
  }

  // 2. Verifikasi BOT_TOKEN
  if (!config.botToken || config.botToken === 'isi_token_botfather_kamu') {
    console.error('\n❌ BOT_TOKEN belum disetel di file .env!');
    console.error('Silakan buka file .env dan masukkan token bot dari @BotFather.');
    process.exit(1);
  }

  // 3. Jalankan Bot Grammy
  const bot = createBot();

  console.log('\n🚀 Memulai bot Telegram (Long Polling)...');
  bot.start({
    onStart: (botInfo) => {
      console.log(`✅ Bot aktif sebagai: @${botInfo.username} (ID: ${botInfo.id})`);
      console.log('Siap menerima perintah: /start, /fsi, /umt, /mtel, /tsel, /olo, /odc, /sync');
    },
  });

  // Graceful Shutdown
  const stopHandler = async () => {
    console.log('\n🛑 Menghentikan bot & menutup koneksi database...');
    try {
      await bot.stop();
      await pool.end();
      console.log('👋 Bot berhasil dihentikan dengan aman.');
      process.exit(0);
    } catch (err) {
      console.error('Error saat shutdown:', err);
      process.exit(1);
    }
  };

  process.once('SIGINT', stopHandler);
  process.once('SIGTERM', stopHandler);
}

start().catch((err) => {
  console.error('❌ Fatal error saat inisialisasi bot:', err);
  process.exit(1);
});
