const db = require('../db');
const config = require('../config');

function isAdmin(userId) {
  if (!userId) return false;
  return config.adminIds.includes(String(userId).trim());
}

async function getStats() {
  const [tselRes, fsiRes, umtRes, mtelRes, oloRes, todayLogsRes, allLogsRes, usersRes] = await Promise.all([
    db.query('SELECT COUNT(*) as count FROM tsel_sites').catch(() => ({ rows: [{ count: 0 }] })),
    db.query('SELECT COUNT(*) as count FROM fsi_sites').catch(() => ({ rows: [{ count: 0 }] })),
    db.query('SELECT COUNT(*) as count FROM umt_sites').catch(() => ({ rows: [{ count: 0 }] })),
    db.query('SELECT COUNT(*) as count FROM mtel_sites').catch(() => ({ rows: [{ count: 0 }] })),
    db.query('SELECT COUNT(*) as count FROM olo').catch(() => ({ rows: [{ count: 0 }] })),
    db.query("SELECT COUNT(*) as count FROM logs WHERE waktu >= CURRENT_DATE").catch(() => ({ rows: [{ count: 0 }] })),
    db.query('SELECT COUNT(*) as count FROM logs').catch(() => ({ rows: [{ count: 0 }] })),
    db.query("SELECT COUNT(DISTINCT chat_id) as count FROM logs").catch(() => ({ rows: [{ count: 0 }] })),
  ]);

  return {
    tsel: tselRes.rows[0].count,
    fsi: fsiRes.rows[0].count,
    umt: umtRes.rows[0].count,
    mtel: mtelRes.rows[0].count,
    olo: oloRes.rows[0].count,
    searchesToday: todayLogsRes.rows[0].count,
    totalSearches: allLogsRes.rows[0].count,
    totalUsers: usersRes.rows[0].count,
  };
}

async function getRecentLogs(limit = 5) {
  const res = await db.query(
    'SELECT waktu, username, full_name, pesan FROM logs ORDER BY id DESC LIMIT $1',
    [limit]
  );
  return res.rows;
}

module.exports = {
  isAdmin,
  getStats,
  getRecentLogs,
};
