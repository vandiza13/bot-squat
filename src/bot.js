const { Bot, InlineKeyboard } = require('grammy');
const config = require('./config');
const {
  formatStartHelp,
  formatAdminPanel,
  formatMultipleSearchResults,
  parseCoordinates,
  escapeHtml,
} = require('./formatters/messageFormatter');
const { catatLog } = require('./services/logService');
const { isAdmin, getStats, getRecentLogs } = require('./services/adminService');
const {
  fetchSiteById,
  searchFSI,
  searchUMT,
  searchMTEL,
  searchTSEL,
  searchOLO,
  searchODC,
  searchGlobal,
} = require('./services/searchService');
const { syncWitelKeTsel, syncAllSheetsToDb } = require('./services/syncService');

function createBot() {
  if (!config.botToken || config.botToken === 'isi_token_botfather_kamu') {
    console.warn('⚠️ BOT_TOKEN belum diisi atau masih default di .env');
  }

  const bot = new Bot(config.botToken || 'DUMMY_TOKEN');

  // Helper untuk membuat Tombol Aksi di Bawah Detail Site
  function createSiteKeyboard(lokasiSite, lokasiOdc, odcName) {
    const kb = new InlineKeyboard();
    const siteCoords = parseCoordinates(lokasiSite);
    const odcCoords = parseCoordinates(lokasiOdc);

    // 1. Tombol Lokasi Site (Google Maps)
    if (siteCoords) {
      kb.url('🗺️ Lokasi Site', `https://www.google.com/maps?q=${siteCoords.lat},${siteCoords.lon || siteCoords.long}`);
    }

    // 2. Tombol Lokasi ODC (Google Maps) - HANYA jika koordinat ODC tersedia
    if (odcCoords) {
      kb.url('🎛️ Lokasi ODC', `https://www.google.com/maps?q=${odcCoords.lat},${odcCoords.lon || odcCoords.long}`);
    }

    // 3. Tombol Cek Seluruh Site di ODC ini
    if (odcName && odcName !== '-' && odcName.trim() !== '') {
      kb.row();
      kb.text(`📋 Cek Isi ${odcName.trim()}`, `cek_odc:${odcName.trim()}`);
    }

    return kb.inline_keyboard.length > 0 ? kb : undefined;
  }

  // Helper membuat Keyboard Pilihan Site jika Ditemukan Banyak Hasil (Fuzzy Search)
  function createMultipleSelectionKeyboard(items) {
    const kb = new InlineKeyboard();
    const badges = {
      TSEL: '🔴',
      FSI: '🟠',
      UMT: '🟡',
      MTEL: '🟢',
      OLO: '🔵',
    };

    items.forEach((item) => {
      const badge = badges[item.target] || '⚪';
      const siteId = (item.site_id || '').trim();
      const siteName = (item.site_name || '').trim();

      let title = `${badge} [${item.target}] ${siteId}`;
      if (siteName && siteName.toUpperCase() !== siteId.toUpperCase()) {
        title += ` • ${siteName}`;
      }

      if (title.length > 36) {
        title = title.substring(0, 34) + '..';
      }

      kb.text(title, `p:${item.target}:${item.id}`).row();
    });

    kb.text('❌ Tutup Pilihan', 'cancel_picker');
    return kb;
  }

  // Helper umum untuk merespon hasil pencarian (Single / Multiple / Not Found)
  async function sendSearchResult(ctx, res) {
    if (!res.found) {
      return ctx.reply(res.message, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    }

    if (res.type === 'MULTIPLE') {
      return ctx.reply(formatMultipleSearchResults(res.keyword, res.items), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: createMultipleSelectionKeyboard(res.items),
      });
    }

    // Single Result
    const kb = createSiteKeyboard(res.lokasi, res.lokasiOdc, res.odcName);
    return ctx.reply(res.message, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: kb,
    });
  }

  // Helper tombol Panel Admin
  function createAdminKeyboard() {
    return new InlineKeyboard()
      .text('🔄 Sync Witel ➔ TSEL', 'adm_sync_witel')
      .row()
      .text('📥 Sync Seluruh Google Sheet', 'adm_sync_all')
      .row()
      .text('📊 Refresh Statistik', 'adm_refresh_stats')
      .text('📜 5 Log Terakhir', 'adm_recent_logs');
  }

  // Middleware Logging Semua Pesan Masuk
  bot.use(async (ctx, next) => {
    if (ctx.message && ctx.message.text && ctx.chat) {
      const chatId = ctx.chat.id;
      const text = ctx.message.text;
      const from = ctx.message.from;
      const username = from?.username || '-';
      const firstName = from?.first_name || '';
      const lastName = from?.last_name || '';
      const fullName = (firstName + ' ' + lastName).trim() || '-';

      catatLog(chatId, username, fullName, text).catch(() => {});
    }
    await next();
  });

  // /start & /help (Halaman Pembuka Elegan)
  bot.command(['start', 'help'], async (ctx) => {
    const userIsAdmin = isAdmin(ctx.from?.id);
    const firstName = ctx.from?.first_name || 'Rekan';

    const kb = new InlineKeyboard();
    if (userIsAdmin) {
      kb.text('👑 Buka Panel Admin', 'adm_open_panel').row();
    }
    kb.text('📊 Status Database', 'show_db_status');
    kb.url('💬 Hubungi Admin', 'https://t.me/Vandiza');

    await ctx.reply(formatStartHelp(firstName, userIsAdmin), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: kb,
    });
  });

  // /admin (Hanya Admin)
  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx.from?.id)) {
      return ctx.reply('⛔ <b>Akses Ditolak:</b> Perintah ini hanya dapat diakses oleh Admin.', {
        parse_mode: 'HTML',
      });
    }

    const stats = await getStats();
    await ctx.reply(formatAdminPanel(stats, ctx.from?.first_name), {
      parse_mode: 'HTML',
      reply_markup: createAdminKeyboard(),
    });
  });

  // /stats (Hanya Admin)
  bot.command('stats', async (ctx) => {
    if (!isAdmin(ctx.from?.id)) {
      return ctx.reply('⛔ <b>Akses Ditolak:</b> Perintah ini hanya dapat diakses oleh Admin.', {
        parse_mode: 'HTML',
      });
    }

    const stats = await getStats();
    await ctx.reply(formatAdminPanel(stats, ctx.from?.first_name), {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('📊 Refresh', 'adm_refresh_stats'),
    });
  });

  // /sync (Hanya Admin)
  bot.command('sync', async (ctx) => {
    if (!isAdmin(ctx.from?.id)) {
      return ctx.reply('⛔ <b>Akses Ditolak:</b> Fitur sinkronisasi data hanya dapat dijalankan oleh Admin.', {
        parse_mode: 'HTML',
      });
    }

    await ctx.reply('⏳ <b>Sinkronisasi Berjalan:</b> Memproses Mapping Dinamis Witel Bekasi ke tabel TSEL...', {
      parse_mode: 'HTML',
    });

    try {
      const res = await syncWitelKeTsel();
      await ctx.reply(
        `✅ <b>SINKRONISASI SELESAI!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `➕ Site Baru     : <code>${res.countBaru}</code>\n` +
        `🔄 Site Diupdate : <code>${res.countUpdated}</code>\n` +
        `⏱️ Waktu         : <code>${res.durationSec}</code> detik`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('Sync error:', err);
      await ctx.reply(`❌ <b>Sinkronisasi Gagal:</b>\n<code>${escapeHtml(err.message)}</code>`, {
        parse_mode: 'HTML',
      });
    }
  });

  // /ping (Engine Status)
  bot.command('ping', async (ctx) => {
    const uptimeSec = Math.floor(process.uptime());
    const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const userIsAdmin = isAdmin(ctx.from?.id);

    await ctx.reply(
      `⚡ <b>[ BOT ENGINE STATUS ]</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🟢 <b>Engine:</b> Node.js (${process.version})\n` +
      `🤖 <b>Framework:</b> GrammY (Long Polling)\n` +
      `🗄️ <b>Database:</b> PostgreSQL (Supabase)\n` +
      `👤 <b>Role Anda:</b> ${userIsAdmin ? '👑 Admin' : '👤 Pengguna Biasa'}\n` +
      `⏱️ <b>Uptime:</b> ${uptimeSec} detik\n` +
      `💾 <b>RAM:</b> ${memory} MB\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Google Apps Script webhook saat ini NONAKTIF karena traffic dialihkan ke Node.js.</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // /fsi
  bot.command('fsi', async (ctx) => {
    const query = ctx.match?.trim();
    if (!query) {
      return ctx.reply('Perintah tidak lengkap. Harap masukkan ID atau Nama yang dicari.\nContoh: <code>/fsi NamaSite</code>', {
        parse_mode: 'HTML',
      });
    }
    const res = await searchFSI(query);
    await sendSearchResult(ctx, res);
  });

  // /umt
  bot.command('umt', async (ctx) => {
    const query = ctx.match?.trim();
    if (!query) {
      return ctx.reply('Perintah tidak lengkap. Harap masukkan ID atau Nama yang dicari.\nContoh: <code>/umt NamaSite</code>', {
        parse_mode: 'HTML',
      });
    }
    const res = await searchUMT(query);
    await sendSearchResult(ctx, res);
  });

  // /mtel
  bot.command('mtel', async (ctx) => {
    const query = ctx.match?.trim();
    if (!query) {
      return ctx.reply('Perintah tidak lengkap. Harap masukkan ID atau Nama yang dicari.\nContoh: <code>/mtel NamaSite</code>', {
        parse_mode: 'HTML',
      });
    }
    const res = await searchMTEL(query);
    await sendSearchResult(ctx, res);
  });

  // /tsel
  bot.command('tsel', async (ctx) => {
    const query = ctx.match?.trim();
    if (!query) {
      return ctx.reply('Perintah tidak lengkap. Harap masukkan ID atau Nama yang dicari.\nContoh: <code>/tsel NamaSite</code>', {
        parse_mode: 'HTML',
      });
    }
    const res = await searchTSEL(query);
    await sendSearchResult(ctx, res);
  });

  // /olo
  bot.command('olo', async (ctx) => {
    const query = ctx.match?.trim();
    if (!query) {
      return ctx.reply('Perintah tidak lengkap. Harap masukkan ID atau Nama yang dicari.\nContoh: <code>/olo NamaSite</code>', {
        parse_mode: 'HTML',
      });
    }
    const res = await searchOLO(query);
    await sendSearchResult(ctx, res);
  });

  // /odc
  bot.command('odc', async (ctx) => {
    const query = ctx.match?.trim();
    if (!query) {
      return ctx.reply('Perintah tidak lengkap. Harap masukkan Nama ODC yang dicari.\nContoh: <code>/odc ODC-BKS-01</code>', {
        parse_mode: 'HTML',
      });
    }
    const message = await searchODC(query);
    await ctx.reply(message, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });

  // Callback Query Handling (Tombol Inline)
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;

    // Aksi Klik Pilihan Site (Pencarian Parsial / Fuzzy Search)
    if (data.startsWith('p:')) {
      const parts = data.split(':');
      const target = parts[1];
      const id = parts[2];

      await ctx.answerCallbackQuery({ text: `Memuat data ${target}...` });
      try {
        const res = await fetchSiteById(target, id);
        if (!res || !res.found) {
          return ctx.reply('❌ Maaf, data detail site tidak ditemukan.');
        }
        const kb = createSiteKeyboard(res.lokasi, res.lokasiOdc, res.odcName);
        return ctx.reply(res.message, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_markup: kb,
        });
      } catch (err) {
        console.error('Error fetching site by id:', err);
        return ctx.reply('❌ Gagal memuat data site.');
      }
    }

    // Aksi Tutup Pilihan Hasil Pencarian
    if (data === 'cancel_picker') {
      await ctx.answerCallbackQuery({ text: 'Pencarian ditutup' });
      try {
        await ctx.deleteMessage();
      } catch (e) {
        await ctx.editMessageText('<i>Pencarian ditutup.</i>', { parse_mode: 'HTML' });
      }
      return;
    }

    // Aksi Klik ODC
    if (data.startsWith('cek_odc:')) {
      const odcName = data.split(':')[1];
      await ctx.answerCallbackQuery({ text: `Mencari data ${odcName}...` });
      const message = await searchODC(odcName);
      return ctx.reply(message, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    }

    // Aksi Tampilkan Status Database
    if (data === 'show_db_status') {
      await ctx.answerCallbackQuery();
      const stats = await getStats();
      const totalData = Number(stats.tsel) + Number(stats.fsi) + Number(stats.umt) + Number(stats.mtel) + Number(stats.olo);
      return ctx.reply(
        `📊 <b>[ STATUS DATABASE TERHUBUNG ]</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• 🔴 <b>TSEL Sites :</b> <code>${stats.tsel}</code> record\n` +
        `• 🟠 <b>FSI Sites  :</b> <code>${stats.fsi}</code> record\n` +
        `• 🟡 <b>UMT Sites  :</b> <code>${stats.umt}</code> record\n` +
        `• 🟢 <b>MTEL Sites :</b> <code>${stats.mtel}</code> record\n` +
        `• 🔵 <b>OLO Sites  :</b> <code>${stats.olo}</code> record\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📈 <b>Total Infrastruktur:</b> <code>${totalData}</code> site aktif.\n` +
        `<i>Data tersimpan aman di PostgreSQL Supabase Cloud.</i>`,
        { parse_mode: 'HTML' }
      );
    }

    // Aksi Admin Panel (Periksa Hak Akses)
    if (data.startsWith('adm_')) {
      if (!isAdmin(userId)) {
        return ctx.answerCallbackQuery({
          text: '⛔ Anda bukan Admin!',
          show_alert: true,
        });
      }

      if (data === 'adm_open_panel' || data === 'adm_refresh_stats') {
        const stats = await getStats();
        await ctx.answerCallbackQuery({ text: 'Statistik diperbarui!' });
        try {
          await ctx.editMessageText(formatAdminPanel(stats, ctx.from.first_name), {
            parse_mode: 'HTML',
            reply_markup: createAdminKeyboard(),
          });
        } catch (e) {
          await ctx.reply(formatAdminPanel(stats, ctx.from.first_name), {
            parse_mode: 'HTML',
            reply_markup: createAdminKeyboard(),
          });
        }
      } else if (data === 'adm_sync_witel') {
        await ctx.answerCallbackQuery({ text: 'Memulai sync Witel Bekasi...' });
        await ctx.reply('⏳ <b>Sync Berjalan:</b> Memproses BTS Witel Bekasi...', { parse_mode: 'HTML' });
        try {
          const res = await syncWitelKeTsel();
          await ctx.reply(
            `✅ <b>Sync Witel Selesai!</b>\n➕ Baru: ${res.countBaru} | 🔄 Update: ${res.countUpdated} (${res.durationSec}s)`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {
          await ctx.reply(`❌ <b>Sync Gagal:</b> ${escapeHtml(e.message)}`, { parse_mode: 'HTML' });
        }
      } else if (data === 'adm_sync_all') {
        await ctx.answerCallbackQuery({ text: 'Memulai sync seluruh sheet...' });
        await ctx.reply('⏳ <b>Sync Berjalan:</b> Menarik seluruh tab Google Sheets...', { parse_mode: 'HTML' });
        try {
          const res = await syncAllSheetsToDb();
          await ctx.reply(
            `✅ <b>Sync Seluruh Sheet Selesai!</b>\n` +
            `• TSEL: ${res.tsel || 0}\n• FSI: ${res.fsi || 0}\n• UMT: ${res.umt || 0}\n• MTEL: ${res.mtel || 0}\n• OLO: ${res.olo || 0}`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {
          await ctx.reply(`❌ <b>Sync Gagal:</b> ${escapeHtml(e.message)}`, { parse_mode: 'HTML' });
        }
      } else if (data === 'adm_recent_logs') {
        await ctx.answerCallbackQuery();
        const logs = await getRecentLogs(5);
        if (logs.length === 0) {
          return ctx.reply('Belum ada log aktivitas.');
        }
        const text = logs
          .map((l) => {
            const time = new Date(l.waktu).toLocaleTimeString('id-ID', { hour12: false });
            return `🕒 <code>${time}</code> | <b>${escapeHtml(l.full_name || l.username)}</b>: <i>${escapeHtml(l.pesan)}</i>`;
          })
          .join('\n');
        await ctx.reply(`📜 <b>5 Aktivitas Terakhir:</b>\n━━━━━━━━━━━━━━━━━━━━\n${text}`, {
          parse_mode: 'HTML',
        });
      }
    }
  });

  // Handle Command Lain yang Tidak Dikenal
  bot.hears(/^\/([a-zA-Z0-9_]+)/, async (ctx) => {
    const command = ctx.match[0];
    await ctx.reply(`Perintah '${command}' tidak dikenali.\nGunakan /help.`);
  });

  // Default Pencarian Global (Pesan Biasa / Non-Command)
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!text || text.startsWith('/')) return;

    try {
      const res = await searchGlobal(text);
      await sendSearchResult(ctx, res);
    } catch (err) {
      console.error('Error on global search:', err);
      await ctx.reply('Terjadi kesalahan saat memproses pencarian data.');
    }
  });

  // Global Error Handler
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`⚠️ Error while handling update ${ctx.update.update_id}:`, err.error);
  });

  return bot;
}

module.exports = {
  createBot,
};
