const db = require('../db');

async function catatLog(chatId, username, fullName, message) {
  try {
    const query = `
      INSERT INTO logs (chat_id, username, full_name, pesan)
      VALUES ($1, $2, $3, $4)
    `;
    await db.query(query, [
      String(chatId),
      String(username || "-"),
      String(fullName || "-"),
      String(message || ""),
    ]);
  } catch (err) {
    console.error('⚠️ Gagal mencatat log ke database:', err.message);
  }
}

module.exports = {
  catatLog,
};
