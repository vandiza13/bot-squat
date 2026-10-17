require('dotenv').config();

const config = {
  botToken: process.env.BOT_TOKEN || "",
  databaseUrl: process.env.DATABASE_URL || "",
  adminIds: (process.env.ADMIN_IDS || "")
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  gasWebappUrl: process.env.GAS_WEBAPP_URL || "",
  spreadsheetId: process.env.SPREADSHEET_ID || "",
  witelSpreadsheetId: process.env.WITEL_SPREADSHEET_ID || "",
  googleCredentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
};

module.exports = config;
