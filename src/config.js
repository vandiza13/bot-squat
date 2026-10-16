require('dotenv').config();

const config = {
  botToken: process.env.BOT_TOKEN,
  databaseUrl: process.env.DATABASE_URL,
  adminIds: (process.env.ADMIN_IDS || "78062880")
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  gasWebappUrl: process.env.GAS_WEBAPP_URL || "",
  spreadsheetId: process.env.SPREADSHEET_ID || "1lybP7L6_T9LUIM4tFCA7UhEgBEq4OllV37_g5RPhLj4",
  witelSpreadsheetId: process.env.WITEL_SPREADSHEET_ID || "1Gmw6tkpM-NIz5j3tofSjOyvzWxhdm11pK4STGR-hEmc",
  googleCredentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
};

module.exports = config;
