const { Pool } = require('pg');
const config = require('./config');

const isSupabase = config.databaseUrl && (
  config.databaseUrl.includes('supabase.co') || 
  config.databaseUrl.includes('supabase.com') ||
  config.databaseUrl.includes('pooler.supabase')
);

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isSupabase ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('⚠️ Unexpected PG pool error:', err.message);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // console.log('executed query', { text: text.slice(0, 50), duration, rows: res.rowCount });
  return res;
}

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    return { ok: true, now: res.rows[0].now };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  pool,
  query,
  testConnection,
};
