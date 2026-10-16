const db = require('../db');
const config = require('../config');
const { fetchSheetValues } = require('./sheetsService');
const { standarisasiNamaODC } = require('../formatters/messageFormatter');

function parseLatLong(raw) {
  if (!raw) return { lat: null, lon: null };
  const parts = String(raw).split(',');
  if (parts.length === 2) {
    const lat = parseFloat(parts[0].trim());
    const lon = parseFloat(parts[1].trim());
    return {
      lat: isNaN(lat) ? null : lat,
      lon: isNaN(lon) ? null : lon,
    };
  }
  return { lat: null, lon: null };
}

function parseIp(raw) {
  if (!raw || raw === '-' || raw.toUpperCase() === 'N/A') return null;
  const trimmed = String(raw).trim();
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function parseIntVal(raw) {
  if (!raw || raw === '-') return null;
  const num = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  return isNaN(num) ? null : num;
}

async function runInChunks(items, chunkSize, workerFn) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map((item, idx) => workerFn(item, i + idx)));
  }
}

async function syncWitelKeTsel() {
  const startTime = Date.now();
  const idWitel = config.witelSpreadsheetId;

  console.log('📡 Menarik data dari Sheet BTS Witel Bekasi...');
  const dataWitel = await fetchSheetValues(idWitel, "'BTS witel bekasi'!A1:ZZ", "WITEL");
  if (!dataWitel || dataWitel.length < 2) {
    throw new Error("Gagal menarik data dari Sheet Witel Bekasi.");
  }

  const headWitel = dataWitel[0].map((h) => (h || "").toString().trim().toUpperCase());
  function getIdx(colName) {
    return headWitel.indexOf(colName.toUpperCase());
  }

  const idxSiteId = getIdx("SITE ID");
  const idxSiteName = getIdx("SITE NAME");
  const idxLonglat = getIdx("LONGLATE");
  const idxSiteClass = getIdx("SITE CLASS");
  const idxBranch = getIdx("DISTRICT");
  const idxSto = getIdx("STO");
  const idxMetro = getIdx("METRO");
  const idxPortMetro = getIdx("PORT METRO");
  const idxAkses = getIdx("AKSES");
  const idxPortConn = getIdx("PORT CONNETION");
  const idxIpOlt = getIdx("IP OLT");
  const idxGpon = getIdx("GPON");
  const idxPortGpon = getIdx("PORT GPON");
  const idxIpOnt = getIdx("IP ONT");
  const idxSnOnt = getIdx("SN ONT");
  const idxEa = getIdx("EA/SUBRACK/CORE");
  const idxOa = getIdx("OA/SUBRACK/CORE");
  const idxNameOdc = getIdx("SITE NAME ODC");
  const idxCapOdc = getIdx("CAPACITY ODC");
  const idxFeederOdc = getIdx("BASTRAY FEEDER DI ODC");
  const idxCoreFeeder = getIdx("CORE FEEDER DI ODC");
  const idxBasDist = getIdx("BASTRAY DISTRIBUSI");
  const idxDistCore = getIdx("DISTRIBUSI/CORE DISTRIBUSI");
  const idxLonglatOdc = getIdx("LONGLAT ODC");
  const idxNameOdp = getIdx("SITE NAME ODP");
  const idxLonglatOdp = getIdx("LONGLAT ODP");
  const idxKet = getIdx("KETERANGAN");

  function getVal(row, i) {
    return (i !== -1 && row[i] !== undefined) ? String(row[i]).trim() : "";
  }

  // Pre-load daftar site_id yang ada di database
  const existingRes = await db.query("SELECT UPPER(site_id) as site_id FROM tsel_sites");
  const tselSet = new Set(existingRes.rows.map((r) => r.site_id).filter(Boolean));

  let countBaru = 0;
  let countUpdated = 0;
  const processedWitelIds = new Set();
  const validRows = [];

  for (let j = 1; j < dataWitel.length; j++) {
    const row = dataWitel[j];
    const siteId = getVal(row, idxSiteId);
    if (!siteId) continue;
    const cleanId = siteId.toUpperCase();
    if (processedWitelIds.has(cleanId)) continue;
    processedWitelIds.add(cleanId);
    validRows.push({ row, cleanId });
  }

  console.log(`⚡ Memproses ${validRows.length} site secara paralel (batch)...`);

  await runInChunks(validRows, 25, async ({ row, cleanId }) => {
    const rawSTO = getVal(row, idxSto);
    const valBranch = getVal(row, idxBranch);
    const valIpOlt = parseIp(getVal(row, idxIpOlt));
    const valSiteClass = getVal(row, idxSiteClass);

    if (tselSet.has(cleanId)) {
      const updates = [];
      const values = [];
      let paramIdx = 1;

      if (valSiteClass && valSiteClass !== "-") {
        updates.push(`site_class = $${paramIdx++}`);
        values.push(valSiteClass);
      }
      if (valBranch && valBranch !== "-") {
        updates.push(`branch = $${paramIdx++}`);
        values.push(valBranch);
      }
      if (valIpOlt) {
        updates.push(`ip_olt = $${paramIdx++}`);
        values.push(valIpOlt);
      }

      if (updates.length > 0) {
        values.push(cleanId);
        await db.query(`UPDATE tsel_sites SET ${updates.join(", ")} WHERE UPPER(site_id) = $${paramIdx}`, values);
        countUpdated++;
      }
    } else {
      const locSite = parseLatLong(getVal(row, idxLonglat));
      const locOdc = parseLatLong(getVal(row, idxLonglatOdc));
      const locOdp = parseLatLong(getVal(row, idxLonglatOdp));

      const insertSql = `
        INSERT INTO tsel_sites (
          site_id, site_name, latitude, longitude, site_class, branch, sto, metro,
          port_metro, akses, port_connection, ip_olt, gpon, port_gpon, ip_ont,
          sn_ont, ea_subrack_core, oa_subrack_core, site_name_odc, capacity_odc,
          bastray_feeder_odc, core_feeder_odc, bastray_distribusi, distribusi_core,
          latitude_odc, longitude_odc, site_name_odp, latitude_odp, longitude_odp, keterangan
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20,
          $21, $22, $23, $24,
          $25, $26, $27, $28, $29, $30
        )
      `;

      await db.query(insertSql, [
        cleanId,
        getVal(row, idxSiteName) || "-",
        locSite.lat,
        locSite.lon,
        valSiteClass || "-",
        valBranch || "-",
        rawSTO || "-",
        getVal(row, idxMetro) || "-",
        getVal(row, idxPortMetro) || "-",
        getVal(row, idxAkses) || "-",
        getVal(row, idxPortConn) || "-",
        valIpOlt,
        getVal(row, idxGpon) || "-",
        getVal(row, idxPortGpon) || "-",
        parseIp(getVal(row, idxIpOnt)),
        getVal(row, idxSnOnt) || "-",
        getVal(row, idxEa) || "-",
        getVal(row, idxOa) || "-",
        standarisasiNamaODC(getVal(row, idxNameOdc), rawSTO),
        parseIntVal(getVal(row, idxCapOdc)),
        getVal(row, idxFeederOdc) || "-",
        getVal(row, idxCoreFeeder) || "-",
        getVal(row, idxBasDist) || "-",
        getVal(row, idxDistCore) || "-",
        locOdc.lat,
        locOdc.lon,
        standarisasiNamaODC(getVal(row, idxNameOdp), rawSTO),
        locOdp.lat,
        locOdp.lon,
        getVal(row, idxKet) || "-",
      ]);
      countBaru++;
      tselSet.add(cleanId);
    }
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  return { success: true, countBaru, countUpdated, durationSec };
}

async function syncAllSheetsToDb() {
  const spreadsheetId = config.spreadsheetId;
  const results = {};

  // 1. Sync FSI (A2:F) -> fsi_sites
  try {
    console.log('📥 [1/5] Menarik data FSI dari Google Sheets...');
    const fsiRows = await fetchSheetValues(spreadsheetId, "FSI!A2:F", "FSI");
    console.log(`📦 FSI: ${fsiRows.length} baris diterima. Mengupdate database...`);

    const existingFsi = await db.query("SELECT UPPER(site_id) as site_id FROM fsi_sites");
    const fsiSet = new Set(existingFsi.rows.map((r) => r.site_id).filter(Boolean));

    const validFsi = fsiRows.filter((r) => r[0] || r[1]);
    let fsiCount = 0;

    await runInChunks(validFsi, 25, async (r) => {
      const cleanId = String(r[0] || "").trim();
      const cleanUpper = cleanId.toUpperCase();
      const loc = parseLatLong(r[2]);

      if (fsiSet.has(cleanUpper)) {
        await db.query(
          `UPDATE fsi_sites SET site_name = $1, latitude = $2, longitude = $3, sto = $4, ring = $5, keterangan = $6 WHERE UPPER(site_id) = $7`,
          [r[1] || "-", loc.lat, loc.lon, r[3] || "-", r[4] || "-", r[5] || "-", cleanUpper]
        );
      } else {
        await db.query(
          `INSERT INTO fsi_sites (site_id, site_name, latitude, longitude, sto, ring, keterangan)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [cleanId, r[1] || "-", loc.lat, loc.lon, r[3] || "-", r[4] || "-", r[5] || "-"]
        );
        fsiSet.add(cleanUpper);
      }
      fsiCount++;
    });
    console.log(`✅ [1/5] FSI selesai (${fsiCount} baris).`);
    results.fsi = fsiCount;
  } catch (e) {
    console.error('❌ Gagal sync FSI:', e.message);
    results.fsiError = e.message;
  }

  // 2. Sync UMT (A2:G) -> umt_sites
  try {
    console.log('📥 [2/5] Menarik data UMT dari Google Sheets...');
    const umtRows = await fetchSheetValues(spreadsheetId, "UMT!A2:G", "UMT");
    console.log(`📦 UMT: ${umtRows.length} baris diterima. Mengupdate database...`);

    const existingUmt = await db.query("SELECT UPPER(site_id) as site_id FROM umt_sites");
    const umtSet = new Set(existingUmt.rows.map((r) => r.site_id).filter(Boolean));

    const validUmt = umtRows.filter((r) => r[0] || r[1]);
    let umtCount = 0;

    await runInChunks(validUmt, 25, async (r) => {
      const cleanId = String(r[0] || "").trim();
      const cleanUpper = cleanId.toUpperCase();
      const loc = parseLatLong(r[2]);

      if (umtSet.has(cleanUpper)) {
        await db.query(
          `UPDATE umt_sites SET site_name = $1, latitude = $2, longitude = $3, sto = $4, ring = $5, keterangan = $6 WHERE UPPER(site_id) = $7`,
          [r[1] || "-", loc.lat ? String(loc.lat) : null, loc.lon ? String(loc.lon) : null, r[3] || "-", r[4] || "-", r[6] || "-", cleanUpper]
        );
      } else {
        await db.query(
          `INSERT INTO umt_sites (site_id, site_name, latitude, longitude, sto, ring, keterangan)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [cleanId, r[1] || "-", loc.lat ? String(loc.lat) : null, loc.lon ? String(loc.lon) : null, r[3] || "-", r[4] || "-", r[6] || "-"]
        );
        umtSet.add(cleanUpper);
      }
      umtCount++;
    });
    console.log(`✅ [2/5] UMT selesai (${umtCount} baris).`);
    results.umt = umtCount;
  } catch (e) {
    console.error('❌ Gagal sync UMT:', e.message);
    results.umtError = e.message;
  }

  // 3. Sync MTEL (A2:E) -> mtel_sites
  try {
    console.log('📥 [3/5] Menarik data MTEL dari Google Sheets...');
    const mtelRows = await fetchSheetValues(spreadsheetId, "MTEL!A2:E", "MTEL");
    console.log(`📦 MTEL: ${mtelRows.length} baris diterima. Mengupdate database...`);

    const existingMtel = await db.query("SELECT UPPER(site_id) as site_id FROM mtel_sites");
    const mtelSet = new Set(existingMtel.rows.map((r) => r.site_id).filter(Boolean));

    const validMtel = mtelRows.filter((r) => r[0] || r[1]);
    let mtelCount = 0;

    await runInChunks(validMtel, 25, async (r) => {
      const cleanId = String(r[0] || "").trim();
      const cleanUpper = cleanId.toUpperCase();
      const loc = parseLatLong(r[2]);

      if (mtelSet.has(cleanUpper)) {
        await db.query(
          `UPDATE mtel_sites SET site_name = $1, latitude = $2, longitude = $3, sto = $4, keterangan = $5 WHERE UPPER(site_id) = $6`,
          [r[1] || "-", loc.lat, loc.lon, r[3] || "-", r[4] || "-", cleanUpper]
        );
      } else {
        await db.query(
          `INSERT INTO mtel_sites (site_id, site_name, latitude, longitude, sto, keterangan)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [cleanId, r[1] || "-", loc.lat, loc.lon, r[3] || "-", r[4] || "-"]
        );
        mtelSet.add(cleanUpper);
      }
      mtelCount++;
    });
    console.log(`✅ [3/5] MTEL selesai (${mtelCount} baris).`);
    results.mtel = mtelCount;
  } catch (e) {
    console.error('❌ Gagal sync MTEL:', e.message);
    results.mtelError = e.message;
  }

  // 4. Sync TSEL (A2:AA) -> tsel_sites
  try {
    console.log('📥 [4/5] Menarik data TSEL dari Google Sheets...');
    const tselRows = await fetchSheetValues(spreadsheetId, "TSEL!A2:AA", "TSEL");
    console.log(`📦 TSEL: ${tselRows.length} baris diterima. Mengupdate database...`);

    const existingTsel = await db.query("SELECT UPPER(site_id) as site_id FROM tsel_sites");
    const tselSet = new Set(existingTsel.rows.map((r) => r.site_id).filter(Boolean));

    const validTsel = tselRows.filter((r) => r[0] || r[1]);
    let tselCount = 0;

    await runInChunks(validTsel, 25, async (r) => {
      const cleanId = String(r[0] || "").trim();
      const cleanUpper = cleanId.toUpperCase();
      const loc = parseLatLong(r[2]);
      const locOdc = parseLatLong(r[23]);
      const locOdp = parseLatLong(r[25]);

      if (tselSet.has(cleanUpper)) {
        await db.query(
          `UPDATE tsel_sites SET
            site_name = $1, latitude = $2, longitude = $3, site_class = $4, branch = $5,
            sto = $6, metro = $7, port_metro = $8, akses = $9, port_connection = $10,
            ip_olt = $11, gpon = $12, port_gpon = $13, ip_ont = $14, sn_ont = $15,
            ea_subrack_core = $16, oa_subrack_core = $17, site_name_odc = $18, capacity_odc = $19,
            bastray_feeder_odc = $20, core_feeder_odc = $21, bastray_distribusi = $22,
            distribusi_core = $23, latitude_odc = $24, longitude_odc = $25, site_name_odp = $26,
            latitude_odp = $27, longitude_odp = $28, keterangan = $29
          WHERE UPPER(site_id) = $30`,
          [
            r[1] || "-", loc.lat, loc.lon, r[3] || "-", r[4] || "-",
            r[5] || "-", r[6] || "-", r[7] || "-", r[8] || "-", r[9] || "-",
            parseIp(r[10]), r[11] || "-", r[12] || "-", parseIp(r[13]), r[14] || "-",
            r[15] || "-", r[16] || "-", r[17] || "-", parseIntVal(r[18]),
            r[19] || "-", r[20] || "-", r[21] || "-",
            r[22] || "-", locOdc.lat, locOdc.lon, r[24] || "-",
            locOdp.lat, locOdp.lon, r[26] || "-",
            cleanUpper
          ]
        );
      } else {
        await db.query(
          `INSERT INTO tsel_sites (
            site_id, site_name, latitude, longitude, site_class, branch, sto, metro,
            port_metro, akses, port_connection, ip_olt, gpon, port_gpon, ip_ont,
            sn_ont, ea_subrack_core, oa_subrack_core, site_name_odc, capacity_odc,
            bastray_feeder_odc, core_feeder_odc, bastray_distribusi, distribusi_core,
            latitude_odc, longitude_odc, site_name_odp, latitude_odp, longitude_odp, keterangan
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20,
            $21, $22, $23, $24,
            $25, $26, $27, $28, $29, $30
          )`,
          [
            cleanId, r[1] || "-", loc.lat, loc.lon, r[3] || "-", r[4] || "-",
            r[5] || "-", r[6] || "-", r[7] || "-", r[8] || "-", r[9] || "-",
            parseIp(r[10]), r[11] || "-", r[12] || "-", parseIp(r[13]), r[14] || "-",
            r[15] || "-", r[16] || "-", r[17] || "-", parseIntVal(r[18]),
            r[19] || "-", r[20] || "-", r[21] || "-",
            r[22] || "-", locOdc.lat, locOdc.lon, r[24] || "-",
            locOdp.lat, locOdp.lon, r[26] || "-"
          ]
        );
        tselSet.add(cleanUpper);
      }
      tselCount++;
      if (tselCount % 300 === 0) {
        console.log(`   ⏳ TSEL progress: ${tselCount}/${validTsel.length} baris...`);
      }
    });
    console.log(`✅ [4/5] TSEL selesai (${tselCount} baris).`);
    results.tsel = tselCount;
  } catch (e) {
    console.error('❌ Gagal sync TSEL:', e.message);
    results.tselError = e.message;
  }

  // 5. Sync OLO (A2:W) -> olo (replace agar tidak duplikat)
  try {
    console.log('📥 [5/5] Menarik data OLO dari Google Sheets...');
    const oloRows = await fetchSheetValues(spreadsheetId, "OLO!A2:W", "OLO");
    console.log(`📦 OLO: ${oloRows.length} baris diterima. Mengupdate database...`);

    const validOlo = oloRows.filter((r) => r[0] || r[1] || r[2]);
    await db.query("DELETE FROM olo");

    let oloCount = 0;
    await runInChunks(validOlo, 25, async (r) => {
      await db.query(
        `INSERT INTO olo (
          sid, isp_name, cust_name, lokasi, sto, metro, port_metro,
          ip_gpon_sw, gpon_sw, port_gpon, sn_ont, vlan, bw, layanan,
          odc, odp, keterangan
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17
        )`,
        [
          r[0] || "-", r[1] || "-", r[2] || "-", r[3] || "-",
          r[4] || "-", r[5] || "-", r[6] || "-",
          r[7] || "-", r[8] || "-", r[9] || "-",
          r[10] || "-", r[11] || "-", r[12] || "-",
          r[13] || "-", r[14] || "-", r[21] || "-",
          r[22] || "-",
        ]
      );
      oloCount++;
    });
    console.log(`✅ [5/5] OLO selesai (${oloCount} baris).`);
    results.olo = oloCount;
  } catch (e) {
    console.error('❌ Gagal sync OLO:', e.message);
    results.oloError = e.message;
  }

  return results;
}

module.exports = {
  syncWitelKeTsel,
  syncAllSheetsToDb,
};
