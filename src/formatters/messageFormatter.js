function escapeHtml(text) {
  if (text == null) return "";
  return text
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseCoordinates(rawString) {
  if (!rawString) return null;
  const parts = rawString.toString().split(",");
  if (parts.length === 2) {
    const lat = parseFloat(parts[0].trim());
    const long = parseFloat(parts[1].trim());
    if (!isNaN(lat) && !isNaN(long)) {
      return { lat, long };
    }
  }
  return null;
}

function getLokasiString(row) {
  if (row.latitude && row.longitude) {
    return `${String(row.latitude).trim()}, ${String(row.longitude).trim()}`;
  }
  return row.lokasi || null;
}

function standarisasiNamaODC(namaRaw, kodeSTO) {
  if (!namaRaw) return "-";
  let text = namaRaw.toString().toUpperCase().trim();
  const sto = (kodeSTO || "").toString().toUpperCase().trim();

  if (text.startsWith("ODC") && sto && !text.includes(sto)) {
    text = text.replace("ODC", "ODC " + sto);
  } else if (text.startsWith("ODP") && sto && !text.includes(sto)) {
    text = text.replace("ODP", "ODP " + sto);
  }

  const regex = /^(ODC|ODP)[\s_\-\/]*([A-Z]+)[\s_\-\/]*([A-Z0-9]+)$/;
  const match = text.match(regex);
  if (match) {
    return match[1] + "-" + match[2] + "-" + match[3];
  }
  return text.replace(/[\s_\/]+/g, "-").replace(/-+/g, "-");
}

function formatStartHelp(userName = "Rekan", isAdminUser = false) {
  let msg = 
    `🛰️ <b>SQUAT INTELLIGENT ASSISTANT</b>\n` +
    `<i>Sistem Informasi Infrastruktur Jaringan & Database Site</i>\n\n` +
    `<blockquote>Selamat datang, <b>${escapeHtml(userName)}</b>! 👋\n` +
    `Asisten ini dirancang untuk memudahkan pencarian identitas site, konektivitas perangkat, topologi ODC/ODP.</blockquote>\n\n` +
    `📋 <b>KATALOG PERINTAH PENCARIAN</b>\n` +
    `┌ 🔴 <b>TSEL</b> ➔ <code>/tsel [ID / Nama Site]</code>\n` +
    `├ 🟠 <b>FSI</b>  ➔ <code>/fsi [ID / Nama Site]</code>\n` +
    `├ 🟡 <b>UMT</b>  ➔ <code>/umt [ID / Nama Site]</code>\n` +
    `├ 🟢 <b>MTEL</b> ➔ <code>/mtel [ID / Nama Site]</code>\n` +
    `├ 🔵 <b>OLO</b>  ➔ <code>/olo [SID / Cust Name]</code>\n` +
    `└ 🟣 <b>ODC</b>  ➔ <code>/odc [Nama ODC]</code>\n\n` +
    `⚡ <b>Pencarian Cepat (Global):</b>\n` +
    `<blockquote>Ketik langsung ID atau Nama Site (contoh: <code>BKX253</code>) tanpa garis miring. Sistem akan otomatis memindai seluruh database secara presisi.</blockquote>\n\n`;

  if (isAdminUser) {
    msg += 
      `👑 <b>MENU ADMINISTRATOR AKTIF:</b>\n` +
      `• <code>/admin</code> ➔ Panel Kontrol Admin Terpadu\n` +
      `• <code>/sync</code>  ➔ Sinkronisasi Otomatis Witel Bekasi\n` +
      `• <code>/stats</code> ➔ Laporan Statistik Data & Trafik\n\n`;
  }

  msg += 
    `<blockquote>🛡️ <b>Engine:</b> PostgreSQL Supabase Cloud\n` +
    `👨💻 <b>Managed by:</b> <a href="https://t.me/Vandiza">Tubagus Paradisa</a></blockquote>`;

  return msg;
}

function formatAdminPanel(stats, adminName) {
  return (
    `👑 <b>[ EXECUTIVE ADMIN CONTROL PANEL ]</b>\n` +
    `<blockquote>Selamat bertugas, <b>${escapeHtml(adminName || "Admin")}</b>! 👋\n` +
    `Sistem berjalan optimal di lingkungan Node.js & Supabase Cloud.</blockquote>\n\n` +
    `📊 <b>STATUS DATA INFRASTRUKTUR</b>\n` +
    `┌ 🔴 <b>TSEL Sites</b> : <code>${stats.tsel}</code> record\n` +
    `├ 🟠 <b>FSI Sites</b>  : <code>${stats.fsi}</code> record\n` +
    `├ 🟡 <b>UMT Sites</b>  : <code>${stats.umt}</code> record\n` +
    `├ 🟢 <b>MTEL Sites</b> : <code>${stats.mtel}</code> record\n` +
    `└ 🔵 <b>OLO Sites</b>  : <code>${stats.olo}</code> record\n\n` +
    `📈 <b>METRIK AKTIVITAS BOT</b>\n` +
    `┌ ⚡ <b>Pencarian Hari Ini</b> : <code>${stats.searchesToday}</code> kueri\n` +
    `├ 📊 <b>Total Pencarian</b>    : <code>${stats.totalSearches}</code> kueri\n` +
    `└ 👥 <b>Pengguna Terdaftar</b> : <code>${stats.totalUsers}</code> user\n\n` +
    `<i>Pilih tombol tindakan di bawah ini:</i>`
  );
}

function formatFSI(row) {
  const siteId = escapeHtml(row.site_id || row.id_tenant || "-");
  const siteName = escapeHtml(row.site_name || "-");
  const lokasi = escapeHtml(getLokasiString(row) || "-");
  const sto = escapeHtml(row.sto || "-");
  const ring = escapeHtml(row.ring || "-");
  const ket = escapeHtml(row.keterangan || "-");

  return `🏢 <b>[ DATA FSI ]</b>
<b>ID Tenant</b> = <code>${siteId}</code>
<b>Site Name</b> = ${siteName}
<b>Lokasi</b> = <code>${lokasi}</code>
<b>STO</b> = ${sto}
<b>RING</b> = ${ring}
========================
<b>Keterangan</b> = <i>${ket}</i>
========================

🛡️ Powered by Vandiza`;
}

function formatUMT(row) {
  const siteId = escapeHtml(row.site_id || "-");
  const siteName = escapeHtml(row.site_name || "-");
  const lokasi = escapeHtml(getLokasiString(row) || "-");
  const sto = escapeHtml(row.sto || "-");
  const ring = escapeHtml(row.ring || "N/A");
  const linkText = row.link_file
    ? `\n<b>Link File</b> = <a href="${row.link_file}">Download KMZ</a>`
    : "";
  const ket = escapeHtml(row.keterangan || "-");

  return `🏢 <b>[ DATA UMT ]</b>
<b>Site ID</b> = <code>${siteId}</code>
<b>Site Name</b> = ${siteName}
<b>Lokasi</b> = <code>${lokasi}</code>
<b>STO</b> = ${sto}
<b>Ring</b> = ${ring}${linkText}
========================
<b>Keterangan</b> = <i>${ket}</i>
========================

🛡️ Powered by Vandiza`;
}

function formatMTEL(row) {
  const siteId = escapeHtml(row.site_id || row.id_tenant || "-");
  const siteName = escapeHtml(row.site_name || "-");
  const lokasi = escapeHtml(getLokasiString(row) || "-");
  const sto = escapeHtml(row.sto || "-");
  const ket = escapeHtml(row.keterangan || "-");

  return `🏢 <b>[ DATA MTEL ]</b>
<b>ID Tenant</b> = <code>${siteId}</code>
<b>Site Name</b> = ${siteName}
<b>Lokasi</b> = <code>${lokasi}</code>
========================
<b>STO</b> = ${sto}
========================
<b>Keterangan</b> = <i>${ket}</i>
========================

🛡️ Powered by Vandiza`;
}

function formatTSEL(row) {
  const sId = escapeHtml(row.site_id || "-");
  const sName = escapeHtml(row.site_name || "-");
  const sLoc = escapeHtml(getLokasiString(row) || "-");
  const sClass = escapeHtml(row.site_class || "-");
  const sBranch = escapeHtml(row.branch || "-");
  const sSto = escapeHtml(row.sto || "-");
  const sMetro = escapeHtml(row.metro || "-");
  const sPMetro = escapeHtml(row.port_metro || "-");
  const sAkses = escapeHtml(row.akses || "-");
  const sPConn = escapeHtml(row.port_connection || "-");
  const sIpOlt = escapeHtml(row.ip_olt || "-");
  const sGpon = escapeHtml(row.gpon || "-");
  const sPGpon = escapeHtml(row.port_gpon || "-");
  const sIpOnt = escapeHtml(row.ip_ont || "-");
  const sSnOnt = escapeHtml(row.sn_ont || "-");
  const sEa = escapeHtml(row.ea_subrack_core || row.ea || "-");
  const sOa = escapeHtml(row.oa_subrack_core || row.oa || "-");
  const sOdc = escapeHtml(row.site_name_odc || row.odc || "-");
  const sCapOdc = escapeHtml(row.capacity_odc != null ? String(row.capacity_odc) : (row.cap_odc || "-"));
  const sFdOdc = escapeHtml(row.bastray_feeder_odc || row.feeder_odc || "-");
  const sCrFd = escapeHtml(row.core_feeder_odc || row.core_feeder || "-");
  const sBsDist = escapeHtml(row.bastray_distribusi || row.bastray_dist || "-");
  const sDsCore = escapeHtml(row.distribusi_core || row.distribusi || "-");
  
  const locOdc = (row.latitude_odc && row.longitude_odc)
    ? `${row.latitude_odc}, ${row.longitude_odc}`
    : (row.lokasi_odc || "-");
  const sLocOdc = escapeHtml(locOdc);

  const sOdp = escapeHtml(row.site_name_odp || row.odp || "-");
  const locOdp = (row.latitude_odp && row.longitude_odp)
    ? `${row.latitude_odp}, ${row.longitude_odp}`
    : (row.lokasi_odp || "-");
  const sLocOdp = escapeHtml(locOdp);

  const sKet = escapeHtml(row.keterangan || "-");

  return `🏢 <b>[ IDENTITAS SITE ]</b>
<b>Site ID</b> = <code>${sId}</code>
<b>Site Name</b> = ${sName}
<b>Longlate</b> = <code>${sLoc}</code>
<b>Site Class</b> = ${sClass}

⚙️ <b>[ KONEKTIVITAS & PERANGKAT ]</b>
========================
<b>BRANCH</b> = ${sBranch}
<b>STO</b> = <b>${sSto}</b>
<b>METRO</b> = ${sMetro}
<b>Port METRO</b> = <code>${sPMetro}</code>
<b>Akses</b> = ${sAkses}
<b>Port Connection</b> = ${sPConn}
<b>IP OLT</b> = <code>${sIpOlt}</code>
<b>GPON</b> = ${sGpon}
<b>Port GPON</b> = <code>${sPGpon}</code>
<b>Ip ONT</b> = <code>${sIpOnt}</code>
<b>SN ONT</b> = <code>${sSnOnt}</code>

🗄️ <b>[ CORE STO / RACK ]</b>
========================
<b>EA/SUB/CORE</b> = ${sEa}
<b>OA/SUB/CORE</b> = ${sOa}

🎛️ <b>[ JARINGAN ODC ]</b>
========================
<b>ODC</b> = <code>${sOdc}</code>
<b>Cap ODC</b> = ${sCapOdc}
<b>Feeder ODC</b> = ${sFdOdc}
<b>Core Feeder</b> = ${sCrFd}
<b>Bastray Dist</b> = ${sBsDist}
<b>Distribusi</b> = ${sDsCore}
<b>Longlate ODC</b> = <code>${sLocOdc}</code>

📍 <b>[ JARINGAN ODP ]</b>
========================
<b>ODP</b> = <code>${sOdp}</code>
<b>Longlate ODP</b> = <code>${sLocOdp}</code>

📝 <b>[ KETERANGAN ]</b>
========================
<i>${sKet}</i>

🛡️ Powered by Vandiza`;
}

function formatOLO(row) {
  return `🏢 <b>[ DATA OLO ]</b>
<b>SID</b> = <code>${escapeHtml(row.sid || "-")}</code>
<b>ISP Name</b> = ${escapeHtml(row.isp_name || "-")}
<b>Cust Name</b> = ${escapeHtml(row.cust_name || "-")}
<b>Longlate</b> = <code>${escapeHtml(getLokasiString(row) || "-")}</code>

⚙️ <b>[ KONEKTIVITAS ]</b>
========================
<b>STO</b> = <b>${escapeHtml(row.sto || "-")}</b>
<b>METRO</b> = ${escapeHtml(row.metro || "-")}
<b>Port METRO</b> = <code>${escapeHtml(row.port_metro || "-")}</code>
<b>IP GPON/SW</b> = <code>${escapeHtml(row.ip_gpon_sw || "-")}</code>
<b>GPON/SW</b> = ${escapeHtml(row.gpon_sw || "-")}
<b>Port GPON</b> = <code>${escapeHtml(row.port_gpon || "-")}</code>
<b>SN ONT</b> = <code>${escapeHtml(row.sn_ont || "-")}</code>
<b>VLAN</b> = <code>${escapeHtml(row.vlan || "-")}</code>
<b>BW</b> = ${escapeHtml(row.bw || "-")}
<b>Layanan</b> = ${escapeHtml(row.layanan || "-")}

🎛️ <b>[ ODC / ODP ]</b>
========================
<b>ODC</b> = <code>${escapeHtml(row.site_name_odc || row.odc || "-")}</code>
<b>ODP</b> = <code>${escapeHtml(row.site_name_odp || row.odp || "-")}</code>
========================
🛡️ Powered by Vandiza`;
}

function formatODC(query, listTSEL = [], listOLO = []) {
  let resultText = `<b>[ HASIL PENCARIAN ODC ]</b>\nTarget: <code>${escapeHtml(query)}</code>\n\n`;
  let found = false;

  if (listTSEL.length > 0) {
    const formattedTSEL = listTSEL
      .slice(0, 40)
      .map((r) => `• <code>${escapeHtml(r.site_id || "-")}</code> - ${escapeHtml(r.site_name || "-")}`)
      .join("\n");
    resultText += `<b>📂 TSEL (${listTSEL.length} Site):</b>\n${formattedTSEL}\n\n`;
    found = true;
  }

  if (listOLO.length > 0) {
    const formattedOLO = listOLO
      .slice(0, 40)
      .map((r) => `• <code>${escapeHtml(r.sid || r.site_id || "-")}</code> - ${escapeHtml(r.cust_name || r.isp_name || r.site_name || "-")}`)
      .join("\n");
    resultText += `<b>📂 OLO (${listOLO.length} Site):</b>\n${formattedOLO}\n\n`;
    found = true;
  }

  if (!found) {
    return `ODC dengan nama PERSIS '${escapeHtml(query)}' tidak ditemukan.`;
  }

  resultText += `========================\n\n🛡️ Powered by Vandiza`;
  return resultText;
}

function formatMultipleSearchResults(keyword, items, totalCount) {
  const count = items.length;
  return (
    `🔍 <b>HASIL PENCARIAN KATA KUNCI</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Ditemukan <b>${totalCount || count} data</b> yang cocok dengan:\n` +
    `👉 <code>${escapeHtml(keyword)}</code>\n\n` +
    `<blockquote>Silakan klik tombol site di bawah untuk melihat rincian spesifikasi, perangkat & navigasi lokasi:</blockquote>`
  );
}

module.exports = {
  escapeHtml,
  parseCoordinates,
  getLokasiString,
  standarisasiNamaODC,
  formatStartHelp,
  formatAdminPanel,
  formatMultipleSearchResults,
  formatFSI,
  formatUMT,
  formatMTEL,
  formatTSEL,
  formatOLO,
  formatODC,
};

