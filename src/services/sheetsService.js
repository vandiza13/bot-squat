const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let sheetsClient = null;

function getGoogleAuth() {
  if (config.googleCredentialsPath) {
    const credPath = path.isAbsolute(config.googleCredentialsPath)
      ? config.googleCredentialsPath
      : path.join(process.cwd(), config.googleCredentialsPath);

    if (fs.existsSync(credPath)) {
      return new google.auth.GoogleAuth({
        keyFile: credPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    }
  }

  // Cek apakah ada file service-account.json di root project
  const defaultKeyPath = path.join(process.cwd(), 'service-account.json');
  if (fs.existsSync(defaultKeyPath)) {
    return new google.auth.GoogleAuth({
      keyFile: defaultKeyPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  }

  return null;
}

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const auth = getGoogleAuth();
  if (!auth) {
    throw new Error(
      "Koneksi Google Sheets belum dikonfigurasi. Harap isi GAS_WEBAPP_URL di .env atau sediakan file service-account.json"
    );
  }

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

async function fetchSheetValues(spreadsheetId, range, targetName = null) {
  // 1. Prioritaskan GAS_WEBAPP_URL jika tersedia di .env
  if (config.gasWebappUrl) {
    let target = targetName;
    if (!target) {
      if (range.includes('BTS witel bekasi')) target = 'WITEL';
      else if (range.startsWith('FSI')) target = 'FSI';
      else if (range.startsWith('UMT')) target = 'UMT';
      else if (range.startsWith('MTEL')) target = 'MTEL';
      else if (range.startsWith('TSEL')) target = 'TSEL';
      else if (range.startsWith('OLO')) target = 'OLO';
      else target = 'TSEL';
    }

    const separator = config.gasWebappUrl.includes('?') ? '&' : '?';
    const url = `${config.gasWebappUrl}${separator}target=${encodeURIComponent(target)}`;
    
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`Gagal fetch dari GAS Web App (HTTP ${response.status})`);
    }

    const json = await response.json();
    if (json.status === 'error') {
      throw new Error(`GAS WebApp Error: ${json.message}`);
    }

    return json.rows || [];
  }

  // 2. Fallback menggunakan Service Account API
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return res.data.values || [];
}

module.exports = {
  getSheetsClient,
  fetchSheetValues,
};
