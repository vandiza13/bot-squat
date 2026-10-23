const { Bot, InlineKeyboard, Keyboard } = require('grammy');
const config = require('./config');
const {
  formatStartHelp,
  formatAdminPanel,
  formatMultipleSearchResults,
  formatNearbyRadar,
  formatCorrectionDiff,
  formatAdminCorrectionReview,
  parseCoordinates,
  escapeHtml,
} = require('./formatters/messageFormatter');
const { catatLog } = require('./services/logService');
const { isAdmin, getStats, getRecentLogs } = require('./services/adminService');
const {
  EDITABLE_FIELDS,
  generateCorrectionTemplate,
  parseCorrectionInput,
  createCorrectionTicket,
  getCorrectionTicket,
  updateTicketNewData,
  approveCorrection,
  rejectCorrection,
} = require('./services/correctionService');
const {
  fetchSiteById,
  getSiteRawData,
  searchFSI,
  searchUMT,
  searchMTEL,
  searchTSEL,
  searchOLO,
  searchODC,
  searchGlobal,
  searchNearby,
} = require('./services/searchService');
const { syncWitelKeTsel, syncAllSheetsToDb } = require('./services/syncService');

function createBot() {
  if (!config.botToken || config.botToken === 'isi_token_botfather_kamu') {
    console.warn('⚠️ BOT_TOKEN belum diisi atau masih default di .env');
  }

  const bot = new Bot(config.botToken || 'DUMMY_TOKEN');

  // Sesi aktif untuk proses koreksi data teknisi dan admin
  const activeCorrectionSessions = new Map();
  const adminEditSessions = new Map();

  // Helper untuk membuat Tombol Aksi di Bawah Detail Site dengan Warna
  function createSiteKeyboard(lokasiSite, lokasiOdc, odcName, siteId = null, target = 'TSEL') {
    const kb = new InlineKeyboard();
    const siteCoords = parseCoordinates(lokasiSite);
    const odcCoords = parseCoordinates(lokasiOdc);

    // 1. Tombol Navigasi Titik Site (Warna Biru / Primary)
    if (siteCoords) {
      kb.url('📍 Navigasi ke Site', `https://www.google.com/maps?q=${siteCoords.lat},${siteCoords.lon || siteCoords.long}`).primary();
    }

    // 2. Tombol Navigasi Titik ODC (Warna Hijau / Success) - HANYA jika koordinat ODC tersedia
    if (odcCoords) {
      kb.url('🎛️ Peta Titik ODC', `https://www.google.com/maps?q=${odcCoords.lat},${odcCoords.lon || odcCoords.long}`).success();
    }

    if (siteCoords || odcCoords) {
      kb.row();
    }

    // 3. Tombol Cek Seluruh Site di ODC ini (Warna Biru / Primary)
    if (odcName && odcName !== '-' && odcName.trim() !== '') {
      kb.text(`📋 Cek Isi ${odcName.trim()}`, `cek_odc:${odcName.trim()}`).primary().row();
    }

    // 4. Tombol Koreksi Data Teknis (Hanya TSEL)
    if (siteId && (target || '').toUpperCase() === 'TSEL') {
      kb.text('✏️ Koreksi Data', `kor_init:${siteId.trim()}`).row();
    }

    return kb.inline_keyboard.length > 0 ? kb : undefined;
  }

  // Helper membuat keyboard approval untuk admin (Bisa langsung approve atau edit dulu)
  function createAdminApprovalKeyboard(ticketId, isEdited = false) {
    const kb = new InlineKeyboard();
    if (isEdited) {
      kb.text('✅ Setujui (Data Hasil Edit)', `adm_appr_kor:${ticketId}`).success().row();
      kb.text('✏️ Edit Lagi', `adm_edit_kor:${ticketId}`).primary();
      kb.text('❌ Tolak', `adm_rej_kor:${ticketId}`).danger();
    } else {
      kb.text('✅ Setujui Langsung', `adm_appr_kor:${ticketId}`).success().row();
      kb.text('✏️ Edit Dulu Data nya', `adm_edit_kor:${ticketId}`).primary();
      kb.text('❌ Tolak', `adm_rej_kor:${ticketId}`).danger();
    }
    return kb;
  }

  // Helper generate teks editable tiket untuk admin
  function generateEditableTicketText(ticket) {
    const newData = ticket.new_data || {};
    const entries = Object.entries(newData);
    const lines = [];
    for (const [col, val] of entries) {
      const fieldMeta = Object.values(EDITABLE_FIELDS).find((f) => f.column === col);
      const label = fieldMeta ? fieldMeta.label : col.toUpperCase();
      lines.push(`${label} = ${val}`);
    }
    if (ticket.notes && ticket.notes.trim() !== '-' && ticket.notes.trim() !== '') {
      lines.push(`ALASAN = ${ticket.notes}`);
    } else {
      lines.push(`ALASAN = [Tuliskan alasan/catatan perubahan]`);
    }
    return lines.join('\n');
  }

  // Helper meneruskan tiket review ke seluruh admin
  async function broadcastTicketToAdmins(ticket, isEdited = false) {
    const text = formatAdminCorrectionReview(ticket, isEdited);
    const kb = createAdminApprovalKeyboard(ticket.id, isEdited);

    const adminIds = config.adminIds;
    if (!adminIds || adminIds.length === 0) {
      console.warn('⚠️ Tidak ada ADMIN_IDS yang diset di .env untuk menerima tiket koreksi.');
      return;
    }

    for (const adminId of adminIds) {
      try {
        await bot.api.sendMessage(adminId, text, {
          parse_mode: 'HTML',
          reply_markup: kb,
          link_preview_options: { is_disabled: true },
        });
      } catch (err) {
        console.error(`Gagal mengirim tiket #${ticket.ticket_no} ke admin ${adminId}:`, err.message);
      }
    }
  }

  // Memulai alur koreksi data site
  async function startCorrectionFlow(ctx, siteId) {
    const cleanId = (siteId || '').trim();
    if (!cleanId) {
      return ctx.reply('Perintah tidak lengkap. Harap masukkan Site ID yang ingin dikoreksi.\nContoh: <code>/koreksi CKR887</code>', {
        parse_mode: 'HTML',
      });
    }

    const siteData = await getSiteRawData(cleanId);
    if (!siteData) {
      return ctx.reply(`❌ Site ID <code>${escapeHtml(cleanId)}</code> tidak ditemukan di database TSEL.`, {
        parse_mode: 'HTML',
      });
    }

    const template = generateCorrectionTemplate(siteData);
    activeCorrectionSessions.set(ctx.from.id, {
      siteId: siteData.site_id,
      siteData,
      step: 'WAITING_INPUT',
      timestamp: Date.now(),
    });

    return ctx.reply(
      `✏️ <b>FORM KOREKSI DATA TEKNIS SITE:</b> <code>${escapeHtml(siteData.site_id)}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Salin teks di bawah, ubah nilai parameter yang salah (boleh kirim hanya baris yang diubah saja), lalu kirim balik ke bot:\n\n` +
      `<code>${escapeHtml(template)}</code>\n\n` +
      `<i>💡 Ketik /batal kapan saja untuk membatalkan proses koreksi.</i>`,
      {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }
    );
  }

  // Helper membuat Keyboard Interaktif Hasil Radar GPS dengan Warna
  function createNearbyKeyboard(lat, lon, sites = [], odcs = []) {
    const kb = new InlineKeyboard();
    const badges = {
      TSEL: '🔴',
      FSI: '🟠',
      UMT: '🟡',
      MTEL: '🟢',
      OLO: '🔵',
    };

    // Tombol pembuka detail site terdekat (Warna Biru / Primary)
    sites.forEach((site) => {
      const badge = badges[site.target] || '⚪';
      const dist = parseFloat(site.distance_m);
      const distStr = dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`;
      const title = `${badge} [${site.target}] ${site.site_id} (${distStr})`;
      kb.text(title, `p:${site.target}:${site.id}`).primary().row();
    });

    // Tombol cek ODC terdekat (Warna Hijau / Success)
    odcs.forEach((odc) => {
      const dist = parseFloat(odc.distance_m);
      const distStr = dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`;
      kb.text(`🎛️ Isi ${odc.odc_name} (${distStr})`, `cek_odc:${odc.odc_name}`).success().row();
    });

    // Navigasi titik posisi (Biru) & Tutup (Merah / Danger)
    kb.url('🗺️ Lihat Posisi di Peta', `https://www.google.com/maps?q=${lat},${lon}`).primary().row();
    kb.text('❌ Tutup Radar', 'cancel_picker').danger();

    return kb;
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

      kb.text(title, `p:${item.target}:${item.id}`).primary().row();
    });

    kb.text('❌ Tutup Pilihan', 'cancel_picker').danger();
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
    const kb = createSiteKeyboard(res.lokasi, res.lokasiOdc, res.odcName, res.siteId, res.dbTarget || 'TSEL');
    return ctx.reply(res.message, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: kb,
    });
  }

  // Helper tombol Panel Admin dengan Warna
  function createAdminKeyboard() {
    return new InlineKeyboard()
      .text('🔄 Sync Witel ➔ TSEL', 'adm_sync_witel').success()
      .row()
      .text('📥 Sync Seluruh Google Sheet', 'adm_sync_all').primary()
      .row()
      .text('📊 Refresh Statistik', 'adm_refresh_stats').primary()
      .text('📜 5 Log Terakhir', 'adm_recent_logs').primary();
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
      kb.text('👑 Buka Panel Admin', 'adm_open_panel').primary().row();
    }
    kb.text('🛰️ Radar Sekitar Saya', 'ask_radar_location').success().row();
    kb.text('📊 Status Database', 'show_db_status').primary();
    kb.url('💬 Hubungi Admin', 'https://t.me/Vandiza').primary();

    // Menu Tombol Bawah (Reply Keyboard Berwarna seperti bot modern)
    const replyKb = new Keyboard()
      .text('🛰️ Radar Sekitar').success()
      .text('📊 Status Database').primary()
      .row()
      .text('ℹ️ Bantuan').primary()
      .resized();

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

  // /radar & /nearby (Radar Spasial GPS)
  bot.command(['radar', 'nearby'], async (ctx) => {
    const match = (ctx.match || '').trim();

    // Jika user memberikan koordinat langsung: /radar -6.2919, 107.0540
    if (match) {
      const coords = parseCoordinates(match);
      if (coords) {
        await ctx.reply('🛰️ <b>Memindai Radar GPS...</b>\nMencari site dan ODC terdekat dalam radius...', {
          parse_mode: 'HTML',
        });
        const res = await searchNearby(coords.lat, coords.lon || coords.long);
        if (!res.success) {
          return ctx.reply(res.message || 'Gagal memproses radar spasial.');
        }
        const message = formatNearbyRadar(res.lat, res.lon, res.sites, res.odcs);
        const kb = createNearbyKeyboard(res.lat, res.lon, res.sites, res.odcs);
        return ctx.reply(message, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_markup: kb,
        });
      }
    }

    // Jika tanpa parameter koordinat, tampilkan tombol minta lokasi dengan warna Hijau (Success)
    const replyKb = new Keyboard()
      .requestLocation('📍 Kirim Titik GPS Saya').success()
      .resized()
      .oneTime();

    await ctx.reply(
      `🛰️ <b>RADAR SPASIAL INFRASTRUKTUR</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Fitur ini memindai seluruh <b>Site TSEL, FSI, UMT, MTEL, OLO, dan ODC</b> terdekat dari posisi Anda.\n\n` +
      `<b>Cara Penggunaan:</b>\n` +
      `1. Ketuk tombol <b>"📍 Kirim Titik GPS Saya"</b> di bawah.\n` +
      `2. Atau kirimkan Pin Lokasi dari menu lampiran (📎) Telegram.\n` +
      `3. Atau ketik koordinat langsung, contoh: <code>/radar -6.2919, 107.0540</code>`,
      {
        parse_mode: 'HTML',
        reply_markup: replyKb,
      }
    );
  });

  // /koreksi (Bisa dipanggil langsung: /koreksi CKR887)
  bot.command('koreksi', async (ctx) => {
    const siteId = ctx.match?.trim();
    await startCorrectionFlow(ctx, siteId);
  });

  // /batal (Batalkan sesi koreksi atau admin edit)
  bot.command('batal', async (ctx) => {
    let canceled = false;
    if (activeCorrectionSessions.has(ctx.from?.id)) {
      activeCorrectionSessions.delete(ctx.from.id);
      canceled = true;
    }
    if (adminEditSessions.has(ctx.from?.id)) {
      adminEditSessions.delete(ctx.from.id);
      canceled = true;
    }
    if (canceled) {
      return ctx.reply('❌ Proses telah dibatalkan.');
    }
    return ctx.reply('Tidak ada proses atau sesi yang sedang aktif.');
  });

  // Handler Pesan Lokasi (Native Location Sharing / Pin Point)
  bot.on('message:location', async (ctx) => {
    const loc = ctx.message.location;
    if (!loc) return;

    await ctx.reply('🛰️ <b>Memindai Radar GPS...</b>\nMencari site dan ODC terdekat dari posisi Anda...', {
      parse_mode: 'HTML',
    });

    try {
      const res = await searchNearby(loc.latitude, loc.longitude);
      if (!res.success) {
        return ctx.reply(res.message || 'Gagal memproses radar spasial.');
      }

      const message = formatNearbyRadar(res.lat, res.lon, res.sites, res.odcs);
      const kb = createNearbyKeyboard(res.lat, res.lon, res.sites, res.odcs);

      await ctx.reply(message, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: kb,
      });
    } catch (err) {
      console.error('Error on message:location:', err);
      await ctx.reply('Terjadi kesalahan saat memproses titik lokasi.');
    }
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
        const kb = createSiteKeyboard(res.lokasi, res.lokasiOdc, res.odcName, res.siteId, res.dbTarget || target);
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

    // Aksi Klik Radar dari Menu /start
    if (data === 'ask_radar_location') {
      await ctx.answerCallbackQuery();
      const replyKb = new Keyboard()
        .requestLocation('📍 Kirim Titik GPS Saya').success()
        .resized()
        .oneTime();

      return ctx.reply(
        '🛰️ <b>Ketuk tombol "📍 Kirim Titik GPS Saya" di bawah</b> untuk memindai seluruh site & ODC di sekitar lokasi Anda saat ini:',
        {
          parse_mode: 'HTML',
          reply_markup: replyKb,
        }
      );
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

    // Aksi Klik Tombol [ ✏️ Koreksi Data ] pada Detail Site
    if (data.startsWith('kor_init:')) {
      const siteId = data.split(':')[1];
      await ctx.answerCallbackQuery({ text: `Membuka form koreksi ${siteId}...` });
      return startCorrectionFlow(ctx, siteId);
    }

    // Aksi Konfirmasi Kirim Tiket Koreksi oleh Teknisi
    if (data === 'kor_submit') {
      const session = activeCorrectionSessions.get(userId);
      if (!session || !session.pendingResult) {
        await ctx.answerCallbackQuery({ text: 'Sesi koreksi sudah kedaluwarsa.' });
        try {
          await ctx.editMessageText('<i>Sesi koreksi telah kedaluwarsa. Silakan ketik /koreksi kembali.</i>', { parse_mode: 'HTML' });
        } catch (e) {}
        return;
      }

      await ctx.answerCallbackQuery({ text: 'Mengirim tiket koreksi ke Admin...' });

      const from = ctx.from;
      const reporterUsername = from.username || '';
      const reporterName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.first_name || 'Teknisi';

      try {
        const ticket = await createCorrectionTicket({
          targetTable: 'tsel',
          siteId: session.siteId,
          siteName: session.siteData.site_name || '-',
          reporterId: userId,
          reporterUsername,
          reporterName,
          oldData: session.pendingResult.oldData,
          newData: session.pendingResult.newData,
          notes: session.pendingResult.notes || '',
        });

        activeCorrectionSessions.delete(userId);

        try {
          await ctx.editMessageText(
            `✅ <b>USULAN KOREKSI BERHASIL DIKIRIM KE ADMIN</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `• <b>Nomor Tiket :</b> <code>#${ticket.ticket_no}</code>\n` +
            `• <b>Site ID     :</b> <code>${escapeHtml(ticket.site_id)}</code>\n` +
            `• <b>Status      :</b> 🟡 <i>Menunggu Review Admin</i>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `<i>Anda akan menerima pesan notifikasi di bot ini setelah Admin meninjau usulan data Anda. Terima kasih! 🛡️</i>`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {}

        // Teruskan tiket ke semua admin
        await broadcastTicketToAdmins(ticket);
      } catch (err) {
        console.error('Error creating correction ticket:', err);
        return ctx.reply('❌ Terjadi kesalahan saat menyimpan tiket koreksi.');
      }
      return;
    }

    // Aksi Batal Koreksi oleh Teknisi
    if (data === 'kor_cancel') {
      activeCorrectionSessions.delete(userId);
      await ctx.answerCallbackQuery({ text: 'Koreksi dibatalkan.' });
      try {
        await ctx.editMessageText('<i>Pengajuan koreksi data dibatalkan.</i>', { parse_mode: 'HTML' });
      } catch (e) {}
      return;
    }

    // Aksi Admin Panel (Periksa Hak Akses)
    if (data.startsWith('adm_')) {
      if (!isAdmin(userId)) {
        return ctx.answerCallbackQuery({
          text: '⛔ Anda bukan Admin!',
          show_alert: true,
        });
      }

      // 1. Admin: Setujui Koreksi (Langsung atau Setelah Diedit)
      if (data.startsWith('adm_appr_kor:')) {
        const ticketId = data.split(':')[1];
        await ctx.answerCallbackQuery({ text: 'Memproses persetujuan...' });

        try {
          const res = await approveCorrection(ticketId, userId);
          if (res.alreadyProcessed) {
            return ctx.reply(`⚠️ Tiket ini sudah pernah diproses sebelumnya (Status: ${res.status}).`);
          }

          const adminName = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Admin');
          const waktuStr = new Date().toLocaleTimeString('id-ID', { hour12: false });

          try {
            await ctx.editMessageText(
              `✅ <b>TIKET #${escapeHtml(res.ticket.ticket_no)} TELAH DISETUJUI & DB DIPERBARUI</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `• <b>Site ID   :</b> <code>${escapeHtml(res.ticket.site_id)}</code>\n` +
              `• <b>Tabel     :</b> <code>${escapeHtml(res.ticket.target_table.toUpperCase())}</code>\n` +
              `• <b>Status    :</b> 🟢 <b>APPROVED</b>\n` +
              `• <b>Eksekutor :</b> ${escapeHtml(adminName)} pada <code>${waktuStr} WIB</code>\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `<i>Seluruh parameter yang disetujui telah langsung aktif di database.</i>`,
              { parse_mode: 'HTML' }
            );
          } catch (e) {}

          // Notifikasi ke Pelapor (Teknisi)
          if (res.ticket.reporter_id) {
            try {
              await bot.api.sendMessage(
                res.ticket.reporter_id,
                `🎉 <b>KOREKSI DATA DISETUJUI ADMIN!</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `Usulan koreksi data untuk site <code>${escapeHtml(res.ticket.site_id)}</code> (Tiket: <code>#${res.ticket.ticket_no}</code>) telah <b>DISETUJUI</b> oleh Admin.\n\n` +
                `Database telah resmi diperbarui. Silakan cek kembali dengan mengetik <code>${res.ticket.site_id}</code>.\n` +
                `Terima kasih atas kontribusi dan laporannya! 🛡️`,
                { parse_mode: 'HTML' }
              );
            } catch (e) {
              console.error('Gagal mengirim notif persetujuan ke teknisi:', e.message);
            }
          }
        } catch (err) {
          console.error('Error approving correction ticket:', err);
          return ctx.reply(`❌ Gagal menyetujui tiket: ${err.message}`);
        }
        return;
      }

      // 2. Admin: Edit Data Usulan Sebelum Approve
      if (data.startsWith('adm_edit_kor:')) {
        const ticketId = data.split(':')[1];
        const ticket = await getCorrectionTicket(ticketId);
        if (!ticket) {
          return ctx.answerCallbackQuery({ text: 'Tiket tidak ditemukan.', show_alert: true });
        }

        if (ticket.status !== 'PENDING') {
          return ctx.answerCallbackQuery({ text: `Tiket sudah tidak aktif (Status: ${ticket.status})`, show_alert: true });
        }

        await ctx.answerCallbackQuery({ text: 'Membuka mode edit tiket...' });

        adminEditSessions.set(userId, {
          ticketId: ticket.id,
          ticket,
          step: 'WAITING_ADMIN_EDIT_INPUT',
          timestamp: Date.now(),
        });

        const editableText = generateEditableTicketText(ticket);

        return ctx.reply(
          `✏️ <b>MODE EDIT ADMIN UNTUK TIKET:</b> <code>#${escapeHtml(ticket.ticket_no)}</code>\n` +
          `Site: <code>${escapeHtml(ticket.site_id)}</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Salin teks di bawah, perbaiki nilai parameter yang ingin disesuaikan, lalu kirim kembali ke sini:\n\n` +
          `<code>${escapeHtml(editableText)}</code>\n\n` +
          `<i>💡 Ketik /batal jika ingin keluar dari mode edit.</i>`,
          {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
          }
        );
      }

      // 3. Admin: Tolak Koreksi
      if (data.startsWith('adm_rej_kor:')) {
        const ticketId = data.split(':')[1];
        await ctx.answerCallbackQuery({ text: 'Menolak tiket koreksi...' });

        try {
          const res = await rejectCorrection(ticketId, userId);
          if (res.alreadyProcessed) {
            return ctx.reply(`⚠️ Tiket ini sudah pernah diproses sebelumnya (Status: ${res.status}).`);
          }

          const adminName = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Admin');
          const waktuStr = new Date().toLocaleTimeString('id-ID', { hour12: false });

          try {
            await ctx.editMessageText(
              `❌ <b>TIKET #${escapeHtml(res.ticket.ticket_no)} DITOLAK OLEH ADMIN</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `• <b>Site ID   :</b> <code>${escapeHtml(res.ticket.site_id)}</code>\n` +
              `• <b>Status    :</b> 🔴 <b>REJECTED</b>\n` +
              `• <b>Reviewer  :</b> ${escapeHtml(adminName)} pada <code>${waktuStr} WIB</code>\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `<i>Database tidak mengalami perubahan.</i>`,
              { parse_mode: 'HTML' }
            );
          } catch (e) {}

          // Notifikasi ke Pelapor (Teknisi)
          if (res.ticket.reporter_id) {
            try {
              await bot.api.sendMessage(
                res.ticket.reporter_id,
                `⚠️ <b>KOREKSI DATA TIDAK DISETUJUI</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `Usulan koreksi data Anda untuk site <code>${escapeHtml(res.ticket.site_id)}</code> (Tiket: <code>#${res.ticket.ticket_no}</code>) <b>TIDAK DISETUJUI</b> oleh Admin.\n` +
                `Database tetap menggunakan data sebelumnya. Jika ada pertanyaan silakan hubungi Admin.`,
                { parse_mode: 'HTML' }
              );
            } catch (e) {
              console.error('Gagal mengirim notif penolakan ke teknisi:', e.message);
            }
          }
        } catch (err) {
          console.error('Error rejecting correction ticket:', err);
          return ctx.reply(`❌ Gagal menolak tiket: ${err.message}`);
        }
        return;
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

  // Default Pencarian Global & Auto-Detect Koordinat GPS
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!text || text.startsWith('/')) return;

    // 1. Cek apakah Admin sedang dalam sesi Edit Data Tiket
    if (adminEditSessions.has(ctx.from.id)) {
      const session = adminEditSessions.get(ctx.from.id);
      const parsed = parseCorrectionInput(text, session.ticket.old_data);

      if (!parsed.hasChanges && !parsed.notes) {
        return ctx.reply('⚠️ Tidak ada perubahan yang terdeteksi. Silakan kirimkan nilai baru yang telah diperbaiki, atau ketik /batal.');
      }

      const mergedNewData = { ...session.ticket.new_data, ...parsed.newData };
      const updatedNotes = parsed.notes || session.ticket.notes;

      try {
        const updatedTicket = await updateTicketNewData(session.ticket.id, mergedNewData, updatedNotes);
        adminEditSessions.delete(ctx.from.id);

        const cardText = formatAdminCorrectionReview(updatedTicket, true);
        const kb = createAdminApprovalKeyboard(updatedTicket.id, true);

        return ctx.reply(cardText, {
          parse_mode: 'HTML',
          reply_markup: kb,
          link_preview_options: { is_disabled: true },
        });
      } catch (err) {
        console.error('Error updating ticket by admin:', err);
        return ctx.reply('❌ Terjadi kesalahan saat menyimpan perubahan edit admin.');
      }
    }

    // 2. Cek apakah Teknisi sedang dalam sesi Pengisian Koreksi Data
    if (activeCorrectionSessions.has(ctx.from.id)) {
      const session = activeCorrectionSessions.get(ctx.from.id);
      if (session.step === 'WAITING_INPUT') {
        const parsed = parseCorrectionInput(text, session.siteData);

        if (!parsed.hasChanges) {
          return ctx.reply(
            '⚠️ <b>Tidak ada perubahan data yang terdeteksi.</b>\n' +
            'Pastikan Anda telah mengubah nilai parameter dari data lama di database.\n' +
            '<i>Ketik /batal jika ingin membatalkan.</i>',
            { parse_mode: 'HTML' }
          );
        }

        session.pendingResult = parsed;
        session.step = 'WAITING_CONFIRMATION';

        const diffText = formatCorrectionDiff(parsed.changes, parsed.notes);
        const confirmKb = new InlineKeyboard()
          .text('🚀 Kirim ke Admin', 'kor_submit').success()
          .row()
          .text('❌ Batalkan', 'kor_cancel').danger();

        return ctx.reply(
          `🔍 <b>RINGKASAN USULAN KOREKSI (Site: <code>${escapeHtml(session.siteId)}</code>)</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Ditemukan <b>${parsed.changes.length} data</b> yang akan diusulkan:\n\n` +
          `${diffText}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Apakah Anda yakin ingin mengirimkan usulan ini ke Admin untuk di-review?`,
          {
            parse_mode: 'HTML',
            reply_markup: confirmKb,
            link_preview_options: { is_disabled: true },
          }
        );
      }
    }

    // Shortcut dari Reply Keyboard Bawah (Berwarna)
    if (text === '🛰️ Radar Sekitar') {
      const replyKb = new Keyboard()
        .requestLocation('📍 Kirim Titik GPS Saya').success()
        .resized()
        .oneTime();
      return ctx.reply('🛰️ <b>Ketuk tombol hijau di bawah</b> untuk memindai titik lokasi GPS Anda saat ini:', {
        parse_mode: 'HTML',
        reply_markup: replyKb,
      });
    }

    if (text === '📊 Status Database') {
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

    if (text === 'ℹ️ Bantuan') {
      const userIsAdmin = isAdmin(ctx.from?.id);
      const firstName = ctx.from?.first_name || 'Rekan';
      return ctx.reply(formatStartHelp(firstName, userIsAdmin), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    }

    // Cek apakah teks berupa Koordinat GPS (contoh: -6.2919, 107.0540)
    const coords = parseCoordinates(text);
    if (coords && coords.lat >= -90 && coords.lat <= 90 && coords.lon >= -180 && coords.lon <= 180) {
      await ctx.reply('🛰️ <b>Koordinat GPS Terdeteksi!</b>\nMemindai radar infrastruktur terdekat...', {
        parse_mode: 'HTML',
      });
      try {
        const res = await searchNearby(coords.lat, coords.lon || coords.long);
        if (res.success) {
          const message = formatNearbyRadar(res.lat, res.lon, res.sites, res.odcs);
          const kb = createNearbyKeyboard(res.lat, res.lon, res.sites, res.odcs);
          return ctx.reply(message, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
            reply_markup: kb,
          });
        }
      } catch (err) {
        console.error('Error on auto GPS search:', err);
      }
    }

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
