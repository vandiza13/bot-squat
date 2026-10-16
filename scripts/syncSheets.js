const { syncWitelKeTsel, syncAllSheetsToDb } = require('../src/services/syncService');
const db = require('../src/db');

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--witel';

  console.log(`🔄 Menjalankan Sinkronisasi Google Sheets (Mode: ${mode})...`);

  try {
    if (mode === '--all') {
      console.log('⏳ Menarik seluruh data (FSI, UMT, MTEL, TSEL, OLO) dari Google Sheets...');
      const res = await syncAllSheetsToDb();
      console.log('✅ Hasil Sinkronisasi Seluruh Sheet:', res);
    } else if (mode === '--witel') {
      console.log('⏳ Menarik dan meng-upsert data BTS Witel Bekasi ke tabel TSEL...');
      const res = await syncWitelKeTsel();
      console.log(`✅ Selesai dalam ${res.durationSec}s!`);
      console.log(`   ➕ Baru: ${res.countBaru} baris`);
      console.log(`   🔄 Diupdate: ${res.countUpdated} site`);
    } else {
      console.log('Opsi tidak valid. Gunakan:');
      console.log('  node scripts/syncSheets.js --witel   (Hanya Witel Bekasi -> TSEL)');
      console.log('  node scripts/syncSheets.js --all     (Semua sheet FSI, UMT, MTEL, TSEL, OLO)');
    }
  } catch (err) {
    console.error('❌ Gagal sinkronisasi:', err.message);
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  main();
}
