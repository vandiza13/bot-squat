const fs = require('fs');
const path = require('path');
const db = require('../src/db');

async function initDatabase() {
  console.log('🔄 Memulai inisialisasi tabel PostgreSQL...');

  const test = await db.testConnection();
  if (!test.ok) {
    console.error('❌ Gagal terkoneksi ke PostgreSQL / Supabase!');
    console.error('Error detail:', test.error);
    console.log('\n💡 Pastikan DATABASE_URL di file .env sudah diisi dengan kredensial Supabase / PostgreSQL yang aktif.');
    process.exit(1);
  }

  console.log('✅ Berhasil terkoneksi ke database:', test.now);

  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    await db.query(sql);
    console.log('✅ Semua tabel dan indeks berhasil dibuat / diverifikasi:');
    console.log('   - fsi');
    console.log('   - umt');
    console.log('   - mtel');
    console.log('   - tsel');
    console.log('   - olo');
    console.log('   - logs');
    console.log('\n🎉 Database siap digunakan!');
  } catch (err) {
    console.error('❌ Terjadi kesalahan saat menjalankan schema.sql:', err.message);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;
